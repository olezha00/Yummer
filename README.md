# Yummer

A personal food diary for iPhone (installable web app): calories and macros, live barcode scanning, Open Food Facts product lookup, and AI meal estimates (Gemini free tier or Claude, with your own key).

## Install on iPhone
1. Open the GitHub Pages link in Safari.
2. Tap Share → **Add to Home Screen**.

## Notes
- All data is stored on the device (IndexedDB). Use Settings → "Сохранить копию" to back up.
- API keys are stored only on the device and sent only to the chosen AI provider.
- Product data: [Open Food Facts](https://world.openfoodfacts.org), ODbL.
- `vendor/` holds bundled copies of `@anthropic-ai/sdk` 1.7.0 and `@zxing/library` 0.21.3.
