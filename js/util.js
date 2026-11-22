import { locale, t } from "./i18n.js";

/* ---------- Helpers ---------- */
export const $ = (s, r = document) => r.querySelector(s);
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
export const r1 = n => Math.round((+n || 0) * 10) / 10;
export const fm = n => { n = +n || 0; return n >= 10 ? String(Math.round(n)) : String(r1(n)); };
export const pad = n => String(n).padStart(2, "0");
export const dkey = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
export const fromKey = k => { const [y,m,d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
export const shift = (k, n) => { const d = fromKey(k); d.setDate(d.getDate() + n); return dkey(d); };
export const today = () => dkey(new Date());
export function dateLabel(k) {
  const td = today();
  if (k === td) return t("day.today"); if (k === shift(td, -1)) return t("day.yesterday"); if (k === shift(td, 1)) return t("day.tomorrow");
  return fromKey(k).toLocaleDateString(locale(), { weekday: "short", day: "numeric", month: "short" });
}
export const scale = (f, g) => ({ kcal: f.kcal * g / 100, protein: f.protein * g / 100, fat: f.fat * g / 100, carbs: f.carbs * g / 100 });
export const uidLocal = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
export const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l");

export function blobToB64(blob) { return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(",")[1]); fr.onerror = rej; fr.readAsDataURL(blob); }); }
export const uid2 = () => (crypto.randomUUID ? crypto.randomUUID() : uidLocal());
export function clean(o) { const out = {}; for (const [k, v] of Object.entries(o)) if (v !== undefined) out[k] = v; return out; }
