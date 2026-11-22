import { AI } from "./ai.js";
import { $ } from "../util.js";

/* ---------- Open Food Facts: direct API calls ---------- */
export const OFFAPI = { available: true };
export const OFF_FIELDS = "code,product_name,product_name_pl,product_name_ru,brands,nutriments,serving_quantity";
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export async function browserJSON(url) {
  if (!navigator.onLine) throw Object.assign(new Error("Нет интернета. Поиск в Open Food Facts недоступен."), { code: "offline" });
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { Accept: "application/json" } });
    if (r.status === 404) return null;
    if (!r.ok) throw Object.assign(new Error("Open Food Facts ответил ошибкой " + r.status + ". Попробуйте ещё раз."), { code: "http" });
    return await r.json();
  } catch (e) {
    if (e.name === "AbortError") throw Object.assign(new Error("Open Food Facts не ответил вовремя. Попробуйте ещё раз."), { code: "timeout" });
    throw e;
  } finally { clearTimeout(t); }
}
export function offErrorText(e) {
  return (e && e.message && /[а-яё]/i.test(e.message)) ? e.message : "Не удалось связаться с Open Food Facts. Проверьте интернет и попробуйте ещё раз.";
}
export const n1 = v => (v == null || v === "" || isNaN(+v)) ? null : Math.round(+v * 10) / 10;
export function offToFood(x) {
  if (!x) return null;
  const n = x.nutriments || {};
  let kcal = n1(n["energy-kcal_100g"]); if (kcal == null && n["energy-kj_100g"] != null) kcal = n1(n["energy-kj_100g"] / 4.184);
  const name = String(x.product_name_ru || x.product_name_pl || x.product_name || "").trim();
  const brand = (Array.isArray(x.brands) ? x.brands[0] : String(x.brands || "").split(",")[0] || "").trim() || null;
  const f = { id: String(x.code), barcode: String(x.code), name, brand, kcal, protein: n1(n.proteins_100g), fat: n1(n.fat_100g), carbs: n1(n.carbohydrates_100g), serving: n1(x.serving_quantity), source: "off" };
  return f;
}
export const offComplete = f => f && f.name && [f.kcal, f.protein, f.fat, f.carbs].every(v => v != null);
export async function offByBarcode(code) {
  const j = await browserJSON("https://world.openfoodfacts.org/api/v2/product/" + encodeURIComponent(code) + ".json?fields=" + OFF_FIELDS);
  return j && j.status === 1 ? offToFood({ code, ...j.product }) : null;
}
export async function offSearchLive(q) {
  let query = q;
  if (/[а-яё]/i.test(q) && AI.ready()) {
    try { const t = await AI.text("Translate this food search query into Polish as it would appear on a product label in a Polish shop. Reply with the Polish words only, nothing else: " + q); if (t) query = t.trim().replace(/^["«]|["»]$/g, "").slice(0, 80); } catch {}
  }
  const url = "https://search.openfoodfacts.org/search?q=" + encodeURIComponent(query + ' countries_tags:"en:poland"') + "&page_size=25&langs=pl,en&fields=" + OFF_FIELDS;
  const j = await browserJSON(url);
  return { query, items: ((j && j.hits) || []).map(offToFood).filter(offComplete) };
}
