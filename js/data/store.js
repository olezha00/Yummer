import { changed, S } from "../state.js";
import { tText } from "../i18n.js";
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
      const txn = this.db.transaction(store, mode); const st = txn.objectStore(store); let out;
      const r = fn(st); if (r) r.onsuccess = () => { out = r.result; };
      txn.oncomplete = () => res(out); txn.onerror = () => rej(txn.error); txn.onabort = () => rej(txn.error);
    });
  },
  all(store) { return this.tx(store, "readonly", st => st.getAll()); },
  byDate(date) { return this.tx("entries", "readonly", st => st.index("date").getAll(date)); },
  put(store, v, key) { return this.tx(store, "readwrite", st => key === undefined ? st.put(v) : st.put(v, key)); },
  get(store, key) { return this.tx(store, "readonly", st => st.get(key)); },
  del(store, key) { return this.tx(store, "readwrite", st => st.delete(key)); },
  clear(store) { return this.tx(store, "readwrite", st => st.clear()); },
  /** Writes many records in ONE readwrite transaction: { storeName: [records] }. */
  putMany(byStore) {
    const names = Object.keys(byStore);
    return new Promise((res, rej) => {
      const txn = this.db.transaction(names, "readwrite");
      for (const n of names) { const st = txn.objectStore(n); for (const v of byStore[n]) st.put(v); }
      txn.oncomplete = () => res(); txn.onerror = () => rej(txn.error); txn.onabort = () => rej(txn.error);
    });
  },
  /** Walks an index newest-first and stops as soon as visit() returns false. */
  scanDesc(store, index, visit) {
    return new Promise((res, rej) => {
      const txn = this.db.transaction(store, "readonly");
      const rq = txn.objectStore(store).index(index).openCursor(null, "prev");
      rq.onsuccess = () => { const c = rq.result; if (c && visit(c.value) !== false) c.continue(); };
      txn.oncomplete = () => res(); txn.onerror = () => rej(txn.error); txn.onabort = () => rej(txn.error);
    });
  },
};
export async function reloadFoods() { S.foods = await IDB.all("foods"); changed(); }
export async function watchDay() { const d = S.date; const list = await IDB.byDate(d); if (S.date === d) { S.entries = list; changed(); } }

export const Data = {
  async saveGoals(g) { S.goals = g; S.goalsSet = true; await IDB.put("kv", g, "goals"); changed(); },
  async addFood(f) { const id = uid2(); await IDB.put("foods", clean({ ...f, id, createdAt: Date.now() })); await reloadFoods(); return id; },
  async updateFood(id, f) { const cur = await IDB.get("foods", id); await IDB.put("foods", clean({ ...cur, ...f, id })); await reloadFoods(); },
  async deleteFood(id) { await IDB.del("foods", id); await reloadFoods(); },
  async addEntry(e) { await this.addEntries([e]); },
  /** Adds several diary entries in one transaction and refreshes the day once. */
  async addEntries(list) {
    const now = Date.now();
    await IDB.putMany({ entries: list.map((e, i) => clean({ ...e, id: uid2(), createdAt: now + i })) });
    await watchDay();
  },
  async updateEntry(id, e) { const cur = (await IDB.get("entries", id)) || {}; await IDB.put("entries", clean({ ...cur, ...e, id })); await watchDay(); },
  async deleteEntry(id) { await IDB.del("entries", id); await watchDay(); },
  async recent() {
    // Newest first via the createdAt index; stops after 12 distinct foods instead of loading the whole diary.
    const seen = new Set(), out = [];
    await IDB.scanDesc("entries", "createdAt", e => {
      const k = norm(e.name);
      if (e.per100 && !seen.has(k)) { seen.add(k); out.push(e); }
      return out.length < 12;
    });
    return out;
  },
  async exportAll() {
    return { app: "yummer", version: 1, exportedAt: new Date().toISOString(), goals: await IDB.get("kv", "goals") || null, foods: await IDB.all("foods"), entries: await IDB.all("entries") };
  },
  async importAll(d) {
    if (!d || d.app !== "yummer" || !Array.isArray(d.entries) || !Array.isArray(d.foods)) throw new Error(tText("backup.notYummer"));
    const foods = d.foods.map(sanitizeFood).filter(Boolean), entries = d.entries.map(sanitizeEntry).filter(Boolean);
    const goals = sanitizeGoals(d.goals);
    await IDB.putMany({ foods, entries });   // one transaction: all records land, or none do
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
const FOOD_SOURCES = ["custom", "off", "mine"];
function macros(o) { const m = { kcal: num(o.kcal), protein: num(o.protein), fat: num(o.fat), carbs: num(o.carbs) }; return Object.values(m).every(x => x != null) ? m : null; }

export function sanitizeFood(f) {
  if (!f || typeof f !== "object") return null;
  const m = macros(f), fid = id(f.id), name = str(f.name);
  if (!m || !fid || !name) return null;
  const barcode = typeof f.barcode === "string" && /^\d{6,14}$/.test(f.barcode) ? f.barcode : null;
  return { id: fid, name, brand: str(f.brand, 100), barcode, ...m, serving: num(f.serving, 5000), source: FOOD_SOURCES.includes(f.source) ? f.source : "custom", createdAt: num(f.createdAt, 1e13) || Date.now() };
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

/** Validates one AI-estimated item (description or label). Returns null when it is out of range. */
export function sanitizeAIItem(i) {
  if (!i || typeof i !== "object") return null;
  const name = str(i.name), grams = num(i.grams, 5000);
  if (!name || !(grams > 0)) return null;
  const m = { kcal: num(i.kcal, 10000), protein: num(i.protein, 10000), fat: num(i.fat, 10000), carbs: num(i.carbs, 10000) };
  if (Object.values(m).some(x => x == null)) return null;
  return { name, grams, ...m };
}
/** Validates nutrition read from a label photo; bad fields become null so the user fills them in. */
export function sanitizeLabel(r) {
  if (!r || typeof r !== "object") return {};
  const bc = r.barcode == null ? "" : String(r.barcode).replace(/\D/g, "");
  return { name: str(r.name), brand: str(r.brand, 100), barcode: /^\d{6,14}$/.test(bc) ? bc : null,
    kcal: num(r.kcal, 1000), protein: num(r.protein, 100), fat: num(r.fat, 100), carbs: num(r.carbs, 100), serving: num(r.serving, 5000) };
}
