// Yummer service worker: app shell works offline; API calls always go to the network.
const VERSION = "yummer-v4";
const SHELL = ["./", "index.html", "manifest.webmanifest", "css/fonts.css", "css/styles.css",
  "js/actions.js",
  "js/data/foods.js",
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
  "js/state.js",
  "js/ui/sheet.js",
  "js/ui/views.js",
  "js/util.js",
  "vendor/anthropic.js", "vendor/zxing.min.js",
  "fonts/inter-cyrillic.woff2", "fonts/inter-latin-ext.woff2", "fonts/inter-latin.woff2",
  "fonts/onest-cyrillic.woff2", "fonts/onest-latin-ext.woff2", "fonts/onest-latin.woff2",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
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
  // Network first so updates arrive; cache when offline. Only page navigations fall back to index.html,
  // so a missing script or image fails as itself instead of being answered with HTML.
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request).then(r => r || (e.request.mode === "navigate" ? caches.match("index.html") : Response.error())))
  );
});
