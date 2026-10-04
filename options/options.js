'use strict';

const DEFAULT_PREFS = Object.freeze({
  commentsEnabled: true,
  showLocation: true,
  showExactTime: true,
  timezone: 'Asia/Shanghai',
  timeFormat: 'dd/mm/yyyy hh.mm.ss',
  showUnavailableLocation: false,
  settingsLanguage: 'zh-CN',
  pageLanguage: 'zh-CN',
  translationEnabled: true,
  commentTranslationTarget: 'en',
  bannerEnabled: true,
  bannerImage: '',
  bannerHeight: 180,
  bannerDim: 0
});

const TIME_FORMATS = Object.freeze([
  // BI1XLN
  'dd/mm/yyyy hh.mm.ss',
  'yyyy/mm/dd hh:mm:ss',
  'mm/dd/yyyy hh:mm:ss'
]);

const CROP_WIDTH = 1280;
const CROP_HEIGHT = 120;
const EXPORT_WIDTH = 2560;
const EXPORT_HEIGHT = 240;
const MAX_UPLOAD_BYTES = 40 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 80 * 1000 * 1000;
const TARGET_DATA_URL_BYTES = 4 * 1024 * 1024;
const SUPPORTED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

const elements = {};
let sourceImage = null;
let sourceMeta = null;
let currentBannerDataUrl = '';
let cropState = { zoom: 1, panX: 0, panY: 0 };
let dragState = null;
let suppressNextCropClick = false;
let isDirty = false;
let isSaving = false;
let toastTimer = null;

function t(message) {
  return globalThis.BCE_SETTINGS_I18N?.t(message) ?? message;
}

function setLocalizedText(element, source, suffix = '') {
  if (!element) return;
  element.dataset.bceI18nSource = String(source ?? '');
  element.dataset.bceI18nSuffix = suffix;
  element.textContent = `${t(element.dataset.bceI18nSource)}${suffix}`;
}

function applySettingsLanguage(language) {
  globalThis.BCE_SETTINGS_I18N?.apply(language);
}

document.addEventListener('DOMContentLoaded', init);

async function init() {
  collectElements();
  bindEvents();
  startClock();
  syncCropImageState();

  try {
    const stored = await storageGet('prefs');
    const prefs = normalizePrefs(stored.prefs);
    applyPrefsToForm(prefs);
    currentBannerDataUrl = prefs.bannerImage;

    if (prefs.bannerImage) {
      await loadImageFromUrl(prefs.bannerImage, {
        nameKey: '已保存的横幅',
        size: estimateDataUrlBytes(prefs.bannerImage)
      });
    }

    setDirty(false, '设置已载入');
  } catch (error) {
    console.error('读取设置失败：', error);
    applyPrefsToForm(DEFAULT_PREFS);
    setSaveStatus('无法读取设置，请刷新后重试', 'error');
    showToast('无法读取本地设置', true);
  }
}

function collectElements() {
  const ids = [
    'commentsEnabled', 'showLocation', 'showExactTime', 'timezoneShanghai',
    'timeFormat',
    'timezoneLocal', 'showUnavailableLocation', 'settingsLanguage', 'pageLanguageChinese',
    'pageLanguageEnglish', 'translationEnabled', 'commentTranslationTarget', 'timePreview', 'commentControls',
    'bannerEnabled', 'bannerControls', 'bannerHeight', 'bannerHeightValue',
    'bannerDim', 'bannerDimValue', 'bannerFileInput', 'imageInfo',
    'imageName', 'imageDimensions', 'imageSize', 'cropStage', 'cropCanvas',
    'cropEmpty', 'zoomRange', 'zoomValue', 'resetCropButton', 'deleteImageButton',
    'outputFormat', 'outputQuality', 'outputQualityValue', 'restoreDefaultsButton',
    'saveButton', 'saveStatus', 'saveStatusText', 'toast', 'toastIcon', 'toastText'
  ];

  for (const id of ids) {
    elements[id] = document.getElementById(id);
  }
}

function bindEvents() {
  const trackedControls = [
    elements.commentsEnabled,
    elements.showLocation,
    elements.showExactTime,
    elements.timezoneShanghai,
    elements.timezoneLocal,
    elements.timeFormat,
    elements.showUnavailableLocation,
    elements.pageLanguageChinese,
    elements.pageLanguageEnglish,
    elements.translationEnabled,
    elements.commentTranslationTarget,
    elements.bannerEnabled,
    elements.bannerHeight,
    elements.bannerDim,
    elements.outputFormat,
    elements.outputQuality
  ];

  for (const control of trackedControls) {
    control.addEventListener('input', () => {
      updateInterfaceState();
      setDirty(true);
    });
  }

  elements.settingsLanguage.addEventListener('input', () => {
    applySettingsLanguage(elements.settingsLanguage.value);
    updateInterfaceState();
    setDirty(true);
  });

  // The crop preview is the single upload surface. A click always opens the
  // picker (including after an image is loaded), while a genuine drag is
  // consumed by the crop gesture and must not open a picker on pointerup.
  elements.cropStage.addEventListener('click', () => {
    if (suppressNextCropClick) {
      suppressNextCropClick = false;
      return;
    }
    elements.bannerFileInput.click();
  });
  elements.cropStage.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      elements.bannerFileInput.click();
    }
  });

  elements.bannerFileInput.addEventListener('change', async () => {
    const [file] = elements.bannerFileInput.files;
    if (file) await handleImageFile(file);
    elements.bannerFileInput.value = '';
  });

  elements.zoomRange.addEventListener('input', () => {
    setZoom(Number(elements.zoomRange.value));
    setDirty(true);
  });

  elements.cropStage.addEventListener('wheel', handleCropWheel, { passive: false });
  elements.cropStage.addEventListener('pointerdown', beginCropDrag);
  elements.cropStage.addEventListener('pointermove', moveCropDrag);
  elements.cropStage.addEventListener('pointerup', endCropDrag);
  elements.cropStage.addEventListener('pointercancel', endCropDrag);
  elements.cropStage.addEventListener('lostpointercapture', endCropDrag);

  elements.resetCropButton.addEventListener('click', () => {
    resetCrop();
    setDirty(true);
  });

  elements.deleteImageButton.addEventListener('click', deleteCurrentImage);
  elements.restoreDefaultsButton.addEventListener('click', restoreDefaults);
  elements.saveButton.addEventListener('click', saveSettings);

  // Keep anchored sections below the sticky top bar instead of hiding their
  // headings underneath the translucent header.  The CSS scroll margin below
  // remains a fallback for keyboard/browser-native anchor navigation.
  for (const link of document.querySelectorAll('.section-nav a[href^="#"]')) {
    link.addEventListener('click', (event) => {
      const target = document.querySelector(link.getAttribute('href'));
      if (!target) return;
      event.preventDefault();
      const topbar = document.querySelector('.topbar');
      const offset = (topbar?.getBoundingClientRect().height || 0) + 24;
      const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - offset);
      window.scrollTo({ top, behavior: 'smooth' });
      history.replaceState(null, '', link.getAttribute('href'));
    });
  }

  window.addEventListener('beforeunload', (event) => {
    if (isDirty && !isSaving) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
}

function normalizePrefs(value) {
  const raw = value && typeof value === 'object' ? value : {};
  return {
    commentsEnabled: asBoolean(raw.commentsEnabled, DEFAULT_PREFS.commentsEnabled),
    showLocation: asBoolean(raw.showLocation, DEFAULT_PREFS.showLocation),
    showExactTime: asBoolean(raw.showExactTime, DEFAULT_PREFS.showExactTime),
    timezone: raw.timezone === 'local' ? 'local' : 'Asia/Shanghai',
    timeFormat: TIME_FORMATS.includes(raw.timeFormat) ? raw.timeFormat : DEFAULT_PREFS.timeFormat,
    showUnavailableLocation: asBoolean(raw.showUnavailableLocation, DEFAULT_PREFS.showUnavailableLocation),
    settingsLanguage: raw.settingsLanguage === 'en' ? 'en' : 'zh-CN',
    pageLanguage: raw.pageLanguage === 'en' ? 'en' : 'zh-CN',
    translationEnabled: asBoolean(raw.translationEnabled, DEFAULT_PREFS.translationEnabled),
    commentTranslationTarget: ['en', 'zh', 'ja', 'ko', 'fr', 'de', 'es', 'ru'].includes(raw.commentTranslationTarget)
      ? raw.commentTranslationTarget
      : DEFAULT_PREFS.commentTranslationTarget,
    bannerEnabled: asBoolean(raw.bannerEnabled, DEFAULT_PREFS.bannerEnabled),
    bannerImage: isSupportedDataUrl(raw.bannerImage) ? raw.bannerImage : '',
    bannerHeight: clampNumber(raw.bannerHeight, 120, 280, DEFAULT_PREFS.bannerHeight),
    bannerDim: clampNumber(raw.bannerDim, 0, 60, DEFAULT_PREFS.bannerDim)
  };
}

function asBoolean(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(Math.min(max, Math.max(min, number))) : fallback;
}

function isSupportedDataUrl(value) {
  return typeof value === 'string' && /^data:image\/(?:png|jpeg|webp);base64,/i.test(value);
}

function applyPrefsToForm(prefs) {
  elements.commentsEnabled.checked = prefs.commentsEnabled;
  elements.showLocation.checked = prefs.showLocation;
  elements.showExactTime.checked = prefs.showExactTime;
  elements.timezoneShanghai.checked = prefs.timezone === 'Asia/Shanghai';
  elements.timezoneLocal.checked = prefs.timezone === 'local';
  elements.timeFormat.value = prefs.timeFormat;
  elements.showUnavailableLocation.checked = prefs.showUnavailableLocation;
  elements.settingsLanguage.value = prefs.settingsLanguage;
  elements.pageLanguageChinese.checked = prefs.pageLanguage !== 'en';
  elements.pageLanguageEnglish.checked = prefs.pageLanguage === 'en';
  elements.translationEnabled.checked = prefs.translationEnabled;
  elements.commentTranslationTarget.value = prefs.commentTranslationTarget;
  elements.bannerEnabled.checked = prefs.bannerEnabled;
  elements.bannerHeight.value = String(prefs.bannerHeight);
  elements.bannerDim.value = String(prefs.bannerDim);
  applySettingsLanguage(prefs.settingsLanguage);
  updateInterfaceState();
}

function readFormPrefs() {
  return {
    commentsEnabled: elements.commentsEnabled.checked,
    showLocation: elements.showLocation.checked,
    showExactTime: elements.showExactTime.checked,
    timezone: elements.timezoneLocal.checked ? 'local' : 'Asia/Shanghai',
    timeFormat: TIME_FORMATS.includes(elements.timeFormat.value)
      ? elements.timeFormat.value
      : DEFAULT_PREFS.timeFormat,
    showUnavailableLocation: elements.showUnavailableLocation.checked,
    settingsLanguage: elements.settingsLanguage.value === 'en' ? 'en' : 'zh-CN',
    pageLanguage: elements.pageLanguageEnglish.checked ? 'en' : 'zh-CN',
    translationEnabled: elements.translationEnabled.checked,
    commentTranslationTarget: elements.commentTranslationTarget.value,
    bannerEnabled: elements.bannerEnabled.checked,
    bannerImage: currentBannerDataUrl,
    bannerHeight: Number(elements.bannerHeight.value),
    bannerDim: Number(elements.bannerDim.value)
  };
}

function updateInterfaceState() {
  const commentsEnabled = elements.commentsEnabled.checked;
  const bannerEnabled = elements.bannerEnabled.checked;

  elements.commentControls.classList.toggle('is-disabled', !commentsEnabled);
  elements.bannerControls.classList.toggle('is-disabled', !bannerEnabled);

  elements.bannerHeightValue.value = `${elements.bannerHeight.value} px`;
  elements.bannerDimValue.value = `${elements.bannerDim.value}%`;
  elements.outputQualityValue.value = `${elements.outputQuality.value}%`;
  elements.zoomValue.value = `${Math.round(cropState.zoom * 100)}%`;

  updateTimePreview();
}

function startClock() {
  updateTimePreview();
  window.setInterval(updateTimePreview, 1000);
}

function updateTimePreview() {
  if (!elements.timePreview) return;
  const date = new Date();
  const timezone = elements.timezoneLocal && elements.timezoneLocal.checked ? undefined : 'Asia/Shanghai';
  const timeFormat = TIME_FORMATS.includes(elements.timeFormat?.value)
    ? elements.timeFormat.value
    : DEFAULT_PREFS.timeFormat;
  elements.timePreview.value = formatDate(date, timezone, timeFormat);
}

function formatDate(date, timeZone, timeFormat = DEFAULT_PREFS.timeFormat) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  );

  if (timeFormat === 'yyyy/mm/dd hh:mm:ss') {
    return `${parts.year}/${parts.month}/${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
  }
  if (timeFormat === 'mm/dd/yyyy hh:mm:ss') {
    return `${parts.month}/${parts.day}/${parts.year} ${parts.hour}:${parts.minute}:${parts.second}`;
  }
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}.${parts.minute}.${parts.second}`;
}

async function handleImageFile(file) {
  if (!SUPPORTED_TYPES.has(file.type)) {
    showToast('请选择 PNG、JPEG 或 WebP 图片', true);
    return;
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    showToast('图片超过 40 MB，请先压缩后再试', true);
    return;
  }

  setSaveStatus('正在读取图片…', 'neutral');
  try {
    // Decode from a local data URL, rather than a short-lived object URL. In
    // Edge's extension options page an object URL can be revoked while its
    // deferred image decode/canvas paint is still pending, leaving metadata
    // visible but the crop stage falsely empty.
    const dataUrl = await readFileAsDataUrl(file);
    await loadImageFromUrl(dataUrl, { name: file.name, size: file.size });
    currentBannerDataUrl = '';
    setDirty(true, '新图片尚未保存');
    showToast('图片已载入，可以拖动裁切');
  } catch (error) {
    console.error('图片读取失败：', error);
    showToast('无法读取这张图片，请换一张重试', true);
    setSaveStatus('图片读取失败', 'error');
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      const value = typeof reader.result === 'string' ? reader.result : '';
      if (isSupportedDataUrl(value)) resolve(value);
      else reject(new Error('图片数据无效'));
    }, { once: true });
    reader.addEventListener('error', () => reject(reader.error || new Error('图片读取失败')), { once: true });
    reader.readAsDataURL(file);
  });
}

function loadImageFromUrl(url, meta) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      if (!image.naturalWidth || !image.naturalHeight) {
        reject(new Error('图片尺寸无效'));
        return;
      }

      if (image.naturalWidth * image.naturalHeight > MAX_IMAGE_PIXELS) {
        reject(new Error('图片像素超过 8000 万，请缩小后再试'));
        return;
      }

      sourceImage = image;
      sourceMeta = {
        name: meta.name || '横幅图片',
        nameKey: meta.nameKey || '',
        size: Number(meta.size) || 0,
        width: image.naturalWidth,
        height: image.naturalHeight
      };
      resetCrop();
      updateImageInfo();
      syncCropImageState();
      renderCanvases();
      resolve();
    };
    image.onerror = () => reject(new Error('图片解码失败'));
    image.src = url;
  });
}

function resetCrop() {
  cropState = { zoom: 1, panX: 0, panY: 0 };
  elements.zoomRange.value = '1';
  elements.zoomValue.value = '100%';
  renderCanvases();
}

function setZoom(nextZoom, anchor) {
  if (!sourceImage) return;

  const previous = getRenderMetrics();
  cropState.zoom = Math.min(4, Math.max(1, nextZoom));

  if (anchor && previous) {
    const imageX = (anchor.x - previous.originX) / previous.scale;
    const imageY = (anchor.y - previous.originY) / previous.scale;
    const next = getRenderMetrics(false);
    cropState.panX = anchor.x - ((CROP_WIDTH - next.width) / 2) - imageX * next.scale;
    cropState.panY = anchor.y - ((CROP_HEIGHT - next.height) / 2) - imageY * next.scale;
  }

  constrainPan();
  elements.zoomRange.value = cropState.zoom.toFixed(2);
  elements.zoomValue.value = `${Math.round(cropState.zoom * 100)}%`;
  renderCanvases();
}

function getRenderMetrics(includeOrigin = true) {
  if (!sourceImage) return null;
  const baseScale = Math.max(CROP_WIDTH / sourceImage.naturalWidth, CROP_HEIGHT / sourceImage.naturalHeight);
  const scale = baseScale * cropState.zoom;
  const width = sourceImage.naturalWidth * scale;
  const height = sourceImage.naturalHeight * scale;
  const result = { baseScale, scale, width, height };
  if (includeOrigin) {
    result.originX = (CROP_WIDTH - width) / 2 + cropState.panX;
    result.originY = (CROP_HEIGHT - height) / 2 + cropState.panY;
  }
  return result;
}

function constrainPan() {
  const metrics = getRenderMetrics(false);
  if (!metrics) return;
  const maxX = Math.max(0, (metrics.width - CROP_WIDTH) / 2);
  const maxY = Math.max(0, (metrics.height - CROP_HEIGHT) / 2);
  cropState.panX = Math.max(-maxX, Math.min(maxX, cropState.panX));
  cropState.panY = Math.max(-maxY, Math.min(maxY, cropState.panY));
}

function beginCropDrag(event) {
  if (!sourceImage || event.button !== 0) return;
  const rect = elements.cropStage.getBoundingClientRect();
  dragState = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    panX: cropState.panX,
    panY: cropState.panY,
    moved: false,
    scaleX: CROP_WIDTH / rect.width,
    scaleY: CROP_HEIGHT / rect.height
  };
  elements.cropStage.setPointerCapture(event.pointerId);
  elements.cropStage.classList.add('is-dragging');
  event.preventDefault();
}

function moveCropDrag(event) {
  if (!dragState || dragState.pointerId !== event.pointerId) return;
  if (!dragState.moved && (Math.abs(event.clientX - dragState.startX) > 3 || Math.abs(event.clientY - dragState.startY) > 3)) {
    dragState.moved = true;
  }
  cropState.panX = dragState.panX + (event.clientX - dragState.startX) * dragState.scaleX;
  cropState.panY = dragState.panY + (event.clientY - dragState.startY) * dragState.scaleY;
  constrainPan();
  renderCanvases();
  setDirty(true);
}

function endCropDrag(event) {
  if (!dragState || dragState.pointerId !== event.pointerId) return;
  suppressNextCropClick = dragState.moved;
  dragState = null;
  elements.cropStage.classList.remove('is-dragging');
}

function handleCropWheel(event) {
  if (!sourceImage) return;
  event.preventDefault();
  const rect = elements.cropStage.getBoundingClientRect();
  const anchor = {
    x: (event.clientX - rect.left) * CROP_WIDTH / rect.width,
    y: (event.clientY - rect.top) * CROP_HEIGHT / rect.height
  };
  const factor = Math.exp(-event.deltaY * 0.0014);
  setZoom(cropState.zoom * factor, anchor);
  setDirty(true);
}

function renderCanvases() {
  renderImageToCanvas(elements.cropCanvas);
}

function renderImageToCanvas(canvas) {
  const context = canvas.getContext('2d', { alpha: true });
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (!sourceImage) return;

  const metrics = getRenderMetrics();
  context.save();
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(
    sourceImage,
    metrics.originX,
    metrics.originY,
    metrics.width,
    metrics.height
  );
  context.restore();
}

function updateImageInfo() {
  const hasImage = Boolean(sourceImage && sourceMeta);
  elements.imageInfo.hidden = !hasImage;
  if (!hasImage) return;
  if (sourceMeta.nameKey) {
    setLocalizedText(elements.imageName, sourceMeta.nameKey);
  } else {
    delete elements.imageName.dataset.bceI18nSource;
    delete elements.imageName.dataset.bceI18nSuffix;
    elements.imageName.textContent = sourceMeta.name;
  }
  elements.imageDimensions.textContent = `${sourceMeta.width} × ${sourceMeta.height}`;
  elements.imageSize.textContent = formatBytes(sourceMeta.size);
  syncCropImageState();
}

function syncCropImageState() {
  // This state is derived only from the decoded image and its metadata. A
  // caller cannot force a stale “No image selected” overlay after an upload.
  const empty = !(sourceImage && sourceMeta);
  elements.cropEmpty.hidden = !empty;
  elements.cropStage.classList.toggle('is-empty', empty);
  elements.cropStage.dataset.bceImageLoaded = empty ? 'false' : 'true';
  elements.cropStage.setAttribute(
    'aria-label',
    t(empty ? '上传或选择横幅图片' : '单击重新上传，拖动进行裁切')
  );
  elements.zoomRange.disabled = empty;
  elements.resetCropButton.disabled = empty;
  elements.deleteImageButton.disabled = empty;
  if (empty) {
    const cropContext = elements.cropCanvas.getContext('2d');
    cropContext.clearRect(0, 0, CROP_WIDTH, CROP_HEIGHT);
  }
}

function deleteCurrentImage() {
  if (!sourceImage) return;
  sourceImage = null;
  sourceMeta = null;
  currentBannerDataUrl = '';
  cropState = { zoom: 1, panX: 0, panY: 0 };
  elements.imageInfo.hidden = true;
  elements.zoomRange.value = '1';
  elements.zoomValue.value = '100%';
  syncCropImageState();
  setDirty(true, '图片已移除，保存后生效');
  showToast('图片已移除，记得保存设置');
}

function restoreDefaults() {
  const shouldRestore = window.confirm(t('恢复全部默认设置？当前尚未保存的修改和横幅图片会被移除。'));
  if (!shouldRestore) return;

  applyPrefsToForm(DEFAULT_PREFS);
  sourceImage = null;
  sourceMeta = null;
  currentBannerDataUrl = '';
  cropState = { zoom: 1, panX: 0, panY: 0 };
  elements.outputFormat.value = 'image/webp';
  elements.outputQuality.value = '86';
  elements.imageInfo.hidden = true;
  elements.zoomRange.value = '1';
  elements.zoomValue.value = '100%';
  syncCropImageState();
  updateInterfaceState();
  setDirty(true, '已恢复默认，保存后生效');
  showToast('已恢复默认设置，记得保存');
}

async function saveSettings() {
  if (isSaving) return;
  isSaving = true;
  elements.saveButton.disabled = true;
  elements.restoreDefaultsButton.disabled = true;
  setSaveStatus(sourceImage ? '正在裁切并压缩图片…' : '正在保存设置…', 'neutral');

  try {
    if (sourceImage) {
      currentBannerDataUrl = await exportBannerDataUrl(
        elements.outputFormat.value,
        Number(elements.outputQuality.value) / 100
      );
    } else {
      currentBannerDataUrl = '';
    }

    const prefs = normalizePrefs(readFormPrefs());
    await storageSet({ prefs });
    setDirty(false, '已保存', ` · ${formatClockTime(new Date())}`);
    showToast('设置已保存，刷新 B 站页面即可应用');

    if (sourceImage && currentBannerDataUrl) {
      sourceMeta = {
        ...sourceMeta,
        size: estimateDataUrlBytes(currentBannerDataUrl)
      };
      updateImageInfo();
    }
  } catch (error) {
    console.error('保存设置失败：', error);
    setSaveStatus('保存失败，请重试', 'error');
    showToast(error && error.message ? error.message : '保存失败，请重试', true);
  } finally {
    isSaving = false;
    elements.saveButton.disabled = false;
    elements.restoreDefaultsButton.disabled = false;
  }
}

async function exportBannerDataUrl(requestedType, requestedQuality) {
  const canvas = document.createElement('canvas');
  canvas.width = EXPORT_WIDTH;
  canvas.height = EXPORT_HEIGHT;
  const context = canvas.getContext('2d', { alpha: false });
  const metrics = getRenderMetrics();
  const factor = EXPORT_WIDTH / CROP_WIDTH;

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(
    sourceImage,
    metrics.originX * factor,
    metrics.originY * factor,
    metrics.width * factor,
    metrics.height * factor
  );

  let type = requestedType === 'image/jpeg' ? 'image/jpeg' : 'image/webp';
  let quality = Math.min(0.95, Math.max(0.6, requestedQuality || 0.86));
  let dataUrl = canvas.toDataURL(type, quality);

  if (!dataUrl.startsWith(`data:${type}`)) {
    type = 'image/jpeg';
    dataUrl = canvas.toDataURL(type, quality);
  }

  while (estimateDataUrlBytes(dataUrl) > TARGET_DATA_URL_BYTES && quality > 0.6) {
    quality = Math.max(0.6, quality - 0.06);
    dataUrl = canvas.toDataURL(type, quality);
  }

  if (!isSupportedDataUrl(dataUrl)) {
    throw new Error('浏览器无法导出所选图片格式');
  }
  return dataUrl;
}

function setDirty(dirty, message, suffix = '') {
  isDirty = dirty;
  if (dirty) {
    setSaveStatus(message || '有尚未保存的修改', 'dirty', suffix);
  } else {
    setSaveStatus(message || '所有设置已保存', 'saved', suffix);
  }
}

function setSaveStatus(message, state, suffix = '') {
  setLocalizedText(elements.saveStatusText, message, suffix);
  elements.saveStatus.classList.toggle('is-dirty', state === 'dirty');
  elements.saveStatus.classList.toggle('is-saved', state === 'saved');
  elements.saveStatus.classList.toggle('is-error', state === 'error');
}

function showToast(message, isError = false) {
  window.clearTimeout(toastTimer);
  setLocalizedText(elements.toastText, message);
  elements.toastIcon.textContent = isError ? '!' : '✓';
  elements.toast.classList.toggle('is-error', isError);
  elements.toast.classList.add('is-visible');
  toastTimer = window.setTimeout(() => {
    elements.toast.classList.remove('is-visible');
  }, 3300);
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return t('本地图片');
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function estimateDataUrlBytes(dataUrl) {
  if (typeof dataUrl !== 'string') return 0;
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return 0;
  const base64Length = dataUrl.length - comma - 1;
  return Math.max(0, Math.floor(base64Length * 3 / 4));
}

function formatClockTime(date) {
  return new Intl.DateTimeFormat(globalThis.BCE_SETTINGS_I18N?.getLanguage?.() === 'en' ? 'en-GB' : 'zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).format(date);
}

function storageGet(key) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(key, (result) => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve(result);
    });
  });
}

function storageSet(value) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(value, () => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve();
    });
  });
}
