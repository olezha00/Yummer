# Yummer

A personal food diary for iPhone, built as an installable web app. It tracks calories and macros, scans barcodes with the camera, looks products up in Open Food Facts, and can estimate meals with AI (Gemini's free tier by default, or Claude, using your own key).

The app is in Russian, English, Polish and German. It follows the phone's language (English when the phone uses another language), and you can pick a language in Settings.

Live app: https://olezha00.github.io/yummer/

## Install on iPhone
1. Open the link above in Safari.
2. Tap Share, then **Add to Home Screen**.
3. Open Yummer from the Home Screen icon. To use the AI features, paste a Gemini key (aistudio.google.com) in Settings.

## How it is built
Plain HTML, CSS and JavaScript modules. There is no build step: GitHub Pages serves the files as they are.

```
index.html            page markup and script tags
css/styles.css        all styles; colours are tokens with a dark theme
css/fonts.css         self-hosted Onest and Inter (no request to Google Fonts)
js/main.js            entry point: opens storage, loads settings, wires events, first render
js/state.js           shared app state (S) and the open bottom sheet (ui.sheet)
js/i18n.js            language choice (device or Settings) and t() for translated text
js/i18n/*.js          UI text per language: ru, en, pl, de (same keys in each)
js/util.js            small pure helpers: dates, rounding, escaping, text normalising
js/actions.js         what happens on taps, typing and form submits (all event wiring)
js/data/foods.js      built-in generic foods, meals, default goals
js/data/store.js      IndexedDB storage on the device, backup export/import
js/services/off.js    Open Food Facts API: barcode lookup and product search
js/services/ai.js     AI calls (Gemini or Claude), label reading prompts and schemas
js/services/barcode.js  live camera scanner and barcode decoding from photos
js/ui/views.js        diary, my foods and settings screens
js/ui/sheet.js        bottom sheets: search, amount, describe-a-meal, food form
sw.js                 service worker: the app opens offline
vendor/               pinned copies of @anthropic-ai/sdk 1.7.0 and @zxing/library 0.21.3
fonts/                Onest and Inter woff2 files (SIL Open Font License)
tests/                unit tests for the pure helpers (node --test)
```

## Working on it
- Run locally: `npm run serve`, then open http://localhost:8080.
- Checks: `npm run check` (syntax and imports) and `npm test`. Both run on every pull request in GitHub Actions.
- Changes go through pull requests into `main`. Merging to `main` publishes the app.
- When you add a new file under `js/`, add it to `SHELL` in `sw.js` and bump `VERSION` there, so phones pick up the update.

## Data and privacy
- Your diary lives on the device (IndexedDB). Use Settings → "Сохранить копию" to back it up.
- API keys stay on the device and are sent only to the AI service you choose.
- Product data comes from [Open Food Facts](https://world.openfoodfacts.org) under the ODbL licence.
