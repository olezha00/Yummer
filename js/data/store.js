import { S } from "../state.js";
import { render } from "../ui/views.js";
import { clean, norm, uid2 } from "../util.js";

/* ---------- Data layer: IndexedDB on this device ---------- */
export const IDB = {
  db: null,
  open() {
    return new Promise((res, rej) => {
      const rq = indexedDB.open("yummer", 1);
      rq.onupgradeneeded = () => {
        const d = rq.result;
        const en = d.createObjectStore("entries", { keyPath: "id" }); en.createIndex("date", "date"); en.createIndex("createdAt", "createdAt");
        d.createObjectStore("foods", { keyPath: "id" });
        d.createObjectStore("kv");
      };
      rq.onsuccess = () => { this.db = rq.result; res(); };
      rq.onerror = () => rej(rq.error);
    });
  },
  tx(store, mode, fn) {
    return new Promise((res, rej) => {
      const t = this.db.transaction(store, mode); const st = t.objectStore(store); let out;
      const r = fn(st); if (r) r.onsuccess = () => { out = r.result; };
      t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    });
  },
  all(store) { return this.tx(store, "readonly", st => st.getAll()); },
  byDate(date) { return this.tx("entries", "readonly", st => st.index("date").getAll(date)); },
  put(store, v, key) { return this.tx(store, "readwrite", st => key === undefined ? st.put(v) : st.put(v, key)); },
  get(store, key) { return this.tx(store, "readonly", st => st.get(key)); },
  del(store, key) { return this.tx(store, "readwrite", st => st.delete(key)); },
  clear(store) { return this.tx(store, "readwrite", st => st.clear()); },
};
export async function reloadFoods() { S.foods = await IDB.all("foods"); render(); }
export async function watchDay() { const d = S.date; const list = await IDB.byDate(d); if (S.date === d) { S.entries = list; render(); } }

export const Data = {
  async saveGoals(g) { S.goals = g; S.goalsSet = true; await IDB.put("kv", g, "goals"); render(); },
  async addFood(f) { const id = uid2(); await IDB.put("foods", clean({ ...f, id, createdAt: Date.now() })); await reloadFoods(); return id; },
  async updateFood(id, f) { const cur = await IDB.get("foods", id); await IDB.put("foods", clean({ ...cur, ...f, id })); await reloadFoods(); },
  async deleteFood(id) { await IDB.del("foods", id); await reloadFoods(); },
  async addEntry(e) { await IDB.put("entries", clean({ ...e, id: uid2(), createdAt: Date.now() })); await watchDay(); },
  async updateEntry(id, e) { const cur = (await IDB.get("entries", id)) || {}; await IDB.put("entries", clean({ ...cur, ...e, id })); await watchDay(); },
  async deleteEntry(id) { await IDB.del("entries", id); await watchDay(); },
  async recent() {
    const list = (await IDB.all("entries")).sort((a, b) => b.createdAt - a.createdAt);
    const seen = new Set(), out = [];
    for (const e of list) { const k = norm(e.name); if (seen.has(k) || !e.per100) continue; seen.add(k); out.push(e); if (out.length >= 12) break; }
    return out;
  },
  async exportAll() {
    return { app: "yummer", version: 1, exportedAt: new Date().toISOString(), goals: await IDB.get("kv", "goals") || null, foods: await IDB.all("foods"), entries: await IDB.all("entries") };
  },
  async importAll(d) {
    if (!d || d.app !== "yummer" || !Array.isArray(d.entries) || !Array.isArray(d.foods)) throw new Error("Это не файл резервной копии Yummer.");
    const foods = d.foods.map(sanitizeFood).filter(Boolean), entries = d.entries.map(sanitizeEntry).filter(Boolean);
    for (const f of foods) await IDB.put("foods", f);
    for (const e of entries) await IDB.put("entries", e);
    const goals = sanitizeGoals(d.goals);
    if (goals) await this.saveGoals(goals);
    await reloadFoods(); await watchDay();
    return { foods: foods.length, entries: entries.length, skipped: d.foods.length + d.entries.length - foods.length - entries.length };
  },
};

/* ---------- Backup validation: only well-formed records are stored ---------- */
const num = (v, max = 100000) => { const n = Number(v); return Number.isFinite(n) && n >= 0 && n <= max ? Math.round(n * 10) / 10 : null; };
const str = (v, max = 200) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const id = v => (typeof v === "string" && /^[\w-]{1,64}$/.test(v) ? v : null);
const MEAL_KEYS = ["breakfast", "lunch", "dinner", "snacks"];
function macros(o) { const m = { kcal: num(o.kcal), protein: num(o.protein), fat: num(o.fat), carbs: num(o.carbs) }; return Object.values(m).every(x => x != null) ? m : null; }

export function sanitizeFood(f) {
  if (!f || typeof f !== "object") return null;
  const m = macros(f), fid = id(f.id), name = str(f.name);
  if (!m || !fid || !name) return null;
  const barcode = typeof f.barcode === "string" && /^\d{6,14}$/.test(f.barcode) ? f.barcode : null;
  return { id: fid, name, brand: str(f.brand, 100), barcode, ...m, serving: num(f.serving, 5000), source: str(f.source, 20), createdAt: num(f.createdAt, 1e13) || Date.now() };
}
export function sanitizeEntry(e) {
  if (!e || typeof e !== "object") return null;
  const m = macros(e), eid = id(e.id), name = str(e.name), grams = num(e.grams, 10000);
  if (!m || !eid || !name || grams == null || typeof e.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(e.date) || !MEAL_KEYS.includes(e.meal)) return null;
  const per = e.per100 && macros(e.per100);
  return { id: eid, date: e.date, meal: e.meal, name, grams, ...m, per100: per ? { ...per, serving: num(e.per100.serving, 5000) } : null,
    foodId: id(e.foodId), estimated: e.estimated === true || undefined, createdAt: num(e.createdAt, 1e13) || Date.now() };
}
export function sanitizeGoals(g) {
  if (!g || typeof g !== "object") return null;
  const out = { kcal: num(g.kcal, 10000), protein: num(g.protein, 1000), fat: num(g.fat, 1000), carbs: num(g.carbs, 2000) };
  return Object.values(out).every(x => x != null) ? out : null;
}
