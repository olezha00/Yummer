// Yummer service worker: app shell works offline; API calls always go to the network.
const VERSION = "yummer-v14"; // must equal APP_VERSION in js/services/updates.js
const SHELL = ["./", "index.html", "manifest.webmanifest", "css/fonts.css", "css/styles.css",
  "js/actions.js",
  "js/data/foods.js",
  "js/data/match.js",
  "js/data/store.js",
  "js/i18n.js",
  "js/i18n/de.js",
  "js/i18n/en.js",
  "js/i18n/pl.js",
  "js/i18n/ru.js",
  "js/main.js",
  "js/services/ai.js",
  "js/services/barcode.js",
  "js/services/off.js",
  "js/services/updates.js",
  "js/state.js",
  "js/ui/sheet.js",
  "js/ui/swipe.js",
  "js/ui/views.js",
  "js/util.js",
  "vendor/anthropic.js", "vendor/zxing.min.js",
  "fonts/inter-cyrillic.woff2", "fonts/inter-latin-ext.woff2", "fonts/inter-latin.woff2",
  "fonts/onest-cyrillic.woff2", "fonts/onest-latin-ext.woff2", "fonts/onest-latin.woff2",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", e => {
  // cache: "reload" skips the browser HTTP cache (GitHub Pages lets it keep files for 10 minutes),
  // so a new version never caches files from the old one.
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return; // Open Food Facts, Gemini, Anthropic: network only
  // Pinned files (vendor/, fonts/) never change without a VERSION bump: serve them from the cache.
  if (/\/(vendor|fonts)\//.test(url.pathname)) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
    return;
  }
  // Network first so updates arrive; cache when offline. "no-cache" revalidates with the server instead of
  // trusting the HTTP cache, so a just-deployed file is never mixed with stale ones.
  // Only page navigations fall back to index.html, so a missing script fails as itself instead of returning HTML.
  e.respondWith(
    fetch(e.request.url, { cache: "no-cache", credentials: "same-origin" }).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
      // Safari refuses a redirected response for a page navigation (e.g. /Yummer → /Yummer/). Send the browser
      // a real redirect, so the address bar, and every relative path in the page, use the final URL.
      if (res.redirected && e.request.mode === "navigate") return Response.redirect(res.url, 302);
      return res;
    }).catch(() => caches.match(e.request).then(r => r || (e.request.mode === "navigate" ? caches.match("index.html") : Response.error())))
  );
});
