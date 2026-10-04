(() => {
  'use strict';

  // ISO territory coverage is derived at build time from Unicode CLDR's
  // territory catalogue. Names are resolved by the browser's built-in Intl
  // locale data, so looking up a public Bilibili location never makes a
  // network request and never exposes that location to a third party.
  const REGION_CODES = Object.freeze(
    'AC AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CP CQ CR CU CV CW CX CY CZ DE DG DJ DK DM DO DZ EA EC EE EG EH ER ES ET EU EZ FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU IC ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA QO RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TA TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM UN US UY UZ VA VC VE VG VI VN VU WF WS XA XB XK YE YT ZA ZM ZW ZZ'.split(' ')
  );

  // Bilibili emits a few non-CLDR aliases. Keep them explicit and local rather
  // than guessing from an IP address or querying any geolocation service.
  const ALIASES = Object.freeze({
    '中国': 'CN',
    '中国大陆': 'CN',
    '香港': 'HK',
    '中国香港': 'HK',
    '中国香港特别行政区': 'HK',
    '澳门': 'MO',
    '中国澳门': 'MO',
    '中国澳门特别行政区': 'MO',
    '台湾': 'TW',
    '中国台湾': 'TW',
    '台湾地区': 'TW',
    '海外': 'OVERSEAS',
    '未知': 'UNKNOWN',
    '未知地区': 'UNKNOWN',
    '未提供': 'UNKNOWN'
  });

  const FALLBACK_NAMES = Object.freeze({
    'OVERSEAS': 'Overseas',
    'UNKNOWN': 'Unknown',
    '北京': 'Beijing', '天津': 'Tianjin', '上海': 'Shanghai', '重庆': 'Chongqing',
    '河北': 'Hebei', '山西': 'Shanxi', '辽宁': 'Liaoning', '吉林': 'Jilin',
    '黑龙江': 'Heilongjiang', '江苏': 'Jiangsu', '浙江': 'Zhejiang', '安徽': 'Anhui',
    '福建': 'Fujian', '江西': 'Jiangxi', '山东': 'Shandong', '河南': 'Henan',
    '湖北': 'Hubei', '湖南': 'Hunan', '广东': 'Guangdong', '海南': 'Hainan',
    '四川': 'Sichuan', '贵州': 'Guizhou', '云南': 'Yunnan', '陕西': 'Shaanxi',
    '甘肃': 'Gansu', '青海': 'Qinghai', '内蒙古': 'Inner Mongolia', '广西': 'Guangxi',
    '西藏': 'Tibet', '宁夏': 'Ningxia', '新疆': 'Xinjiang'
  });

  function normalize(value) {
    return typeof value === 'string'
      ? value.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/gu, '').replace(/\s+/gu, ' ').trim()
      : '';
  }

  function makeNameMaps() {
    const chineseToEnglish = Object.create(null);
    const codeToEnglish = Object.create(null);
    try {
      const chinese = new Intl.DisplayNames(['zh-CN'], { type: 'region' });
      const english = new Intl.DisplayNames(['en'], { type: 'region' });
      for (const code of REGION_CODES) {
        const chineseName = chinese.of(code);
        const englishName = english.of(code);
        if (typeof chineseName === 'string' && typeof englishName === 'string') {
          chineseToEnglish[normalize(chineseName)] = englishName;
          codeToEnglish[code] = englishName;
        }
      }
    } catch {
      // The small fallback below still covers Bilibili's common public values
      // on a browser that lacks Intl.DisplayNames.
    }
    return { chineseToEnglish, codeToEnglish };
  }

  const maps = makeNameMaps();

  function stripAdministrativeSuffix(value) {
    return value
      .replace(/(?:省|市|特别行政区|自治区)$/u, '')
      .replace(/^中国/u, '');
  }

  function translateChineseRegion(value) {
    const normalized = normalize(value);
    if (!normalized) return '';

    const alias = ALIASES[normalized];
    if (alias) return maps.codeToEnglish[alias] || FALLBACK_NAMES[alias] || normalized;

    const direct = maps.chineseToEnglish[normalized] || FALLBACK_NAMES[normalized];
    if (direct) return direct;

    const simplified = stripAdministrativeSuffix(normalized);
    const simplifiedAlias = ALIASES[simplified];
    if (simplifiedAlias) return maps.codeToEnglish[simplifiedAlias] || FALLBACK_NAMES[simplifiedAlias] || normalized;
    return maps.chineseToEnglish[simplified] || FALLBACK_NAMES[simplified] || normalized;
  }

  globalThis.BCE_REGION_DATA = Object.freeze({
    REGION_CODES,
    translateChineseRegion
  });
})();
