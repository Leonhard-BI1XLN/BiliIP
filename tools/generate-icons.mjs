import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'assets', 'icons');
mkdirSync(outDir, { recursive: true });

const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i += 1) {
  let value = i;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  }
  crcTable[i] = value >>> 0;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const output = Buffer.alloc(12 + data.length);
  output.writeUInt32BE(data.length, 0);
  typeBuffer.copy(output, 4);
  data.copy(output, 8);
  output.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return output;
}

function roundedRectContains(x, y, left, top, right, bottom, radius) {
  const closestX = Math.max(left + radius, Math.min(x, right - radius));
  const closestY = Math.max(top + radius, Math.min(y, bottom - radius));
  const dx = x - closestX;
  const dy = y - closestY;
  return dx * dx + dy * dy <= radius * radius;
}

function createPixels(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const radius = size * 0.22;
  const inset = Math.max(1, Math.round(size * 0.045));

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4;
      const inside = roundedRectContains(
        x + 0.5,
        y + 0.5,
        inset,
        inset,
        size - inset,
        size - inset,
        radius,
      );
      if (!inside) continue;

      const mix = (x + y) / Math.max(1, 2 * size - 2);
      pixels[offset] = Math.round(0x00 * (1 - mix) + 0xfb * mix);
      pixels[offset + 1] = Math.round(0xae * (1 - mix) + 0x72 * mix);
      pixels[offset + 2] = Math.round(0xec * (1 - mix) + 0x99 * mix);
      pixels[offset + 3] = 255;
    }
  }

  const isWhiteMark = (x, y) => {
    const nx = x / size;
    const ny = y / size;
    const leftStroke = nx >= 0.27 && nx <= 0.37 && ny >= 0.23 && ny <= 0.77;
    const bars = nx >= 0.32 && nx <= 0.61 && (
      (ny >= 0.23 && ny <= 0.32) ||
      (ny >= 0.455 && ny <= 0.545) ||
      (ny >= 0.68 && ny <= 0.77)
    );
    const rightStroke = nx >= 0.57 && nx <= 0.68 && (
      (ny >= 0.29 && ny <= 0.48) ||
      (ny >= 0.52 && ny <= 0.71)
    );
    const antennaLeft = ny >= 0.13 && ny <= 0.26 && nx - ny * 0.42 >= 0.26 && nx - ny * 0.42 <= 0.33;
    const antennaRight = ny >= 0.13 && ny <= 0.26 && nx + ny * 0.42 >= 0.67 && nx + ny * 0.42 <= 0.74;
    return leftStroke || bars || rightStroke || antennaLeft || antennaRight;
  };

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (!isWhiteMark(x + 0.5, y + 0.5)) continue;
      const offset = (y * size + x) * 4;
      pixels[offset] = 255;
      pixels[offset + 1] = 255;
      pixels[offset + 2] = 255;
      pixels[offset + 3] = 246;
    }
  }

  return pixels;
}

function createPng(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const pixels = createPixels(size);
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0;
    pixels.copy(raw, rowStart + 1, y * size * 4, (y + 1) * size * 4);
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    signature,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of [16, 32, 48, 128]) {
  writeFileSync(join(outDir, `icon-${size}.png`), createPng(size));
}

console.log(`Generated extension icons in ${outDir}`);
