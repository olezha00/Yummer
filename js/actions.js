import { DEFAULT_GOALS, GENERIC, mealLabel } from "./data/foods.js";
import { Data, watchDay } from "./data/store.js";
import { AI, ITEMS_SCHEMA, readLabel, saveAISettings } from "./services/ai.js";
import { decodeBarcode, startScanner, stopScanner } from "./services/barcode.js";
import { offByBarcode, offComplete, offErrorText, offSearchLive } from "./services/off.js";
import { S, ui } from "./state.js";
import { closeSheet, openSheet, previewHTML, readFoodForm, renderSheet, setStatus } from "./ui/sheet.js";
import { render, toast } from "./ui/views.js";
import { $, r1, scale, shift, today } from "./util.js";

/* ---------- Photos (barcode or label) ---------- */
export let camPurpose = null;
export function pickPhoto(purpose) { camPurpose = purpose; const inp = $("#camInput"); inp.value = ""; inp.click(); }

export function handleCode(code) {
  const digits = code.replace(/\s/g, "");
  const found = S.foods.find(f => f.barcode && f.barcode === digits);
  if (found) { openSheet({ step: "amount", meal: ui.sheet.meal, food: { ...found, source: "mine" }, grams: found.serving || 100, unit: found.serving ? "srv" : "g" }); return; }
  if (/^https?:\/\//i.test(digits)) { setStatus("В этом QR-коде ссылка (" + digits.slice(0, 60) + "), а не данные о продукте. Сканируйте штрихкод.", true); return; }
  if (navigator.onLine) { lookupBarcode(digits); return; }
  newProductForm(digits, "Товара " + digits + " нет среди ваших продуктов.");
}
export async function lookupBarcode(digits) {
  setStatus("Ищем " + digits + " в Open Food Facts…");
  try {
    const f = await offByBarcode(digits);
    if (!ui.sheet) return;
    if (offComplete(f)) { openSheet({ step: "amount", meal: ui.sheet.meal, food: f, grams: f.serving || 100, unit: f.serving ? "srv" : "g" }); return; }
    newProductForm(digits, f ? "Товар найден в Open Food Facts, но без полной пищевой ценности." : "Товара " + digits + " нет в Open Food Facts.", f);
  } catch (e) { if (ui.sheet) newProductForm(digits, offErrorText(e)); }
}
export function newProductForm(digits, why, partial) {
  openSheet({ step: "food", meal: ui.sheet.meal, food: { ...(partial || {}), barcode: digits, source: undefined }, pendingCode: digits,
    status: why + " Сфотографируйте таблицу пищевой ценности, и поля заполнятся сами, или введите значения вручную. Продукт сохранится, и в следующий раз штрихкод найдётся сразу." });
}


/* ---------- Live search ---------- */
export async function runOffSearch() {
  if (!ui.sheet || ui.sheet.step !== "search") return;
  const q = (ui.sheet.q || "").trim(); if (!q) return;
  ui.sheet.offBusy = true; ui.sheet.offErr = ""; renderSheet();
  try { const r = await offSearchLive(q); if (!ui.sheet || ui.sheet.step !== "search") return; ui.sheet.offResults = r.items; ui.sheet.offQuery = r.query; ui.sheet.offFor = q; }
  catch (e) { if (!ui.sheet) return; ui.sheet.offErr = offErrorText(e); }
  ui.sheet.offBusy = false; renderSheet();
}


/* ---------- AI describe ---------- */
export async function runAI() {
  const text = ($("#aitext")?.value || "").trim();
  ui.sheet.text = text;
  if (!text) { ui.sheet.status = "Сначала напишите, что вы съели."; ui.sheet.err = true; return renderSheet(); }
  ui.sheet.busy = true; ui.sheet.status = "Спрашиваем Claude…"; ui.sheet.err = false; renderSheet();
  const prompt = `You estimate nutrition for a food diary. The person wrote what they ate:
"""${text}"""
Split it into separate foods. For each, estimate the eaten amount in grams (use typical Polish/European portions and products when not specified) and the TOTAL kcal, protein, fat and carbs for that amount.
Return JSON only, no prose, exactly: {"items":[{"name":string,"grams":number,"kcal":number,"protein":number,"fat":number,"carbs":number}]}
Write food names in Russian.`;
  try {
    const out = await AI.json(prompt, ITEMS_SCHEMA);
    const items = (out?.items || []).filter(i => i && i.name && +i.grams > 0).map(i => ({ name: String(i.name), grams: +i.grams, kcal: +i.kcal || 0, protein: +i.protein || 0, fat: +i.fat || 0, carbs: +i.carbs || 0 }));
    ui.sheet.items = items; ui.sheet.busy = false;
    ui.sheet.status = items.length ? "" : "Не получилось разобрать продукты. Назовите каждый продукт и примерное количество."; ui.sheet.err = !items.length;
  } catch (e) {
    ui.sheet.busy = false; ui.sheet.err = true;
    ui.sheet.status = e?.message || "Не удалось получить оценку. Попробуйте ещё раз.";
  }
  renderSheet();
}

/* ---------- Events ---------- */
export function entryFromFood(f, grams, meal) {
  const m = scale(f, grams);
  return { date: S.date, meal, name: f.name + (f.brand ? " (" + f.brand + ")" : ""), grams: r1(grams),
    kcal: r1(m.kcal), protein: r1(m.protein), fat: r1(m.fat), carbs: r1(m.carbs),
    per100: { kcal: +f.kcal, protein: +f.protein, fat: +f.fat, carbs: +f.carbs, serving: f.serving || null },
    foodId: f.source === "mine" ? f.id : null };
}
export async function safe(p, ok) { try { await p; if (ok) toast(ok); } catch (e) { toast("Не удалось сохранить: " + (e?.message || "попробуйте ещё раз"), true); } }


/* ---------- Settings actions ---------- */
export async function testKey() {
  const st = $("#keyStatus"); if (!st) return; st.className = "status"; st.textContent = "Проверяем ключ…";
  try { await AI.text("Reply with the single word: ok"); const s2 = $("#keyStatus"); if (s2) { s2.textContent = "Ключ работает."; } }
  catch (e) { const s2 = $("#keyStatus"); if (s2) { s2.textContent = e.message; s2.className = "status err"; } }
}
export async function doExport() {
  const st = $("#bkStatus");
  try {
    const data = await Data.exportAll();
    const name = "yummer-" + today() + ".json";
    const file = new File([JSON.stringify(data)], name, { type: "application/json" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); }
    else { const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }
    if (st) { st.className = "status"; st.textContent = "Копия готова: " + data.entries.length + " записей, " + data.foods.length + " продуктов."; }
  } catch (e) { if (st && e.name !== "AbortError") { st.className = "status err"; st.textContent = "Не удалось сохранить копию: " + e.message; } }
}

/* ---------- Event wiring (called once from main.js) ---------- */
export function bindEvents() {
  $("#camInput").addEventListener("change", async ev => {
    const file = ev.target.files && ev.target.files[0];
    if (!file || !ui.sheet) return;
    const purpose = camPurpose;
    if (purpose === "scan") {
      setStatus("Распознаём штрихкод…");
      let code = await decodeBarcode(file);
      if (!code && AI.ready()) {
        setStatus("Полоски не распознались, просим Claude прочитать цифры…");
        try { const r = await readLabel(file); code = r.barcode ? String(r.barcode).replace(/\D/g, "") : null; } catch {}
      }
      if (!code) return setStatus("Штрихкод не найден. Снимите ближе, чтобы штрихкод занимал большую часть фото, или введите цифры в поиск.", true);
      handleCode(code.trim());
    } else if (purpose === "label" || purpose === "labelForm") {
      if (ui.sheet.step !== "food") openSheet({ step: "food", meal: ui.sheet.meal, food: { barcode: ui.sheet.pendingCode || null }, busy: true, status: "Читаем этикетку…" });
      else { ui.sheet.busy = true; ui.sheet.status = "Читаем этикетку…"; ui.sheet.err = false; renderSheet(); }
      try {
        const cur = readFoodForm();
        const r = await readLabel(file);
        const merged = { ...cur };
        for (const k of ["name", "brand", "kcal", "protein", "fat", "carbs", "serving"]) if (r[k] != null && r[k] !== "") merged[k] = r[k];
        if (!merged.barcode && r.barcode) merged.barcode = String(r.barcode).replace(/\D/g, "");
        ui.sheet.food = merged; ui.sheet.busy = false;
        const missing = ["kcal", "protein", "fat", "carbs"].filter(k => merged[k] == null);
        ui.sheet.status = missing.length ? "Заполнено то, что удалось прочитать. Добавьте: " + missing.map(k => ({kcal:"ккал",protein:"белки",fat:"жиры",carbs:"углеводы"})[k]).join(", ") + "." : "Заполнено по этикетке. Проверьте цифры и сохраните.";
        ui.sheet.err = !!missing.length; renderSheet();
      } catch (e) { ui.sheet.busy = false; ui.sheet.status = (e?.message || "Не удалось прочитать этикетку."); ui.sheet.err = true; renderSheet(); }
    }
  });

  document.addEventListener("click", async ev => {
    const b = ev.target.closest("[data-act]");
    if (!b) return;
    const act = b.dataset.act;
    switch (act) {
      case "tab": S.tab = b.dataset.tab; render(); window.scrollTo(0, 0); break;
      case "day": S.date = shift(S.date, +b.dataset.d); render(); watchDay(); break;
      case "close": closeSheet(); break;
      case "add": openSheet({ step: "search", meal: b.dataset.meal, q: "", recent: [] }); Data.recent().then(r => { if (ui.sheet && ui.sheet.step === "search") { ui.sheet.recent = r; renderSheet(); } }); break;
      case "back": openSheet({ step: "search", meal: ($("#mealSel")?.value) || ui.sheet.meal, q: ui.sheet.q0 || "", recent: ui.sheet.recent0 || [] }); Data.recent().then(r => { if (ui.sheet && ui.sheet.step === "search") { ui.sheet.recent = r; renderSheet(); } }); break;
      case "pick": {
        const src = b.dataset.src, id = b.dataset.id;
        let f = src === "mine" ? S.foods.find(x => x.id === id) : src === "generic" ? GENERIC.find(x => x.id === id) : src === "off" ? (ui.sheet.offResults || []).find(x => x.id === id) : null;
        if (src === "recent") { const e = ui.sheet.recent.find(x => "r:" + x.name === id); if (e) f = { name: e.name, ...e.per100, source: "recent", lastGrams: e.grams }; }
        if (!f) return;
        f = { ...f, source: src };
        const grams = f.lastGrams || f.serving || 100;
        openSheet({ step: "amount", meal: ui.sheet.meal, food: f, grams, unit: f.serving && !f.lastGrams ? "srv" : "g", q0: ui.sheet.q, recent0: ui.sheet.recent });
        break;
      }
      case "unit": ui.sheet.unit = b.dataset.u; renderSheet(); break;
      case "addEntry": {
        const grams = +ui.sheet.grams; if (!(grams > 0)) return setStatus("Укажите количество.", true);
        const meal = $("#mealSel").value; const e = entryFromFood(ui.sheet.food, grams, meal);
        const fd = ui.sheet.food; closeSheet();
        if (fd.source === "off" && !S.foods.some(x => x.barcode === fd.barcode)) { const { id, source, ...keep } = fd; try { const nid = await Data.addFood({ ...keep, source: "off" }); e.foodId = nid; } catch {} }
        await safe(Data.addEntry(e), `«${e.name}» добавлено: ${mealLabel(meal)}.`); break;
      }
      case "editEntry": {
        const e = S.entries.find(x => x.id === b.dataset.id); if (!e) return;
        const per = e.per100 || { kcal: e.kcal / e.grams * 100, protein: e.protein / e.grams * 100, fat: e.fat / e.grams * 100, carbs: e.carbs / e.grams * 100 };
        openSheet({ step: "editEntry", id: e.id, meal: e.meal, food: { name: e.name, ...per }, grams: e.grams, unit: "g" }); break;
      }
      case "saveEntry": {
        const grams = +ui.sheet.grams; if (!(grams > 0)) return;
        const m = scale(ui.sheet.food, grams), meal = $("#mealSel").value, id = ui.sheet.id;
        closeSheet(); await safe(Data.updateEntry(id, { grams: r1(grams), meal, kcal: r1(m.kcal), protein: r1(m.protein), fat: r1(m.fat), carbs: r1(m.carbs) }), "Сохранено."); break;
      }
      case "askDel": ui.sheet.confirmDel = true; renderSheet(); break;
      case "delEntry": { const id = ui.sheet.id; closeSheet(); await safe(Data.deleteEntry(id), "Удалено."); break; }
      case "toAI": if (!AI.ready()) return setStatus("Чтобы описывать еду словами, добавьте ключ ИИ в «Настройках».", true); openSheet({ step: "ai", meal: ui.sheet.meal, text: ui.sheet.q || "", q0: ui.sheet.q, recent0: ui.sheet.recent }); break;
      case "runAI": runAI(); break;
      case "aiDrop": ui.sheet.text = $("#aitext").value; ui.sheet.items.splice(+b.dataset.i, 1); renderSheet(); break;
      case "aiAdd": {
        const meal = ui.sheet.meal, items = ui.sheet.items; closeSheet();
        for (const i of items) {
          const per100 = { kcal: r1(i.kcal / i.grams * 100), protein: r1(i.protein / i.grams * 100), fat: r1(i.fat / i.grams * 100), carbs: r1(i.carbs / i.grams * 100), serving: null };
          await safe(Data.addEntry({ date: S.date, meal, name: i.name, grams: r1(i.grams), kcal: r1(i.kcal), protein: r1(i.protein), fat: r1(i.fat), carbs: r1(i.carbs), per100, foodId: null, estimated: true }));
        }
        toast(`Добавлено в «${mealLabel(meal)}»: ${items.length} шт.`); break;
      }
      case "scan": ui.sheet.status = ""; startScanner(); break;
      case "scanClose": stopScanner(); break;
      case "scanPhoto": stopScanner(); pickPhoto("scan"); break;
      case "export": doExport(); break;
      case "import": $("#importInput").value = ""; $("#importInput").click(); break;
      case "testKey": testKey(); break;
      case "askDelKey": S.confirmKeyDel = true; render(); break;
      case "delKey": AI.keys[AI.provider] = null; S.confirmKeyDel = false; await saveAISettings(); render(); toast("Ключ удалён."); break;
      case "provider": AI.provider = b.dataset.p; S.confirmKeyDel = false; await saveAISettings(); render(); break;
      case "offSearch": runOffSearch(); break;
      case "labelPhoto": if (!AI.ready()) return setStatus("Чтобы читать этикетки, добавьте ключ ИИ в «Настройках».", true); pickPhoto("label"); break;
      case "labelIntoForm": ui.sheet.food = readFoodForm(); if (!AI.ready()) return setStatus("Чтобы читать этикетки, добавьте ключ ИИ в «Настройках».", true); pickPhoto("labelForm"); break;
      case "newFood": openSheet({ step: "food", meal: ui.sheet?.meal || null, food: { name: ui.sheet?.q || "" }, q0: ui.sheet?.q, recent0: ui.sheet?.recent }); break;
      case "editFood": { const f = S.foods.find(x => x.id === b.dataset.id); if (f) openSheet({ step: "food", id: f.id, food: { ...f } }); break; }
      case "askDelFood": ui.sheet.food = readFoodForm(); ui.sheet.confirmDel = true; renderSheet(); break;
      case "delFood": { const id = ui.sheet.id; closeSheet(); await safe(Data.deleteFood(id), "Продукт удалён."); break; }
    }
  });

  document.addEventListener("input", ev => {
    const t = ev.target;
    if (!ui.sheet) {
      if (t.id && t.id.startsWith("g-")) {
        const n = id => +($("#" + id)?.value || 0);
        const el = $("#g-calc"); if (el) el.textContent = Math.round(n("g-protein") * 4 + n("g-fat") * 9 + n("g-carbs") * 4) + " kcal";
      }
      return;
    }
    if (t.id === "q") { ui.sheet.q = t.value; ui.sheet.status = ""; renderSheet(); }
    else if (t.id === "amt") {
      const v = parseFloat(String(t.value).replace(",", ".")) || 0;
      ui.sheet.grams = ui.sheet.unit === "srv" ? v * ui.sheet.food.serving : v;
      const pv = $("#pv"); if (pv) pv.innerHTML = previewHTML(scale(ui.sheet.food, ui.sheet.grams));
    }
    else if (t.id === "aitext") ui.sheet.text = t.value;
  });
  document.addEventListener("change", ev => { if (ui.sheet && ev.target.id === "mealSel") ui.sheet.meal = ev.target.value; });
  document.addEventListener("keydown", ev => {
    if (ev.key === "Escape" && ui.sheet) closeSheet();
    if (ev.key === "Enter" && ui.sheet?.step === "search" && ev.target.id === "q") {
      const v = ev.target.value.trim(); ev.preventDefault(); ev.target.blur(); if (/^\d{8,14}$/.test(v)) handleCode(v); else if (v && navigator.onLine) runOffSearch();
    }
  });

  document.addEventListener("submit", async ev => {
    ev.preventDefault();
    if (ev.target.id === "goalsForm") {
      const n = id => Math.max(0, Math.round(+$("#" + id).value || 0));
      await safe(Data.saveGoals({ kcal: n("g-kcal") || DEFAULT_GOALS.kcal, protein: n("g-protein"), fat: n("g-fat"), carbs: n("g-carbs") }), "Цели сохранены.");
      S.goalsSet = true; render();
    }
    if (ev.target.id === "keyForm") {
      const k = ($("#k-key").value || "").trim(), m = ($("#k-model")?.value || "").trim();
      if (m) AI.geminiModel = m;
      if (k) {
        const bad = AI.provider === "claude" ? !/^sk-ant-/.test(k) : k.length < 20;
        if (bad) { const st = $("#keyStatus"); st.textContent = AI.provider === "claude" ? "Ключ Claude начинается с «sk-ant-»." : "Это не похоже на ключ Gemini."; st.className = "status err"; return; }
        AI.keys[AI.provider] = k;
      }
      await saveAISettings(); S.confirmKeyDel = false; render(); if (AI.key) testKey();
      return;
    }
    if (ev.target.id === "foodForm") {
      const f = readFoodForm();
      if (!f.name || [f.kcal, f.protein, f.fat, f.carbs].some(x => x == null)) { ui.sheet.food = f; return setStatus("Заполните название и все четыре значения пищевой ценности.", true); }
      if (f.barcode && !ui.sheet.id && S.foods.some(x => x.barcode === f.barcode)) { ui.sheet.food = f; return setStatus("Продукт с таким штрихкодом уже есть в «Моих продуктах».", true); }
      const meal = ui.sheet.meal, id = ui.sheet.id;
      try {
        if (id) { await Data.updateFood(id, f); closeSheet(); toast("Продукт сохранён."); return; }
        const newId = await Data.addFood({ ...f, source: "custom" });
        if (meal) openSheet({ step: "amount", meal, food: { ...f, id: newId, source: "mine" }, grams: f.serving || 100, unit: f.serving ? "srv" : "g" });
        else { closeSheet(); toast("Продукт сохранён."); }
      } catch (e) { setStatus("Не удалось сохранить: " + (e?.message || "попробуйте ещё раз"), true); }
    }
  });

  $("#importInput").addEventListener("change", async ev => {
    const f = ev.target.files && ev.target.files[0]; if (!f) return;
    const st = $("#bkStatus");
    try { const r = await Data.importAll(JSON.parse(await f.text())); if (st) { st.className = "status"; st.textContent = "Восстановлено: " + r.entries + " записей, " + r.foods + " продуктов."; } }
    catch (e) { if (st) { st.className = "status err"; st.textContent = e.message || "Не удалось прочитать файл."; } }
  });
  window.addEventListener("online", () => { if (ui.sheet && ui.sheet.step === "search") renderSheet(); });
  window.addEventListener("offline", () => { if (ui.sheet && ui.sheet.step === "search") renderSheet(); });
}
