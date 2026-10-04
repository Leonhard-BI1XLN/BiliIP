(() => {
  'use strict';

  const MESSAGE_SOURCE = 'bili-comment-enhancer:page-bridge';
  // Keep this channel versioned. An existing tab can retain an old page-world
  // bridge after the extension is reloaded; old bridges must not start a
  // second Translator session for a new content script's request.
  const PAGE_TRANSLATE_REQUEST = 'translate-request-v118';
  const PAGE_TRANSLATE_RESPONSE = 'translate-response-v118';
  const PAGE_BRIDGE_READY = 'bridge-ready-v118';
  const META_ATTRIBUTE = 'data-bce-comment-meta';
  const MESSAGE_META_ATTRIBUTE = 'data-bce-message-meta';
  const TITLE_META_ATTRIBUTE = 'data-bce-title-meta';
  const SHADOW_STYLE_ATTRIBUTE = 'data-bce-shadow-style';
  const TEXT_NODE = typeof Node === 'undefined' ? 3 : Node.TEXT_NODE;
  const SHOW_TEXT = typeof NodeFilter === 'undefined' ? 4 : NodeFilter.SHOW_TEXT;
  const RENDERER_SELECTOR = [
    'bili-comment-thread-renderer',
    'bili-comment-renderer',
    'bili-comment-reply-renderer'
  ].join(',');
  const COMMENT_CONTAINER_SELECTOR = [
    RENDERER_SELECTOR,
    '.reply-item',
    '.sub-reply-item',
    '[class*="reply-item"]',
    '[class*="reply_item"]'
  ].join(',');
  const COMMENT_CONTENT_SELECTOR = [
    '.reply-content-container',
    '.reply-content',
    '.sub-reply-content',
    'bili-rich-text',
    '[class*="reply-content"]',
    '[class*="reply_content"]',
    '[class*="reply-text"]',
    '[class*="reply_text"]',
    '[class*="comment-content"]',
    '[class*="comment_content"]'
  ].join(',');
  // The message centre is a separate Bilibili application. Its reply list is
  // Vue-rendered instead of using the public comment web-components, so it
  // needs its own narrow, route-specific anchor discovery.
  const MESSAGE_REPLY_ITEM_SELECTOR = [
    '.reply-item',
    '.reply-list-item',
    '.reply-list__item',
    '.msg-item',
    '.talk-item',
    '.message-list-item',
    '.notification-item',
    '[class*="notify-item"]',
    '[class*="notification-item"]',
    '[class*="interaction-item"]',
    '[class*="message-item"]',
    '[class*="talk-item"]',
    '[class*="reply-item"]',
    '[class*="reply_item"]',
    '[class*="reply-list-item"]',
    '[class*="reply_list_item"]'
  ].join(',');
  const MESSAGE_REPLY_CONTENT_SELECTOR = [
    '.reply-content',
    '.reply-content-container',
    '.reply-text',
    '.reply-content-text',
    '[class*="reply-content"]',
    '[class*="reply_content"]',
    '[class*="reply-text"]',
    '[class*="reply_text"]',
    '[class*="message-content"]',
    '[class*="message_content"]',
    '.msg-item .desc',
    '.talk-item .content',
    '.talk-item .text',
    '.talk-item .desc',
    '.chat-content .bubble',
    '.chat-content .text',
    '.chat-history .bubble',
    '.chat-history .text',
    '.message-list .source-content',
    '.message-list .notify-content',
    '.interaction-item__msg',
    '.interaction-item__reference',
    '[class*="SessionItem__Message_"]',
    '[class*="MsgText__Content_"]',
    '[class*="RichText_"]'
  ].join(',');
  const MESSAGE_TIME_SELECTOR = [
    '[data-ctime]',
    '[data-timestamp]',
    '[data-time]',
    '.reply-time',
    '.time',
    '[class*="reply-time"]',
    '[class*="reply_time"]',
    '[class*="time"]',
    '[class*="date"]'
  ].join(',');
  const META_TARGET_SELECTOR = '#pubdate,.reply-info,.sub-reply-info';
  const ORIGINAL_TIME_HIDDEN_CLASS = 'bce-original-time-hidden';
  const ORIGINAL_TIME_HIDDEN_ATTRIBUTE = 'data-bce-original-time-hidden';
  const TRANSLATABLE_ATTRIBUTE_NAMES = Object.freeze(['title', 'aria-label', 'placeholder']);
  const MESSAGE_REPLY_PREFIX = /^(?:回复|Reply)\s*@[^:：]+\s*[:：]\s*/iu;
  const MESSAGE_DATE_TIME_PATTERN = /\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日\s*\d{1,2}\s*[:：]\s*\d{2}/u;
  const MESSAGE_ISO_DATE_TIME_PATTERN = /\d{4}\s*[-\/]\s*\d{1,2}\s*[-\/]\s*\d{1,2}\s+\d{1,2}\s*[:：]\s*\d{2}/u;
  const MESSAGE_RELATIVE_TIME_PATTERN = /(?:今天|昨天|Today|Yesterday)\s+\d{1,2}\s*[:：]\s*\d{2}/iu;
  const VIDEO_TITLE_SELECTOR = [
    'h1.video-title',
    '.video-title',
    '[class*="video-title"]',
    '[class*="videoTitle"]'
  ].join(',');
  // Title translation is intentionally disabled. Keep the cleanup path in
  // renderTitleTranslationButtons so an older injected title control cannot
  // survive an extension reload; comment/message translation stays enabled.
  const TITLE_TRANSLATION_ENABLED = false;
  // BI1XLN
  const TRANSLATION_EXCLUSION_SELECTOR = [
    'script',
    'style',
    'textarea',
    'input',
    'select',
    'option',
    'pre',
    'code',
    '[contenteditable="true"]',
    '[data-bce-comment-meta]',
    '[data-bce-message-meta]',
    '[data-bce-title-meta]',
    '[data-bce-comment-translation]',
    '[data-bce-user-content]',
    '[data-user-name]',
    '[data-username]',
    '[class*="user-name"]',
    '[class*="user_name"]',
    '[class*="username"]',
    'bili-rich-text',
    '.reply-content',
    '.reply-content-container',
    '[class*="reply-content"]',
    '.video-title',
    '[class*="video-title"]',
    'h1'
  ].join(',');
  // A placeholder is fixed product chrome, not a user's typed value. Inputs
  // remain excluded from text-node translation, but their placeholder is
  // deliberately handled below so the global Bilibili search bar is covered.
  const TRANSLATION_ATTRIBUTE_EXCLUSION_SELECTOR = TRANSLATION_EXCLUSION_SELECTOR
    .replace(',input', '')
    .replace(',textarea', '');

  // The current homepage uses `.bili-header__banner`; the other candidates
  // keep the replacement working through small header-markup experiments.
  const BANNER_SELECTORS = Object.freeze([
    '.bili-header__banner',
    '#biliMainHeader .bili-header__banner',
    '.bili-header .header-banner'
  ]);
  const BANNER_CONTAINER_SELECTOR = BANNER_SELECTORS.join(',');
  const HOME_LOGO_SELECTORS = Object.freeze([
    '.bili-header__logo',
    '#biliMainHeader .bili-header__logo',
    '.bili-header a[class*="logo" i]',
    '#biliMainHeader a[class*="logo" i]',
    'a[class*="logo" i]',
    'header a[class*="logo" i]',
    'header a[aria-label*="bilibili" i]',
    'a[href="//www.bilibili.com/"]',
    'a[href="https://www.bilibili.com/"]',
    'header a[href$="bilibili.com/" i]',
    'header a[href$="bilibili.com" i]'
  ]);
  const HOME_LOGO_SELECTOR = HOME_LOGO_SELECTORS.join(',');

  const TIME_FORMATS = Object.freeze([
    'dd/mm/yyyy hh.mm.ss',
    'yyyy/mm/dd hh:mm:ss',
    'mm/dd/yyyy hh:mm:ss'
  ]);
  const DEFAULT_TIME_FORMAT = TIME_FORMATS[0];

  const DEFAULT_PREFS = Object.freeze({
    commentsEnabled: true,
    showLocation: true,
    showExactTime: true,
    timezone: 'Asia/Shanghai',
    timeFormat: DEFAULT_TIME_FORMAT,
    showUnavailableLocation: false,
    // These two language choices deliberately serve different surfaces.
    // `settingsLanguage` is retained here so a complete preference object can
    // move between the options page and content script without losing it.
    settingsLanguage: 'zh-CN',
    pageLanguage: 'zh-CN',
    translationEnabled: true,
    commentTranslationTarget: 'en',
    bannerEnabled: true,
    bannerImage: '',
    bannerHeight: 180,
    bannerDim: 0
  });

  const SHADOW_STYLE_TEXT = `
    [data-bce-localized-ui="true"] {
      letter-spacing: normal !important;
      word-spacing: normal !important;
      font-kerning: normal;
    }
    .bce-comment-meta,
    .bce-message-meta {
      --bce-meta-fg: #61666d;
      display: flex !important;
      flex-wrap: wrap;
      align-items: baseline;
      column-gap: 10px;
      row-gap: 3px;
      width: 100%;
      margin: 6px 0 0 !important;
      padding: 0 !important;
      color: var(--bce-meta-fg) !important;
      font: 400 12px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
      letter-spacing: normal !important;
      word-spacing: normal !important;
    }
    .bce-meta-item {
      display: inline;
      color: inherit !important;
      white-space: nowrap;
    }
    [data-bce-message-row="true"],
    [data-bce-message-content="true"] {
      height: auto !important;
      max-height: none !important;
      overflow: visible !important;
      text-overflow: clip !important;
    }
    [data-bce-message-content="true"] {
      display: block !important;
      white-space: normal !important;
      overflow-wrap: anywhere !important;
      word-break: break-word !important;
      -webkit-line-clamp: unset !important;
      line-clamp: unset !important;
    }
    /* Never rewrite Vue-owned reply nodes for a manual translation. */
    [data-bce-original-comment-hidden="true"] {
      display: none !important;
    }
    .bce-manual-translation-content {
      color: inherit !important;
      white-space: pre-wrap !important;
      overflow-wrap: anywhere !important;
      word-break: break-word !important;
      letter-spacing: normal !important;
      word-spacing: normal !important;
    }
    .bce-manual-translation-content[data-bce-display="block"] { display: block !important; }
    .bce-manual-translation-content[data-bce-display="inline"] { display: inline !important; }
    .bce-time-group {
      display: inline-flex;
      align-items: baseline;
      gap: 6px;
      min-width: 0;
      white-space: nowrap;
    }
    .bce-translate-comment {
      display: inline-flex !important;
      align-items: center;
      gap: 4px;
      margin: 0;
      padding: 0 !important;
      border: 0 !important;
      background: transparent !important;
      color: inherit !important;
      font: inherit !important;
      letter-spacing: normal !important;
      cursor: pointer;
    }
    .bce-translate-comment:hover,
    .bce-translate-comment:focus-visible { color: #00aeec !important; }
    .bce-translate-comment:disabled { cursor: wait; opacity: .7; }
    .bce-translate-comment[data-bce-translating="true"] .bce-translation-icon {
      animation: bce-translation-pulse 1s ease-in-out infinite;
    }
    @keyframes bce-translation-pulse {
      0%, 100% { opacity: .45; transform: translateY(3px) scale(.92); }
      50% { opacity: 1; transform: translateY(3px) scale(1); }
    }
    .bce-title-translation-holder {
      display: inline-flex !important;
      align-items: center;
      flex: 0 0 auto !important;
      max-width: max-content;
      margin-inline-start: 8px !important;
      vertical-align: middle;
      line-height: 1;
      white-space: nowrap !important;
      pointer-events: auto !important;
    }
    .bce-title-translation-target {
      display: flex !important;
      flex-wrap: wrap !important;
      align-items: flex-start !important;
      gap: 2px 8px;
      width: 100% !important;
      min-width: 0 !important;
      max-width: 100% !important;
      height: auto !important;
      max-height: none !important;
      white-space: normal !important;
      overflow: visible !important;
      overflow-wrap: anywhere !important;
      word-break: break-word !important;
      text-overflow: clip !important;
    }
    .bce-title-translation-text {
      display: block !important;
      flex: 1 1 0% !important;
      min-width: 0 !important;
      max-width: 100% !important;
      white-space: normal !important;
      overflow-wrap: anywhere !important;
      word-break: break-word !important;
    }
    .bce-title-flow-expanded {
      height: auto !important;
      min-height: max-content !important;
      max-height: none !important;
      overflow: visible !important;
    }
    .bce-translation-icon {
      display: block;
      width: 17px;
      height: 17px;
      position: relative;
      top: 3px;
      transform: none;
      object-fit: contain;
      filter: invert(54%) sepia(89%) saturate(2496%) hue-rotate(165deg) brightness(95%) contrast(101%);
    }
    .bce-comment-translation {
      display: block !important;
      width: 100%;
      margin: 5px 0 0 !important;
      padding: 0 !important;
      color: var(--bce-meta-fg) !important;
      font: 400 13px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
      letter-spacing: normal !important;
      word-spacing: normal !important;
    }
    .bce-translation-label { margin-inline-end: 6px; opacity: .72; }
    .bce-translation-status { opacity: .72; }
    .bce-translation-error { color: #e34d59 !important; }
    .bce-translation-text { white-space: pre-wrap; }
    .bce-location-unavailable { opacity: .72; }
    .bce-original-time-hidden { display: none !important; }
    @media (prefers-color-scheme: dark) {
      .bce-comment-meta,
      .bce-message-meta,
      .bce-comment-translation {
        --bce-meta-fg: #a2a7ae;
      }
    }
  `;

  const BILI_ENGLISH_DICTIONARY = globalThis.BCE_BILI_ENGLISH_DICTIONARY &&
    typeof globalThis.BCE_BILI_ENGLISH_DICTIONARY === 'object'
    ? globalThis.BCE_BILI_ENGLISH_DICTIONARY
    : Object.freeze({ ui: {}, location: {}, patterns: [] });
  const REGION_DATA = globalThis.BCE_REGION_DATA && typeof globalThis.BCE_REGION_DATA === 'object'
    ? globalThis.BCE_REGION_DATA
    : Object.freeze({ translateChineseRegion: () => '' });
  const COMMENT_TRANSLATION_TARGETS = new Set(['en', 'zh', 'ja', 'ko', 'fr', 'de', 'es', 'ru']);

  function clamp(value, minimum, maximum, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
  }

  function normalizePreferences(input) {
    const value = input && typeof input === 'object' ? input : {};
    const bannerDim = clamp(value.bannerDim, 0, 60, DEFAULT_PREFS.bannerDim) / 100;

    return {
      commentsEnabled: value.commentsEnabled !== false,
      showLocation: value.showLocation !== false,
      showExactTime: value.showExactTime !== false,
      timezone: value.timezone === 'local' ? 'local' : 'Asia/Shanghai',
      timeFormat: TIME_FORMATS.includes(value.timeFormat) ? value.timeFormat : DEFAULT_TIME_FORMAT,
      showUnavailableLocation: value.showUnavailableLocation === true,
      settingsLanguage: value.settingsLanguage === 'en' ? 'en' : 'zh-CN',
      pageLanguage: value.pageLanguage === 'en' ? 'en' : 'zh-CN',
      translationEnabled: value.translationEnabled !== false,
      commentTranslationTarget: COMMENT_TRANSLATION_TARGETS.has(value.commentTranslationTarget)
        ? value.commentTranslationTarget
        : DEFAULT_PREFS.commentTranslationTarget,
      bannerEnabled: value.bannerEnabled !== false,
      bannerImage: typeof value.bannerImage === 'string' ? value.bannerImage : '',
      bannerHeight: Math.round(clamp(value.bannerHeight, 120, 280, DEFAULT_PREFS.bannerHeight)),
      bannerDim
    };
  }

  function normalizeRpid(value) {
    if (typeof value === 'bigint') {
      return value > 0n ? value.toString() : '';
    }
    if (typeof value === 'number') {
      return Number.isSafeInteger(value) && value > 0 ? String(value) : '';
    }
    if (typeof value !== 'string') {
      return '';
    }
    const normalized = value.trim();
    return /^\d+$/.test(normalized) && !/^0+$/.test(normalized) ? normalized : '';
  }

  function normalizeLocation(value) {
    if (typeof value !== 'string') {
      return null;
    }
    const normalized = value
      .replace(/^\s*IP\s*(?:属地|归属地)?\s*[:：]\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120);
    return normalized || null;
  }

  function normalizeReply(record) {
    if (!record || typeof record !== 'object') {
      return null;
    }
    let rpid = normalizeRpid(record.rpid_str ?? record.rpidStr);
    if (!rpid) {
      rpid = normalizeRpid(record.rpid);
    }
    if (!rpid) {
      return null;
    }

    const rawTimestamp = record.ctime ?? record.create_time ?? record.createTime;
    const numericTimestamp = typeof rawTimestamp === 'string' && rawTimestamp.trim() === ''
      ? Number.NaN
      : Number(rawTimestamp);
    const ctime = Number.isFinite(numericTimestamp) && numericTimestamp >= 0
      ? Math.floor(numericTimestamp > 10_000_000_000 ? numericTimestamp / 1000 : numericTimestamp)
      : null;
    const location = normalizeLocation(
      record.location ??
      record.reply_control?.location ??
      record.replyControl?.location
    );
    const messageText = typeof record.messageText === 'string'
      ? record.messageText.replace(/\s+/gu, ' ').trim().slice(0, 8_000)
      : '';
    return { rpid, ctime, location, messageText };
  }

  function twoDigits(value) {
    return String(value).padStart(2, '0');
  }

  const shanghaiFormatter = typeof Intl !== 'undefined'
    ? new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    })
    : null;

  function normalizeTimeFormat(value) {
    return TIME_FORMATS.includes(value) ? value : DEFAULT_TIME_FORMAT;
  }

  function dateTimeParts(date, timezone) {
    if (timezone === 'local' || !shanghaiFormatter) {
      return {
        day: twoDigits(date.getDate()),
        month: twoDigits(date.getMonth() + 1),
        year: String(date.getFullYear()),
        hour: twoDigits(date.getHours()),
        minute: twoDigits(date.getMinutes()),
        second: twoDigits(date.getSeconds())
      };
    }

    const parts = {};
    for (const part of shanghaiFormatter.formatToParts(date)) {
      if (part.type !== 'literal') {
        parts[part.type] = part.value;
      }
    }
    return parts;
  }

  function formatDateTimeParts(parts, timeFormat = DEFAULT_TIME_FORMAT, includeSeconds = true) {
    const format = normalizeTimeFormat(timeFormat);
    const day = parts.day;
    const month = parts.month;
    const year = parts.year;
    const hour = parts.hour;
    const minute = parts.minute;
    const second = parts.second;
    if (format === 'yyyy/mm/dd hh:mm:ss') {
      return `${year}/${month}/${day} ${hour}:${minute}${includeSeconds ? `:${second}` : ''}`;
    }
    if (format === 'mm/dd/yyyy hh:mm:ss') {
      return `${month}/${day}/${year} ${hour}:${minute}${includeSeconds ? `:${second}` : ''}`;
    }
    return `${day}/${month}/${year} ${hour}.${minute}${includeSeconds ? `.${second}` : ''}`;
  }

  function formatTimestamp(value, timezone = 'Asia/Shanghai', timeFormat = DEFAULT_TIME_FORMAT) {
    if (typeof value === 'string' && value.trim() === '') {
      return '';
    }
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return '';
    }

    const milliseconds = Math.abs(numeric) > 10_000_000_000 ? numeric : numeric * 1000;
    const date = new Date(milliseconds);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return formatDateTimeParts(dateTimeParts(date, timezone), timeFormat);
  }

  function calendarDayNumber(date, timezone = 'Asia/Shanghai') {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      return Number.NaN;
    }

    if (timezone === 'local' || !shanghaiFormatter) {
      return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000;
    }

    const parts = {};
    for (const part of shanghaiFormatter.formatToParts(date)) {
      if (part.type !== 'literal') {
        parts[part.type] = part.value;
      }
    }
    return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) / 86_400_000;
  }

  function formatReplyTime(value, timezone = 'Asia/Shanghai', pageLanguage = 'zh-CN', now = new Date(), timeFormat = DEFAULT_TIME_FORMAT) {
    const display = getCommentTimeDisplay(value, timezone, pageLanguage, now, timeFormat);
    if (!display) return '';
    if (display.kind === 'relative') return display.relative;
    return `${display.date} ${display.time}`;
  }

  function formatRelativeElapsed(milliseconds, pageLanguage) {
    const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (pageLanguage === 'en') {
      const plural = (value, singular) => `${value} ${singular}${value === 1 ? '' : 's'}`;
      return `${plural(hours, 'hour')} ${plural(minutes, 'minute')} ${twoDigits(seconds)} second${seconds === 1 ? '' : 's'} ago`;
    }
    return `${hours}小时${minutes}分钟${twoDigits(seconds)}秒前`;
  }

  function getCommentTimeDisplay(value, timezone = 'Asia/Shanghai', pageLanguage = 'zh-CN', now = new Date(), timeFormat = DEFAULT_TIME_FORMAT) {
    const exact = formatTimestamp(value, timezone, timeFormat);
    if (!exact) return null;

    const numeric = Number(value);
    const milliseconds = Math.abs(numeric) > 10_000_000_000 ? numeric : numeric * 1000;
    const published = new Date(milliseconds);
    const reference = now instanceof Date ? now : new Date(now);
    if (Number.isNaN(published.getTime()) || Number.isNaN(reference.getTime())) return null;

    const [date = '', time = ''] = exact.split(' ');
    const dayDistance = calendarDayNumber(reference, timezone) - calendarDayNumber(published, timezone);
    if (dayDistance === 0) {
      return {
        kind: 'relative',
        date: '',
        time: '',
        relative: formatRelativeElapsed(reference.getTime() - published.getTime(), pageLanguage)
      };
    }
    if (dayDistance === 1) {
      return {
        kind: 'yesterday',
        date: pageLanguage === 'en' ? 'Yesterday' : '昨天',
        time,
        relative: ''
      };
    }
    return { kind: 'absolute', date, time, relative: '' };
  }

  function translateLocation(value, pageLanguage = 'zh-CN') {
    const location = normalizeLocation(value);
    if (!location || pageLanguage !== 'en') {
      return location || '';
    }
    return REGION_DATA.translateChineseRegion?.(location) || BILI_ENGLISH_DICTIONARY.location?.[location] || location;
  }

  function normalizeFixedUiKey(value) {
    return typeof value === 'string'
      ? value.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/gu, '').replace(/\s+/gu, ' ').trim()
      : '';
  }

  function translateFixedUiText(value) {
    if (typeof value !== 'string') {
      return value;
    }

    const leadingWhitespace = value.match(/^\s*/u)?.[0] || '';
    const trailingWhitespace = value.match(/\s*$/u)?.[0] || '';
    const trimmed = normalizeFixedUiKey(value);
    if (!trimmed) {
      return value;
    }

    const punctuationVariants = new Set([
      trimmed,
      trimmed.replace(/,/gu, '，'),
      trimmed.replace(/，/gu, ','),
      trimmed.replace(/[()]/gu, (value) => value === '(' ? '（' : '）'),
      trimmed.replace(/[（）]/gu, (value) => value === '（' ? '(' : ')')
    ]);
    let direct = '';
    for (const variant of punctuationVariants) {
      direct = BILI_ENGLISH_DICTIONARY.ui?.[variant];
      if (direct) break;
    }
    if (direct) {
      return `${leadingWhitespace}${direct}${trailingWhitespace}`;
    }

    let translatedValue = trimmed;
    let changed = false;
    for (const entry of BILI_ENGLISH_DICTIONARY.patterns || []) {
      if (entry?.pattern instanceof RegExp) {
        // Some phrase entries are global so they can translate multiple
        // fixed labels inside one notification. Reset lastIndex around test
        // and replace; otherwise a global RegExp can alternate between rows.
        entry.pattern.lastIndex = 0;
        const matches = entry.pattern.test(translatedValue);
        entry.pattern.lastIndex = 0;
        if (matches) {
          translatedValue = translatedValue.replace(entry.pattern, entry.replacement);
          entry.pattern.lastIndex = 0;
          changed = true;
        }
      }
    }
    if (changed) return `${leadingWhitespace}${translatedValue}${trailingWhitespace}`;
    return value;
  }

  // Safe, pure helpers for the repository's VM-based tests. Content scripts
  // live in an isolated world, so this does not expose extension state to Bili.
  try {
    const testHelpers = Object.freeze({
      BANNER_SELECTORS,
      BILI_ENGLISH_DICTIONARY,
      DEFAULT_PREFS,
      DEFAULT_TIME_FORMAT,
      TIME_FORMATS,
      formatCommentTime: getCommentTimeDisplay,
      formatReplyTime,
      formatTimestamp,
      formatRelativeElapsed,
      normalizePreferences,
      normalizeReply,
      translateFixedUiText,
      translateLocation
    });
    Object.defineProperty(globalThis, '__BILI_ASSISTANT_TEST__', {
      configurable: true,
      value: testHelpers
    });
    Object.defineProperty(globalThis, '__BILI_ASSISTANT_CONTENT_TEST__', {
      configurable: true,
      value: testHelpers
    });
  } catch {
    // The optional test hook is not needed at runtime.
  }

  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    typeof chrome === 'undefined' ||
    !chrome.runtime?.getURL
  ) {
    return;
  }

  // A tab can keep an old content-script alive for a short time while the
  // extension is being reloaded. Chrome invalidates its extension context in
  // that window; every runtime/storage call must then become a no-op instead
  // of surfacing “Extension context invalidated” in edge://extensions.
  function extensionContextUrl(path) {
    try {
      if (!chrome.runtime?.id || typeof chrome.runtime.getURL !== 'function') return '';
      return chrome.runtime.getURL(path);
    } catch {
      return '';
    }
  }

  let prefs = { ...DEFAULT_PREFS };
  const records = new Map();
  const observedRoots = new Set();
  const rootObservers = new Map();
  let refreshScheduled = false;
  let pageBridgeInjected = false;
  let pageBridgeReady = false;
  let resolvePageBridgeReady = null;
  let pageBridgeReadyPromise = new Promise((resolve) => {
    resolvePageBridgeReady = resolve;
  });
  // Track only fixed UI text that this extension changed, so switching back to
  // Chinese restores Bilibili's exact original markup rather than guessing.
  const translatedTextNodes = new Map();
  const translatedAttributes = new Map();
  const localizedUiElements = new Set();
  const metaByTarget = new WeakMap();
  // Keep the precise body element that was used as the mount point. This is
  // essential for Bilibili's nested open shadow roots: the metadata itself
  // may be a sibling of a web-component host while the visible text lives in
  // that host's shadow tree.
  const commentContentByMeta = new WeakMap();
  const messageMetaByItem = new WeakMap();
  const messageMetaByContent = new WeakMap();
  let nextMessageReplyKey = 1;
  const liveTimeMetas = new Set();
  const commentTranslationStates = new Map();
  const manuallyTranslatedComments = new Map();
  const translatorSessions = new Map();
  const pendingPageTranslations = new Map();
  let nextPageTranslationId = 1;

  function isTranslationExcluded(node) {
    const parent = typeof Element !== 'undefined' && node instanceof Element ? node : node?.parentElement;
    return Boolean(parent?.closest?.(TRANSLATION_EXCLUSION_SELECTOR));
  }

  function markLocalizedUi(element) {
    if (!(element instanceof Element)) return;
    localizedUiElements.add(element);
    element.setAttribute('data-bce-localized-ui', 'true');
  }

  function translateTextNode(node) {
    if (!node || node.nodeType !== TEXT_NODE || isTranslationExcluded(node)) {
      return;
    }

    const previous = translatedTextNodes.get(node);
    // If Bilibili itself changes a translated node, treat its new value as the
    // fresh source string. This keeps hydration and live counters accurate.
    const original = previous && node.nodeValue === previous.translated
      ? previous.original
      : node.nodeValue;
    const translated = translateFixedUiText(original);
    if (translated === original) {
      if (previous) {
        translatedTextNodes.delete(node);
      }
      return;
    }

    translatedTextNodes.set(node, { original, translated });
    markLocalizedUi(node.parentElement);
    if (node.nodeValue !== translated) {
      node.nodeValue = translated;
    }
  }

  function translateAttribute(element, name) {
    const exclusionSelector = name === 'placeholder'
      ? TRANSLATION_ATTRIBUTE_EXCLUSION_SELECTOR
      : TRANSLATION_EXCLUSION_SELECTOR;
    if (!(element instanceof Element) || element.closest?.(exclusionSelector) || !element.hasAttribute(name)) {
      return;
    }
    let states = translatedAttributes.get(element);
    if (!states) {
      states = new Map();
      translatedAttributes.set(element, states);
    }
    const previous = states.get(name);
    const current = element.getAttribute(name);
    const original = previous && current === previous.translated ? previous.original : current;
    const translated = translateFixedUiText(original || '');
    if (translated === original) {
      if (previous) states.delete(name);
      if (!states.size) translatedAttributes.delete(element);
      return;
    }
    states.set(name, { original, translated });
    markLocalizedUi(element);
    if (current !== translated) element.setAttribute(name, translated);
  }

  function translateElementAttributes(root) {
    if (!root || !('querySelectorAll' in root)) return;
    if (root instanceof Element) {
      for (const name of TRANSLATABLE_ATTRIBUTE_NAMES) translateAttribute(root, name);
    }
    const selector = TRANSLATABLE_ATTRIBUTE_NAMES.map((name) => `[${name}]`).join(',');
    for (const element of root.querySelectorAll(selector)) {
      for (const name of TRANSLATABLE_ATTRIBUTE_NAMES) translateAttribute(element, name);
    }
  }

  function translateNode(root) {
    if (prefs.pageLanguage !== 'en' || !root || typeof document.createTreeWalker !== 'function') {
      return;
    }

    if (root.nodeType === TEXT_NODE) {
      translateTextNode(root);
      return;
    }

    translateElementAttributes(root);
    const walker = document.createTreeWalker(root, SHOW_TEXT);
    let textNode;
    while ((textNode = walker.nextNode())) {
      translateTextNode(textNode);
    }
  }

  function restoreTranslatedText() {
    for (const [node, value] of translatedTextNodes) {
      if (node.isConnected && node.nodeValue === value.translated) {
        node.nodeValue = value.original;
      }
      translatedTextNodes.delete(node);
    }
    for (const [element, states] of translatedAttributes) {
      if (element.isConnected) {
        for (const [name, value] of states) {
          if (element.getAttribute(name) === value.translated) {
            element.setAttribute(name, value.original);
          }
        }
      }
      translatedAttributes.delete(element);
    }
    for (const element of localizedUiElements) {
      if (element.isConnected) element.removeAttribute('data-bce-localized-ui');
    }
    localizedUiElements.clear();
  }

  function applyPageLanguage(root = document) {
    if (prefs.pageLanguage === 'en') {
      translateNode(root);
    } else {
      restoreTranslatedText();
    }
  }

  function isMainBilibiliSite() {
    return location.hostname === 'www.bilibili.com' || location.hostname === 'bilibili.com';
  }

  function isMessageReplyPage() {
    return location.hostname === 'message.bilibili.com' && /^#\/reply(?:\/|$|\?)/u.test(location.hash);
  }

  function injectPageBridge() {
    if (pageBridgeInjected) {
      return;
    }

    const parent = document.documentElement || document.head;
    if (!parent) {
      const observer = new MutationObserver(() => {
        if (document.documentElement || document.head) {
          observer.disconnect();
          injectPageBridge();
        }
      });
      observer.observe(document, { childList: true });
      return;
    }

    pageBridgeInjected = true;
    const script = document.createElement('script');
    const bridgeUrl = extensionContextUrl('content/page-bridge.js');
    if (!bridgeUrl) {
      pageBridgeInjected = false;
      return;
    }
    script.src = bridgeUrl;
    script.async = false;
    script.dataset.bcePageBridge = 'true';
    script.addEventListener('load', () => script.remove(), { once: true });
    script.addEventListener('error', () => {
      pageBridgeInjected = false;
      script.remove();
    }, { once: true });
    parent.append(script);
  }

  function mergeRecord(incoming) {
    const normalized = normalizeReply(incoming);
    if (!normalized) {
      return false;
    }

    const previous = records.get(normalized.rpid);
    const merged = previous
      ? { ...previous }
      : { rpid: normalized.rpid, ctime: null, location: null, messageText: '' };
    if (normalized.ctime !== null) {
      merged.ctime = normalized.ctime;
    }
    if (normalized.location !== null) {
      merged.location = normalized.location;
    }
    if (normalized.messageText) {
      merged.messageText = normalized.messageText;
    }
    // The page bridge may encounter the same renderer more than once while
    // Bilibili updates unrelated parts of the page. Treat an identical record
    // as a no-op: scheduling a full refresh for it was a 3-second redraw loop
    // that made metadata and translation controls visibly flash.
    const changed = !previous ||
      previous.ctime !== merged.ctime ||
      previous.location !== merged.location ||
      previous.messageText !== merged.messageText;
    if (!changed) {
      return false;
    }

    records.set(normalized.rpid, merged);

    if (records.size > 20_000) {
      const oldest = records.keys().next().value;
      records.delete(oldest);
    }
    return true;
  }

  function addRecordBatch(batch) {
    if (!Array.isArray(batch)) {
      return;
    }
    let changed = false;
    for (const item of batch.slice(0, 2_000)) {
      changed = mergeRecord(item) || changed;
    }
    if (changed) {
      // The message centre is a hash-route Vue app. Its reply rows can mount
      // after the route's initial generic child-list burst, so render the
      // visible message roots directly when public reply data arrives instead
      // of waiting for an unrelated DOM mutation to schedule another pass.
      if (isMessageReplyPage()) {
        for (const root of observedRoots) renderMessageReplyItems(root);
      } else {
        scheduleRefresh();
      }
    }
  }

  function installShadowStyle(root) {
    if (
      typeof ShadowRoot === 'undefined' ||
      !(root instanceof ShadowRoot) ||
      root.querySelector(`style[${SHADOW_STYLE_ATTRIBUTE}]`)
    ) {
      return;
    }
    const style = document.createElement('style');
    style.setAttribute(SHADOW_STYLE_ATTRIBUTE, 'true');
    style.textContent = SHADOW_STYLE_TEXT;
    root.prepend(style);
  }

  function readElementRpid(element) {
    if (!(element instanceof Element)) {
      return '';
    }

    for (const attribute of ['data-bce-rpid', 'data-rpid', 'data-reply-id', 'data-replyid']) {
      const rpid = normalizeRpid(element.getAttribute(attribute));
      if (rpid) {
        return rpid;
      }
    }

    const replyLike = element.matches(COMMENT_CONTAINER_SELECTOR);
    if (replyLike) {
      for (const attribute of ['data-id', 'data-root']) {
        const rpid = normalizeRpid(element.getAttribute(attribute));
        if (rpid) {
          return rpid;
        }
      }
    }

    const idMatch = replyLike && element.id.match(/(?:reply|comment)[-_]?(\d+)/i);
    return idMatch ? normalizeRpid(idMatch[1]) : '';
  }

  function findRpidForTarget(target) {
    let current = target;
    const seen = new Set();

    while (current && !seen.has(current)) {
      seen.add(current);
      if (current instanceof Element) {
        const rpid = readElementRpid(current);
        if (rpid) {
          return rpid;
        }
        if (current.parentElement) {
          current = current.parentElement;
          continue;
        }
      }

      const root = current.getRootNode?.();
      current = root instanceof ShadowRoot ? root.host : null;
    }

    return '';
  }

  function isStandaloneTimeTarget(target) {
    return target instanceof Element && (target.id === 'pubdate' || (
      target.matches('.reply-info,.sub-reply-info') && target.children.length === 0
    ));
  }

  function findCommentContainer(target) {
    let current = target;
    const seen = new Set();
    while (current && !seen.has(current)) {
      seen.add(current);
      if (current instanceof Element) {
        if (current.matches(COMMENT_CONTAINER_SELECTOR)) return current;
        if (current.parentElement) {
          current = current.parentElement;
          continue;
        }
      }
      const root = current.getRootNode?.();
      current = root instanceof ShadowRoot ? root.host : null;
    }
    return null;
  }

  function isInSameComment(element, owner) {
    return !owner || findCommentContainer(element) === owner;
  }

  function candidateContent(scope, target, owner) {
    if (!scope || !('querySelectorAll' in scope)) return null;
    const candidates = [];
    if (scope instanceof Element && scope.matches(COMMENT_CONTENT_SELECTOR)) candidates.push(scope);
    for (const element of scope.querySelectorAll(COMMENT_CONTENT_SELECTOR)) candidates.push(element);
    const sameComment = candidates.filter((element) => isInSameComment(element, owner));
    const beforeTarget = sameComment.filter((element) => {
      try {
        return Boolean(element.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING);
      } catch {
        return false;
      }
    });
    return beforeTarget.at(-1) || sameComment.at(-1) || null;
  }

  // The time node identifies a record, but it is deliberately not the mount
  // point. Mounting below the real comment body gives top-level comments and
  // nested replies the same left edge as their text.
  function findCommentContentAnchor(target) {
    const owner = findCommentContainer(target);
    let current = target;
    const seenRoots = new Set();
    while (current) {
      if (current instanceof Element) {
        const closest = current.closest(COMMENT_CONTENT_SELECTOR);
        if (closest && isInSameComment(closest, owner)) return closest;
      }
      const root = current.getRootNode?.();
      if (root && !seenRoots.has(root)) {
        seenRoots.add(root);
        const candidate = candidateContent(root, target, owner);
        if (candidate) return candidate;
      }
      if (root instanceof ShadowRoot) {
        current = root.host;
      } else if (current instanceof Element) {
        current = current.parentElement;
      } else {
        current = null;
      }
    }
    return null;
  }

  function findMetaForTarget(target, rpid = findRpidForTarget(target)) {
    const cached = metaByTarget.get(target);
    if (cached?.isConnected) return cached;
    const owner = findCommentContainer(target);
    let current = target;
    const seenRoots = new Set();
    while (current) {
      const root = current.getRootNode?.();
      if (root && !seenRoots.has(root) && 'querySelectorAll' in root) {
        seenRoots.add(root);
        for (const meta of root.querySelectorAll(`[${META_ATTRIBUTE}]`)) {
          if (meta.dataset.bceRpid === rpid && isInSameComment(meta, owner)) {
            metaByTarget.set(target, meta);
            return meta;
          }
        }
      }
      if (root instanceof ShadowRoot) current = root.host;
      else if (current instanceof Element) current = current.parentElement;
      else current = null;
    }
    return null;
  }

  function defaultTimeNodes(target) {
    // A mutation can be delivered after a Bilibili node has been detached,
    // and removeAllMeta also walks Document/ShadowRoot roots. Keep this
    // cleanup helper total: one stale target must never abort the entire
    // content-script refresh loop (the old uncaught exception pointed at the
    // `for` statement in setDefaultTimeHidden).
    if (!(target instanceof Element)) {
      return [];
    }
    if (isStandaloneTimeTarget(target)) {
      return [target];
    }

    return [...target.querySelectorAll([
      '.reply-time',
      '.sub-reply-time',
      '[class*="reply-time"]',
      '[class*="reply_time"]',
      '[data-time]'
    ].join(','))].filter((element) => !element.hasAttribute(META_ATTRIBUTE));
  }

  function setDefaultTimeHidden(target, hidden) {
    const nodes = defaultTimeNodes(target);
    for (const timeElement of nodes) {
      timeElement.classList.toggle(ORIGINAL_TIME_HIDDEN_CLASS, hidden);
      if (hidden) {
        timeElement.setAttribute(ORIGINAL_TIME_HIDDEN_ATTRIBUTE, 'true');
      } else {
        timeElement.removeAttribute(ORIGINAL_TIME_HIDDEN_ATTRIBUTE);
      }
    }
  }

  function removeMetaForTarget(target) {
    const rpid = findRpidForTarget(target);
    const meta = findMetaForTarget(target, rpid);
    if (meta) {
      liveTimeMetas.delete(meta);
      restoreVisibleCommentText(meta);
      findTranslationResult(meta, rpid)?.remove();
      meta.remove();
    }
    metaByTarget.delete(target);
    if (rpid) commentTranslationStates.delete(rpid);
    setDefaultTimeHidden(target, false);
  }

  function createMetaItem(className, text, title) {
    const item = document.createElement('span');
    item.className = `bce-meta-item ${className}`;
    item.textContent = text;
    if (title) {
      item.title = title;
    }
    return item;
  }

  function publicationTimeTitle(isEnglish) {
    if (prefs.timezone === 'local') {
      return isEnglish ? 'Publication time (browser local time)' : '发布时间（浏览器本地时间）';
    }
    return isEnglish ? 'Publication time (China Standard Time)' : '发布时间（北京时间）';
  }

  function createTimeGroup(display, isEnglish) {
    const group = document.createElement('span');
    group.className = 'bce-time-group';
    const title = publicationTimeTitle(isEnglish);
    if (display.kind === 'relative') {
      const relative = createMetaItem('bce-time-relative', display.relative, title);
      relative.dataset.bceTimeRelative = 'true';
      group.append(relative);
      return group;
    }
    group.append(
      createMetaItem('bce-time-date', display.date, title),
      createMetaItem('bce-time-clock', display.time, title)
    );
    return group;
  }

  function targetLanguageName(language, isEnglish) {
    const names = isEnglish
      ? { en: 'English', zh: 'Chinese', ja: 'Japanese', ko: 'Korean', fr: 'French', de: 'German', es: 'Spanish', ru: 'Russian' }
      : { en: '英语', zh: '中文', ja: '日语', ko: '韩语', fr: '法语', de: '德语', es: '西班牙语', ru: '俄语' };
    return names[language] || language;
  }

  function createTranslationButton(meta, rpid, isEnglish) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'bce-translate-comment';
    button.dataset.bceTranslateComment = 'true';
    button.dataset.bceTranslationKey = String(rpid || '');
    setTranslationButtonMode(button, false, isEnglish);
    const icon = document.createElement('img');
    icon.className = 'bce-translation-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.alt = '';
    const iconUrl = extensionContextUrl('assets/icons/google-translate.svg');
    if (iconUrl) icon.src = iconUrl;
    // Keep the accessible name in title/aria-label, but leave the visual
    // affordance as the compact translation icon requested for dense threads.
    button.append(icon);
    return button;
  }

  function translationButtonFromEvent(event) {
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    for (const candidate of path) {
      if (candidate instanceof Element && candidate.matches?.('[data-bce-translate-comment]')) {
        return candidate;
      }
    }
    const target = event.target;
    return target instanceof Element ? target.closest?.('[data-bce-translate-comment]') || null : null;
  }

  // This handler is installed on `window` at document_start, ahead of Bili's
  // router handlers. Per-button listeners run too late when a virtual-list
  // row is wrapped in a navigable notification, which is why a click could
  // navigate away or appear to require several attempts.
  function interceptTranslationInteraction(event) {
    const button = translationButtonFromEvent(event);
    if (!button || !prefs.translationEnabled) return;
    if ((event.type === 'pointerdown' || event.type === 'mousedown') && event.button !== 0) return;

    event.stopImmediatePropagation?.();
    event.stopPropagation();
    if (event.type !== 'click') return;

    event.preventDefault();
    const meta = button.closest?.(
      `[${META_ATTRIBUTE}],[${MESSAGE_META_ATTRIBUTE}],[${TITLE_META_ATTRIBUTE}]`
    );
    if (!meta) return;
    void translateComment(meta, button.dataset.bceTranslationKey || '', button);
  }

  function titleTranslationKey(title) {
    const text = commentTextFromAnchor(title).slice(0, 120);
    return `title:${location.href}:${text}`;
  }

  function titleCandidates(scope = document) {
    if (!scope || !('querySelectorAll' in scope)) return [];
    const candidates = new Set();
    if (scope instanceof Element && scope.matches(VIDEO_TITLE_SELECTOR)) candidates.add(scope);
    for (const element of scope.querySelectorAll(VIDEO_TITLE_SELECTOR)) candidates.add(element);
    const usable = [...candidates].filter((element) => {
      const text = commentTextFromAnchor(element);
      return text.length > 0 && text.length < 1_000;
    });
    // A title wrapper and its inner h1 can both match generated Bili classes;
    // only attach to the smallest visible title node.
    return usable.filter((candidate) => !usable.some(
      (other) => other !== candidate && candidate.contains(other)
    ));
  }

  function setupTitleTranslationLayout(title, holder) {
    if (!(title instanceof Element)) return;
    title.classList.add('bce-title-translation-target');
    let text = [...title.children].find((child) => child.classList.contains('bce-title-translation-text'));
    if (!text) {
      text = document.createElement('span');
      text.className = 'bce-title-translation-text';
      for (const node of [...title.childNodes]) {
        if (node !== holder) text.append(node);
      }
      // A new holder is prepared before it is attached to the title. Passing
      // that detached node to insertBefore would throw NotFoundError; append
      // the text wrapper first and let the caller attach the holder after it.
      const reference = holder?.parentElement === title ? holder : null;
      title.insertBefore(text, reference);
    }
  }

  const titleFlowAncestors = new WeakMap();

  function syncTitleFlowLayout(title) {
    if (!(title instanceof Element)) return;
    const expanded = new Set([title]);
    let node = title.parentElement;
    // Only walk the compact video-info chain. Expanding the page/app root
    // would be unnecessary and could alter unrelated layout containers.
    for (let depth = 0; node && depth < 4; depth += 1, node = node.parentElement) {
      let style;
      try {
        style = globalThis.getComputedStyle?.(node);
      } catch {
        style = null;
      }
      const constrained = style && (
        style.height !== 'auto' ||
        style.maxHeight !== 'none' ||
        /hidden|clip/iu.test(`${style.overflow} ${style.overflowY}`)
      );
      if (constrained) {
        node.classList.add('bce-title-flow-expanded');
        expanded.add(node);
      }
      if (expanded.size >= 3) break;
    }
    titleFlowAncestors.set(title, expanded);
  }

  function clearTitleFlowLayout(title) {
    const expanded = titleFlowAncestors.get(title);
    for (const element of expanded || []) {
      if (element !== title) element.classList.remove('bce-title-flow-expanded');
    }
    titleFlowAncestors.delete(title);
  }

  function teardownTitleTranslationLayout(title) {
    if (!(title instanceof Element)) return;
    const text = [...title.children].find((child) => child.classList.contains('bce-title-translation-text'));
    if (text) {
      while (text.firstChild) title.insertBefore(text.firstChild, text);
      text.remove();
    }
    title.classList.remove('bce-title-translation-target');
    clearTitleFlowLayout(title);
  }

  function renderTitleTranslationButtons(scope = document) {
    if (
      !scope ||
      !('querySelectorAll' in scope) ||
      !/^\/video(?:\/|$)/u.test(location.pathname)
    ) return;
    if (!TITLE_TRANSLATION_ENABLED) {
      for (const title of titleCandidates(scope)) {
        const existing = title.querySelector(`[${TITLE_META_ATTRIBUTE}]`);
        if (existing) restoreVisibleCommentText(existing);
        existing?.remove();
        teardownTitleTranslationLayout(title);
      }
      return;
    }
    for (const title of titleCandidates(scope)) {
      const existing = title.querySelector(`[${TITLE_META_ATTRIBUTE}]`);
      if (!prefs.commentsEnabled || !prefs.translationEnabled) {
        if (existing) restoreVisibleCommentText(existing);
        existing?.remove();
        teardownTitleTranslationLayout(title);
        continue;
      }
      if (existing) {
        setupTitleTranslationLayout(title, existing);
        syncTitleFlowLayout(title);
        const key = existing.dataset.bceRpid || titleTranslationKey(title);
        const button = existing.querySelector('[data-bce-translate-comment]');
        if (button) {
          setTranslationButtonMode(button, commentTranslationStates.get(key)?.status === 'translated', prefs.pageLanguage === 'en');
        }
        continue;
      }

      const holder = document.createElement('span');
      holder.className = 'bce-title-translation-holder';
      holder.setAttribute(TITLE_META_ATTRIBUTE, 'true');
      setupTitleTranslationLayout(title, holder);
      syncTitleFlowLayout(title);
      const key = titleTranslationKey(title);
      holder.dataset.bceRpid = key;
      holder.dataset.bceTitleKey = key;
      commentContentByMeta.set(holder, title);
      const button = createTranslationButton(holder, key, prefs.pageLanguage === 'en');
      if (commentTranslationStates.get(key)?.status === 'translated') {
        setTranslationButtonMode(button, true, prefs.pageLanguage === 'en');
      }
      holder.append(button);
      title.append(holder);
    }
  }

  function findTranslationResult(meta, rpid = meta?.dataset?.bceRpid) {
    const sibling = meta?.nextElementSibling;
    if (sibling?.hasAttribute('data-bce-comment-translation') && sibling.dataset.bceRpid === rpid) {
      return sibling;
    }
    const root = meta?.getRootNode?.();
    if (!root || !('querySelectorAll' in root)) return null;
    for (const result of root.querySelectorAll('[data-bce-comment-translation]')) {
      if (result.dataset.bceRpid === rpid) return result;
    }
    return null;
  }

  function removeAllTranslationRows(root = document) {
    if (!root || !('querySelectorAll' in root)) return;
    for (const result of root.querySelectorAll('[data-bce-comment-translation]')) {
      result.remove();
    }
  }

  function visibleTextFromOpenRoots(node, parts = [], seen = new Set()) {
    if (!node || seen.has(node)) return parts;
    seen.add(node);
    if (node.nodeType === TEXT_NODE) {
      const parent = node.parentElement;
      if (!parent?.closest?.(
        `[${META_ATTRIBUTE}],[${MESSAGE_META_ATTRIBUTE}],[data-bce-comment-translation],script,style,textarea,input,select,option`
      )) {
        parts.push(node.nodeValue || '');
      }
      return parts;
    }
    if (node instanceof Element && node.matches?.(
      `[${META_ATTRIBUTE}],[${MESSAGE_META_ATTRIBUTE}],[data-bce-comment-translation],script,style,textarea,input,select,option`
    )) {
      return parts;
    }
    for (const child of node.childNodes || []) visibleTextFromOpenRoots(child, parts, seen);
    if (node instanceof Element && node.shadowRoot) visibleTextFromOpenRoots(node.shadowRoot, parts, seen);
    return parts;
  }

  function visibleTextNodesFromOpenRoots(node, nodes = [], seen = new Set()) {
    if (!node || seen.has(node)) return nodes;
    seen.add(node);
    if (node.nodeType === TEXT_NODE) {
      const parent = node.parentElement;
      if (!parent?.closest?.(
        `[${META_ATTRIBUTE}],[${MESSAGE_META_ATTRIBUTE}],[data-bce-comment-translation],script,style,textarea,input,select,option`
      )) {
        nodes.push(node);
      }
      return nodes;
    }
    if (node instanceof Element && node.matches?.(
      `[${META_ATTRIBUTE}],[${MESSAGE_META_ATTRIBUTE}],[data-bce-comment-translation],script,style,textarea,input,select,option`
    )) {
      return nodes;
    }
    for (const child of node.childNodes || []) visibleTextNodesFromOpenRoots(child, nodes, seen);
    if (node instanceof Element && node.shadowRoot) visibleTextNodesFromOpenRoots(node.shadowRoot, nodes, seen);
    return nodes;
  }

  function setTranslationButtonMode(button, translated, isEnglish) {
    if (!button) return;
    const label = translated
      ? (isEnglish ? 'Show original comment' : '显示原文')
      : (isEnglish ? 'Translate comment' : '翻译评论');
    button.title = translated
      ? label
      : `${label} → ${targetLanguageName(prefs.commentTranslationTarget, isEnglish)}`;
    button.setAttribute('aria-label', button.title);
    button.dataset.bceTranslated = translated ? 'true' : 'false';
  }

  function syncTranslationButtons(rpid) {
    const key = String(rpid || '');
    if (!key) return;
    const state = commentTranslationStates.get(key);
    const isEnglish = prefs.pageLanguage === 'en';
    const buttons = new Set();
    for (const root of observedRoots) {
      if (!root || !('querySelectorAll' in root)) continue;
      for (const button of root.querySelectorAll('[data-bce-translate-comment]')) {
        if (button.dataset.bceTranslationKey === key) buttons.add(button);
      }
    }
    for (const button of buttons) {
      if (state?.status === 'loading') {
        button.disabled = true;
        button.dataset.bceTranslating = 'true';
        button.title = state.message || (isEnglish ? 'Preparing on-device translation…' : '正在准备本机翻译…');
        button.setAttribute('aria-label', button.title);
        continue;
      }
      button.disabled = false;
      delete button.dataset.bceTranslating;
      if (state?.status === 'translated') {
        setTranslationButtonMode(button, true, isEnglish);
      } else if (state?.status === 'error') {
        setTranslationButtonMode(button, false, isEnglish);
        button.dataset.bceTranslationError = state.message || '';
        if (state.message) {
          button.title = state.message;
          button.setAttribute('aria-label', state.message);
        }
      } else {
        delete button.dataset.bceTranslationError;
        setTranslationButtonMode(button, false, isEnglish);
      }
    }
  }

  function translationDisplayKind(anchor) {
    try {
      const display = globalThis.getComputedStyle?.(anchor)?.display || '';
      return /^inline(?:-|$)/u.test(display) ? 'inline' : 'block';
    } catch {
      return 'block';
    }
  }

  function translatedOutputAnchor(meta, anchor) {
    const state = manuallyTranslatedComments.get(meta);
    return state?.replacement?.isConnected ? state.replacement : anchor;
  }

  function copyCommentTextColor(anchor, replacement) {
    if (!(anchor instanceof Element) || !(replacement instanceof Element)) return;
    try {
      // Bilibili often applies the readable foreground to a nested text span,
      // while the row wrapper itself inherits a much darker theme color. Copy
      // the first visible source-text color so the replacement has the same
      // contrast in comment threads and nested replies.
      const sourceNode = visibleTextNodesFromOpenRoots(anchor)
        .find((node) => node.nodeValue?.trim());
      const sourceElement = sourceNode?.parentElement || anchor;
      const color = globalThis.getComputedStyle?.(sourceElement)?.color || '';
      if (color && color !== 'rgba(0, 0, 0, 0)') {
        replacement.style.setProperty('color', color, 'important');
      }
    } catch {
      // Styling must never interrupt the translation state machine.
    }
  }

  function positionMetaAfterCommentOutput(meta, anchor) {
    const output = translatedOutputAnchor(meta, anchor);
    if (output instanceof Element && meta?.previousElementSibling !== output) {
      output.insertAdjacentElement('afterend', meta);
    }
  }

  function replaceVisibleCommentText(meta, anchor, translated) {
    if (!(anchor instanceof Element) || !translated) return false;
    const existing = manuallyTranslatedComments.get(meta);
    if (existing?.replacement?.isConnected && existing.anchor === anchor) {
      existing.replacement.textContent = translated;
      copyCommentTextColor(anchor, existing.replacement);
      return true;
    }
    if (existing) restoreVisibleCommentText(meta);

    // Comment and message metadata are sibling rows. Keep the framework-owned
    // source nodes intact, including split Reply / @mention / body markup.
    if (!anchor.contains(meta) && anchor.parentElement) {
      const replacement = document.createElement('span');
      replacement.className = 'bce-manual-translation-content';
      replacement.setAttribute('data-bce-manual-translation', 'true');
      replacement.dataset.bceDisplay = translationDisplayKind(anchor);
      replacement.textContent = translated;
      const hadAriaHidden = anchor.hasAttribute('aria-hidden');
      const previousAriaHidden = anchor.getAttribute('aria-hidden');
      anchor.setAttribute('data-bce-original-comment-hidden', 'true');
      anchor.setAttribute('aria-hidden', 'true');
      anchor.insertAdjacentElement('afterend', replacement);
      copyCommentTextColor(anchor, replacement);
      manuallyTranslatedComments.set(meta, {
        anchor,
        replacement,
        hadAriaHidden,
        previousAriaHidden
      });
      return true;
    }

    // Title controls are mounted inside their title, so they cannot use the
    // sibling-output method above. Retain the narrow fallback for that layout.
    const nodes = visibleTextNodesFromOpenRoots(anchor).filter((node) => node.nodeValue?.trim());
    if (!nodes.length) return false;
    const original = nodes.map((node) => ({ node, value: node.nodeValue }));
    nodes[0].nodeValue = translated;
    for (const node of nodes.slice(1)) node.nodeValue = '';
    manuallyTranslatedComments.set(meta, { anchor, original });
    return true;
  }

  function restoreVisibleCommentText(meta) {
    const state = manuallyTranslatedComments.get(meta);
    if (!state) return false;
    if (state.replacement) {
      state.replacement.remove();
      if (state.anchor?.isConnected) {
        state.anchor.removeAttribute('data-bce-original-comment-hidden');
        if (state.hadAriaHidden) state.anchor.setAttribute('aria-hidden', state.previousAriaHidden ?? '');
        else state.anchor.removeAttribute('aria-hidden');
      }
    } else {
      for (const { node, value } of state.original || []) {
        if (node.isConnected) node.nodeValue = value;
      }
    }
    manuallyTranslatedComments.delete(meta);
    return true;
  }

  function commentTextFromAnchor(anchor) {
    // `innerText` is empty for some Bilibili component hosts even though the
    // reader can see text in their open shadow root. Traverse that root before
    // treating the comment as missing.
    const direct = anchor?.innerText || anchor?.textContent || '';
    const text = (direct || visibleTextFromOpenRoots(anchor).join(' '))
      .replace(/[\u200B-\u200D\uFEFF]/gu, '')
      .replace(/\s+/gu, ' ')
      .trim();
    return text.slice(0, 8_000);
  }

  function findCommentContentForMeta(meta) {
    const cached = commentContentByMeta.get(meta);
    if (cached?.isConnected) return cached;
    const previous = meta?.previousElementSibling;
    if (previous?.matches?.(COMMENT_CONTENT_SELECTOR)) return previous;
    return candidateContent(meta?.getRootNode?.(), meta, findCommentContainer(meta));
  }

  function inferSourceLanguage(text, targetLanguage) {
    if (/[\u3040-\u30FF]/u.test(text)) return 'ja';
    if (/[\uAC00-\uD7AF]/u.test(text)) return 'ko';
    if (/[\u0400-\u052F]/u.test(text)) return 'ru';
    if (/[\u0600-\u06FF]/u.test(text)) return 'ar';
    if (/[\u0D80-\u0DFF]/u.test(text)) return 'si';
    if (/[\u4E00-\u9FFF]/u.test(text)) return 'zh';
    return targetLanguage === 'en' ? 'zh' : 'en';
  }

  async function detectCommentLanguage(text, fallbackTarget) {
    // Short Bilibili replies such as “一年3000” are often misclassified by
    // the browser detector as English because they contain mostly digits or a
    // username. Script evidence is more reliable for these compact rows.
    const scriptLanguage = inferSourceLanguage(text, fallbackTarget);
    if (/\p{Script=Han}/u.test(text) || /[\u3040-\u30FF\uAC00-\uD7AF\u0400-\u052F\u0600-\u06FF\u0D80-\u0DFF]/u.test(text)) {
      return scriptLanguage;
    }
    const detectorApi = globalThis.LanguageDetector;
    if (!detectorApi?.availability || !detectorApi?.create) return inferSourceLanguage(text, fallbackTarget);
    try {
      const expectedInputLanguages = ['zh', 'en', 'ja', 'ko', 'fr', 'de', 'es', 'ru', 'ar', 'si'];
      const availability = await detectorApi.availability({ expectedInputLanguages });
      if (availability === 'unavailable') return inferSourceLanguage(text, fallbackTarget);
      const detector = await detectorApi.create({ expectedInputLanguages });
      try {
        const result = await detector.detect(text);
        const best = Array.isArray(result) ? result[0] : null;
        if (best?.detectedLanguage && Number(best.confidence) >= 0.45) return best.detectedLanguage;
      } finally {
        detector.destroy?.();
      }
    } catch {
      // Detection is an optional local enhancement; heuristic fallback stays
      // entirely on-device and keeps manual translation usable.
    }
    return inferSourceLanguage(text, fallbackTarget);
  }

  async function getLocalTranslator(sourceLanguage, targetLanguage, onProgress) {
    const api = globalThis.Translator;
    if (!api?.availability || !api?.create) {
      throw new Error('translator-not-supported');
    }
    const availability = await api.availability({ sourceLanguage, targetLanguage });
    if (availability === 'unavailable') throw new Error('language-pair-unavailable');
    const key = `${sourceLanguage}>${targetLanguage}`;
    let session = translatorSessions.get(key);
    if (!session) {
      session = await api.create({
        sourceLanguage,
        targetLanguage,
        monitor: (monitor) => {
          monitor?.addEventListener?.('downloadprogress', (event) => {
            const total = Number(event.total);
            const loaded = Number(event.loaded);
            const progress = Number.isFinite(total) && total > 0 && Number.isFinite(loaded)
              ? Math.round((loaded / total) * 100)
              : null;
            onProgress?.(progress);
          });
        }
      });
      translatorSessions.set(key, session);
    }
    return session;
  }

  function requestPageWorldTranslation(text, sourceLanguage, targetLanguage) {
    const id = `translation-${Date.now()}-${nextPageTranslationId++}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingPageTranslations.delete(id);
        reject(new Error('translation-bridge-timeout'));
      }, 60_000);
      pendingPageTranslations.set(id, { resolve, reject, timer });
      window.postMessage({
        source: MESSAGE_SOURCE,
        type: PAGE_TRANSLATE_REQUEST,
        id,
        text,
        sourceLanguage,
        targetLanguage
      }, '*');
    });
  }

  async function translateTextLocally(text, sourceLanguage, targetLanguage, onProgress) {
    // Some Edge versions expose Translator only to the page world. Wait a
    // bounded moment for the injected bridge to confirm its listener before
    // dispatching, instead of sending into a missing listener and waiting a
    // minute before a fallback. Once the bridge is ready the request has a
    // single, cached page-world session and normally completes immediately.
    if (!pageBridgeReady) {
      await Promise.race([
        pageBridgeReadyPromise,
        new Promise((resolve) => setTimeout(resolve, 350))
      ]);
    }
    if (pageBridgeReady) {
      return requestPageWorldTranslation(text, sourceLanguage, targetLanguage);
    }

    const translator = await getLocalTranslator(sourceLanguage, targetLanguage, onProgress);
    return translator.translate(text);
  }

  function translationFailureMessage(error, isEnglish) {
    switch (error?.message) {
      case 'translator-not-supported':
        return isEnglish ? 'This Edge version does not provide on-device translation.' : '当前 Edge 版本不支持本机翻译。';
      case 'language-pair-unavailable':
        return isEnglish ? 'This on-device language pair is not available.' : '此本机语言对暂不可用。';
      case 'same-language':
        return isEnglish ? 'The comment is already in the target language.' : '评论已是目标语言。';
      case 'translation-bridge-timeout':
        return isEnglish
          ? 'The on-device translation model did not respond. Try again after Edge finishes downloading it.'
          : '本机翻译模型没有响应。请等 Edge 完成模型下载后重试。';
      default:
        return isEnglish ? 'Translation could not be completed on this device.' : '无法在本机完成翻译。';
    }
  }

  async function translateComment(meta, rpid, button) {
    if (!prefs.translationEnabled || !button || button.dataset.bceTranslating === 'true') return;
    const isEnglish = prefs.pageLanguage === 'en';
    const targetLanguage = prefs.commentTranslationTarget;
    const content = findCommentContentForMeta(meta);
    const existing = commentTranslationStates.get(rpid);
    // Virtual-list updates can replace the button while a model is loading;
    // the state map is the single-flight guard, not just the DOM flag.
    if (existing?.status === 'loading') return;
    if (existing?.status === 'translated') {
      restoreVisibleCommentText(meta);
      commentTranslationStates.delete(rpid);
      findTranslationResult(meta, rpid)?.remove();
      setTranslationButtonMode(button, false, isEnglish);
      delete button.dataset.bceTranslationError;
      syncTranslationButtons(rpid);
      return;
    }
    const sourceText = commentTextFromAnchor(content);
    if (!sourceText) {
      const state = { status: 'error', message: isEnglish ? 'No comment text was found.' : '未找到可翻译的评论正文。' };
      commentTranslationStates.set(rpid, state);
      button.dataset.bceTranslationError = state.message;
      button.title = state.message;
      return;
    }

    button.disabled = true;
    button.dataset.bceTranslating = 'true';
    const preparing = { status: 'loading', message: isEnglish ? 'Preparing on-device translation…' : '正在准备本机翻译…' };
    commentTranslationStates.set(rpid, preparing);
    button.title = preparing.message;
    syncTranslationButtons(rpid);
    try {
      const sourceLanguage = await detectCommentLanguage(sourceText, targetLanguage);
      if (sourceLanguage === targetLanguage) throw new Error('same-language');
      const translated = await translateTextLocally(sourceText, sourceLanguage, targetLanguage, (progress) => {
        const message = progress === null
          ? (isEnglish ? 'Downloading the on-device language model…' : '正在下载本机语言模型…')
          : (isEnglish ? `Downloading the on-device language model… ${progress}%` : `正在下载本机语言模型… ${progress}%`);
        const state = { status: 'loading', message };
        commentTranslationStates.set(rpid, state);
      });
      const state = { status: 'translated', text: String(translated || '').trim() };
      if (!state.text) throw new Error('empty-translation');
      if (!replaceVisibleCommentText(meta, content, state.text)) throw new Error('comment-replacement-failed');
      commentTranslationStates.set(rpid, state);
      findTranslationResult(meta, rpid)?.remove();
      setTranslationButtonMode(button, true, isEnglish);
      delete button.dataset.bceTranslationError;
    } catch (error) {
      const state = { status: 'error', message: translationFailureMessage(error, isEnglish) };
      commentTranslationStates.set(rpid, state);
      button.dataset.bceTranslationError = state.message;
      button.title = state.message;
      removeAllTranslationRows(meta.getRootNode?.() || document);
    } finally {
      delete button.dataset.bceTranslating;
      if (button.isConnected) button.disabled = false;
      syncTranslationButtons(rpid);
    }
  }

  function renderMetaContent(meta, record) {
    const isEnglish = prefs.pageLanguage === 'en';
    const items = [];
    if (prefs.showLocation) {
      if (record.location) {
        items.push(createMetaItem(
          'bce-ip-location',
          `IP: ${translateLocation(record.location, prefs.pageLanguage)}`,
          isEnglish ? 'Public IP location supplied by Bilibili' : 'B站公开提供的 IP 属地'
        ));
      } else if (prefs.showUnavailableLocation) {
        items.push(createMetaItem(
          'bce-ip-location bce-location-unavailable',
          isEnglish ? 'IP: Not available' : 'IP: 未提供',
          isEnglish ? 'Bilibili did not provide a public IP location for this comment' : 'B站未向此页面提供该评论的 IP 属地'
        ));
      }
    }

    let hasExactTime = false;
    if (prefs.showExactTime && record.ctime !== null) {
      const display = getCommentTimeDisplay(record.ctime, prefs.timezone, prefs.pageLanguage, new Date(), prefs.timeFormat);
      if (display) {
        hasExactTime = true;
        items.push(createTimeGroup(display, isEnglish));
        if (display.kind === 'relative') liveTimeMetas.add(meta);
        else liveTimeMetas.delete(meta);
      }
    } else {
      liveTimeMetas.delete(meta);
    }

    if (prefs.translationEnabled) {
      const existingButton = meta.querySelector?.('[data-bce-translate-comment]');
      const translationButton = existingButton?.dataset.bceTranslationKey === String(record.rpid)
        ? existingButton
        : createTranslationButton(meta, record.rpid, isEnglish);
      if (commentTranslationStates.get(record.rpid)?.status === 'translated') {
        setTranslationButtonMode(translationButton, true, isEnglish);
      }
      items.push(translationButton);
    }
    meta.replaceChildren(...items);
    meta.dataset.bceRpid = record.rpid;
    if (record.ctime !== null) meta.dataset.bceCtime = String(record.ctime);
    else delete meta.dataset.bceCtime;
    removeAllTranslationRows(meta.getRootNode?.() || document);
    const translationState = commentTranslationStates.get(String(record.rpid));
    const content = findCommentContentForMeta(meta);
    if (translationState?.status === 'translated') {
      replaceVisibleCommentText(meta, content, translationState.text);
    }
    syncTranslationButtons(record.rpid);
    return hasExactTime;
  }

  function renderTarget(target) {
    if (!(target instanceof Element)) {
      return;
    }

    // Newer comment renderers place #pubdate inside a broader info wrapper.
    // Annotating only the precise node prevents a duplicate line of metadata.
    if (target.id !== 'pubdate' && target.querySelector('#pubdate')) {
      return;
    }

    if (!prefs.commentsEnabled) {
      removeMetaForTarget(target);
      return;
    }

    const rpid = findRpidForTarget(target);
    const record = rpid ? records.get(rpid) : null;
    if (!record) {
      removeMetaForTarget(target);
      return;
    }
    let meta = findMetaForTarget(target, rpid);
    if (!meta) {
      meta = document.createElement('div');
      meta.className = 'bce-comment-meta';
      meta.setAttribute(META_ATTRIBUTE, 'true');
      metaByTarget.set(target, meta);
    }
    const anchor = findCommentContentAnchor(target) || target;
    positionMetaAfterCommentOutput(meta, anchor);
    commentContentByMeta.set(meta, anchor);
    meta.dataset.bcePlacement = anchor === target ? 'time-fallback' : 'comment-content';
    const hasExactTime = renderMetaContent(meta, record);
    setDefaultTimeHidden(target, hasExactTime);
  }

  function messageReplyKey(item) {
    const existing = item.dataset.bceMessageReplyKey;
    if (existing) return existing;
    const publicId = normalizeRpid(
      item.getAttribute('data-rpid') ||
      item.getAttribute('data-reply-id') ||
      item.getAttribute('data-id')
    );
    // `source_id` from the message feed is the public comment rpid. When the
    // rendered item exposes it, use the same key as the page bridge record so
    // its IP location and second-precision timestamp attach to this reply.
    const key = publicId || `message-local-${nextMessageReplyKey++}`;
    item.dataset.bceMessageReplyKey = key;
    return key;
  }

  function findMessageReplyContent(item) {
    if (!(item instanceof Element)) return null;
    const elements = [item, ...item.querySelectorAll('*')];
    const sourceRecords = [...records.values()]
      .map((record) => comparableMessageReplyText(record.messageText))
      .filter(Boolean);

    // The message feed carries source_content even when the rendered row has
    // no stable class name (and some rows omit the `回复 @user:` prefix). Use
    // that text as the strongest row-local anchor first. This is what makes
    // every notification shape share the same IP/time/translate treatment.
    let sourceCandidate = null;
    let sourceScore = Number.POSITIVE_INFINITY;
    for (const element of elements) {
      const text = commentTextFromAnchor(element);
      if (!text || text.length >= 8_000) continue;
      const comparable = comparableMessageReplyText(text);
      if (!comparable) continue;
      for (const source of sourceRecords) {
        if (comparable !== source && !comparable.includes(source) && !source.includes(comparable)) continue;
        const exact = comparable === source ? 0 : 1;
        // Prefer exact/short body nodes over card wrappers. A small depth
        // penalty keeps a real body element ahead of a parent notification.
        const score = exact * 1_000_000 + comparable.length * 10 + element.querySelectorAll('*').length;
        if (score < sourceScore) {
          sourceScore = score;
          sourceCandidate = element;
        }
      }
    }
    if (sourceCandidate) return sourceCandidate;

    // In the live message centre a generic `.content` class may be the entire
    // application column. Never mark that broad wrapper as user content: it
    // would suppress translations for the sidebar and delete-menu labels.
    // Instead locate the smallest element carrying the reply's own
    // `Reply @name: body` line, which is stable across the current Vue skins.
    const prefixed = [];
    for (const element of item.querySelectorAll('*')) {
      const text = commentTextFromAnchor(element);
      if (MESSAGE_REPLY_PREFIX.test(text) && comparableMessageReplyText(text)) prefixed.push(element);
    }
    const leaves = prefixed.filter((candidate) => !prefixed.some(
      (other) => other !== candidate && candidate.contains(other)
    ));
    if (leaves.length) {
      return leaves.sort((left, right) => commentTextFromAnchor(left).length - commentTextFromAnchor(right).length)[0];
    }

    // Keep explicit reply-body class support for older markup, but reject a
    // broad wrapper that contains a complete notification card.
    const candidates = [];
    if (item.matches(MESSAGE_REPLY_CONTENT_SELECTOR)) candidates.push(item);
    for (const element of item.querySelectorAll(MESSAGE_REPLY_CONTENT_SELECTOR)) {
      if (!element.closest(MESSAGE_REPLY_ITEM_SELECTOR) || element.closest(MESSAGE_REPLY_ITEM_SELECTOR) === item) {
        candidates.push(element);
      }
    }
    const leafCandidates = candidates.filter((candidate) => !candidates.some(
      (other) => other !== candidate && candidate.contains(other)
    ));
    const explicit = (leafCandidates.length ? leafCandidates : candidates).find((candidate) => {
      const text = commentTextFromAnchor(candidate);
      return text.length > 0 && text.length < 8_000;
    });
    if (explicit) return explicit;

    // Last-resort support for generated message skins. Restrict the fallback
    // to body-like class names and leaf-ish nodes so the whole app `.content`
    // wrapper, usernames, and action labels are never treated as the comment.
    const bodyLike = elements.filter((candidate) => {
      if (candidate === item) return false;
      const classText = `${candidate.className || ''} ${candidate.id || ''}`;
      if (!/(?:content|text|body|message|desc|bubble|rich)/iu.test(classText)) return false;
      const text = commentTextFromAnchor(candidate);
      return text.length > 0 && text.length < 8_000;
    });
    const bodyLeaves = bodyLike.filter((candidate) => !bodyLike.some(
      (other) => other !== candidate && candidate.contains(other)
    ));
    return (bodyLeaves.length ? bodyLeaves : bodyLike)
      .sort((left, right) => commentTextFromAnchor(left).length - commentTextFromAnchor(right).length)[0] || null;
  }

  function messageTimeDisplayFromElement(element) {
    if (!(element instanceof Element)) return null;
    for (const name of ['data-ctime', 'data-timestamp', 'data-time']) {
      const value = element.getAttribute(name);
      if (/^\d{9,13}$/u.test(value || '')) {
        const exact = formatTimestamp(value, prefs.timezone, prefs.timeFormat);
        if (exact) {
          const [date, time] = exact.split(' ');
          return { date, time, exact: true };
        }
      }
    }

    const value = (element.innerText || element.textContent || '').replace(/\s+/gu, ' ').trim();
    const match = value.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日\s*(\d{1,2})\s*[:：]\s*(\d{2})(?:\s*[:：]\s*(\d{2}))?/u);
    if (match) {
      const [, year, month, day, hour, minute, second] = match;
      const parts = {
        day: twoDigits(day), month: twoDigits(month), year,
        hour: twoDigits(hour), minute: twoDigits(minute), second: twoDigits(second || 0)
      };
      const formatted = formatDateTimeParts(parts, prefs.timeFormat, Boolean(second));
      const [date, time] = formatted.split(' ');
      return {
        date,
        // The message list commonly supplies minute precision only. Do not
        // invent seconds; preserve the precision actually made public by Bili.
        time,
        exact: Boolean(second)
      };
    }

    const iso = value.match(/(\d{4})\s*[-\/]\s*(\d{1,2})\s*[-\/]\s*(\d{1,2})\s+(\d{1,2})\s*[:：]\s*(\d{2})(?:\s*[:：]\s*(\d{2}))?/u);
    if (iso) {
      const [, year, month, day, hour, minute, second] = iso;
      const parts = {
        day: twoDigits(day), month: twoDigits(month), year,
        hour: twoDigits(hour), minute: twoDigits(minute), second: twoDigits(second || 0)
      };
      const formatted = formatDateTimeParts(parts, prefs.timeFormat, Boolean(second));
      const [date, time] = formatted.split(' ');
      return {
        date,
        time,
        exact: Boolean(second)
      };
    }

    const relative = value.match(/(今天|昨天|Today|Yesterday)\s+(\d{1,2})\s*[:：]\s*(\d{2})(?:\s*[:：]\s*(\d{2}))?/iu);
    if (!relative) return null;
    const [, relativeDate, relativeHour, relativeMinute, relativeSecond] = relative;
    const englishRelative = /^today$/iu.test(relativeDate) || /^yesterday$/iu.test(relativeDate);
    const date = /^昨天$|^yesterday$/iu.test(relativeDate)
      ? (prefs.pageLanguage === 'en' ? 'Yesterday' : '昨天')
      : (prefs.pageLanguage === 'en' ? 'Today' : '今天');
    const timeParts = {
      day: '01', month: '01', year: '0000',
      hour: twoDigits(relativeHour), minute: twoDigits(relativeMinute), second: twoDigits(relativeSecond || 0)
    };
    const [, relativeTime] = formatDateTimeParts(timeParts, prefs.timeFormat, Boolean(relativeSecond)).split(' ');
    return {
      date,
      time: relativeTime,
      exact: Boolean(relativeSecond),
      sourceLanguageEnglish: englishRelative
    };
  }

  function findMessageReplyTime(item) {
    if (!(item instanceof Element)) return null;
    const candidates = messageReplyTimeElements(item);
    for (const element of candidates) {
      const display = messageTimeDisplayFromElement(element);
      if (display) return { element, display };
    }
    return null;
  }

  function messageReplyTimeElements(scope) {
    if (!scope || !('querySelectorAll' in scope)) return [];
    const candidates = new Set();
    if (scope instanceof Element && messageTimeDisplayFromElement(scope)) candidates.add(scope);
    for (const element of scope.querySelectorAll(MESSAGE_TIME_SELECTOR)) {
      if (messageTimeDisplayFromElement(element)) candidates.add(element);
    }
    // The actual message centre has periodically used hashed class names for
    // its timestamp. The visible timestamp (including 今天/昨天 and ISO
    // variants) is the invariant, so include its smallest element even when
    // its class is unrecognised.
    for (const element of scope.querySelectorAll('*')) {
      const text = (element.innerText || element.textContent || '').replace(/\s+/gu, ' ').trim();
      if ((MESSAGE_DATE_TIME_PATTERN.test(text) || MESSAGE_ISO_DATE_TIME_PATTERN.test(text) || MESSAGE_RELATIVE_TIME_PATTERN.test(text)) && messageTimeDisplayFromElement(element)) {
        candidates.add(element);
      }
    }
    return [...candidates].filter((candidate) => ![...candidate.children].some(
      (child) => messageTimeDisplayFromElement(child)
    ));
  }

  function comparableMessageReplyText(value) {
    return String(value || '')
      .replace(/<[^>]*>/gu, '')
      .replace(/\s+/gu, ' ')
      .trim()
      .replace(/^(?:回复|Reply)\s*@[^:：]+\s*[:：]\s*/iu, '')
      .trim();
  }

  function findMessageReplyContainerFromTime(timeElement) {
    let current = timeElement instanceof Element ? timeElement.parentElement : null;
    for (let depth = 0; current && depth < 10; depth += 1, current = current.parentElement) {
      if (current.closest?.(`[${MESSAGE_META_ATTRIBUTE}]`)) continue;
      if (current.matches(MESSAGE_REPLY_ITEM_SELECTOR)) return current;
      // The message centre has changed item class names a few times. A
      // timestamp plus an independently detectable reply body is a stronger
      // structural signature than any one generated CSS class.
      if (findMessageReplyContent(current)) return current;
    }
    return null;
  }

  function findMessageRecord(item, content, initialKey) {
    const direct = records.get(initialKey);
    if (direct) return direct;
    const body = comparableMessageReplyText(commentTextFromAnchor(content));
    if (!body) return null;
    for (const record of records.values()) {
      // The feed gives both the source reply text and its ctime. Matching both
      // is a safe fallback when Vue does not expose source_id as a data
      // attribute on the visual row.
      const source = comparableMessageReplyText(record.messageText);
      if (source && (source === body || source.includes(body) || body.includes(source))) return record;
    }
    // Some Bilibili builds omit source_content from the notification payload.
    // If only one visible reply record is available, it is the safe row-local
    // association; never guess among multiple unrelated notifications.
    if (records.size === 1) return records.values().next().value;
    return null;
  }

  function preserveMessageReplyUserNames(item, content) {
    if (!(item instanceof Element)) return;
    for (const candidate of item.querySelectorAll(
      '[data-user-name],[data-username],[class*="user-name"],[class*="user_name"],[class*="username"],.name,[class$="-name"],[class$="_name"]'
    )) {
      if (candidate === content || candidate.contains(content) || content?.contains(candidate)) continue;
      if (!candidate.hasAttribute('data-bce-user-content')) {
        candidate.setAttribute('data-bce-user-content', 'true');
      }
    }
  }

  function localizeMessageReplyPrefix(content) {
    if (prefs.pageLanguage !== 'en' || !content || typeof document.createTreeWalker !== 'function') return;
    const walker = document.createTreeWalker(content, SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (!MESSAGE_REPLY_PREFIX.test(node.nodeValue || '')) continue;
      const previous = translatedTextNodes.get(node);
      const original = previous && node.nodeValue === previous.translated
        ? previous.original
        : node.nodeValue;
      const translated = String(original || '').replace(/^(\s*)回复(?=\s*@)/u, '$1Reply');
      if (translated !== original) {
        translatedTextNodes.set(node, { original, translated });
        markLocalizedUi(node.parentElement);
        node.nodeValue = translated;
      }
    }
  }

  function renderMessageReplyItem(item) {
    if (!(item instanceof Element)) return;
    const existing = messageMetaByItem.get(item);
    if (!prefs.commentsEnabled || !isMessageReplyPage()) {
      existing?.remove();
      messageMetaByItem.delete(item);
      return;
    }

    // The initial verified body is more reliable than a fresh heuristic after
    // Vue splits a reply into its prefix, mention, and body descendants.
    const cachedContent = existing?.isConnected ? commentContentByMeta.get(existing) : null;
    const content = cachedContent?.isConnected && item.contains(cachedContent)
      ? cachedContent
      : findMessageReplyContent(item);
    if (!content) return;
    item.setAttribute('data-bce-message-row', 'true');
    content.setAttribute('data-bce-message-content', 'true');
    // Never replace the metadata subtree while a local model request is in
    // flight. Bilibili's virtual list can emit unrelated mutations during the
    // download; recreating the button there used to make users click several
    // times and discarded the active request's UI state.
    const activeButton = existing?.querySelector?.('[data-bce-translate-comment]');
    if (activeButton?.dataset.bceTranslating === 'true') return;
    localizeMessageReplyPrefix(content);
    if (!content.hasAttribute('data-bce-user-content')) {
      content.setAttribute('data-bce-user-content', 'true');
    }
    preserveMessageReplyUserNames(item, content);
    let key = messageReplyKey(item);
    const record = findMessageRecord(item, content, key);
    // A notification may contain the referenced message as a nested
    // `.reply-content`/`.reply-item`. Only the outer reply has a feed record;
    // skip that quoted child so it does not receive a second, detached
    // translation row. If the site renders a real row without a parent item,
    // it remains eligible as usual.
    const parentMessageItem = item.parentElement?.closest?.(MESSAGE_REPLY_ITEM_SELECTOR);
    if (parentMessageItem && !record) {
      existing?.remove();
      messageMetaByItem.delete(item);
      return;
    }
    const byContent = messageMetaByContent.get(content);
    let meta = existing?.isConnected ? existing : byContent?.isConnected ? byContent : null;
    if (!meta) {
      meta = document.createElement('div');
      meta.className = 'bce-message-meta';
      meta.setAttribute(MESSAGE_META_ATTRIBUTE, 'true');
      messageMetaByItem.set(item, meta);
    }

    // The timestamp and body are often exposed through two nested virtual-list
    // wrappers. Both wrappers can reach this same body node; keep exactly one
    // extension row for that body and remove rows left by a previous renderer.
    for (const duplicate of item.getRootNode().querySelectorAll(`[${MESSAGE_META_ATTRIBUTE}]`)) {
      if (duplicate !== meta && (
        duplicate.previousElementSibling === content ||
        duplicate.dataset.bceRpid === key
      )) {
        duplicate.remove();
      }
    }

    positionMetaAfterCommentOutput(meta, content);
    commentContentByMeta.set(meta, content);
    messageMetaByContent.set(content, meta);
    meta.dataset.bcePlacement = 'message-reply-content';

    const items = [];
    if (record && record.rpid !== key) {
      key = record.rpid;
      item.dataset.bceMessageReplyKey = key;
    }
    meta.dataset.bceRpid = key;
    const isEnglish = prefs.pageLanguage === 'en';
    if (prefs.showLocation) {
      if (record?.location) {
        items.push(createMetaItem(
          'bce-ip-location',
          `IP: ${translateLocation(record.location, prefs.pageLanguage)}`,
          isEnglish ? 'Public IP location supplied by Bilibili' : 'B站公开提供的 IP 属地'
        ));
      } else if (prefs.showUnavailableLocation) {
        items.push(createMetaItem(
          'bce-ip-location bce-location-unavailable',
          isEnglish ? 'IP: Not available' : 'IP: 未提供',
          isEnglish
            ? 'Bilibili did not provide a public IP location for this reply'
            : 'B站未向此页面提供该回复的 IP 属地'
        ));
      }
    }

    const time = findMessageReplyTime(item);
    const timestamp = record?.ctime ?? null;
    if (prefs.showExactTime && timestamp !== null) {
      const display = getCommentTimeDisplay(timestamp, prefs.timezone, prefs.pageLanguage, new Date(), prefs.timeFormat);
      if (display) {
        items.push(createTimeGroup(display, isEnglish));
        if (time?.element) {
          time.element.classList.add(ORIGINAL_TIME_HIDDEN_CLASS);
          time.element.setAttribute(ORIGINAL_TIME_HIDDEN_ATTRIBUTE, 'true');
        }
      }
    } else if (prefs.showExactTime && time) {
      const group = document.createElement('span');
      group.className = 'bce-time-group';
      const title = time.display.exact
        ? (isEnglish ? 'Reply time supplied by Bilibili' : 'B站提供的回复时间')
        : (isEnglish
          ? 'Bilibili supplied this reply time to the minute'
          : 'B站仅向此页面提供了分钟精度的回复时间');
      group.append(
        createMetaItem('bce-time-date', time.display.date, title),
        createMetaItem('bce-time-clock', time.display.time, title)
      );
      items.push(group);
      time.element.classList.add(ORIGINAL_TIME_HIDDEN_CLASS);
      time.element.setAttribute(ORIGINAL_TIME_HIDDEN_ATTRIBUTE, 'true');
    }

    const translationState = commentTranslationStates.get(String(key));
    if (prefs.translationEnabled) {
      const existingTranslationButton = meta.querySelector?.('[data-bce-translate-comment]');
      const translationButton = existingTranslationButton?.dataset.bceTranslationKey === String(key)
        ? existingTranslationButton
        : createTranslationButton(meta, key, isEnglish);
      if (translationState?.status === 'translated') {
        setTranslationButtonMode(translationButton, true, isEnglish);
      }
      items.push(translationButton);
    }
    meta.replaceChildren(...items);
    removeAllTranslationRows(meta.getRootNode?.() || document);
    if (translationState?.status === 'translated') {
      replaceVisibleCommentText(meta, content, translationState.text);
    }
    syncTranslationButtons(key);
  }

  function renderMessageReplyItems(scope = document) {
    if (!isMessageReplyPage() || !scope || !('querySelectorAll' in scope)) return;
    removeAllTranslationRows(scope.getRootNode?.() || scope);
    const items = new Set();
    if (scope instanceof Element && scope.matches(MESSAGE_REPLY_ITEM_SELECTOR)) {
      items.add(scope);
    }
    for (const item of scope.querySelectorAll(MESSAGE_REPLY_ITEM_SELECTOR)) {
      items.add(item);
    }
    // Fallback for Vue class-name changes: discover an item from its native
    // timestamp toolbar, then verify that it contains a reply body before
    // mounting anything. This also avoids touching the direct-message route.
    for (const timeElement of messageReplyTimeElements(scope)) {
      const item = findMessageReplyContainerFromTime(timeElement);
      if (item) items.add(item);
    }
    for (const item of items) renderMessageReplyItem(item);
  }

  function removeAllMeta() {
    restoreAllTranslatedComments();
    for (const root of observedRoots) {
      if (!root.isConnected && root !== document) {
        continue;
      }
      for (const target of root.querySelectorAll(META_TARGET_SELECTOR)) {
        setDefaultTimeHidden(target, false);
      }
      for (const element of root.querySelectorAll(`[${META_ATTRIBUTE}]`)) {
        element.remove();
      }
      for (const element of root.querySelectorAll(`[${MESSAGE_META_ATTRIBUTE}]`)) {
        element.remove();
      }
      for (const element of root.querySelectorAll(`[${TITLE_META_ATTRIBUTE}]`)) {
        element.remove();
      }
      for (const element of root.querySelectorAll(`[${ORIGINAL_TIME_HIDDEN_ATTRIBUTE}]`)) {
        element.classList.remove(ORIGINAL_TIME_HIDDEN_CLASS);
        element.removeAttribute(ORIGINAL_TIME_HIDDEN_ATTRIBUTE);
      }
      for (const element of root.querySelectorAll('[data-bce-comment-translation]')) {
        element.remove();
      }
    }
    liveTimeMetas.clear();
    commentTranslationStates.clear();
    destroyTranslatorSessions();
  }

  function discoverShadowRoots(root) {
    if (!root || !('querySelectorAll' in root)) {
      return;
    }

    if (root instanceof Element && root.shadowRoot) {
      observeRoot(root.shadowRoot);
    }
    // Navigation fly-outs are mounted lazily and are not limited to comment
    // components. Observe every *open* shadow root so the fixed UI catalogue
    // can reach those menus as they appear; closed roots stay platform-private.
    for (const host of root.querySelectorAll('*')) {
      if (host.shadowRoot) {
        observeRoot(host.shadowRoot);
      }
    }
  }

  function scanNode(node) {
    if (node?.nodeType === TEXT_NODE) {
      applyPageLanguage(node);
      return;
    }
    if (!node || !('querySelectorAll' in node)) {
      return;
    }

    // Mark message-centre usernames as user content before translating any
    // surrounding fixed labels. This prevents a username that happens to be a
    // dictionary word from being rewritten.
    renderMessageReplyItems(node);
    renderTitleTranslationButtons(node);
    applyPageLanguage(node);
    discoverShadowRoots(node);
    if (
      node instanceof Element &&
      (node.matches(BANNER_CONTAINER_SELECTOR) || node.querySelector(BANNER_CONTAINER_SELECTOR))
    ) {
      applyBanner();
    }
    if (node instanceof Element && node.matches(META_TARGET_SELECTOR)) {
      renderTarget(node);
    }
    for (const target of node.querySelectorAll(META_TARGET_SELECTOR)) {
      renderTarget(target);
    }
  }

  function observeRoot(root) {
    if (!root || observedRoots.has(root)) {
      return;
    }

    observedRoots.add(root);
    installShadowStyle(root);
    scanNode(root);

    const observer = new MutationObserver((mutations) => {
      let shouldRefresh = false;
      for (const mutation of mutations) {
        const targetElement = mutation.target instanceof Element ? mutation.target : mutation.target?.parentElement;
        if (targetElement?.closest?.(
          `[${META_ATTRIBUTE}],[${MESSAGE_META_ATTRIBUTE}],[data-bce-comment-translation]`
        )) {
          continue;
        }
        if (mutation.type === 'characterData') {
          applyPageLanguage(mutation.target);
          continue;
        }
        if (mutation.type === 'attributes') {
          scanNode(mutation.target);
          const replyIdChanged = ['data-bce-rpid', 'data-rpid', 'data-reply-id', 'data-id'].includes(mutation.attributeName);
          const commentHost = targetElement?.closest?.(
            `${COMMENT_CONTAINER_SELECTOR},${MESSAGE_REPLY_ITEM_SELECTOR},${RENDERER_SELECTOR}`
          );
          shouldRefresh = shouldRefresh || (replyIdChanged && Boolean(commentHost));
          continue;
        }
        // Bilibili's player and recommendation widgets mutate continuously.
        // A generic child-list mutation is not a comment-data update: making
        // it trigger refreshAll() re-rendered every metadata row at animation
        // speed, causing the visible flashing reported on video pages. Newly
        // added nodes are handled precisely below; reply records and ID
        // attributes are the only paths that request a full metadata refresh.
        for (const addedNode of mutation.addedNodes) {
          scanNode(addedNode);
        }
      }
      if (shouldRefresh) {
        scheduleRefresh();
      }
    });
    observer.observe(root, {
      attributes: true,
      attributeFilter: [
        'data-bce-rpid', 'data-rpid', 'data-reply-id', 'data-id',
        ...TRANSLATABLE_ATTRIBUTE_NAMES
      ],
      childList: true,
      characterData: true,
      subtree: true
    });
    rootObservers.set(root, observer);
  }

  function refreshAll() {
    refreshScheduled = false;
    if (!prefs.commentsEnabled) {
      removeAllMeta();
      return;
    }

    for (const root of [...observedRoots]) {
      if (root !== document && !root.host?.isConnected) {
        rootObservers.get(root)?.disconnect();
        rootObservers.delete(root);
        observedRoots.delete(root);
        continue;
      }
      for (const target of root.querySelectorAll(META_TARGET_SELECTOR)) {
        renderTarget(target);
      }
      renderMessageReplyItems(root);
      renderTitleTranslationButtons(root);
    }
  }

  function scheduleRefresh() {
    if (refreshScheduled) {
      return;
    }
    refreshScheduled = true;
    // Do not rely on requestAnimationFrame here: Bilibili can hydrate comments
    // while its tab is in the background, where rAF is deliberately paused.
    // A tiny timer also batches MutationObserver bursts without losing updates.
    setTimeout(refreshAll, 40);
  }

  function recoverLiveTimeMetas() {
    // Bilibili occasionally replaces a comment's info subtree after its
    // initial hydration. The old metadata element then becomes disconnected
    // and drops out of the Set even though the visible reply is still a
    // same-day comment. Re-adopt only our own live-time rows; this is a tiny,
    // bounded selector scan once a second rather than a page-wide refresh.
    for (const root of observedRoots) {
      if (!root || (root !== document && !root.host?.isConnected) || !('querySelectorAll' in root)) continue;
      for (const meta of root.querySelectorAll(
        `[${META_ATTRIBUTE}][data-bce-ctime],[${MESSAGE_META_ATTRIBUTE}][data-bce-ctime]`
      )) {
        if (meta.querySelector('[data-bce-time-relative]')) liveTimeMetas.add(meta);
      }
    }
  }

  function updateLiveCommentTimes() {
    if (!prefs.commentsEnabled || !prefs.showExactTime) {
      liveTimeMetas.clear();
      return;
    }
    recoverLiveTimeMetas();
    for (const meta of [...liveTimeMetas]) {
      try {
        if (!meta.isConnected) {
          liveTimeMetas.delete(meta);
          continue;
        }
        const record = records.get(meta.dataset.bceRpid);
        if (!record || record.ctime === null) {
          liveTimeMetas.delete(meta);
          continue;
        }
        const display = getCommentTimeDisplay(record.ctime, prefs.timezone, prefs.pageLanguage, new Date(), prefs.timeFormat);
        if (!display || display.kind !== 'relative') {
          renderMetaContent(meta, record);
          continue;
        }
        const timeNode = meta.querySelector('[data-bce-time-relative]');
        if (timeNode) timeNode.textContent = display.relative;
        else renderMetaContent(meta, record);
      } catch {
        // One malformed/recycled renderer must never stop every other live
        // clock or prevent the following one-second tick from being queued.
        liveTimeMetas.delete(meta);
      }
    }
  }

  function scheduleLiveTimeTick() {
    const delay = Math.max(20, 1_010 - (Date.now() % 1_000));
    setTimeout(() => {
      try {
        updateLiveCommentTimes();
      } finally {
        // Always re-arm the timer, including when a site renderer is replaced
        // in the middle of an update.
        scheduleLiveTimeTick();
      }
    }, delay);
  }

  function clearCommentTranslations() {
    restoreAllTranslatedComments();
    for (const root of observedRoots) {
      if (!root.isConnected && root !== document) continue;
      for (const result of root.querySelectorAll('[data-bce-comment-translation]')) result.remove();
    }
    commentTranslationStates.clear();
  }

  function restoreAllTranslatedComments() {
    for (const meta of [...manuallyTranslatedComments.keys()]) {
      restoreVisibleCommentText(meta);
    }
  }

  function destroyTranslatorSessions() {
    for (const session of translatorSessions.values()) session?.destroy?.();
    translatorSessions.clear();
  }

  function isSupportedBannerImage(value) {
    return /^data:image\/(?:png|jpe?g|webp|gif|avif);base64,[a-z0-9+/=\s]+$/i.test(value);
  }

  function isHomePage() {
    return isMainBilibiliSite() && (location.pathname === '/' || location.pathname === '');
  }

  function applyBanner() {
    const root = document.documentElement;
    if (!root) {
      return;
    }
    const enabled = prefs.bannerEnabled && isHomePage() && isSupportedBannerImage(prefs.bannerImage);
    root.classList.toggle('bce-custom-banner-active', enabled);
    // This homepage-only navigation entry is redundant regardless of whether
    // the user currently has a custom banner image selected.
    root.classList.toggle('bce-hide-home-logo', isHomePage());

    // Bilibili has shipped several header skins whose brand anchor no longer
    // carries `.bili-header__logo`. Mark every known home-header brand link so
    // the removal is unconditional and survives lazy header hydration.
    for (const logo of document.querySelectorAll(HOME_LOGO_SELECTOR)) {
      logo.toggleAttribute('data-bce-home-logo', isHomePage());
    }

    for (const container of document.querySelectorAll(BANNER_CONTAINER_SELECTOR)) {
      container.classList.toggle('bce-custom-banner-target', enabled);
    }

    if (!enabled) {
      root.style.removeProperty('--bce-banner-image');
      root.style.removeProperty('--bce-banner-height');
      root.style.removeProperty('--bce-banner-dim');
      return;
    }

    root.style.setProperty('--bce-banner-image', `url("${prefs.bannerImage.replace(/\s/g, '')}")`);
    root.style.setProperty('--bce-banner-height', `${prefs.bannerHeight}px`);
    root.style.setProperty('--bce-banner-dim', String(prefs.bannerDim));
  }

  function applyPreferences(nextPrefs) {
    const previous = prefs;
    prefs = normalizePreferences(nextPrefs);
    if (
      previous.commentTranslationTarget !== prefs.commentTranslationTarget ||
      (previous.translationEnabled && !prefs.translationEnabled)
    ) {
      clearCommentTranslations();
      destroyTranslatorSessions();
    }
    applyPageLanguage();
    applyBanner();
    scheduleRefresh();
  }

  function loadPreferences() {
    let settled = false;
    const accept = (result) => {
      if (settled) {
        return;
      }
      settled = true;
      applyPreferences(result?.prefs);
    };

    try {
      if (!chrome.storage?.local?.get) {
        applyPreferences(null);
        return;
      }
      const result = chrome.storage.local.get('prefs', accept);
      if (result && typeof result.then === 'function') {
        result.then(accept).catch(() => accept(null));
      }
    } catch {
      applyPreferences(null);
    }
  }

  function handlePageBridgeMessage(event) {
    // In Chromium isolated worlds, a same-page WindowProxy can be wrapped
    // differently from this script's `window`, so strict object identity is
    // not reliable. Origin + the narrow message schema below is stable.
    if (event.origin !== location.origin) {
      return;
    }
    const message = event.data;
    if (message?.source === MESSAGE_SOURCE && message.type === PAGE_BRIDGE_READY) {
      pageBridgeReady = true;
      resolvePageBridgeReady?.();
      resolvePageBridgeReady = null;
      return;
    }
    if (message?.source === MESSAGE_SOURCE && message.type === PAGE_TRANSLATE_RESPONSE) {
      const pending = pendingPageTranslations.get(message.id);
      if (!pending) return;
      pendingPageTranslations.delete(message.id);
      clearTimeout(pending.timer);
      if (message.ok) pending.resolve(String(message.text || ''));
      else pending.reject(new Error(String(message.error || 'translation-failed')));
      return;
    }
    if (
      !message ||
      message.source !== MESSAGE_SOURCE ||
      message.type !== 'reply-records'
    ) {
      return;
    }
    addRecordBatch(message.records);
  }

  // Register before adding the page-world bridge. Message-centre requests can
  // start during document construction, and otherwise their first batch would
  // be posted before the isolated world had a listener.
  window.addEventListener('message', handlePageBridgeMessage);
  for (const eventName of ['pointerdown', 'mousedown', 'click']) {
    window.addEventListener(eventName, interceptTranslationInteraction, true);
  }
  injectPageBridge();
  observeRoot(document);
  loadPreferences();
  applyBanner();

  try {
    chrome.storage?.onChanged?.addListener((changes, areaName) => {
      try {
        if (areaName === 'local' && changes.prefs) {
          applyPreferences(changes.prefs.newValue);
        }
      } catch {
        // The extension may have been reloaded while this tab was open.
      }
    });
  } catch {
    // An invalidated context cannot subscribe to storage changes.
  }

  for (const eventName of ['pageshow', 'popstate', 'hashchange']) {
    window.addEventListener(eventName, () => {
      applyBanner();
      scheduleRefresh();
    });
  }

  scheduleLiveTimeTick();

  // A few bounded post-hydration passes cover custom elements that attach an
  // open shadow root just after their host is connected. Discovering a new
  // root observes and renders that root itself; a document-wide refresh here
  // would replace every metadata row while an otherwise unrelated part of the
  // page (for example the video player) is actively mutating.
  for (const delay of [250, 1_000, 3_000]) {
    setTimeout(() => {
      discoverShadowRoots(document);
    }, delay);
  }
})();
