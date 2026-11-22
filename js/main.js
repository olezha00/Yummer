import { bindEvents } from "./actions.js";
import { DEFAULT_GOALS } from "./data/foods.js";
import { IDB, watchDay } from "./data/store.js";
import { AI } from "./services/ai.js";
import { S } from "./state.js";
import { render } from "./ui/views.js";

/* Yummer entry point: open storage, load settings, wire events, render. */
async function init() {
  try {
    await IDB.open();
    try { if (navigator.storage && navigator.storage.persist) S.persisted = await navigator.storage.persist(); } catch {}
    const g = await IDB.get("kv", "goals"); if (g) { S.goals = { ...DEFAULT_GOALS, ...g }; S.goalsSet = true; }
    const ai = await IDB.get("kv", "ai");
    if (ai) { AI.provider = ai.provider || "gemini"; AI.keys = { ...AI.keys, ...(ai.keys || {}) }; AI.geminiModel = ai.geminiModel || AI.geminiModel; }
    S.mode = "ready";
    S.foods = await IDB.all("foods");
    await watchDay();
  } catch (e) {
    S.mode = "error"; S.error = "Не удалось открыть хранилище на устройстве: " + (e && e.message || e); render();
  }
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
}


bindEvents();
render();
init();
