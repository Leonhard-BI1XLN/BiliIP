# Third-party notices

The original project code is licensed separately under the MIT License in
`LICENSE`. The files below are third-party materials and remain under their
own licenses. Full local license texts are included in `LICENSES/`.

## Unicode CLDR territory coverage

`content/region-data.js` contains the ISO territory-code coverage list used to
recognize Bilibili's public country/region labels. The list was generated from
the Unicode Common Locale Data Repository (CLDR) territory catalogue. Runtime
English names are resolved locally by the browser's `Intl.DisplayNames` data;
the extension does not download a location database or call a location API.

- Source: <https://github.com/unicode-org/cldr-json>
- Territory catalogue: <https://github.com/unicode-org/cldr-json/tree/main/cldr-json/cldr-localenames-full/main>
- License: [Unicode License v3](https://www.unicode.org/license.txt)
- Local copy: `LICENSES/Unicode-3.0.txt`

Copyright © Unicode, Inc. Unicode and the Unicode Logo are registered
trademarks of Unicode, Inc. in the United States and other countries.

## Google Material Icons — Translate

`assets/icons/google-translate.svg` is the scalable `translate` icon from
Google's Material Design Icons project. It is bundled locally for the manual
translation button and is never requested from a web page at runtime.

- Source: <https://github.com/google/material-design-icons>
- Asset: <https://github.com/google/material-design-icons/tree/master/src/action/translate>
- Copyright: Google LLC and contributors
- License: [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)
- Local copy: `LICENSES/Apache-2.0.txt`

## BiliBili-To-English fixed UI glossary

`content/bili-english-expanded-dictionary.js` contains a local-only import of
fixed Chinese-to-English Bilibili interface strings. The original project's
online translation fallback, scripts, permissions, and user-content handling
are not included or used by this extension.

- Source: <https://github.com/LazyScar/BiliBili-To-English>
- Imported data: <https://github.com/LazyScar/BiliBili-To-English/blob/main/languages/en.js>
- Copyright: LazyScar
- License: [MIT License](https://github.com/LazyScar/BiliBili-To-English/blob/main/LICENSE)
- Local copy: `LICENSES/MIT-LazyScar.txt`
