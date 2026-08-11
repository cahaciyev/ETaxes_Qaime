# ETaxes_Qaime

Qaimə Paket Generator — QAIME_1 (v304) üçün ZIP paket hazırlama aləti.

## Struktur

- `index.html`, `qaime.html` — saytın səhifələri (Ana səhifə və Qaimə Paket aləti), Cloudflare Pages tərəfindən statik olaraq serve olunur.
- `assets/` — build olunmuş, minify/mangle edilmiş CSS və JS (saytın həqiqətən yüklədiyi fayllar).
- `src/` — oxunaqlı mənbə kod (JS modulları, CSS). Redaktə buradan aparılır.
- `build.js` — `src/`-dəki modulları `assets/`-ə bundle+minify edən esbuild skripti.

## Build

```
npm install
npm run build
```

Bu, `src/js/entry-home.js` və `src/js/entry-qaime.js`-i `assets/js/home.js` və `assets/js/qaime.js`-ə, `src/css/style.css`-i isə `assets/css/style.css`-ə bundle edir. Dəyişiklik etdikdən sonra `npm run build` işlədib, həm `src/` həm də `assets/` qovluğunu commit edin.

## Qeyd

Alət tamamilə brauzerdə (client-side) işləyir — heç bir fayl serverə göndərilmir, XML/ZIP paketi lokal olaraq hazırlanır.
