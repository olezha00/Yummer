/* ---------- App updates ----------
   APP_VERSION must equal VERSION in sw.js (npm run check verifies it). Settings shows it, so it is
   easy to see which version a phone runs. */
export const APP_VERSION = "yummer-v14";

/**
 * Registers the service worker and makes new versions reach the Home Screen app:
 * - sw.js is always fetched from the network (updateViaCache: "none");
 * - an iPhone web app is usually resumed, not reloaded, so we also check for an update each time it comes back;
 * - when a new worker takes over, the page reloads once so old and new modules never mix.
 *   canReload() lets the caller postpone that while the person is in the middle of something.
 */
export function watchForUpdates({ canReload }) {
  if (!("serviceWorker" in navigator) || location.protocol !== "https:") return;
  const hadController = !!navigator.serviceWorker.controller;
  let pending = false, reloading = false;
  const reload = () => { if (!reloading) { reloading = true; location.reload(); } };
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController) return;            // first install: this page is already the current version
    if (canReload()) reload(); else pending = true;
  });
  navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then(reg => {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") reg.update().catch(() => {});
      else if (pending) reload();          // the app went to the background: safe moment to switch versions
    });
  }).catch(() => {});
}
