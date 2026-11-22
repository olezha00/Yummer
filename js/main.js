import { applyStaticText, bindEvents } from "./actions.js";
import { setLang, tText } from "./i18n.js";
import { DEFAULT_GOALS } from "./data/foods.js";
import { IDB, sanitizeGoals, watchDay } from "./data/store.js";
import { AI } from "./services/ai.js";
import { watchForUpdates } from "./services/updates.js";
import { onChange, S, ui } from "./state.js";
import { render } from "./ui/views.js";

/* Yummer entry point: open storage, load settings, wire events, render. */
async function init() {
  try {
    await IDB.open();
    setLang(await IDB.get("kv", "lang")); applyStaticText();
    try { if (navigator.storage && navigator.storage.persist) S.persisted = await navigator.storage.persist(); } catch {}
    const g = sanitizeGoals(await IDB.get("kv", "goals")); if (g) { S.goals = g; S.goalsSet = true; } else S.goals = { ...DEFAULT_GOALS };
    const ai = await IDB.get("kv", "ai");
    if (ai) { AI.provider = ai.provider || "gemini"; AI.keys = { ...AI.keys, ...(ai.keys || {}) }; AI.geminiModel = ai.geminiModel || AI.geminiModel; }
    S.mode = "ready";
    S.foods = await IDB.all("foods");
    await watchDay();
  } catch (e) {
    S.mode = "error"; S.error = tText("app.storageError", { msg: e && e.message || e }); render();
  }
  // Reload into a new version only when no bottom sheet (search, food form…) is open.
  watchForUpdates({ canReload: () => !ui.sheet });
}


// Anti-framing: CSP frame-ancestors cannot be set from a <meta> tag on GitHub Pages, so refuse to run inside a frame.
if (window.top !== window.self) {
  document.body.hidden = true;
} else {
  setLang("auto"); applyStaticText();
  onChange(render);
  bindEvents();
  render();
  init();
}
