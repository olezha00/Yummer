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
/* ---------- Product search ----------
   Search-a-licious (search.openfoodfacts.org) takes a Lucene-style query. Two searches run at once:
   products sold in Poland, and products sold elsewhere in the EU / UK. Polish hits come first.
   The query holds both the person's words (brands keep working) and, when AI is set up, a Polish translation. */
export const HOME_COUNTRIES = ["poland"];
export const EU_COUNTRIES = ["european-union", "germany", "czech-republic", "slovakia", "lithuania", "latvia", "estonia", "austria", "hungary",
  "romania", "bulgaria", "croatia", "slovenia", "france", "belgium", "netherlands", "luxembourg", "italy", "spain", "portugal", "ireland",
  "denmark", "sweden", "finland", "greece", "united-kingdom"];
/** Strips characters with a meaning in the query language, so a typed quote or colon can't break the search. */
export function cleanQuery(q) {
  return String(q || "").replace(/[\\+\-!(){}[\]^"~*?:/&|<>=]/g, " ").replace(/\b(AND|OR|NOT|TO)\b/g, m => m.toLowerCase())
    .replace(/\s+/g, " ").trim().slice(0, 80);
}
/** Full query: any of the texts, limited to products sold in one of the countries. */
export function offQuery(texts, countries) {
  const terms = [...new Set(texts.map(cleanQuery).filter(Boolean))];
  if (!terms.length) return "";
  const text = terms.length > 1 ? terms.map(x => "(" + x + ")").join(" OR ") : terms[0];
  return "(" + text + ") AND (" + countries.map(c => 'countries_tags:"en:' + c + '"').join(" OR ") + ")";
}
/** Languages whose product names are searched: Polish first, then the UI language, English and German. */
export const offLangs = lang => [...new Set(["pl", lang, "en", "de"])].join(",");
/** Joins result lists in order, without repeating a product. */
export function mergeFoods(lists, max = 30) {
  const seen = new Set(), out = [];
  for (const list of lists) for (const f of list) if (f && !seen.has(f.id) && out.length < max) { seen.add(f.id); out.push(f); }
  return out;
}
export const searchURL = (query, lang) => "https://search.openfoodfacts.org/search?q=" + encodeURIComponent(query) + "&page_size=25&langs=" + offLangs(lang) + "&fields=" + OFF_FIELDS;
/** The older search on world.openfoodfacts.org: used only when the search service is down. */
export const legacySearchURL = q => "https://world.openfoodfacts.org/cgi/search.pl?search_terms=" + encodeURIComponent(cleanQuery(q)) +
  "&tagtype_0=countries&tag_contains_0=contains&tag_0=poland&search_simple=1&action=process&json=1&page_size=25&fields=" + OFF_FIELDS;

/* Translations of search queries to Polish, kept for this session so a repeated search costs no AI call. */
const toPolish = new Map();
function remember(q, pl) { if (toPolish.size >= 50) toPolish.delete(toPolish.keys().next().value); toPolish.set(q, pl); }
async function polishQuery(q) {
  const cached = toPolish.get(q);
  if (cached) return cached;
  if (I18N.lang === "pl" || !/\p{L}/u.test(q) || /[ąćęłńóśźż]/i.test(q) || !AI.ready()) return q;
  try {
    const pl = await AI.text("Translate this food search query into Polish as it would appear on a product label in a Polish shop. Keep brand names unchanged. Reply with the Polish words only, nothing else: " + q);
    if (pl) { const out = pl.trim().replace(/^["«„“]|["»”]$/g, "").slice(0, 80); remember(q, out); return out; }
  } catch {}
  return q;
}
export async function offSearchLive(q) {
  const query = await polishQuery(q);
  const texts = query !== q ? [query, q] : [q];
  const lang = I18N.lang;
  const hits = countries => browserJSON(searchURL(offQuery(texts, countries), lang)).then(j => (j && j.hits) || []);
  const res = await Promise.allSettled([hits(HOME_COUNTRIES), hits(EU_COUNTRIES)]);
  let lists = res.filter(r => r.status === "fulfilled").map(r => r.value);
  if (!lists.length) {
    try { const j = await browserJSON(legacySearchURL(query)); lists = [(j && j.products) || []]; }
    catch { throw res[0].reason; }
  }
  const items = mergeFoods(lists.map(l => l.map(x => offToFood(x, lang)).filter(offComplete)));
  return { query, items };
}
