import { DEFAULT_GOALS } from "./data/foods.js";
import { today } from "./util.js";

/* ---------- State ---------- */
export const S = {
  mode: "loading", // loading | db | local | error
  tab: "diary",
  date: today(),
  goals: { ...DEFAULT_GOALS },
  foods: [],
  entries: [],
  sample: null, imagesOK: false,
};

/** UI state for the bottom sheet that is currently open (null when closed). */
export const ui = { sheet: null };
