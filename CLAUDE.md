# Notes for Claude working on Yummer

- The owner reviews every change: work on a branch and open a pull request into `main`; never push to `main` directly.
- No build step and no runtime dependencies beyond `vendor/`. Keep modules as plain ES modules that load in Safari on iOS.
- The UI supports Russian, English, Polish and German. Never hard-code UI text: add a key to every file in `js/i18n/` and use `t("key")`. The default language follows the device; Settings can override it. Write strings plainly.
- Before opening a PR run `npm run check` and `npm test`. Add a test in `tests/` for new pure logic.
- New files under `js/`, `css/`, `fonts/` and `vendor/` must be listed in `SHELL` in `sw.js` (`npm run check` fails otherwise), and `VERSION` there bumped when shipped files change, together with `APP_VERSION` in `js/services/updates.js` (`npm run check` compares them). Settings shows that version, so you can see what a phone runs.
- Keep imports one-way: `ui/` and `actions.js` may import `data/` and `services/`, never the reverse. `data/` signals changes with `changed()` from `state.js`. `npm run check` fails on import cycles.
- Never commit API keys. Keys are entered by the user in Settings and stored in IndexedDB only.

## Security (OWASP Top 10)
- Before opening any PR, review the diff against the OWASP Top 10 (run `/security-review`) and fill the Security section of the PR template.
- CI runs CodeQL (security-extended), Semgrep `p/owasp-top-ten` and gitleaks on every PR. Fix findings at the root; never suppress a rule without explaining why in the PR.
- Escape every outside value (Open Food Facts, AI replies, backup files, user input) with `esc()` before it goes into HTML. Validate imported data with the `sanitize*` functions.
- New network hosts must be added to the Content-Security-Policy in `index.html`. Keep the page free of inline scripts.
- Vendored libraries are pinned; update `vendor/SHA256SUMS` when replacing one.
- Pin third-party GitHub Actions to a full commit SHA (with the version in a comment).

## Review flow
1. The developer (Claude) builds the change on a branch, runs the checks and a self-review, opens a PR, and tells the reviewer.
2. A separate reviewer reviews the PR against the OWASP Top 10 and for code quality and efficiency, and posts its findings as review comments on the PR.
3. The developer fixes each finding, or replies explaining why it is not a problem, pushes, and resolves the quality threads. Security threads are left for the reviewer.
4. The reviewer re-reviews the new commits. When the re-review is clean and every CI check is green, the reviewer resolves the remaining threads and merges the PR (the owner's standing rule). The developer never merges.
