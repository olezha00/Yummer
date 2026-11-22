# Notes for Claude working on Yummer

- The owner reviews every change: work on a branch and open a pull request into `main`; never push to `main` directly.
- No build step and no runtime dependencies beyond `vendor/`. Keep modules as plain ES modules that load in Safari on iOS.
- UI text is in Russian. Keep new strings in Russian and write them plainly.
- Before opening a PR run `npm run check` and `npm test`. Add a test in `tests/` for new pure logic.
- New files under `js/` must be listed in `SHELL` in `sw.js`, and `VERSION` there bumped when shipped files change.
- Never commit API keys. Keys are entered by the user in Settings and stored in IndexedDB only.
