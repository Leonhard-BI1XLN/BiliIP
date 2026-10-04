import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const extensionDir = resolve(here, '..');
const edgeCandidates = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];
const edgePath = edgeCandidates.find(existsSync);

if (!edgePath) {
  console.error('Microsoft Edge executable was not found.');
  process.exit(2);
}

const profileDir = mkdtempSync(join(tmpdir(), 'bce-edge-smoke-'));
// BI1XLN
const port = await new Promise((resolvePort, reject) => {
  const server = createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    server.close(() => resolvePort(address.port));
  });
});

const edge = spawn(edgePath, [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profileDir}`,
  `--disable-extensions-except=${extensionDir}`,
  `--load-extension=${extensionDir}`,
  '--window-size=1440,900',
  'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });

let stderr = '';
edge.stderr.on('data', (chunk) => {
  stderr += chunk.toString();
});

const delay = (milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
const smokeDocument = Buffer.from(`<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>Bili extension smoke fixture</title></head>
<body>
  <div class="bili-header__banner" id="__bce-banner-smoke-fixture"></div>
  <a class="bili-header__logo" href="https://www.bilibili.com/">bilibili</a>
  <div id="mirror-vdcon"><div class="right-container"><div><div class="video-pod-above-modules"><div><div class="video-card-ad-small">sponsored</div></div></div></div></div></div>
  <div class="video-title-shell" style="height: 32px; overflow: hidden"><h1 class="video-title">1997年香港回归交接仪式</h1></div>
  <div class="copyright-notice">未经作者授权，禁止转载</div>
  <section id="__bce-smoke-fixture" style="position:fixed;left:-9999px;top:0">
    <div class="reply-item" data-id="9007199254740991">
      <div class="reply-content-container"><div class="reply-content">这是一条用于本机翻译烟测的评论。</div></div>
      <span class="reply-info">刚刚</span>
    </div>
    <div class="reply-item" data-id="9007199254740992">
      <div class="reply-content-container"><div class="reply-content">用于验证实时秒表的评论。</div></div>
      <span class="reply-info">刚刚</span>
    </div>
    <button id="__bce-history-smoke" title="历史" aria-label="历史">历史</button>
  </section>
</body></html>`, 'utf8').toString('base64');

const messageSmokeDocument = Buffer.from(`<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>Bili message extension smoke fixture</title></head>
<body>
  <main id="__bce-message-smoke-fixture" class="message-shell">
    <aside class="message-nav">
      <strong>消息中心</strong><span>我的消息</span><span>回复我的</span><span>@我的</span>
      <span>收到的赞</span><span>系统通知</span><span>消息设置</span>
    </aside>
    <input id="__bce-search-smoke" placeholder="输入关键字搜索">
    <section id="__bce-fixed-ui-smoke">
      <div>收到的赞</div><div>最新</div><div>赞了我的评论</div><div>累计</div>
      <div>系统通知</div><div>广告反馈进度通知</div><div>评论存在违规</div>
      <div>未经作者授权，禁止转载</div>
      <div>消息设置</div><div>提醒（关闭后，消息将不再进行提醒）</div>
      <div>私信智能拦截</div><div>消息屏蔽词</div><div>添加屏蔽词</div>
      <div>回复我的消息提醒</div><div>接收谁的评论消息提醒</div>
      <div>所有人</div><div>关注的人</div><div>不接收任何消息提醒</div>
      <div>SS3B-5212 <span>在评论中@了我</span></div><div>最近消息</div>
    </section>
    <div class="content">
      <article class="notification-row" data-id="9007199254740993">
        <div class="notice-head"><strong>tqlx</strong><span>回复了我的评论</span></div>
        <div class="reply-line" style="color: rgb(230, 230, 230)"><span>回复 @BI1XL:</span> 一年3000</div>
        <span class="opaque-clock">2026年10月3日 23:44</span>
        <button type="button" title="删除该通知">删除该通知</button>
      </article>
      <article class="notification-row msg-item" data-id="9007199254740994">
        <div class="notice-head"><strong>tqlx</strong><span>回复了我的评论</span></div>
        <div class="desc">办的时候给我写的月限额3000但是办出来是月限额和年限额都是3000，只能先用着看后面会不会上调了</div>
        <span class="opaque-clock">今天 07:17</span>
        <button type="button" title="删除该通知">删除该通知</button>
      </article>
      <article class="notification-row talk-item" data-id="9007199254740995">
        <div class="notice-head"><strong>庄周梦飞蝶</strong><span>回复了我的评论</span></div>
        <div class="text">至冬给你上ai列车管家了</div>
        <span class="opaque-clock">2026-10-03 12:20</span>
        <button type="button" title="删除该通知">删除该通知</button>
      </article>
      <article class="notification-row interaction-item" data-id="9007199254740996">
        <div class="notice-head"><strong>自然选择号123</strong><span>回复了我的评论</span></div>
        <div class="interaction-item__msg">回复 @BI1XL: 不会，现在鞋子不太可能被220v电击穿</div>
        <span class="opaque-clock">02/10/2026 08:49:03</span>
        <button type="button" title="删除该通知">删除该通知</button>
      </article>
    </div>
  </main>
</body></html>`, 'utf8').toString('base64');

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
}

async function waitForDebugger() {
  let lastError;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      return await fetchJson(`http://127.0.0.1:${port}/json/version`);
    } catch (error) {
      lastError = error;
      await delay(250);
    }
  }
  throw lastError;
}

class CdpClient {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    this.listeners = new Map();
  }

  async open() {
    await new Promise((resolveOpen, reject) => {
      this.socket.addEventListener('open', resolveOpen, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const callbacks = this.pending.get(message.id);
        if (!callbacks) return;
        this.pending.delete(message.id);
        if (message.error) callbacks.reject(new Error(message.error.message));
        else callbacks.resolve(message.result);
        return;
      }
      this.events.push(message);
      for (const listener of this.listeners.get(message.method) || []) {
        listener(message.params);
      }
    });
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) || [];
    listeners.push(listener);
    this.listeners.set(method, listeners);
  }

  send(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolveSend, reject) => {
      this.pending.set(id, { resolve: resolveSend, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket.close();
  }
}

let client;
let workerClient;
let optionsClient;
try {
  await waitForDebugger();
  const target = await fetchJson(
    `http://127.0.0.1:${port}/json/new?${encodeURIComponent('about:blank')}`,
    { method: 'PUT' },
  );
  client = new CdpClient(target.webSocketDebuggerUrl);
  await client.open();
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  client.on('Fetch.requestPaused', (params) => {
    const isMessageDocument = String(params.request?.url || '').includes('message.bilibili.com');
    client.send('Fetch.fulfillRequest', {
      requestId: params.requestId,
      responseCode: 200,
      responsePhrase: 'OK',
      responseHeaders: [
        { name: 'Content-Type', value: 'text/html; charset=utf-8' },
        { name: 'Cache-Control', value: 'no-store' }
      ],
      body: isMessageDocument ? messageSmokeDocument : smokeDocument
    }).catch(() => {});
  });
  await client.send('Fetch.enable', {
    patterns: [
      {
        urlPattern: 'https://www.bilibili.com/*',
        resourceType: 'Document',
        requestStage: 'Request'
      },
      {
        urlPattern: 'https://message.bilibili.com/*',
        resourceType: 'Document',
        requestStage: 'Request'
      }
    ]
  });
  const initialTargets = await fetchJson(`http://127.0.0.1:${port}/json/list`);
  const extensionWorkerTarget = initialTargets.find(
    (item) => item.type === 'service_worker' && /chrome-extension:\/\/[^/]+\/background\.js$/.test(item.url || ''),
  );
  const extensionTargets = initialTargets
    .filter((item) => String(item.url || '').startsWith('chrome-extension://'))
    .map((item) => ({ type: item.type, url: item.url }));
  if (!extensionWorkerTarget?.webSocketDebuggerUrl) {
    throw new Error('The extension service worker was not exposed for smoke testing.');
  }
  workerClient = new CdpClient(extensionWorkerTarget.webSocketDebuggerUrl);
  await workerClient.open();
  await workerClient.send('Runtime.enable');
  await workerClient.send('Runtime.evaluate', {
    awaitPromise: true,
    expression: `new Promise((resolve, reject) => {
      chrome.storage.local.set({
        prefs: {
          commentsEnabled: true,
          showLocation: true,
          showExactTime: true,
          timezone: 'Asia/Shanghai',
          showUnavailableLocation: false,
          settingsLanguage: 'zh-CN',
          pageLanguage: 'zh-CN',
          commentTranslationTarget: 'en',
          bannerEnabled: true,
          bannerImage: '',
          bannerHeight: 180,
          bannerDim: 0
        }
      }, () => {
        const error = chrome.runtime.lastError;
        if (error) reject(new Error(error.message));
        else resolve(true);
      });
    })`,
  });
  await client.send('Page.navigate', {
    url: 'https://www.bilibili.com/video/BV1ixam6kEr1/'
  });
  // The deterministic document keeps the real Bilibili origin, so Edge loads
  // the extension's normal content scripts without making this smoke check
  // dependent on Bilibili's live page or comment service.
  let biliReady = false;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const readyResult = await client.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `({
        url: location.href,
        ready: location.hostname === 'www.bilibili.com' && Boolean(document.body) &&
          Boolean(window.__biliCommentEnhancerBridgeInstalled__)
      })`,
    });
    if (readyResult.result?.value?.ready) {
      biliReady = true;
      break;
    }
    await delay(250);
  }
  if (!biliReady) {
    throw new Error('Bilibili content document or extension bridge did not become ready.');
  }
  // Flip only the page language after the content script is known to be live.
  // This verifies that the page-language choice updates independently of the
  // still-Chinese settings-page language.
  await workerClient.send('Runtime.evaluate', {
    awaitPromise: true,
    expression: `new Promise((resolve, reject) => {
      chrome.storage.local.set({
        prefs: {
          commentsEnabled: true,
          showLocation: true,
          showExactTime: true,
          timezone: 'Asia/Shanghai',
          showUnavailableLocation: false,
          settingsLanguage: 'zh-CN',
          pageLanguage: 'en',
          translationEnabled: true,
          commentTranslationTarget: 'en',
          bannerEnabled: true,
          bannerImage: '',
          bannerHeight: 180,
          bannerDim: 0
        }
      }, () => {
        const error = chrome.runtime.lastError;
        if (error) reject(new Error(error.message));
        else resolve(true);
      });
    })`,
  });
  await delay(300);
  const translatorAvailabilityResult = await client.send('Runtime.evaluate', {
    awaitPromise: true,
    returnByValue: true,
    expression: `globalThis.Translator
      ? Translator.availability({ sourceLanguage: 'zh', targetLanguage: 'en' })
      : Promise.resolve('api-unavailable')`,
  });
  const translatorAvailability = translatorAvailabilityResult.result?.value || '';

  if (process.env.BCE_FAKE_TRANSLATOR === '1') {
    await client.send('Runtime.evaluate', {
      expression: `Object.defineProperty(window, 'Translator', {
        configurable: true,
        value: {
          availability: async () => 'available',
          create: async () => ({
            translate: async (text) => text.includes('1997')
              ? 'Long translated title '.repeat(24)
              : '[translated] ' + text,
            destroy() {}
          })
        }
      })`,
    });
  }

  // Exercise the extension's normal page-world → isolated-world pipeline: a
  // record travels through postMessage and must land beside the matching
  // legacy-style comment node with both required metadata values.
  await client.send('Runtime.evaluate', {
    expression: `(() => {
      const dispatch = () => window.postMessage({
        source: 'bili-comment-enhancer:page-bridge',
        type: 'reply-records',
        records: [
          {
            rpid_str: '9007199254740991',
            ctime: 1709164799,
            location: 'IP属地：斯里兰卡'
          },
          {
            rpid_str: '9007199254740992',
            ctime: Math.floor(Date.now() / 1000) - 5,
            location: 'IP属地：英国'
          }
        ]
      }, '*');
      dispatch();
      setTimeout(dispatch, 180);
      setTimeout(dispatch, 520);
    })()`,
  });
  await client.send('Runtime.evaluate', {
    expression: `(() => {
      const menu = document.createElement('div');
      menu.id = '__bce-flyout-smoke';
      menu.title = '新番时间表';
      menu.setAttribute('aria-label', '新番时间表');
      menu.textContent = '新番时间表';
      document.getElementById('__bce-smoke-fixture')?.append(menu);
    })()`,
  });
  await delay(1200);

  // Simulate the unrelated DOM churn produced by Bilibili's video player.
  // Metadata children must retain identity: replacing them here would mean a
  // generic page mutation still triggers the old full-row flashing loop.
  await client.send('Runtime.evaluate', {
    expression: `(() => {
      window.__bceStableMetaChild = document.querySelector('#__bce-smoke-fixture .bce-ip-location');
      for (let index = 0; index < 24; index += 1) {
        const node = document.createElement('i');
        node.dataset.playerChurn = String(index);
        document.body.append(node);
        node.remove();
      }
    })()`,
  });
  await delay(250);
  const stableMetaResult = await client.send('Runtime.evaluate', {
    returnByValue: true,
    expression: `window.__bceStableMetaChild === document.querySelector('#__bce-smoke-fixture .bce-ip-location') && Boolean(window.__bceStableMetaChild?.isConnected)`,
  });
  const stableMetadataDuringUnrelatedChurn = stableMetaResult.result?.value === true;

  const liveBeforeResult = await client.send('Runtime.evaluate', {
    returnByValue: true,
    expression: `document.querySelector('[data-bce-rpid="9007199254740992"] [data-bce-time-relative]')?.textContent || ''`,
  });
  const liveBefore = liveBeforeResult.result?.value || '';
  await client.send('Runtime.evaluate', {
    expression: `(() => {
      window.__bceLiveSamples = [];
      window.__bceLiveSampleTimer = setInterval(() => {
        window.__bceLiveSamples.push(document.querySelector('[data-bce-rpid="9007199254740992"] [data-bce-time-relative]')?.textContent || '');
      }, 250);
    })()`,
  });
  await delay(3_300);
  const liveAfterResult = await client.send('Runtime.evaluate', {
    returnByValue: true,
    expression: `document.querySelector('[data-bce-rpid="9007199254740992"] [data-bce-time-relative]')?.textContent || ''`,
  });
  const liveAfter = liveAfterResult.result?.value || '';
  const liveSamplesResult = await client.send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => { clearInterval(window.__bceLiveSampleTimer); return window.__bceLiveSamples || []; })()`,
  });
  const liveSamples = liveSamplesResult.result?.value || [];

  // Title translation is intentionally disabled; verify a video title is
  // left completely native while the rest of the translation smoke continues.
  let titleTranslationDisabledSmoke = null;
  if (process.env.BCE_FAKE_TRANSLATOR === '1') {
    await delay(250);
    const titleDisabledResult = await client.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const title = document.querySelector('.video-title');
        return {
          text: title?.textContent?.trim() || '',
          titleMetaCount: title?.querySelectorAll('[data-bce-title-meta]').length || 0,
          titleButtonCount: title?.querySelectorAll('[data-bce-translate-comment]').length || 0,
          targetClass: title?.classList.contains('bce-title-translation-target') === true,
          flowClass: title?.classList.contains('bce-title-flow-expanded') === true,
        };
      })()`
    });
    titleTranslationDisabledSmoke = titleDisabledResult.result?.value || {};
    console.log(JSON.stringify({ titleTranslationDisabledSmoke }, null, 2));
    if (
      !titleTranslationDisabledSmoke.text ||
      titleTranslationDisabledSmoke.titleMetaCount !== 0 ||
      titleTranslationDisabledSmoke.titleButtonCount !== 0 ||
      titleTranslationDisabledSmoke.targetClass ||
      titleTranslationDisabledSmoke.flowClass
    ) {
      throw new Error(`Title translation disable smoke check failed: ${JSON.stringify(titleTranslationDisabledSmoke)}`);
    }
  }

  const result = await client.send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const seen = new Set();
      const roots = [];
      const visit = (root) => {
        if (!root || seen.has(root)) return;
        seen.add(root);
        roots.push(root);
        for (const element of root.querySelectorAll('*')) {
          if (element.shadowRoot) visit(element.shadowRoot);
        }
      };
      visit(document);
      const all = (selector) => roots.flatMap((root) => [...root.querySelectorAll(selector)]);
      const rendered = all('bili-comment-renderer, bili-comment-reply-renderer');
      const metadata = all('.bce-comment-meta, [data-bce-meta], .bce-meta');
      return {
        url: location.href,
        title: document.title,
        translatorApi: typeof Translator,
        languageDetectorApi: typeof LanguageDetector,
        shadowRootCount: roots.length - 1,
        renderedCommentCount: rendered.length,
        markedHostCount: all('[data-bce-rpid]').length,
        metadataCount: metadata.length,
        metadataText: metadata.slice(0, 5).map((node) => node.textContent.trim()),
        pageBridgeInstalled: Boolean(window.__biliCommentEnhancerBridgeInstalled__),
        fixtureExists: Boolean(document.getElementById('__bce-smoke-fixture')),
        fixtureHtml: document.getElementById('__bce-smoke-fixture')?.innerHTML || '',
        fixtureMetadata: document.querySelector('#__bce-smoke-fixture [data-bce-comment-meta]')?.textContent?.trim() || '',
        fixtureDate: document.querySelector('#__bce-smoke-fixture .bce-time-date')?.textContent?.trim() || '',
        fixtureTime: document.querySelector('#__bce-smoke-fixture .bce-time-clock')?.textContent?.trim() || '',
        fixtureAnchorClass: document.querySelector('#__bce-smoke-fixture [data-bce-comment-meta]')?.previousElementSibling?.className || '',
        fixtureTranslationIcon: document.querySelector('#__bce-smoke-fixture [data-bce-translate-comment] img')?.getAttribute('src') || '',
        fixtureCommentText: document.querySelector('#__bce-smoke-fixture .reply-content')?.textContent?.trim() || '',
        fixtureHistory: document.getElementById('__bce-history-smoke')?.textContent?.trim() || '',
        fixtureFlyout: document.getElementById('__bce-flyout-smoke')?.textContent?.trim() || '',
        fixtureFlyoutTitle: document.getElementById('__bce-flyout-smoke')?.getAttribute('title') || '',
        fixtureLocalizedUi: document.getElementById('__bce-history-smoke')?.getAttribute('data-bce-localized-ui') || '',
        titleText: document.querySelector('.video-title')?.childNodes?.[0]?.textContent?.trim() || '',
        titleTranslateIcon: document.querySelector('.video-title [data-bce-title-meta] img')?.getAttribute('src') || '',
        copyrightNotice: document.querySelector('.copyright-notice')?.textContent?.trim() || '',
        videoAdPresent: Boolean(document.querySelector('#mirror-vdcon .video-card-ad-small')),
        videoAdHidden: getComputedStyle(document.querySelector('#mirror-vdcon .video-card-ad-small') || document.documentElement).display === 'none',
        liveRelative: document.querySelector('[data-bce-rpid="9007199254740992"] [data-bce-time-relative]')?.textContent?.trim() || '',
        fixtureMetaBackground: getComputedStyle(document.querySelector('#__bce-smoke-fixture [data-bce-comment-meta]') || document.documentElement).backgroundColor,
        fixtureIpBackground: getComputedStyle(document.querySelector('#__bce-smoke-fixture .bce-ip-location') || document.documentElement).backgroundColor,
        fixtureOriginalTime: document.querySelector('#__bce-smoke-fixture .reply-info')?.textContent?.trim() || '',
        fixtureDefaultTimeHidden: document.querySelector('#__bce-smoke-fixture .reply-info')?.classList.contains('bce-original-time-hidden') === true,
      };
    })()`,
  });

  const value = {
    ...result.result?.value,
    translatorAvailability,
    stableMetadataDuringUnrelatedChurn,
    liveBefore,
    liveAfter,
    liveSamples,
    extensionTargetCount: extensionTargets.length,
    extensionTargets
  };
  console.log(JSON.stringify(value, null, 2));
  const severeErrors = client.events
    .filter((event) => event.method === 'Runtime.exceptionThrown')
    .map((event) => event.params?.exceptionDetails?.text)
    .filter(Boolean);
  if (severeErrors.length) {
    console.error('Runtime exceptions:', severeErrors);
  }
  if (
    !value.fixtureMetadata.includes('IP: Sri Lanka') ||
    value.fixtureDate !== '29/02/2024' ||
    value.fixtureTime !== '07.59.59' ||
    !String(value.fixtureAnchorClass).includes('reply-content') ||
    !String(value.fixtureTranslationIcon).includes('google-translate.svg') ||
    value.fixtureCommentText !== '这是一条用于本机翻译烟测的评论。' ||
    value.fixtureHistory !== 'History' ||
    value.fixtureFlyout !== 'New Anime Schedule' ||
    value.fixtureFlyoutTitle !== 'New Anime Schedule' ||
    value.fixtureLocalizedUi !== 'true' ||
    !value.titleText ||
    value.titleTranslateIcon !== '' ||
    value.copyrightNotice !== "No reposting without the author's permission" ||
    !value.videoAdPresent ||
    !value.videoAdHidden ||
    !value.stableMetadataDuringUnrelatedChurn ||
    !/^\d+ hours? \d+ minutes? \d{2} seconds? ago$/.test(value.liveRelative) ||
    value.liveBefore === value.liveAfter ||
    new Set(value.liveSamples).size < 2 ||
    !['rgba(0, 0, 0, 0)', 'transparent'].includes(value.fixtureMetaBackground) ||
    !['rgba(0, 0, 0, 0)', 'transparent'].includes(value.fixtureIpBackground) ||
    !value.fixtureDefaultTimeHidden
  ) {
    process.exitCode = 1;
  }

  await client.send('Page.navigate', { url: 'https://message.bilibili.com/#/reply' });
  let messageReady = false;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const readyResult = await client.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `({
        ready: location.hostname === 'message.bilibili.com' && Boolean(document.body) &&
          Boolean(window.__biliCommentEnhancerBridgeInstalled__)
      })`,
    });
    if (readyResult.result?.value?.ready) {
      messageReady = true;
      break;
    }
    await delay(250);
  }
  if (!messageReady) throw new Error('Message-centre content document or bridge did not become ready.');
  await client.send('Runtime.evaluate', {
    // The message route has a heavier Vue bootstrap than the ordinary comment
    // page. Exercise the same page-world delivery pattern that the bridge
    // uses for successive network batches, rather than assuming the first
    // postMessage happens after every isolated-world observer is live.
    expression: `(() => {
      const dispatch = () => window.postMessage({
        source: 'bili-comment-enhancer:page-bridge',
        type: 'reply-records',
        records: [
          {
            rpid_str: '9007199254740993',
            ctime: 1791042245,
            location: 'IP属地：湖南',
            messageText: '一年3000'
          },
          {
            rpid_str: '9007199254740994',
            ctime: Math.floor(Date.now() / 1000) - 7 * 3600 - 17 * 60 - 36,
            location: 'IP属地：陕西',
            messageText: '办的时候给我写的月限额3000但是办出来是月限额和年限额都是3000，只能先用着看后面会不会上调了'
          },
          {
            rpid_str: '9007199254740995',
            ctime: 1790997600,
            location: 'IP属地：湖北',
            messageText: '至冬给你上ai列车管家了'
          },
          {
            rpid_str: '9007199254740996',
            ctime: 1791026943,
            location: 'IP属地：浙江',
            messageText: '不会，现在鞋子不太可能被220v电击穿'
          }
        ]
      }, '*');
      dispatch();
      setTimeout(dispatch, 180);
      setTimeout(dispatch, 520);
    })()`,
  });
  await delay(900);
  const messageResult = await client.send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const item = document.querySelector('#__bce-message-smoke-fixture .notification-row');
      const meta = item?.querySelector('[data-bce-message-meta]');
      return {
        mounted: Boolean(meta),
        text: meta?.textContent?.trim() || '',
        anchorClass: meta?.previousElementSibling?.className || '',
        icon: meta?.querySelector('[data-bce-translate-comment] img')?.getAttribute('src') || '',
        originalTimeHidden: item?.querySelector('.opaque-clock')?.classList.contains('bce-original-time-hidden') === true,
        hasIp: Boolean(meta?.querySelector('.bce-ip-location')),
        hasDate: Boolean(meta?.querySelector('.bce-time-date')),
        hasTime: Boolean(meta?.querySelector('.bce-time-clock')),
        hasSeconds: (meta?.textContent?.split('.')?.length || 0) >= 3,
        contentWhiteSpace: getComputedStyle(item?.querySelector('.reply-line') || document.documentElement).whiteSpace,
        contentOverflow: getComputedStyle(item?.querySelector('.reply-line') || document.documentElement).overflow,
        contentTextOverflow: getComputedStyle(item?.querySelector('.reply-line') || document.documentElement).textOverflow,
        rowOverflow: getComputedStyle(item || document.documentElement).overflow,
        metaCount: item?.querySelectorAll('[data-bce-message-meta]').length || 0,
        translationRowCount: document.querySelectorAll('[data-bce-comment-translation]').length,
        iconTop: getComputedStyle(meta?.querySelector('.bce-translation-icon') || document.documentElement).top,
        sidebar: [...document.querySelectorAll('#__bce-message-smoke-fixture .message-nav span')].map((node) => node.textContent.trim()),
        inboxHeading: document.querySelector('#__bce-message-smoke-fixture .message-nav strong')?.textContent?.trim() || '',
        replyLine: item?.querySelector('.reply-line')?.textContent?.trim() || '',
        deleteNotice: item?.querySelector('button:not([data-bce-translate-comment])')?.textContent?.trim() || '',
        deleteNoticeTitle: item?.querySelector('button:not([data-bce-translate-comment])')?.getAttribute('title') || '',
        searchPlaceholder: document.getElementById('__bce-search-smoke')?.getAttribute('placeholder') || '',
        contentWasOverexcluded: item?.closest('.content')?.hasAttribute('data-bce-user-content') === true,
        fixedUiText: document.getElementById('__bce-fixed-ui-smoke')?.textContent?.trim() || '',
        rows: [...document.querySelectorAll('#__bce-message-smoke-fixture .notification-row')].map((row) => {
          const rowMeta = row.querySelector('[data-bce-message-meta]');
          return {
            metaCount: row.querySelectorAll('[data-bce-message-meta]').length,
            hasIp: Boolean(rowMeta?.querySelector('.bce-ip-location')),
            hasTime: Boolean(
              rowMeta?.querySelector('.bce-time-relative') ||
              (rowMeta?.querySelector('.bce-time-date') && rowMeta?.querySelector('.bce-time-clock'))
            ),
            hasTranslate: Boolean(rowMeta?.querySelector('[data-bce-translate-comment] img[src*="google-translate.svg"]')),
            anchor: rowMeta?.previousElementSibling?.className || ''
          };
        })
      };
    })()`,
  });
  const messageState = messageResult.result?.value || {};
  console.log(JSON.stringify({ messageCentreSmoke: messageState }, null, 2));
  if (
    !messageState.mounted ||
    !messageState.text.includes('IP: Hunan') ||
    !String(messageState.anchorClass).includes('reply-line') ||
    !String(messageState.icon).includes('google-translate.svg') ||
    !messageState.originalTimeHidden ||
    !messageState.hasIp ||
    !messageState.hasDate ||
    !messageState.hasTime ||
    !messageState.hasSeconds ||
    messageState.contentWhiteSpace !== 'normal' ||
    !['visible', 'clip'].includes(messageState.contentOverflow) ||
    messageState.contentTextOverflow !== 'clip' ||
    !['visible', 'clip'].includes(messageState.rowOverflow) ||
    messageState.metaCount !== 1 ||
    messageState.translationRowCount !== 0 ||
    messageState.iconTop !== '3px' ||
    messageState.sidebar?.join('|') !== 'My messages|Replies to me|Mentions|Likes received|System notifications|Message settings' ||
    messageState.inboxHeading !== 'Messages' ||
    !messageState.replyLine.startsWith('Reply @BI1XL:') ||
    messageState.deleteNotice !== 'Delete this notification' ||
    messageState.deleteNoticeTitle !== 'Delete this notification' ||
    messageState.searchPlaceholder !== 'Search by keyword' ||
    messageState.contentWasOverexcluded ||
    !messageState.fixedUiText.includes('Likes received') ||
    !messageState.fixedUiText.includes('Ad feedback status') ||
    !messageState.fixedUiText.includes('Comment violation detected') ||
    !messageState.fixedUiText.includes("No reposting without the author's permission") ||
    !messageState.fixedUiText.includes('After turning off, notifications will stop') ||
    !messageState.fixedUiText.includes('Smart direct-message filtering') ||
    !messageState.fixedUiText.includes('mentioned you in a comment') ||
    messageState.rows?.length !== 4 ||
    !messageState.rows.every((row) => row.metaCount === 1 && row.hasIp && row.hasTime && row.hasTranslate)
  ) {
    throw new Error(`Message-centre metadata smoke check failed: ${JSON.stringify(messageState)}`);
  }

  // The browser model can legitimately be downloading on a fresh profile.
  // This opt-in deterministic provider exercises the DOM/state-machine
  // round-trip independently of that one-time model download.
  if (process.env.BCE_FAKE_TRANSLATOR === '1') {
    await client.send('Runtime.evaluate', {
      expression: `Object.defineProperty(window, 'Translator', {
        configurable: true,
        value: {
          availability: async () => 'available',
          create: async () => ({
            translate: async (text) => '[translated] ' + text,
            destroy() {}
          })
        }
      })`,
    });
  }

  // Exercise the actual one-click path as a diagnostic. Translation depends
  // on the Edge model cache/network, so this does not make the smoke test
  // fail when the model is unavailable; it does verify that the click stays
  // on message.bilibili.com and that the button reports a useful state.
  const clickRectResult = await client.send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const rect = document.querySelector('#__bce-message-smoke-fixture [data-bce-translate-comment]')?.getBoundingClientRect();
      return rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null;
    })()`
  });
  const clickRect = clickRectResult.result?.value;
  if (clickRect) {
    await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: clickRect.x, y: clickRect.y });
    await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: clickRect.x, y: clickRect.y, button: 'left', clickCount: 1 });
    await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: clickRect.x, y: clickRect.y, button: 'left', clickCount: 1 });
  }
  await delay(Number(process.env.BCE_TRANSLATION_WAIT_MS || 1_500));
  const translationClickResult = await client.send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const item = document.querySelector('#__bce-message-smoke-fixture .notification-row');
      const button = item?.querySelector('[data-bce-translate-comment]');
      return {
        url: location.href,
        sourceText: item?.querySelector('.reply-line')?.textContent?.trim() || '',
        title: button?.getAttribute('title') || '',
        translating: button?.dataset?.bceTranslating === 'true',
        translated: button?.dataset?.bceTranslated === 'true',
        error: button?.dataset?.bceTranslationError || '',
        outputColor: getComputedStyle(item?.querySelector('[data-bce-manual-translation]') || document.documentElement).color
      };
    })()`
  });
  console.log(JSON.stringify({ translationClickSmoke: translationClickResult.result?.value || {} }, null, 2));

  // Regression for the message-centre failure where restoring a translated
  // Reply/@mention/body line split it into separate nodes, causing the next
  // translation to see only “回复”. The extension must leave Bilibili's source
  // body intact, use one extension-owned visible output, restore atomically,
  // and translate the complete body again.
  const firstTranslation = translationClickResult.result?.value || {};
  if (firstTranslation.translated) {
    if (firstTranslation.outputColor !== 'rgb(230, 230, 230)') {
      throw new Error(`Manual translation color smoke check failed: ${JSON.stringify(firstTranslation)}`);
    }
    await client.send('Runtime.evaluate', {
      expression: `document.querySelector('#__bce-message-smoke-fixture [data-bce-translate-comment]')?.click()`,
    });
    await delay(120);
    const restoredResult = await client.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const item = document.querySelector('#__bce-message-smoke-fixture .notification-row');
        const content = item?.querySelector('.reply-line');
        return {
          text: content?.textContent?.trim() || '',
          hidden: content?.hasAttribute('data-bce-original-comment-hidden') === true,
          display: getComputedStyle(content || document.documentElement).display,
          replacementCount: item?.querySelectorAll('[data-bce-manual-translation]').length || 0,
          buttonTranslated: item?.querySelector('[data-bce-translate-comment]')?.dataset?.bceTranslated === 'true'
        };
      })()`,
    });
    const restored = restoredResult.result?.value || {};
    if (
      !restored.text.includes('一年3000') ||
      restored.hidden ||
      restored.display === 'none' ||
      restored.replacementCount !== 0 ||
      restored.buttonTranslated
    ) {
      throw new Error(`Manual translation restore smoke check failed: ${JSON.stringify(restored)}`);
    }

    await client.send('Runtime.evaluate', {
      expression: `document.querySelector('#__bce-message-smoke-fixture [data-bce-translate-comment]')?.click()`,
    });
    await delay(Number(process.env.BCE_TRANSLATION_WAIT_MS || 1_500));
    const retranslatedResult = await client.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const item = document.querySelector('#__bce-message-smoke-fixture .notification-row');
        const original = item?.querySelector('.reply-line');
        const output = item?.querySelector('[data-bce-manual-translation]');
        const button = item?.querySelector('[data-bce-translate-comment]');
        return {
          originalText: original?.textContent?.trim() || '',
          originalHidden: original?.hasAttribute('data-bce-original-comment-hidden') === true,
          originalDisplay: getComputedStyle(original || document.documentElement).display,
          outputText: output?.textContent?.trim() || '',
          outputCount: item?.querySelectorAll('[data-bce-manual-translation]').length || 0,
          translated: button?.dataset?.bceTranslated === 'true'
        };
      })()`,
    });
    const retranslated = retranslatedResult.result?.value || {};
    console.log(JSON.stringify({ translationRoundTripSmoke: { restored, retranslated } }, null, 2));
    if (
      !retranslated.originalText.includes('一年3000') ||
      !retranslated.originalHidden ||
      retranslated.originalDisplay !== 'none' ||
      !retranslated.outputText ||
      retranslated.outputCount !== 1 ||
      !retranslated.translated
    ) {
      throw new Error(`Manual translation re-translate smoke check failed: ${JSON.stringify(retranslated)}`);
    }
  }

  await workerClient.send('Runtime.evaluate', {
    awaitPromise: true,
    expression: `new Promise((resolve, reject) => {
      chrome.storage.local.set({ prefs: {
        commentsEnabled: true, showLocation: true, showExactTime: true,
        timezone: 'Asia/Shanghai', showUnavailableLocation: false,
        settingsLanguage: 'zh-CN', pageLanguage: 'en', translationEnabled: true, commentTranslationTarget: 'en',
        bannerEnabled: true, bannerImage: '', bannerHeight: 180, bannerDim: 0
      } }, () => {
        const error = chrome.runtime.lastError;
        if (error) reject(new Error(error.message)); else resolve(true);
      });
    })`,
  });
  await client.send('Page.navigate', { url: 'https://www.bilibili.com/' });
  await delay(900);
  const plainHomeLogoResult = await client.send('Runtime.evaluate', {
    returnByValue: true,
    expression: `({
      hidden: getComputedStyle(document.querySelector('.bili-header__logo')).display === 'none',
      marker: document.documentElement.classList.contains('bce-hide-home-logo'),
      customActive: document.documentElement.classList.contains('bce-custom-banner-active')
    })`,
  });
  const plainHomeLogo = plainHomeLogoResult.result?.value || {};
  console.log(JSON.stringify({ plainHomeLogoSmoke: plainHomeLogo }, null, 2));
  if (!plainHomeLogo.hidden || !plainHomeLogo.marker || plainHomeLogo.customActive) process.exitCode = 1;

  await workerClient.send('Runtime.evaluate', {
    awaitPromise: true,
    expression: `new Promise((resolve, reject) => {
      chrome.storage.local.set({
        prefs: {
          commentsEnabled: true,
          showLocation: true,
          showExactTime: true,
          timezone: 'Asia/Shanghai',
          showUnavailableLocation: false,
          settingsLanguage: 'zh-CN',
          pageLanguage: 'en',
          translationEnabled: true,
          commentTranslationTarget: 'en',
          bannerEnabled: true,
          bannerImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
          bannerHeight: 180,
          bannerDim: 0
        }
      }, () => {
        const error = chrome.runtime.lastError;
        if (error) reject(new Error(error.message));
        else resolve(true);
      });
    })`,
  });
  await client.send('Page.navigate', { url: 'https://www.bilibili.com/' });
  await delay(3500);
  const bannerResult = await client.send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      let banner = document.querySelector('.bili-header__banner');
      if (!banner) {
        banner = document.createElement('div');
        banner.className = 'bili-header__banner';
        banner.id = '__bce-banner-smoke-fixture';
        document.body.prepend(banner);
      }
      return new Promise((resolve) => setTimeout(() => resolve({
        home: location.pathname === '/',
        active: document.documentElement.classList.contains('bce-custom-banner-active'),
        targeted: banner.classList.contains('bce-custom-banner-target'),
        image: getComputedStyle(banner).backgroundImage,
        height: getComputedStyle(banner).height,
        logoHidden: getComputedStyle(document.querySelector('.bili-header__logo')).display === 'none'
      }), 1400));
    })()`,
    awaitPromise: true,
  });
  const bannerState = bannerResult.result?.value || {};
  console.log(JSON.stringify({ bannerSmoke: bannerState }, null, 2));
  if (!bannerState.home || !bannerState.active || !bannerState.targeted || !bannerState.logoHidden || !String(bannerState.image).includes('data:image/png')) {
    process.exitCode = 1;
  }

  const extensionId = new URL(extensionWorkerTarget.url).host;
  const optionsTarget = await fetchJson(
    `http://127.0.0.1:${port}/json/new?${encodeURIComponent(`chrome-extension://${extensionId}/options/options.html`)}`,
    { method: 'PUT' },
  );
  optionsClient = new CdpClient(optionsTarget.webSocketDebuggerUrl);
  await optionsClient.open();
  await optionsClient.send('Runtime.enable');
  await delay(1800);
  const optionsResult = await optionsClient.send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => ({
      title: document.title,
      timePreview: document.getElementById('timePreview')?.value || '',
      timeFormat: document.getElementById('timeFormat')?.value || '',
      bannerEnabled: document.getElementById('bannerEnabled')?.checked === true,
      bannerHeight: document.getElementById('bannerHeightValue')?.value || '',
      cropSize: [
        document.getElementById('cropCanvas')?.width,
        document.getElementById('cropCanvas')?.height
      ],
      canvasCount: document.querySelectorAll('canvas').length,
      legacyDropZone: Boolean(document.getElementById('dropZone')),
      legacyPreview: Boolean(document.getElementById('bannerPreviewCanvas')),
      cropStageRole: document.getElementById('cropStage')?.getAttribute('role') || '',
      cropEmptyVisible: document.getElementById('cropEmpty')?.hidden !== true,
      cropEmptyDisplay: getComputedStyle(document.getElementById('cropEmpty') || document.documentElement).display,
      cropStageLabel: document.getElementById('cropStage')?.getAttribute('aria-label') || '',
      settingsLanguage: document.getElementById('settingsLanguage')?.value || '',
      pageLanguageEnglish: document.getElementById('pageLanguageEnglish')?.checked === true,
      translationEnabled: document.getElementById('translationEnabled')?.checked === true,
      commentTranslationTarget: document.getElementById('commentTranslationTarget')?.value || '',
      saveStatus: document.getElementById('saveStatusText')?.textContent?.trim() || ''
    }))()`,
  });
  const optionsState = optionsResult.result?.value || {};
  console.log(JSON.stringify({ optionsSmoke: optionsState }, null, 2));
  if (
    !/^\d{2}\/\d{2}\/\d{4} \d{2}\.\d{2}\.\d{2}$/.test(optionsState.timePreview) ||
    optionsState.timeFormat !== 'dd/mm/yyyy hh.mm.ss' ||
    !optionsState.bannerEnabled ||
    optionsState.bannerHeight !== '180 px' ||
    optionsState.cropSize?.join('x') !== '1280x120' ||
    optionsState.canvasCount !== 1 ||
    optionsState.legacyDropZone ||
    optionsState.legacyPreview ||
    optionsState.cropStageRole !== 'button' ||
    optionsState.cropEmptyDisplay !== 'none' ||
    optionsState.settingsLanguage !== 'zh-CN' ||
    !optionsState.pageLanguageEnglish ||
    !optionsState.translationEnabled ||
    optionsState.commentTranslationTarget !== 'en' ||
    !optionsState.saveStatus.includes('设置已载入')
  ) {
    process.exitCode = 1;
  }

  await optionsClient.send('Runtime.evaluate', {
    expression: `(() => {
      const selector = document.getElementById('settingsLanguage');
      selector.value = 'en';
      selector.dispatchEvent(new Event('input', { bubbles: true }));
    })()`,
  });
  await delay(250);
  const englishOptionsResult = await optionsClient.send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => ({
      title: document.title,
      settingsLanguage: document.getElementById('settingsLanguage')?.value || '',
      pageLanguageEnglish: document.getElementById('pageLanguageEnglish')?.checked === true,
      translationEnabled: document.getElementById('translationEnabled')?.checked === true,
      commentTranslationTarget: document.getElementById('commentTranslationTarget')?.value || '',
      pageLanguageHeading: document.querySelector('#languageSection h2')?.textContent?.trim() || '',
      saveLabel: document.querySelector('#saveButton span')?.textContent?.trim() || ''
    }))()`,
  });
  const englishOptionsState = englishOptionsResult.result?.value || {};
  console.log(JSON.stringify({ optionsEnglishSmoke: englishOptionsState }, null, 2));
  if (
    englishOptionsState.settingsLanguage !== 'en' ||
    !englishOptionsState.pageLanguageEnglish ||
    !englishOptionsState.translationEnabled ||
    englishOptionsState.commentTranslationTarget !== 'en' ||
    !englishOptionsState.title.includes('Settings') ||
    englishOptionsState.pageLanguageHeading !== 'Bilibili page language' ||
    englishOptionsState.saveLabel !== 'Save and apply'
  ) {
    process.exitCode = 1;
  }

  await optionsClient.send('Runtime.evaluate', {
    expression: `document.getElementById('saveButton').click()`,
  });
  await delay(1800);
  const savedOptionsResult = await optionsClient.send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => ({
      imageLoaded: document.getElementById('imageInfo')?.hidden === false,
      cropReady: document.getElementById('cropEmpty')?.hidden === true,
      saveStatus: document.getElementById('saveStatusText')?.textContent?.trim() || ''
    }))()`,
  });
  const savedOptionsState = savedOptionsResult.result?.value || {};
  const persistedResult = await workerClient.send('Runtime.evaluate', {
    awaitPromise: true,
    returnByValue: true,
    expression: `new Promise((resolve) => chrome.storage.local.get('prefs', (result) => {
      resolve({ imagePrefix: String(result.prefs?.bannerImage || '').slice(0, 24) });
    }))`,
  });
  const persistedState = persistedResult.result?.value || {};
  console.log(JSON.stringify({ cropSaveSmoke: { ...savedOptionsState, ...persistedState } }, null, 2));
  if (
    !savedOptionsState.imageLoaded ||
    !savedOptionsState.cropReady ||
    !/(?:已保存|Saved)/.test(savedOptionsState.saveStatus) ||
    !/^data:image\/(?:webp|jpeg);base64,/i.test(persistedState.imagePrefix)
  ) {
    process.exitCode = 1;
  }
  const finalRuntimeErrors = [
    ...(client?.events || []),
    ...(optionsClient?.events || [])
  ]
    .filter((event) => event.method === 'Runtime.exceptionThrown')
    .map((event) => event.params?.exceptionDetails?.text)
    .filter(Boolean);
  if (finalRuntimeErrors.length) {
    console.error('Runtime exceptions:', finalRuntimeErrors);
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error.stack || error.message);
  if (stderr.trim()) console.error(stderr.trim().slice(-4000));
  process.exitCode = 1;
} finally {
  client?.close();
  workerClient?.close();
  optionsClient?.close();
  edge.kill();
  await delay(300);
  const resolvedProfile = resolve(profileDir);
  const resolvedTemp = resolve(tmpdir());
  if (resolvedProfile.startsWith(`${resolvedTemp}\\`) && resolvedProfile.includes('bce-edge-smoke-')) {
    rmSync(resolvedProfile, { recursive: true, force: true });
  }
}
