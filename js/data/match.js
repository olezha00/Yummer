import { norm } from "../util.js";

/* ---------- Finding saved products that look like a product read from a photo ----------
   Signals: the same barcode (certain), similar name/brand words, and nearly equal nutrition per 100 g.
   Nutrition helps when the saved name is in another language than the pack (a Russian name vs the Polish "Twaróg"). */
const words = s => new Set(norm(s).split(/[^\p{L}\p{N}]+/u).filter(w => w.length >= 2));
function dice(a, b) {
  if (!a.size || !b.size) return 0;
  let common = 0; for (const w of a) if (b.has(w)) common++;
  return 2 * common / (a.size + b.size);
}
const close = (x, y) => x != null && y != null && Math.abs(x - y) <= Math.max(1, 0.05 * Math.max(x, y));
export const sameNutrition = (a, b) => ["kcal", "protein", "fat", "carbs"].every(k => close(+a[k], +b[k]));

/** 0..1, how likely `food` (saved) is the product `read` from a photo. */
export function matchScore(read, food) {
  if (read.barcode && food.barcode && read.barcode === food.barcode) return 1;
  const nameSim = dice(words((read.name || "") + " " + (read.brand || "")), words((food.name || "") + " " + (food.brand || "")));
  const brandEq = read.brand && food.brand && norm(read.brand) === norm(food.brand) ? 0.2 : 0;
  const nutri = sameNutrition(read, food) ? 0.4 : 0;
  return Math.min(0.99, nameSim * 0.7 + brandEq + nutri);
}

/** Up to `limit` saved foods that probably are the same product, best first. */
export function findMatches(read, foods, limit = 5) {
  if (!read) return [];
  return foods.map(f => ({ f, s: matchScore(read, f) })).filter(x => x.s >= 0.5)
    .sort((a, b) => b.s - a.s).slice(0, limit).map(x => x.f);
}
