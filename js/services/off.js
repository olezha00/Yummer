import { AI } from "./ai.js";
import { I18N, tText } from "../i18n.js";

/* ---------- Open Food Facts: direct API calls ---------- */
export const OFFAPI = { available: true };
export const OFF_FIELDS = "code,product_name,product_name_pl,product_name_ru,product_name_en,product_name_de,brands,nutriments,serving_quantity";
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export async function browserJSON(url) {
  if (!navigator.onLine) throw Object.assign(new Error(tText("off.err.offline")), { code: "offline" });
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { Accept: "application/json" } });
    if (r.status === 404) return null;
    if (!r.ok) throw Object.assign(new Error(tText("off.err.http", { status: r.status })), { code: "http" });
    return await r.json();
  } catch (e) {
    if (e.name === "AbortError") throw Object.assign(new Error(tText("off.err.timeout")), { code: "timeout" });
    throw e;
  } finally { clearTimeout(timer); }
}
export function offErrorText(e) {
  // Our own errors carry a code and an already translated message; anything else (TypeError from fetch…) gets a generic one.
  return (e && e.code && e.message) ? e.message : tText("off.err.generic");
}
export const n1 = v => (v == null || v === "" || isNaN(+v)) ? null : Math.round(+v * 10) / 10;
/** Maps an OFF product to a food. lang picks the preferred product name (falls back to Polish, then the default name). */
export function offToFood(x, lang = "en") {
  const code = x && String(x.code ?? "");
  if (!code || !/^\d{6,14}$/.test(code)) return null;   // hits without a real barcode are skipped
  const n = x.nutriments || {};
  let kcal = n1(n["energy-kcal_100g"]); if (kcal == null && n["energy-kj_100g"] != null) kcal = n1(n["energy-kj_100g"] / 4.184);
  const name = String(x["product_name_" + lang] || x.product_name_pl || x.product_name || "").trim();
  const brand = (Array.isArray(x.brands) ? x.brands[0] : String(x.brands || "").split(",")[0] || "").trim() || null;
  const f = { id: code, barcode: code, name, brand, kcal, protein: n1(n.proteins_100g), fat: n1(n.fat_100g), carbs: n1(n.carbohydrates_100g), serving: n1(x.serving_quantity), source: "off" };
  return f;
}
export const offComplete = f => f && f.name && [f.kcal, f.protein, f.fat, f.carbs].every(v => v != null);
export async function offByBarcode(code) {
  const j = await browserJSON("https://world.openfoodfacts.org/api/v2/product/" + encodeURIComponent(code) + ".json?fields=" + OFF_FIELDS);
  return j && j.status === 1 ? offToFood({ ...j.product, code }, I18N.lang) : null;
}
/* Translations of search queries to Polish, kept for this session so a repeated search costs no AI call. */
const toPolish = new Map();
function remember(q, pl) { if (toPolish.size >= 50) toPolish.delete(toPolish.keys().next().value); toPolish.set(q, pl); }
export async function offSearchLive(q) {
  let query = q;
  const cached = toPolish.get(q);
  if (cached) query = cached;
  else if (I18N.lang !== "pl" && /\p{L}/u.test(q) && !/[ąćęłńóśźż]/i.test(q) && AI.ready()) {
    try { const pl = await AI.text("Translate this food search query into Polish as it would appear on a product label in a Polish shop. Reply with the Polish words only, nothing else: " + q); if (pl) { query = pl.trim().replace(/^["«„“]|["»”]$/g, "").slice(0, 80); remember(q, query); } } catch {}
  }
  const url = "https://search.openfoodfacts.org/search?q=" + encodeURIComponent(query + ' countries_tags:"en:poland"') + "&page_size=25&langs=pl,en&fields=" + OFF_FIELDS;
  const j = await browserJSON(url);
  return { query, items: ((j && j.hits) || []).map(x => offToFood(x, I18N.lang)).filter(offComplete) };
}
