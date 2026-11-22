# Notes for Claude working on Yummer

- The owner reviews every change: work on a branch and open a pull request into `main`; never push to `main` directly.
- No build step and no runtime dependencies beyond `vendor/`. Keep modules as plain ES modules that load in Safari on iOS.
- UI text is in Russian. Keep new strings in Russian and write them plainly.
- Before opening a PR run `npm run check` and `npm test`. Add a test in `tests/` for new pure logic.
- New files under `js/` must be listed in `SHELL` in `sw.js`, and `VERSION` there bumped when shipped files change.
- Never commit API keys. Keys are entered by the user in Settings and stored in IndexedDB only.

## Security (OWASP Top 10)
- Before opening any PR, review the diff against the OWASP Top 10 (run `/security-review`) and fill the Security section of the PR template.
- CI runs CodeQL (security-extended), Semgrep `p/owasp-top-ten` and gitleaks on every PR. Fix findings at the root; never suppress a rule without explaining why in the PR.
- Escape every outside value (Open Food Facts, AI replies, backup files, user input) with `esc()` before it goes into HTML. Validate imported data with the `sanitize*` functions.
- New network hosts must be added to the Content-Security-Policy in `index.html`. Keep the page free of inline scripts.
- Vendored libraries are pinned; update `vendor/SHA256SUMS` when replacing one.
- Pin third-party GitHub Actions to a full commit SHA (with the version in a comment).
