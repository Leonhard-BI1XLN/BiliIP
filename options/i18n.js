(() => {
  'use strict';

  // This is a local, hand-written UI glossary. It does not call a translation
  // service or send settings, image data, or page text off the device.
  const en = Object.freeze({
    'BiliIP+ · 设置': 'BiliIP+ · Settings',
    '前往设置内容': 'Go to settings',
    '评论与横幅设置': 'Comment and banner settings',
    '全部数据仅保存在本机': 'All data stays on this device',
    '界面语言': 'Interface language',
    '简体中文': 'Simplified Chinese',
    '自定义你的 B 站网页': 'Customize your Bilibili experience',
    '少一点干扰，': 'Less distraction,',
    '多一点信息。': 'more useful context.',
    '补充评论公开属地与秒级时间，并用你喜欢的静态图片替换首页动态横幅。': 'Add public comment locations and second-level timestamps, then replace the homepage motion banner with an image you choose.',
    '设置页面导航': 'Settings navigation',
    '评论增强': 'Comment enhancements',
    'B 站页面语言': 'Bilibili page language',
    '首页横幅': 'Homepage banner',
    '隐私说明': 'Privacy',
    '关于 IP 属地': 'About IP locations',
    'B 站不会公开真实 IP。扩展只展示接口已经返回的属地，通常精确到省级或国家/地区，无法可靠推断市、区或县。': 'Bilibili does not disclose real IP addresses. This extension only shows the public location returned by Bilibili, usually a province or country/region; it cannot reliably infer a city, district, or county.',
    '在原评论信息旁补充 B 站公开数据，不请求第三方定位服务。': 'Add Bilibili’s public data beside comments without requesting a third-party location service.',
    '启用评论增强': 'Enable comment enhancements',
    '总开关关闭后，下方设置暂时不会应用': 'When off, the settings below are temporarily inactive',
    '显示 IP 属地': 'Show IP location',
    '仅显示 B 站接口公开返回的位置': 'Only show locations returned publicly by Bilibili',
    '显示精确时间': 'Show precise time',
    '24 小时制，精确到秒': '24-hour time, precise to the second',
    '时间与格式': 'Time and format',
    '时间格式': 'Time format',
    '日期格式固定为英式日/月/年，使用点号分隔时分秒。': 'Dates always use British day/month/year order, with dots between hours, minutes, and seconds.',
    '当天评论显示每秒更新的相对时间；昨天与更早评论按日期、时间分开显示。': 'Today’s comments show a second-by-second relative clock; yesterday and older comments show separate date and time fields.',
    '当前时间格式预览': 'Current time-format preview',
    '显示时区': 'Display time zone',
    '北京时间': 'China Standard Time',
    '固定 UTC+8': 'Fixed UTC+8',
    '浏览器本地时间': 'Browser local time',
    '跟随系统时区': 'Follow the system time zone',
    '缺失属地的处理': 'When a location is unavailable',
    '旧评论、部分账号或接口限制可能导致属地为空。': 'Older comments, some accounts, or API limitations can leave a location empty.',
    '显示“IP: 未提供”': 'Show “IP: Not available”',
    '本地英语化': 'Local English interface',
    '用本地固定词典翻译 B 站常见界面和本扩展新增的评论信息，不上传任何网页文字。': 'Use a local fixed glossary for common Bilibili interface labels and this extension’s added comment information; no webpage text is uploaded.',
    '用本地固定词典翻译 B 站常见界面；评论正文只会在你点击按钮后由 Edge 在本机处理。': 'Use a local fixed glossary for common Bilibili interface labels; comment text is processed on-device by Edge only after you click its button.',
    '应用到 B 站的语言': 'Language applied to Bilibili',
    '中文（不翻译 B 站界面）': 'Chinese (do not translate Bilibili)',
    '保留 B 站原始中文': 'Keep Bilibili’s original Chinese',
    'English（本地词典）': 'English (local glossary)',
    '翻译常见固定界面文字': 'Translate common fixed interface labels',
    '设置页语言与 B 站页面语言彼此独立。为避免误译用户内容，标题、评论、私信和弹幕不会被自动翻译。': 'The settings-page language and Bilibili page language are independent. To avoid mistranslating user content, titles, comments, direct messages, and danmaku are never translated automatically.',
    '评论按需翻译': 'On-demand comment translation',
    '启用手动翻译': 'Enable manual translation',
    '关闭后不显示翻译图标，也不会处理任何翻译请求。': 'When off, translation icons are hidden and no translation requests are processed.',
    '评论默认保持原文。点击评论下方的“文⇄A 翻译”后，Edge 会在本机翻译到所选语言；首次使用某个语言对时，浏览器可能下载本地模型。': 'Comments stay in their original language by default. After you click “文⇄A Translate” below a comment, Edge translates it on-device into the selected language; the browser may download a local model for a language pair the first time you use it.',
    '评论翻译目标语言': 'Comment translation target',
    '设置页语言、B 站页面语言和评论翻译目标彼此独立。标题、评论、私信和弹幕不会被自动翻译；本机翻译仅在你点击某条评论时运行，评论文字、IP 属地和设置不会上传给扩展服务。': 'The settings-page language, Bilibili page language, and comment translation target are independent. Titles, comments, direct messages, and danmaku are never translated automatically; on-device translation runs only when you click a comment, and the comment text, IP location, and settings are never uploaded by this extension.',
    '用一张静态图覆盖首页顶部动态景深横幅，鼠标移动时不再晃动。': 'Cover the homepage motion/parallax banner with a static image that does not move with the mouse.',
    '启用自定义横幅': 'Enable custom banner',
    '关闭后恢复 B 站原始横幅': 'Turn off to restore Bilibili’s original banner',
    '效果预览': 'Preview',
    '裁切、亮度和高度调整会实时显示在这里。': 'Cropping, dimming, and height changes appear here immediately.',
    '横幅实时预览': 'Live banner preview',
    '上传图片后将在这里预览': 'Upload an image to preview it here',
    '首页': 'Home',
    '番剧': 'Anime',
    '直播': 'Live',
    '游戏中心': 'Games',
    '横幅高度': 'Banner height',
    '暗化程度': 'Dimming',
    '上传与裁切': 'Upload and crop',
    '支持 PNG、JPEG、WebP；适配 B 站 32:3 横幅，最终导出为 2560 × 240。': 'Supports PNG, JPEG, and WebP; fit for Bilibili’s 32:3 banner and exported at 2560 × 240.',
    '拖放图片或选择图片': 'Drop an image or choose one',
    '拖放图片到这里': 'Drop an image here',
    '或': 'or',
    '选择本地图片': 'choose a local image',
    '· 建议宽度不低于 1920 px': ' · recommended width: at least 1920 px',
    '横幅图片': 'Banner image',
    '横幅裁切画布': 'Banner crop canvas',
    '上传或选择横幅图片': 'Upload or choose a banner image',
    '单击重新上传，拖动进行裁切': 'Click to re-upload; drag to crop',
    '尚未选择图片': 'No image selected',
    '上传后可拖动平移并缩放裁切': 'After upload, drag to pan and zoom the crop',
    '32:3 裁切区域': '32:3 crop area',
    '复位裁切': 'Reset crop',
    '删除图片': 'Remove image',
    '保存格式': 'Save format',
    'WebP（推荐，体积更小）': 'WebP (recommended, smaller file)',
    'JPEG（兼容性更好）': 'JPEG (better compatibility)',
    '图片质量': 'Image quality',
    '保存时会在浏览器内完成裁切和压缩。图片不会离开这台设备，也不会上传到任何服务器。': 'Cropping and compression happen inside the browser when you save. The image never leaves this device or uploads to a server.',
    '隐私与数据说明': 'Privacy and data',
    '设置和横幅图片仅写入 Edge 扩展的本地存储。扩展不收集、上传或出售任何数据；卸载扩展后，这些数据会由浏览器清除。': 'Settings and banner images are stored only in Edge extension local storage. The extension does not collect, upload, or sell data; the browser clears this data when the extension is removed.',
    '免责声明与许可证': 'Disclaimers and licenses',
    '项目授权、第三方资源来源、平台使用说明和非官方声明统一放在独立页面。': 'Project licensing, third-party sources, platform-use notes, and the unofficial-project statement are collected on a separate page.',
    '查看完整说明': 'View full notice',
    '正在读取设置…': 'Loading settings…',
    '恢复默认': 'Restore defaults',
    '保存并应用': 'Save and apply',
    '设置已保存': 'Settings saved',
    '设置已载入': 'Settings loaded',
    '无法读取设置，请刷新后重试': 'Could not read settings. Refresh and try again.',
    '无法读取本地设置': 'Could not read local settings',
    '已保存的横幅': 'Saved banner',
    '请选择 PNG、JPEG 或 WebP 图片': 'Choose a PNG, JPEG, or WebP image',
    '图片超过 40 MB，请先压缩后再试': 'The image is over 40 MB. Compress it and try again.',
    '正在读取图片…': 'Loading image…',
    '新图片尚未保存': 'New image has not been saved',
    '图片已载入，可以拖动裁切': 'Image loaded. Drag to crop it.',
    '无法读取这张图片，请换一张重试': 'Could not read this image. Try a different one.',
    '图片读取失败': 'Image could not be loaded',
    '图片尺寸无效': 'Invalid image dimensions',
    '图片像素超过 8000 万，请缩小后再试': 'The image exceeds 80 million pixels. Resize it and try again.',
    '图片解码失败': 'Image decoding failed',
    '图片已移除，保存后生效': 'Image removed. Save to apply it.',
    '图片已移除，记得保存设置': 'Image removed. Remember to save settings.',
    '恢复全部默认设置？当前尚未保存的修改和横幅图片会被移除。': 'Restore all defaults? Unsaved changes and the banner image will be removed.',
    '已恢复默认，保存后生效': 'Defaults restored. Save to apply them.',
    '已恢复默认设置，记得保存': 'Default settings restored. Remember to save.',
    '正在裁切并压缩图片…': 'Cropping and compressing image…',
    '正在保存设置…': 'Saving settings…',
    '已保存': 'Saved',
    '设置已保存，刷新 B 站页面即可应用': 'Settings saved. Refresh Bilibili to apply them.',
    '保存失败，请重试': 'Save failed. Try again.',
    '浏览器无法导出所选图片格式': 'The browser cannot export the selected image format',
    '有尚未保存的修改': 'Unsaved changes',
    '所有设置已保存': 'All settings are saved',
    '本地图片': 'Local image'
  });

  const textState = new Map();
  const attributeState = new Map();
  let currentLanguage = 'zh-CN';

  function translate(source, language = currentLanguage) {
    if (typeof source !== 'string' || language !== 'en') {
      return source;
    }
    return en[source] || source;
  }

  function preserveWhitespace(source, translated) {
    if (source === translated) {
      return source;
    }
    const leading = source.match(/^\s*/u)?.[0] || '';
    const trailing = source.match(/\s*$/u)?.[0] || '';
    return `${leading}${translated}${trailing}`;
  }

  function translateTextNode(node) {
    const previous = textState.get(node);
    const original = previous && node.nodeValue === previous.rendered
      ? previous.original
      : node.nodeValue;
    const translated = preserveWhitespace(original, translate(original.trim()));
    if (translated !== original || previous) {
      textState.set(node, { original, rendered: translated });
      if (node.nodeValue !== translated) {
        node.nodeValue = translated;
      }
    }
  }

  function translateAttribute(element, name) {
    const key = `${name}`;
    let state = attributeState.get(element);
    if (!state) {
      state = new Map();
      attributeState.set(element, state);
    }
    const previous = state.get(key);
    const current = element.getAttribute(name);
    const original = previous && current === previous.rendered ? previous.original : current;
    if (original == null) {
      return;
    }
    const translated = translate(original);
    if (translated !== original || previous) {
      state.set(key, { original, rendered: translated });
      if (current !== translated) {
        element.setAttribute(name, translated);
      }
    }
  }

  function scan(root) {
    if (!root || !document.createTreeWalker) {
      return;
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const tagName = node.parentElement?.tagName;
      if (tagName === 'SCRIPT' || tagName === 'STYLE') {
        continue;
      }
      translateTextNode(node);
    }

    const elements = root.querySelectorAll?.('[aria-label],[title]') || [];
    for (const element of elements) {
      if (element.hasAttribute('aria-label')) translateAttribute(element, 'aria-label');
      if (element.hasAttribute('title')) translateAttribute(element, 'title');
    }
  }

  function apply(language) {
    currentLanguage = language === 'en' ? 'en' : 'zh-CN';
    document.documentElement.lang = currentLanguage;
    document.title = translate('BiliIP+ · 设置');
    scan(document.body || document.documentElement);

    for (const element of document.querySelectorAll('[data-bce-i18n-source]')) {
      element.textContent = `${translate(element.dataset.bceI18nSource || '')}${element.dataset.bceI18nSuffix || ''}`;
    }
  }

  globalThis.BCE_SETTINGS_I18N = Object.freeze({
    apply,
    getLanguage: () => currentLanguage,
    t: translate
  });
})();
