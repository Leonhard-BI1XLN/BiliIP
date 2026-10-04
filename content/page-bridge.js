(() => {
  'use strict';

  // Bump this marker when bridge capabilities change. Otherwise a user who
  // reloads the extension without refreshing an existing Bilibili tab can
  // leave the old page-world listener installed and translation requests will
  // appear to do nothing.
  const BRIDGE_FLAG = '__biliCommentEnhancerBridgeInstalled_v118__';
  const LEGACY_BRIDGE_FLAG = '__biliCommentEnhancerBridgeInstalled__';
  const MESSAGE_SOURCE = 'bili-comment-enhancer:page-bridge';
  const PAGE_TRANSLATE_REQUEST = 'translate-request-v118';
  const PAGE_TRANSLATE_RESPONSE = 'translate-response-v118';
  const PAGE_BRIDGE_READY = 'bridge-ready-v118';
  const RENDERER_SELECTOR = [
    'bili-comment-thread-renderer',
    'bili-comment-renderer',
    'bili-comment-reply-renderer'
  ].join(',');
  const SHADOW_HOST_SELECTOR = [
    'bili-comments',
    'bili-comment-list-renderer',
    'bili-comment-thread-renderer',
    'bili-comment-renderer',
    'bili-comment-replies-renderer',
    'bili-comment-reply-renderer'
  ].join(',');

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

  function normalizeTimestamp(value) {
    if (typeof value === 'string' && !/^\d+(?:\.\d+)?$/.test(value.trim())) {
      return null;
    }

    const timestamp = Number(value);
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
      return null;
    }

    const seconds = timestamp > 10_000_000_000
      ? Math.floor(timestamp / 1000)
      : Math.floor(timestamp);
    return seconds > 0 ? seconds : null;
  }

  function normalizeLocation(value) {
    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value
      .replace(/^\s*IP\s*(?:属地|归属地)?\s*[:：]\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    return normalized || null;
  }

  function readReplyControl(reply) {
    if (!reply || typeof reply !== 'object') {
      return null;
    }

    const control = reply.reply_control ?? reply.replyControl;
    return control && typeof control === 'object' ? control : null;
  }

  function compactReply(reply) {
    if (!reply || typeof reply !== 'object') {
      return null;
    }

    // String ids preserve Bilibili's 64-bit reply ids exactly. Prefer them to
    // a numeric `rpid`, which can exceed JavaScript's safe-integer range.
    let rpid = normalizeRpid(
      reply.rpid_str ?? reply.rpidStr ?? reply.reply_id ?? reply.replyId
    );
    if (!rpid) {
      rpid = normalizeRpid(reply.rpid);
    }

    // Some renderer models expose the reply id as `id`. Only accept it when
    // other reply-specific fields are present so a member/video id is never
    // mistaken for a comment id.
    if (!rpid && (
      'ctime' in reply ||
      'reply_control' in reply ||
      'replyControl' in reply ||
      'replies' in reply
    )) {
      rpid = normalizeRpid(reply.id);
    }

    if (!rpid) {
      return null;
    }

    const control = readReplyControl(reply);
    const ctime = normalizeTimestamp(
      reply.ctime ?? reply.create_time ?? reply.createTime ?? reply.ctime_ts ?? reply.ctimeTs
    );
    const location = normalizeLocation(
      control?.location ??
      control?.ip_location ??
      control?.ipLocation ??
      reply.ip_location ??
      reply.ipLocation ??
      reply.location
    );

    return { rpid, ctime, location };
  }

  function mergeRecord(target, incoming) {
    if (!target) {
      return { ...incoming };
    }

    if (incoming.ctime !== null) {
      target.ctime = incoming.ctime;
    }
    if (incoming.location !== null) {
      target.location = incoming.location;
    }
    if (incoming.messageText) {
      target.messageText = incoming.messageText;
    }
    return target;
  }

  function extractReplyRecords(payload) {
    if (!payload || typeof payload !== 'object') {
      return [];
    }

    const records = new Map();
    const seen = new WeakSet();
    const stack = [{ value: payload, depth: 0 }];
    let visited = 0;

    while (stack.length && visited < 30_000) {
      const { value, depth } = stack.pop();
      if (!value || typeof value !== 'object' || seen.has(value)) {
        continue;
      }

      if (typeof Node !== 'undefined' && value instanceof Node) {
        continue;
      }

      seen.add(value);
      visited += 1;

      let compact = null;
      try {
        compact = compactReply(value);
      } catch {
        // Reactive renderer models may contain getters that throw while the
        // component is being disconnected. Skipping that object is harmless.
      }

      if (compact) {
        records.set(compact.rpid, mergeRecord(records.get(compact.rpid), compact));
      }

      if (depth >= 16) {
        continue;
      }

      if (Array.isArray(value)) {
        const limit = Math.min(value.length, 10_000);
        for (let index = limit - 1; index >= 0; index -= 1) {
          const child = value[index];
          if (child && typeof child === 'object') {
            stack.push({ value: child, depth: depth + 1 });
          }
        }
        continue;
      }

      let keys;
      try {
        keys = Object.keys(value);
      } catch {
        continue;
      }

      for (let index = keys.length - 1; index >= 0; index -= 1) {
        const key = keys[index];
        // These fields contain large unrelated models and cannot contain
        // nested replies. Avoid walking them on every renderer poll.
        if (/^(?:member|user|avatar|pictures?|emote|jump_url|jumpUrl|card_label)$/i.test(key)) {
          continue;
        }

        try {
          const child = value[key];
          if (child && typeof child === 'object') {
            stack.push({ value: child, depth: depth + 1 });
          }
        } catch {
          // Ignore unstable Proxy/getter properties.
        }
      }
    }

    return [...records.values()];
  }

  function isReplyEndpoint(input) {
    let url;
    try {
      url = new URL(String(input), location.href);
    } catch {
      return false;
    }

    const bilibiliHost = url.hostname === 'bilibili.com' || url.hostname.endsWith('.bilibili.com');
    return bilibiliHost && /^\/x\/v2\/reply(?:\/|$)/.test(url.pathname);
  }

  function isMessageReplyEndpoint(input) {
    let url;
    try {
      url = new URL(String(input), location.href);
    } catch {
      return false;
    }
    const bilibiliHost = url.hostname === 'bilibili.com' || url.hostname.endsWith('.bilibili.com');
    return bilibiliHost && /^\/x\/(?:im\/web\/)?msgfeed\/reply$/u.test(url.pathname);
  }

  function compactMessageReplyNotification(entry) {
    const item = entry?.item;
    if (!entry || !item || typeof item !== 'object') return null;
    const rpid = normalizeRpid(item.source_id ?? item.sourceId);
    const oid = normalizeRpid(item.subject_id ?? item.subjectId);
    const type = Number(item.business_id ?? item.businessId);
    const root = normalizeRpid(item.root_id ?? item.rootId) || '0';
    if (!rpid || !oid || !Number.isInteger(type) || type <= 0) return null;
    const messageText = typeof item.source_content === 'string'
      ? item.source_content.replace(/\s+/gu, ' ').trim().slice(0, 8_000)
      : '';
    const location = normalizeLocation(
      item.reply_control?.location ??
      item.replyControl?.location ??
      item.ip_location ??
      item.ipLocation ??
      item.location
    );
    return {
      rpid,
      ctime: normalizeTimestamp(entry.reply_time ?? entry.replyTime),
      location,
      messageText,
      lookup: { rpid, oid, type, root }
    };
  }

  function extractMessageReplyNotifications(payload) {
    const entries = payload?.data?.items;
    if (!Array.isArray(entries)) return [];
    const records = [];
    for (const entry of entries.slice(0, 100)) {
      const record = compactMessageReplyNotification(entry);
      if (record) records.push(record);
    }
    return records;
  }

  // Exposed for the repository's zero-dependency VM tests. This object only
  // contains pure helpers/constants and no page or extension data.
  try {
    Object.defineProperty(globalThis, '__BILI_ASSISTANT_PAGE_TEST__', {
      configurable: true,
      value: Object.freeze({
        extractReplyRecords,
        extractMessageReplyNotifications,
        isMessageReplyEndpoint,
        isReplyEndpoint,
        normalizeLocation,
        normalizeRpid,
        RENDERER_SELECTOR
      })
    });
  } catch {
    // A page can reserve this optional test hook; the bridge still functions.
  }

  if (globalThis[BRIDGE_FLAG]) {
    return;
  }

  try {
    Object.defineProperty(globalThis, BRIDGE_FLAG, {
      configurable: false,
      value: true
    });
  } catch {
    globalThis[BRIDGE_FLAG] = true;
  }
  // Keep the stable diagnostic marker used by older smoke checks and by
  // already-open content pages; the versioned marker above is what prevents
  // an old bridge from suppressing this newer one.
  try {
    Object.defineProperty(globalThis, LEGACY_BRIDGE_FLAG, {
      configurable: true,
      value: true
    });
  } catch {
    try { globalThis[LEGACY_BRIDGE_FLAG] = true; } catch { /* readonly */ }
  }

  const pendingRecords = new Map();
  const pendingMessageLookups = new Map();
  const attemptedMessageLookups = new Set();
  const translationSessions = new Map();
  // BI1XLN
  const translationSessionPromises = new Map();
  let publishScheduled = false;
  let messageLookupScheduled = false;
  let messageLookupsInFlight = 0;
  let hydratedMessageRoute = '';

  function postTranslationResponse(id, ok, value) {
    window.postMessage({
      source: MESSAGE_SOURCE,
      type: PAGE_TRANSLATE_RESPONSE,
      id,
      ok,
      ...(ok ? { text: String(value || '') } : { error: String(value || 'translation-failed') })
    }, '*');
  }

  async function translateInPageWorld(request) {
    const id = typeof request?.id === 'string' ? request.id : '';
    const text = typeof request?.text === 'string' ? request.text.slice(0, 8_000) : '';
    const sourceLanguage = typeof request?.sourceLanguage === 'string' ? request.sourceLanguage : '';
    const targetLanguage = typeof request?.targetLanguage === 'string' ? request.targetLanguage : '';
    if (!id || !text || !sourceLanguage || !targetLanguage) return;
    try {
      const api = globalThis.Translator;
      if (!api?.availability || !api?.create) throw new Error('translator-not-supported');
      const availability = await api.availability({ sourceLanguage, targetLanguage });
      if (availability === 'unavailable') throw new Error('language-pair-unavailable');
      const key = `${sourceLanguage}>${targetLanguage}`;
      let session = translationSessions.get(key);
      if (!session) {
        let sessionPromise = translationSessionPromises.get(key);
        if (!sessionPromise) {
          sessionPromise = Promise.resolve(api.create({ sourceLanguage, targetLanguage }));
          translationSessionPromises.set(key, sessionPromise);
        }
        try {
          session = await sessionPromise;
          translationSessions.set(key, session);
        } finally {
          translationSessionPromises.delete(key);
        }
      }
      const translated = await session.translate(text);
      postTranslationResponse(id, true, translated);
    } catch (error) {
      postTranslationResponse(id, false, error?.message || 'translation-failed');
    }
  }

  window.addEventListener('message', (event) => {
    if (event.origin !== location.origin) return;
    const message = event.data;
    if (message?.source === MESSAGE_SOURCE && message.type === PAGE_TRANSLATE_REQUEST) {
      void translateInPageWorld(message);
    }
  });

  // A positive readiness signal makes translation dispatch deterministic. The
  // content script no longer has to post into a page listener that has not
  // loaded yet, then make the user click again after a long timeout.
  window.postMessage({
    source: MESSAGE_SOURCE,
    type: PAGE_BRIDGE_READY,
    version: '1.18.0'
  }, '*');

  function publishRecords(records) {
    for (const record of records) {
      const normalized = compactReply(record);
      if (!normalized) {
        continue;
      }
      if (typeof record.messageText === 'string' && record.messageText) {
        normalized.messageText = record.messageText;
      }
      pendingRecords.set(
        normalized.rpid,
        mergeRecord(pendingRecords.get(normalized.rpid), normalized)
      );
    }

    if (!pendingRecords.size || publishScheduled) {
      return;
    }

    publishScheduled = true;
    queueMicrotask(() => {
      publishScheduled = false;
      if (!pendingRecords.size) {
        return;
      }

      const recordsToSend = [...pendingRecords.values()].slice(0, 2_000);
      for (const record of recordsToSend) {
        pendingRecords.delete(record.rpid);
      }

      window.postMessage({
        source: MESSAGE_SOURCE,
        type: 'reply-records',
        records: recordsToSend
      }, '*');

      if (pendingRecords.size) {
        publishRecords([]);
      }
    });
  }

  function requestMessageReplyDetail(lookup) {
    const url = new URL(
      lookup.root !== '0' ? '/x/v2/reply/detail' : '/x/v2/reply/main',
      'https://api.bilibili.com'
    );
    url.searchParams.set('type', String(lookup.type));
    url.searchParams.set('oid', lookup.oid);
    url.searchParams.set('ps', '20');
    url.searchParams.set('seek_rpid', lookup.rpid);
    if (lookup.root !== '0') {
      url.searchParams.set('root', lookup.root);
      url.searchParams.set('next', '0');
    } else {
      url.searchParams.set('mode', '3');
      url.searchParams.set('next', '0');
    }
    return fetch(url.toString(), { credentials: 'include' })
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (!payload) return;
        const exact = extractReplyRecords(payload).find((record) => record.rpid === lookup.rpid);
        if (exact) publishRecords([exact]);
      })
      .catch(() => {
        // A deleted comment, unsupported business type, or page-level API
        // restriction simply leaves this one public location unavailable.
      });
  }

  function drainMessageReplyLookups() {
    messageLookupScheduled = false;
    while (messageLookupsInFlight < 2 && pendingMessageLookups.size) {
      const [key, lookup] = pendingMessageLookups.entries().next().value;
      pendingMessageLookups.delete(key);
      messageLookupsInFlight += 1;
      requestMessageReplyDetail(lookup).finally(() => {
        messageLookupsInFlight -= 1;
        if (pendingMessageLookups.size && !messageLookupScheduled) {
          messageLookupScheduled = true;
          setTimeout(drainMessageReplyLookups, 80);
        }
      });
    }
  }

  function queueMessageReplyLookup(lookup) {
    if (!lookup || attemptedMessageLookups.has(lookup.rpid)) return;
    attemptedMessageLookups.add(lookup.rpid);
    // This is an on-demand UI enhancement, not a background crawler. Limit a
    // session to the rows a user can reasonably reach in the message list.
    if (attemptedMessageLookups.size > 200) return;
    pendingMessageLookups.set(lookup.rpid, lookup);
    if (!messageLookupScheduled) {
      messageLookupScheduled = true;
      queueMicrotask(drainMessageReplyLookups);
    }
  }

  function hydrateMessageReplyRecords() {
    const route = `${location.hostname}${location.hash}`;
    if (
      hydratedMessageRoute === route ||
      location.hostname !== 'message.bilibili.com' ||
      !/^#\/reply(?:\/|$|\?)/u.test(location.hash)
    ) {
      return;
    }
    hydratedMessageRoute = route;

    // Do not depend on the Vue application happening to issue its feed call
    // after the content script starts. The documented Bilibili reply feed is
    // fetched once for this visible route with the user's existing Bili
    // session, stays in the page world, and is used only to decorate rows the
    // user can already see. It neither uploads nor transmits this data to any
    // third party.
    const endpoints = [
      'https://api.bilibili.com/x/msgfeed/reply?platform=web&build=0&mobi_app=web',
      'https://api.vc.bilibili.com/x/im/web/msgfeed/reply?platform=web&build=0&mobi_app=web'
    ];
    const tryEndpoint = (index) => {
      if (index >= endpoints.length) return;
      fetch(endpoints[index], { credentials: 'include' })
        .then((response) => response.ok ? response.json() : null)
        .then((payload) => {
          if (payload) {
            inspectPayload(payload, { messageReply: true });
          } else {
            tryEndpoint(index + 1);
          }
        })
        .catch(() => tryEndpoint(index + 1));
    };
    tryEndpoint(0);
  }

  function inspectPayload(payload, { messageReply = false } = {}) {
    try {
      publishRecords(extractReplyRecords(payload));
      if (messageReply) {
        const notifications = extractMessageReplyNotifications(payload);
        publishRecords(notifications);
        for (const notification of notifications) queueMessageReplyLookup(notification.lookup);
      }
    } catch {
      // Network interception must never affect the website's own request.
    }
  }

  function requestUrl(input) {
    if (typeof input === 'string' || input instanceof URL) {
      return String(input);
    }
    if (typeof Request !== 'undefined' && input instanceof Request) {
      return input.url;
    }
    return input && typeof input.url === 'string' ? input.url : '';
  }

  function installFetchBridge() {
    if (typeof window.fetch !== 'function') {
      return;
    }

    const originalFetch = window.fetch;
    function bridgedFetch(...args) {
      const url = requestUrl(args[0]);
      const replyRequest = isReplyEndpoint(url);
      const messageReplyRequest = isMessageReplyEndpoint(url);
      const result = Reflect.apply(originalFetch, this, args);

      if ((replyRequest || messageReplyRequest) && result && typeof result.then === 'function') {
        Promise.resolve(result).then((response) => {
          // clone() keeps the Response and its body ownership entirely intact
          // for Bilibili's code.
          let clone;
          try {
            clone = response.clone();
          } catch {
            return;
          }
          clone.json().then((payload) => {
            inspectPayload(payload, { messageReply: messageReplyRequest });
          }).catch(() => {});
        }).catch(() => {});
      }

      return result;
    }

    try {
      Object.defineProperty(bridgedFetch, 'name', { value: originalFetch.name });
      Object.defineProperty(bridgedFetch, 'length', { value: originalFetch.length });
    } catch {
      // Cosmetic function metadata is not required.
    }

    window.fetch = bridgedFetch;
  }

  function installXhrBridge() {
    if (typeof XMLHttpRequest === 'undefined') {
      return;
    }

    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    const requestUrls = new WeakMap();
    const watched = new WeakSet();

    XMLHttpRequest.prototype.open = function bridgedOpen(method, url, ...rest) {
      requestUrls.set(this, String(url));
      return Reflect.apply(originalOpen, this, [method, url, ...rest]);
    };

    XMLHttpRequest.prototype.send = function bridgedSend(...args) {
      if (!watched.has(this)) {
        watched.add(this);
        this.addEventListener('loadend', () => {
          const url = this.responseURL || requestUrls.get(this) || '';
          const messageReplyRequest = isMessageReplyEndpoint(url);
          if (!isReplyEndpoint(url) && !messageReplyRequest) {
            return;
          }

          try {
            if (this.responseType === 'json') {
              inspectPayload(this.response, { messageReply: messageReplyRequest });
            } else if (this.responseType === '' || this.responseType === 'text') {
              inspectPayload(JSON.parse(this.responseText), { messageReply: messageReplyRequest });
            }
          } catch {
            // Ignore non-JSON/error responses without modifying the XHR.
          }
        });
      }

      return Reflect.apply(originalSend, this, args);
    };
  }

  const observedRoots = new WeakSet();
  const rendererRetryStates = new WeakMap();

  function scheduleRendererRetry(host) {
    if (!host?.isConnected) return;
    const previous = rendererRetryStates.get(host);
    if (previous?.timer || (previous?.attempt ?? 0) >= 4) return;
    const attempt = previous?.attempt ?? 0;
    const delays = [0, 80, 350, 1_200];
    const state = { attempt: attempt + 1, timer: 0 };
    state.timer = setTimeout(() => {
      state.timer = 0;
      inspectRenderer(host);
    }, delays[attempt]);
    rendererRetryStates.set(host, state);
  }

  function readRendererData(host) {
    for (const key of ['data', '__data']) {
      try {
        const value = host[key];
        if (value && typeof value === 'object') {
          return value;
        }
      } catch {
        // The component can expose a transient throwing getter while updating.
      }
    }
    return null;
  }

  function directRecord(data, allRecords) {
    const candidates = [
      data,
      data?.reply,
      data?.comment,
      data?.root,
      data?.data,
      data?.data?.reply,
      data?.data?.comment
    ];

    for (const candidate of candidates) {
      try {
        const record = compactReply(candidate);
        if (record) {
          return record;
        }
      } catch {
        // Continue to the extracted-record fallback.
      }
    }

    return allRecords[0] ?? null;
  }

  function inspectRenderer(host) {
    const data = readRendererData(host);
    if (!data) {
      // Renderer properties are commonly assigned a few microtasks after the
      // host is connected. Retry this host a bounded number of times instead
      // of scanning every known renderer forever.
      scheduleRendererRetry(host);
      return;
    }

    const retryState = rendererRetryStates.get(host);
    if (retryState?.timer) clearTimeout(retryState.timer);
    rendererRetryStates.delete(host);

    const records = extractReplyRecords(data);
    if (!records.length) {
      return;
    }

    const ownRecord = directRecord(data, records);
    if (ownRecord && host.getAttribute('data-bce-rpid') !== ownRecord.rpid) {
      host.setAttribute('data-bce-rpid', ownRecord.rpid);
    }
    publishRecords(records);
  }

  function inspectTree(node) {
    if (!node || !('querySelectorAll' in node)) {
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node;
      if (element.matches(RENDERER_SELECTOR)) {
        inspectRenderer(element);
      }
      if (element.shadowRoot) {
        observeRoot(element.shadowRoot);
      }
    }

    for (const renderer of node.querySelectorAll(RENDERER_SELECTOR)) {
      inspectRenderer(renderer);
    }

    for (const host of node.querySelectorAll(SHADOW_HOST_SELECTOR)) {
      if (host.shadowRoot) {
        observeRoot(host.shadowRoot);
      }
    }
  }

  function observeRoot(root) {
    if (!root || observedRoots.has(root)) {
      return;
    }
    observedRoots.add(root);
    inspectTree(root);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          inspectTree(node);
        }
      }
    });
    observer.observe(root, { childList: true, subtree: true });
  }

  installFetchBridge();
  installXhrBridge();
  observeRoot(document);
  hydrateMessageReplyRecords();
  window.addEventListener('hashchange', hydrateMessageReplyRecords);

})();
