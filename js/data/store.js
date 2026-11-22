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
    for (const f of d.foods) if (f && f.id) await IDB.put("foods", f);
    for (const e of d.entries) if (e && e.id && e.date) await IDB.put("entries", e);
    if (d.goals) await this.saveGoals(d.goals);
    await reloadFoods(); await watchDay();
    return { foods: d.foods.length, entries: d.entries.length };
  },
};
