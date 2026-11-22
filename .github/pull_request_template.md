## What changes

## How it was tested

## Security (OWASP Top 10)
<!-- Tick what applies, and explain anything that doesn't pass. CI also runs CodeQL, Semgrep OWASP rules and a secret scan. -->
- [ ] A03 Injection / XSS: every outside value put into HTML goes through `esc()`; no new `innerHTML` with raw data
- [ ] A05 Misconfiguration: Content-Security-Policy still covers any new host in `connect-src`
- [ ] A06/A08 Components and integrity: no new third-party code, or it is pinned in `vendor/` with `SHA256SUMS` updated
- [ ] A02/A07 Secrets: no keys or tokens in code, logs or URLs
- [ ] A04 Input validation: data from files, APIs or AI replies is checked before it is stored
- [ ] A10 SSRF / outbound calls: requests go only to the allowed hosts
