import { de } from "./i18n/de.js";
import { en } from "./i18n/en.js";
import { pl } from "./i18n/pl.js";
import { ru } from "./i18n/ru.js";

/* ---------- UI language ---------- */
export const DICTS = { ru, en, pl, de };
export const LANGS = Object.keys(DICTS);
export const FALLBACK = "en";

/** First supported language in the device's preference list ("pl-PL" → "pl"), else English. */
export function detectLang(prefs) {
  for (const p of prefs || []) { const base = String(p || "").toLowerCase().split(/[-_]/)[0]; if (LANGS.includes(base)) return base; }
  return FALLBACK;
}
function deviceLangs() { return typeof navigator === "undefined" ? [] : (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language]); }

/** choice is "auto" (follow the device) or one of LANGS. */
export const I18N = { choice: "auto", lang: detectLang(deviceLangs()) };
export function setLang(choice) {
  I18N.choice = LANGS.includes(choice) ? choice : "auto";
  I18N.lang = I18N.choice === "auto" ? detectLang(deviceLangs()) : I18N.choice;
  if (typeof document !== "undefined") document.documentElement.lang = I18N.lang;
}
export const deviceLang = () => detectLang(deviceLangs());

/** Translates a key and fills {placeholders}. Missing keys fall back to English, then to the key itself. */
export function t(key, vars) {
  const s = DICTS[I18N.lang]?.[key] ?? DICTS[FALLBACK][key] ?? key;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m)) : s;
}
/** Locale for Intl date formatting. */
export const locale = () => ({ ru: "ru-RU", en: "en-GB", pl: "pl-PL", de: "de-DE" })[I18N.lang];
