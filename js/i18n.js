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

/* Translations are our own constants; the values filled into {placeholders} may come from outside
   (food names, search text, API errors). So there are two functions:
   - t()     for HTML: every value is HTML-escaped unless wrapped in raw().
   - tText() for textContent, Error messages and statuses that are escaped later: values go in as they are. */
class Raw { constructor(v) { this.v = String(v); } }
/** Marks a trusted HTML fragment (our own markup) so t() inserts it unescaped. */
export const raw = v => new Raw(v);
const escHTML = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const lookup = key => DICTS[I18N.lang]?.[key] ?? DICTS[FALLBACK][key] ?? key;
function fill(s, vars, enc) {
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] == null ? m : vars[k] instanceof Raw ? vars[k].v : enc(String(vars[k])))) : s;
}
/** Translated text for HTML. Missing keys fall back to English, then to the key itself. */
export const t = (key, vars) => fill(lookup(key), vars, escHTML);
/** Translated plain text (not for innerHTML). */
export const tText = (key, vars) => fill(lookup(key), vars, v => v);
/** Locale for Intl date formatting. */
export const locale = () => ({ ru: "ru-RU", en: "en-GB", pl: "pl-PL", de: "de-DE" })[I18N.lang];
