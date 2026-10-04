import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(TEST_DIR, '..');
const FIXTURE_PATH = join(TEST_DIR, 'fixtures', 'replies.json');
const failures = [];
let passed = 0;

function source(pathFromRoot) {
  return readFileSync(join(ROOT, pathFromRoot), 'utf8');
}

function json(pathFromRoot) {
  return JSON.parse(source(pathFromRoot));
}

function walk(directory, predicate = () => true) {
  if (!existsSync(directory)) return [];
  const entries = [];
  for (const name of readdirSync(directory)) {
    const absolute = join(directory, name);
    const info = statSync(absolute);
    if (info.isDirectory()) entries.push(...walk(absolute, predicate));
    else if (predicate(absolute)) entries.push(absolute);
  }
  return entries;
}

async function test(name, callback) {
  try {
    await callback();
    passed += 1;
    console.log(`\u2713 ${name}`);
  } catch (error) {
    failures.push({ name, error });
    console.error(`\u2717 ${name}`);
    console.error(`  ${error?.stack || error}`.replaceAll('\n', '\n  '));
  }
}

function assertLocalFile(pathFromRoot, label = pathFromRoot) {
  assert.ok(pathFromRoot && typeof pathFromRoot === 'string', `${label} must be a path`);
  assert.ok(!/^(?:https?:)?\/\//i.test(pathFromRoot), `${label} must be packaged locally`);
  assert.ok(existsSync(join(ROOT, pathFromRoot)), `${label} does not exist: ${pathFromRoot}`);
}

function htmlTagAttributes(html, tagName) {
  const tags = html.match(new RegExp(`<${tagName}\\b[^>]*>`, 'gi')) || [];
  return tags.map((tag) => {
    const attributes = {};
    for (const match of tag.matchAll(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
      attributes[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
    }
    return { tag, attributes };
  });
}

function discoverTestApi() {
  const candidates = [
    'content/region-data.js',
    'content/bili-english-dictionary.js',
    'content/core.js',
    'content/content.js',
    'content/page-bridge.js'
  ].filter((path) => existsSync(join(ROOT, path)));

  const sandbox = {
    console: { log() {}, warn() {}, error() {}, debug() {} },
    setTimeout() { return 0; },
    clearTimeout() {},
    URL,
    Intl,
    Date,
    TextEncoder,
    TextDecoder,
    CustomEvent: class CustomEvent {
      constructor(type, options = {}) { this.type = type; this.detail = options.detail; }
    },
    Event: class Event { constructor(type) { this.type = type; } },
    location: { href: 'https://www.bilibili.com/', origin: 'https://www.bilibili.com', pathname: '/' },
    navigator: { language: 'zh-CN' },
    chrome: {
      runtime: {
        id: 'test-extension',
        getURL: (value) => `chrome-extension://test-extension/${value}`,
        sendMessage: () => Promise.resolve(),
        onMessage: { addListener() {} }
      },
      storage: {
        local: {
          get: (_defaults, callback) => {
            const value = {};
            if (typeof callback === 'function') callback(value);
            return Promise.resolve(value);
          },
          set: () => Promise.resolve()
        },
        onChanged: { addListener() {} }
      }
    },
    MutationObserver: class MutationObserver { observe() {} disconnect() {} },
    ResizeObserver: class ResizeObserver { observe() {} disconnect() {} },
    fetch: async () => ({ clone() { return this; }, json: async () => ({}) }),
    XMLHttpRequest: class XMLHttpRequest {
      addEventListener() {}
      open() {}
    }
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.document = {
    readyState: 'complete',
    body: { appendChild() {}, classList: { add() {}, remove() {}, toggle() {} } },
    head: { appendChild() {} },
    documentElement: { appendChild() {}, classList: { add() {}, remove() {}, toggle() {} } },
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return true; },
    createElement(tagName) {
      return {
        tagName: String(tagName).toUpperCase(),
        dataset: {},
        style: {},
        classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
        addEventListener() {},
        remove() {},
        appendChild() {},
        setAttribute() {},
        removeAttribute() {}
      };
    },
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };

  const context = vm.createContext(sandbox);
  for (const pathFromRoot of candidates) {
    try {
      const code = source(pathFromRoot);
      new vm.Script(code, { filename: pathFromRoot }).runInContext(context, { timeout: 1_000 });
    } catch {
      // A browser-only entry point may need APIs beyond these conservative stubs.
      // The implementation can still publish the hook from another candidate file.
    }
  }

  const apiNames = [
    '__BILI_ASSISTANT_TEST__',
    '__BILI_ASSISTANT_PAGE_TEST__',
    '__BILI_ASSISTANT_CONTENT_TEST__',
    '__BILI_ENHANCER_TEST__',
    '__BILI_HELPER_TEST__',
    '__BILI_TEST__'
  ];
  const discovered = {};
  for (const name of apiNames) {
    if (sandbox[name] && typeof sandbox[name] === 'object') Object.assign(discovered, sandbox[name]);
  }
  return Object.keys(discovered).length ? discovered : null;
}

function pickFunction(api, names) {
  for (const name of names) {
    if (typeof api?.[name] === 'function') return api[name].bind(api);
  }
  return null;
}

function normalizeRecord(value) {
  const rawLocation = value?.location ?? value?.ipLocation ?? value?.ip_location ?? '';
  return {
    rpid: String(value?.rpid ?? value?.rpidStr ?? value?.rpid_str ?? value?.id ?? ''),
    ctime: Number(value?.ctime ?? value?.timestamp ?? value?.time ?? 0),
    location: String(rawLocation || '').replace(/^IP\s*属地\s*[：:]\s*/u, '').trim()
  };
}

await test('manifest is a tightly scoped Manifest V3 extension', () => {
  const manifest = json('manifest.json');
  assert.equal(manifest.manifest_version, 3);
  assert.match(manifest.version, /^\d+\.\d+\.\d+(?:\.\d+)?$/);
  assert.ok(manifest.name?.trim());
  assert.ok(manifest.description?.trim());

  const permissions = new Set(manifest.permissions || []);
  for (const permission of permissions) {
    assert.ok(['storage', 'unlimitedStorage'].includes(permission), `unexpected permission: ${permission}`);
  }
  assert.ok(permissions.has('storage'), 'storage permission is required for settings');
  assert.deepEqual(manifest.host_permissions || [], [], 'host_permissions should not be needed');

  assertLocalFile(manifest.background?.service_worker, 'background service worker');
  assertLocalFile(manifest.options_ui?.page, 'options page');
  assert.equal(manifest.options_ui?.open_in_tab, true, 'the custom options UI should open in a full tab');

  const contentScripts = manifest.content_scripts || [];
  assert.ok(contentScripts.length > 0, 'missing content_scripts');
  const expectedBilibiliMatches = ['https://bilibili.com/*', 'https://*.bilibili.com/*'];
  const biliScript = contentScripts.find((entry) =>
    expectedBilibiliMatches.every((pattern) => (entry.matches || []).includes(pattern))
  );
  assert.ok(biliScript, 'content script must cover Bilibili and its subdomains, including message.bilibili.com');
  assert.equal(
    biliScript.run_at,
    'document_start',
    'message-centre network interception must begin before its initial reply feed loads'
  );
  for (const entry of contentScripts) {
    for (const pattern of entry.matches || []) {
      assert.ok(expectedBilibiliMatches.includes(pattern), `over-broad content-script match: ${pattern}`);
    }
    for (const path of [...(entry.js || []), ...(entry.css || [])]) assertLocalFile(path, 'content script asset');
  }
  assert.deepEqual(
    biliScript.js,
    [
      'content/region-data.js',
      'content/bili-english-expanded-dictionary.js',
      'content/bili-english-dictionary.js',
      'content/content.js'
    ],
    'the local region catalogue and UI glossary must load before the content implementation'
  );

  for (const item of manifest.web_accessible_resources || []) {
    for (const path of item.resources || []) assertLocalFile(path, 'web-accessible resource');
    for (const pattern of item.matches || []) {
      assert.ok(expectedBilibiliMatches.includes(pattern), `over-broad web-accessible match: ${pattern}`);
    }
  }

  for (const path of Object.values(manifest.icons || {})) assertLocalFile(path, 'extension icon');
  for (const path of Object.values(manifest.action?.default_icon || {})) assertLocalFile(path, 'action icon');
});

await test('all JavaScript and module files pass Node syntax checking', () => {
  const files = walk(ROOT, (path) => ['.js', '.mjs', '.cjs'].includes(extname(path)))
    .filter((path) => !path.includes(`${join(ROOT, '.git')}`));
  assert.ok(files.length > 0, 'no JavaScript files found');
  for (const path of files) {
    const result = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
    assert.equal(
      result.status,
      0,
      `${relative(ROOT, path)} has invalid syntax:\n${result.stderr || result.stdout}`
    );
  }
});

await test('extension pages obey MV3 CSP and package all executable code locally', () => {
  const manifest = json('manifest.json');
  const csp = manifest.content_security_policy?.extension_pages || '';
  assert.match(csp, /(?:^|;)\s*script-src\s+'self'(?:\s|;|$)/i, 'CSP must limit scripts to self');
  assert.doesNotMatch(csp, /'unsafe-(?:eval|inline)'|\bhttps?:|\bdata:/i);
  assert.match(csp, /(?:^|;)\s*object-src\s+'self'(?:\s|;|$)/i);

  const codeFiles = walk(ROOT, (path) => ['.js', '.mjs', '.cjs'].includes(extname(path)))
    .filter((path) => !path.startsWith(TEST_DIR));
  for (const path of codeFiles) {
    const text = readFileSync(path, 'utf8');
    assert.doesNotMatch(text, /\beval\s*\(|\bnew\s+Function\s*\(|\bFunction\s*\(\s*["'`]/, `${relative(ROOT, path)} uses dynamic code`);
    assert.doesNotMatch(text, /\b(?:importScripts|import)\s*\(\s*["'`]https?:\/\//i, `${relative(ROOT, path)} loads remote code`);
  }

  const htmlFiles = walk(ROOT, (path) => extname(path) === '.html');
  assert.ok(htmlFiles.length > 0, 'custom options HTML is missing');
  for (const path of htmlFiles) {
    const html = readFileSync(path, 'utf8');
    assert.doesNotMatch(html, /<script\b(?![^>]*\bsrc\s*=)[^>]*>[\s\S]*?<\/script>/i, `${relative(ROOT, path)} contains inline JavaScript`);
    assert.doesNotMatch(html, /\son\w+\s*=/i, `${relative(ROOT, path)} contains an inline event handler`);
    for (const { attributes } of [...htmlTagAttributes(html, 'script'), ...htmlTagAttributes(html, 'link')]) {
      const url = attributes.src || attributes.href;
      if (!url) continue;
      assert.doesNotMatch(url, /^(?:https?:)?\/\//i, `${relative(ROOT, path)} loads a remote asset: ${url}`);
      const clean = url.split(/[?#]/, 1)[0];
      assert.ok(existsSync(resolve(dirname(path), clean)), `${relative(ROOT, path)} references missing asset: ${url}`);
    }
  }
});

await test('custom options page exposes the single upload/crop surface, settings, and actions', () => {
  const manifest = json('manifest.json');
  const page = manifest.options_ui?.page;
  assertLocalFile(page, 'options page');
  const html = source(page);
  const requiredIds = [
    'commentsEnabled',
    'showLocation',
    'showExactTime',
    'timezoneShanghai',
    'timezoneLocal',
    'timeFormat',
    'showUnavailableLocation',
    'settingsLanguage',
    'pageLanguageChinese',
    'pageLanguageEnglish',
    'commentTranslationTarget',
    'timePreview',
    'bannerEnabled',
    'bannerHeight',
    'bannerDim',
    'bannerFileInput',
    'cropCanvas',
    'cropStage',
    'zoomRange',
    'resetCropButton',
    'deleteImageButton',
    'outputFormat',
    'outputQuality',
    'restoreDefaultsButton',
    'saveButton',
    'saveStatus'
  ];
  for (const id of requiredIds) {
    assert.match(html, new RegExp(`\\bid=["']${id}["']`), `missing #${id}`);
  }
  assert.match(html, /<input\b[^>]*\bid=["']bannerFileInput["'][^>]*\btype=["']file["'][^>]*>/i);
  assert.match(html, /<input\b[^>]*\bid=["']bannerFileInput["'][^>]*\baccept=["'][^"']*image\//i);
  assert.equal((html.match(/<canvas\b/gi) || []).length, 1, 'only the crop canvas should remain');
  assert.doesNotMatch(html, /\bid=["']dropZone["']/i, 'legacy drag/drop upload surface must be removed');
  assert.doesNotMatch(html, /\bid=["']bannerPreviewCanvas["']/i, 'duplicate upper preview must be removed');
  assert.match(html, /id=["']cropStage["'][^>]*role=["']button["']/i, 'crop surface must be the upload button');
  const optionsCss = source('options/options.css');
  assert.match(optionsCss, /\.crop-empty\[hidden\][\s\S]*display:\s*none !important/, 'empty crop overlay must disappear after an image is loaded');
  const optionsJs = source('options/options.js');
  assert.match(optionsJs, /suppressNextCropClick/, 'crop dragging must not open the file picker on pointerup');
  assert.match(optionsJs, /elements\.bannerFileInput\.click\(\)/, 'crop stage click must open the file picker for re-upload');
  assert.doesNotMatch(html, /<script\b(?![^>]*\bsrc\s*=)/i, 'options page must not use inline scripts');
  assert.match(html, /src=["']i18n\.js["']/i, 'settings page must load its local UI glossary');
  assert.match(html, /src=["']options\.js["']/i, 'settings page must load its controller');
});

await test('timestamp formatter emits dd/mm/yyyy hh.mm.ss in 24-hour time', () => {
  const api = discoverTestApi();
  assert.ok(api, 'content implementation must expose a test hook such as globalThis.__BILI_ASSISTANT_TEST__');
  const formatTimestamp = pickFunction(api, ['formatTimestamp', 'formatReplyTime', 'formatTime', 'formatDateTime']);
  assert.ok(formatTimestamp, 'test hook is missing a timestamp formatter');

  const timestampSeconds = 1704067200; // 01/01/2024 08.00.00 in Asia/Shanghai.
  let formatted;
  const attempts = [
    () => formatTimestamp(timestampSeconds, 'Asia/Shanghai'),
    () => formatTimestamp(timestampSeconds, { timeZone: 'Asia/Shanghai' }),
    () => formatTimestamp(timestampSeconds, true),
    () => formatTimestamp(timestampSeconds)
  ];
  for (const attempt of attempts) {
    try {
      const value = attempt();
      if (typeof value === 'string' && /^\d{2}\/\d{2}\/\d{4} \d{2}\.\d{2}\.\d{2}$/.test(value)) {
        formatted = value;
        break;
      }
    } catch {}
  }
  assert.ok(formatted, 'formatter output must match dd/mm/yyyy hh.mm.ss');
  assert.equal(formatted, '01/01/2024 08.00.00', 'Shanghai formatter must be deterministic and 24-hour');
  assert.equal(api.formatTimestamp(timestampSeconds, 'Asia/Shanghai', 'yyyy/mm/dd hh:mm:ss'), '2024/01/01 08:00:00');
  assert.equal(api.formatTimestamp(timestampSeconds, 'Asia/Shanghai', 'mm/dd/yyyy hh:mm:ss'), '01/01/2024 08:00:00');

  const leap = 1709164799; // 29/02/2024 07.59.59 in Asia/Shanghai.
  let leapText;
  for (const argument of ['Asia/Shanghai', { timeZone: 'Asia/Shanghai' }, true]) {
    try {
      const value = formatTimestamp(leap, argument);
      if (typeof value === 'string' && /^\d{2}\/\d{2}\/\d{4} \d{2}\.\d{2}\.\d{2}$/.test(value)) {
        leapText = value;
        break;
      }
    } catch {}
  }
  assert.equal(leapText, '29/02/2024 07.59.59');
});

await test('comment metadata follows live/yesterday/date rules and stays plain text', () => {
  const api = discoverTestApi();
  assert.ok(api, 'content implementation must expose a test hook');
  assert.equal(typeof api.formatReplyTime, 'function', 'relative comment-time formatter is missing');
  assert.equal(typeof api.translateLocation, 'function', 'location translation helper is missing');

  const now = new Date(Date.UTC(2026, 9, 4, 4, 0, 0)); // 04/10/2026 12.00.00 CST.
  const yesterday = Math.floor(Date.UTC(2026, 9, 3, 4, 5, 6) / 1000);
  const twoDaysAgo = Math.floor(Date.UTC(2026, 9, 2, 4, 5, 6) / 1000);
  const today = Math.floor(Date.UTC(2026, 9, 4, 2, 29, 59) / 1000);

  assert.equal(api.formatReplyTime(yesterday, 'Asia/Shanghai', 'zh-CN', now), '昨天 12.05.06');
  assert.equal(api.formatReplyTime(yesterday, 'Asia/Shanghai', 'en', now), 'Yesterday 12.05.06');
  assert.equal(api.formatReplyTime(twoDaysAgo, 'Asia/Shanghai', 'zh-CN', now), '02/10/2026 12.05.06');
  assert.equal(api.formatReplyTime(twoDaysAgo, 'Asia/Shanghai', 'zh-CN', now, 'yyyy/mm/dd hh:mm:ss'), '2026/10/02 12:05:06');
  assert.equal(api.formatReplyTime(today, 'Asia/Shanghai', 'zh-CN', now), '1小时30分钟01秒前');
  assert.equal(api.formatReplyTime(today, 'Asia/Shanghai', 'en', now), '1 hour 30 minutes 01 second ago');
  assert.equal(api.translateLocation('江苏', 'en'), 'Jiangsu');
  assert.equal(api.translateLocation('斯里兰卡', 'en'), 'Sri Lanka');
  assert.equal(api.translateLocation('中国香港', 'en'), 'Hong Kong SAR China');
  assert.equal(api.translateLocation('中国澳门', 'en'), 'Macao SAR China');
  assert.equal(api.translateLocation('中国台湾', 'en'), 'Taiwan');
  assert.equal(api.translateLocation('江苏', 'zh-CN'), '江苏');

  const content = source('content/content.js');
  const css = source('content/content.css');
  assert.match(content, /IP:\s*\$\{translateLocation/, 'metadata must use English colon plus a space');
  assert.match(content, /findCommentContentAnchor/, 'metadata must mount from the comment content anchor');
  assert.match(content, /updateLiveCommentTimes/, 'today-relative timestamps must update without full refreshes');
  assert.match(content, /bce-original-time-hidden/, 'default Bilibili time should be hidden when custom time is present');
  assert.match(css, /\.bce-original-time-hidden\s*\{\s*display:\s*none !important;/, 'default-time hiding style is missing');
  assert.match(css, /\.bce-comment-meta,[\s\S]*\.bce-message-meta\s*\{[\s\S]*display:\s*flex !important;/, 'metadata should be a content-aligned block row');
  assert.doesNotMatch(css, /--bce-meta-bg|\.bce-ip-location::before|border-radius:\s*5px/, 'metadata must not be rendered as a filled pill');
});

await test('settings and Bilibili language choices are independent and local', () => {
  const options = source('options/options.js');
  const localGlossary = source('content/bili-english-dictionary.js');
  assert.match(options, /settingsLanguage:\s*raw\.settingsLanguage/, 'settings language must be saved independently');
  assert.match(options, /pageLanguage:\s*raw\.pageLanguage/, 'Bilibili page language must be saved independently');
  assert.match(options, /translationEnabled:\s*asBoolean\(raw\.translationEnabled/, 'manual translation must have an independent persisted switch');
  assert.match(options, /commentTranslationTarget:[\s\S]*raw\.commentTranslationTarget/, 'comment target language must be saved separately');
  assert.match(options, /pageLanguage:\s*elements\.pageLanguageEnglish\.checked/, 'page-language radio choice must be persisted');
  assert.match(options, /settingsLanguage:\s*elements\.settingsLanguage\.value/, 'settings-language selector must be persisted');
  assert.match(localGlossary, /BCE_BILI_ENGLISH_DICTIONARY/, 'local Bilibili glossary is missing');
  assert.doesNotMatch(localGlossary, /https?:\/\//i, 'local glossary must not call a network translation service');
});

await test('fixed UI translation handles late menus and local manual comment translation', () => {
  const api = discoverTestApi();
  const content = source('content/content.js');
  const css = source('content/content.css');
  const dictionary = source('content/bili-english-dictionary.js');
  const options = source('options/options.html');
  assert.match(dictionary, /'新番时间表':\s*'New Anime Schedule'/, 'new anime fly-out label is missing');
  assert.match(dictionary, /'国创动画索引':\s*'Chinese Animation Index'/, 'Chinese animation fly-out label is missing');
  assert.match(dictionary, /'历史':\s*'History'/, 'history label is missing');
  assert.match(content, /TRANSLATABLE_ATTRIBUTE_NAMES/, 'hover-label attributes must be scanned');
  assert.match(content, /root\.querySelectorAll\('\*'\)/, 'all open shadow roots must be discovered');
  assert.match(css, /\[data-bce-localized-ui="true"\][\s\S]*letter-spacing:\s*normal !important;/, 'translated UI needs a scoped letter-spacing reset');
  assert.match(content, /globalThis\.Translator/, 'manual translation must use the browser translation API when present');
  assert.match(content, /interceptTranslationInteraction/, 'comment translation must require an explicit captured click');
  assert.match(content, /window\.addEventListener\(eventName, interceptTranslationInteraction, true\)/, 'translation clicks must be captured before Bilibili routers');
  assert.match(content, /event\.preventDefault\(\)/, 'translation clicks must stay on the current Bilibili page');
  assert.match(content, /event\.stopPropagation\(\)/, 'translation clicks must not bubble into Bilibili routers');
  assert.match(content, /commentContentByMeta/, 'manual translation must retain the exact mounted body anchor');
  assert.match(content, /data-bce-original-comment-hidden/, 'comment replies must preserve their original framework-owned DOM while translated');
  assert.match(content, /bce-manual-translation-content/, 'comment replies need an extension-owned translated output node');
  assert.match(content, /copyCommentTextColor/, 'translated replies must preserve the source text contrast');
  assert.match(content, /setProperty\('color', color, 'important'\)/, 'translated reply color must win over page theme overrides');
  assert.match(content, /cachedContent\?\.isConnected/, 'message replies must retain the first verified complete body anchor');
  assert.doesNotMatch(content, /button\.append\(icon, text\)/, 'translation button must not show a text label');
  assert.match(content, /assets\/icons\/google-translate\.svg/, 'translation button must use the bundled Google Material translate SVG');
  assert.match(content, /replaceVisibleCommentText/, 'manual comment translation must replace the visible original text');
  assert.match(content, /TITLE_TRANSLATION_ENABLED\s*=\s*false/, 'video title translation must be explicitly disabled');
  assert.match(content, /if \(!TITLE_TRANSLATION_ENABLED\)/, 'disabled title translation needs a guarded cleanup path');
  assert.doesNotMatch(content, /TITLE_TRANSLATION_ENABLED\s*=\s*true/, 'video title translation must stay disabled');
  assert.equal(api?.BILI_ENGLISH_DICTIONARY?.ui?.['删除该通知'], 'Delete this notification');
  assert.equal(api?.BILI_ENGLISH_DICTIONARY?.ui?.['个人观点，仅供参考'], 'Personal opinion, for reference only');
  assert.equal(api?.BILI_ENGLISH_DICTIONARY?.ui?.['输入关键字搜索'], 'Search by keyword');
  assert.equal(api?.BILI_ENGLISH_DICTIONARY?.ui?.['三农'], 'Agriculture');
  assert.equal(api?.BILI_ENGLISH_DICTIONARY?.ui?.['系统消息'], 'System notifications');
  assert.doesNotMatch(content, /fetch\s*\(/, 'comment translation must not silently call a remote service');
  assert.match(options, /id="commentTranslationTarget"/, 'settings page needs a target-language control');
  assert.match(options, /id="translationEnabled"/, 'settings page needs an independent manual-translation switch');
});

await test('reply extraction handles nested fixtures, 64-bit IDs, timestamps, and optional public locations', () => {
  const api = discoverTestApi();
  assert.ok(api, 'content implementation must expose a test hook such as globalThis.__BILI_ASSISTANT_TEST__');
  const fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));
  const extractOne = pickFunction(api, ['extractReply', 'normalizeReply', 'replyToRecord']);
  const extractMany = pickFunction(api, ['extractReplyRecords', 'extractReplies', 'collectReplies', 'collectReplyRecords', 'walkReplies']);
  assert.ok(extractOne || extractMany, 'test hook is missing a reply extraction function');

  if (extractOne) {
    for (const item of fixture.cases) {
      const actual = normalizeRecord(extractOne(item.reply));
      assert.deepEqual(actual, item.expected, item.name);
    }
  }

  if (extractMany) {
    let output = extractMany(fixture.payload);
    if (output instanceof Map) output = [...output.values()];
    else if (!Array.isArray(output) && output && typeof output === 'object') output = Object.values(output);
    assert.ok(Array.isArray(output), 'multi-reply extractor must return an array, Map, or plain object');
    const records = output.map(normalizeRecord).filter((record) => record.rpid);
    for (const item of fixture.cases) {
      const actual = records.find((record) => record.rpid === item.expected.rpid);
      assert.deepEqual(actual, item.expected, item.name);
    }
  }
});

await test('banner implementation has resilient Bilibili selectors and applies only on the homepage', () => {
  const api = discoverTestApi();
  assert.ok(api, 'content implementation must expose a test hook such as globalThis.__BILI_ASSISTANT_TEST__');
  const selectors = api.BANNER_SELECTORS ?? api.bannerSelectors ?? api.BANNER_SELECTOR ?? api.bannerSelector;
  const list = Array.isArray(selectors)
    ? selectors
    : typeof selectors === 'string'
      ? selectors.split(',')
      : selectors && typeof selectors === 'object'
        ? Object.values(selectors).flatMap((value) => Array.isArray(value) ? value : [value])
        : [];
  assert.ok(list.length >= 2, 'at least two fallback banner selectors are required for Bilibili markup changes');
  assert.ok(list.every((item) => typeof item === 'string' && item.trim()), 'banner selectors must be non-empty strings');
  assert.ok(list.some((item) => /bili-header|header/i.test(item)), 'selectors should target Bilibili header markup');
  assert.ok(list.some((item) => /banner/i.test(item)), 'selectors should target banner markup');

  const content = source('content/content.js');
  assert.match(content, /location\.pathname|pathname/, 'banner replacement must check the current pathname');
  assert.match(content, /(?:===?\s*["']\/["']|isHome(?:Page)?)/, 'banner replacement must be homepage-only');
  assert.doesNotMatch(content, /mousemove|pointermove/i, 'custom static banner must not recreate mouse-following parallax');
  assert.match(source('content/content.css'), /bili-header__logo/, 'custom banner should hide the redundant homepage logo link');
});

await test('message-centre replies receive public IP, time, and an icon-only manual translation control', () => {
  const api = discoverTestApi();
  const content = source('content/content.js');
  const bridge = source('content/page-bridge.js');
  assert.match(content, /isMessageReplyPage/, 'message-centre route detection is missing');
  assert.match(content, /renderMessageReplyItems/, 'message-centre reply renderer is missing');
  assert.match(content, /MESSAGE_REPLY_PREFIX/, 'message rows must identify the actual Reply @user body rather than a broad content wrapper');
  assert.match(content, /\.msg-item|\.talk-item|interaction-item__msg/, 'message rows must support alternate notification skins');
  assert.match(content, /MESSAGE_RELATIVE_TIME_PATTERN/, 'message rows must support Today/Yesterday timestamps');
  assert.match(content, /parentMessageItem/, 'nested quoted messages must not receive a second metadata row');
  assert.match(content, /messageReplyTimeElements/, 'message rows must discover timestamps even when Vue hashes the time class');
  assert.match(content, /`IP: \$\{translateLocation\(record\.location/, 'message-centre IP location must be rendered when supplied');
  assert.match(bridge, /isMessageReplyEndpoint/, 'message feed network response must be recognized');
  assert.equal(
    api?.isMessageReplyEndpoint?.('https://api.vc.bilibili.com/x/im/web/msgfeed/reply'),
    true,
    'new message-centre API path must be recognized'
  );
  assert.ok(
    content.indexOf("window.addEventListener('message', handlePageBridgeMessage)") < content.lastIndexOf('injectPageBridge();'),
    'bridge receiver must be registered before page-world interception starts'
  );
  assert.match(bridge, /requestMessageReplyDetail/, 'message reply must resolve its public comment detail');
  assert.match(bridge, /hydrateMessageReplyRecords/, 'message reply data must be fetched once even when Vue loaded before interception');
  assert.match(bridge, /credentials: 'include'/, 'Bilibili detail lookup must use the current Bilibili session only');
  assert.match(content, /existing\?\.status === 'loading'/, 'translation must be single-flight across virtual-list redraws');
  assert.match(content, /previous\.ctime !== merged\.ctime/, 'identical bridge records must not trigger a full metadata redraw');
  assert.doesNotMatch(content, /if \(mutation\.addedNodes\.length \|\| mutation\.removedNodes\.length\)\s*\{\s*shouldRefresh = true;/, 'generic page mutations must not trigger a full metadata redraw loop');
  assert.doesNotMatch(bridge, /setInterval\s*\(/, 'page bridge must not perpetually poll renderer hosts');
  assert.match(content, /translate-request-v118/, 'translation requests need an isolated channel after extension reloads');
  assert.match(bridge, /translate-request-v118/, 'page bridge must receive only the current translation channel');
  const contentCss = source('content/content.css');
  assert.match(contentCss, /data-bce-message-content="true"[\s\S]*white-space:\s*normal/, 'message replies must wrap instead of using a one-line ellipsis');
  assert.match(contentCss, /data-bce-message-row="true"[\s\S]*overflow:\s*visible/, 'message rows must grow to keep the translation button visible');
  assert.match(contentCss, /data-bce-original-comment-hidden="true"[\s\S]*display:\s*none !important/, 'translated replies must hide the source text from layout');
  assert.match(content, /recoverLiveTimeMetas/, 'live clocks must recover after Bilibili recycles an info subtree');
  assert.match(content, /finally\s*\{[\s\S]*scheduleLiveTimeTick\(\)/, 'live clock scheduling must survive an update exception');
  assert.equal(typeof api?.extractMessageReplyNotifications, 'function', 'message feed parser must expose a testable extractor');
  const notifications = api.extractMessageReplyNotifications({
    data: {
      items: [{
        reply_time: 1791042245,
        item: {
          subject_id: 17000001,
          root_id: 70000001,
          source_id: '9007199254740993',
          business_id: 1,
          source_content: '一条消息中心评论'
        }
      }]
    }
  });
  assert.deepEqual(
    JSON.parse(JSON.stringify(notifications.map((item) => ({ rpid: item.rpid, ctime: item.ctime, messageText: item.messageText, lookup: item.lookup })))),
    [{
      rpid: '9007199254740993',
      ctime: 1791042245,
      messageText: '一条消息中心评论',
      lookup: { rpid: '9007199254740993', oid: '17000001', type: 1, root: '70000001' }
    }]
  );
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exitCode = 1;
