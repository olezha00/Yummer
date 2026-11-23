import { GENERIC_COUNT, genericFoods, isOwnFood, mealLabel, meals, ownFoodIds } from "../data/foods.js";
import { I18N, t } from "../i18n.js";
import { AI } from "../services/ai.js";
import { S, ui } from "../state.js";
import { dots, offCredit, ownTag, totals } from "./views.js";
import { $, esc, fm, norm, r1, scale } from "../util.js";

/* ---------- Sheet (add / edit flows) ---------- */
export function openSheet(s) { ui.sheet = s; renderSheet(); }
export function closeSheet() { ui.sheet = null; $("#sheetRoot").innerHTML = ""; }
export const ICON = {
  scan: `<svg viewBox="0 0 24 24"><path d="M3 7V4h3M21 7V4h-3M3 17v3h3M21 17v3h-3"/><path d="M7 8v8M10 8v8M13 8v8M16 8v8"/></svg>`,
  label: `<svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>`,
  ai: `<svg viewBox="0 0 24 24"><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8z"/></svg>`,
};

export function renderSheet() {
  const root = $("#sheetRoot");
  if (!ui.sheet) { root.innerHTML = ""; return; }
  let inner = "";
  const s = ui.sheet;
  if (s.step === "search") inner = sheetSearch(s);
  else if (s.step === "amount") inner = sheetAmount(s);
  else if (s.step === "ai") inner = sheetAI(s);
  else if (s.step === "food") inner = sheetFood(s);
  else if (s.step === "editEntry") inner = sheetAmount(s);
  const keepFocus = document.activeElement && root.contains(document.activeElement) ? document.activeElement.id : null;
  const selStart = keepFocus ? document.activeElement.selectionStart : null;
  root.innerHTML = `<div class="scrim" data-act="close"></div><div class="sheet" role="dialog" aria-modal="true"><div class="panel"><div class="grab"></div>${inner}</div></div>`;
  if (keepFocus) { const el = document.getElementById(keepFocus); if (el) { el.focus(); try { if (selStart != null) el.setSelectionRange(selStart, selStart); } catch {} } }
  else { const af = root.querySelector("[data-autofocus]"); if (af) af.focus(); }
}

export function sheetSearch(s) {
  const q = norm(s.q);
  const mine = S.foods.map(f => ({ ...f, source: "mine", own: isOwnFood(f) }));
  let results;
  if (q) {
    const words = q.split(/\s+/).filter(Boolean);
    const hit = f => { const n = f.search || norm(f.name + " " + (f.brand || "")); return words.every(w => n.includes(w)); };
    const code = s.q.trim();
    results = [...mine.filter(f => hit(f) || (f.barcode && f.barcode === code)), ...genericFoods().filter(hit)].slice(0, 30);
  } else results = null;
  const tools = `<div class="tools">
    <button class="tool" data-act="scan">${ICON.scan}${t("search.scan")}</button>
    <button class="tool" data-act="labelPhoto">${ICON.label}${t("search.labelPhoto")}</button>
    <button class="tool" data-act="toAI">${ICON.ai}${t("search.describe")}</button></div>`;
  let list = "";
  const row = f => `<button class="item" data-act="pick" data-src="${esc(f.source)}" data-id="${esc(f.id)}"><div class="main"><div class="name"><span class="nm">${esc(f.name)}</span>${f.own ? ownTag() : f.source === "generic" ? `<span class="tag">${t("search.tagGeneric")}</span>` : f.source === "recent" ? `<span class="tag">${t("search.tagRecent")}</span>` : f.source === "off" ? '<span class="tag">OFF</span>' : ""}</div>
    <div class="sub num">${f.brand ? esc(f.brand) + " · " : ""}${t("search.per100", { kcal: Math.round(f.kcal) })} · ${dots(f)}</div></div></button>`;
  if (results) list = results.length ? `<div class="results">${results.map(row).join("")}</div>` :
    `<div class="empty">${t("search.nothing", { q: s.q })} <button class="btn" data-act="newFood" style="padding:4px 10px">${t("search.createFood")}</button></div>`;
  else if (s.recent?.length) { const own = ownFoodIds(S.foods); list = `<p class="small muted" style="margin:4px 0">${t("search.recent")}</p><div class="results">${s.recent.map(e => row({ id: "r:" + e.name, name: e.name, ...e.per100, source: "recent", own: own.has(e.foodId) })).join("")}</div>`; }
  else list = `<p class="small muted">${t("search.intro", { n: GENERIC_COUNT })}</p>`;
  return `<h3>${t("search.add", { meal: mealLabel(s.meal) })}${closeBtn()}</h3>
    <input type="search" id="q" placeholder="${t("search.placeholder")}" value="${esc(s.q || "")}" autocomplete="off" data-autofocus>
    ${tools}<div class="status ${s.err ? "err" : ""}" id="sstatus">${esc(s.status || "")}</div>${list}
    ${offBlock(s, row)}`;
}

export function sheetAmount(s) {
  const f = s.food, g = +s.grams || 0, m = scale(f, g);
  const unit = f.serving ? `<div class="seg" role="group" aria-label="${t("amount.unitsAria")}">
      <button data-act="unit" data-u="g" aria-pressed="${s.unit !== "srv"}">${t("amount.grams")}</button>
      <button data-act="unit" data-u="srv" aria-pressed="${s.unit === "srv"}">${t("amount.servings", { g: fm(f.serving) })}</button></div>` : "";
  const qty = s.unit === "srv" ? r1(g / f.serving) : g;
  const isEdit = s.step === "editEntry";
  return `<h3>${esc(f.name)}${closeBtn()}</h3>
    <div class="stack">
      ${unit}
      <div class="grid2">
        <div class="field"><label for="amt">${s.unit === "srv" ? t("amount.servingsLabel") : t("amount.qty")}</label><input id="amt" type="number" inputmode="decimal" min="0" step="any" value="${qty || ""}" data-autofocus></div>
        <div class="field"><label for="mealSel">${t("amount.meal")}</label><select id="mealSel">${meals().map(([k, l]) => `<option value="${k}" ${k === s.meal ? "selected" : ""}>${l}</option>`).join("")}</select></div>
      </div>
      <div class="preview num" id="pv">${previewHTML(m)}</div>
      <p class="small muted">${t("amount.per100", { kcal: Math.round(f.kcal), protein: fm(f.protein), fat: fm(f.fat), carbs: fm(f.carbs) })}</p>
      <button class="btn primary block" data-act="${isEdit ? "saveEntry" : "addEntry"}">${isEdit ? t("common.save") : t("amount.add")}</button>
      ${isEdit ? `<button class="btn danger block" data-act="${s.confirmDel ? "delEntry" : "askDel"}">${s.confirmDel ? t("common.confirmDelete") : t("amount.delete")}</button>` : `<button class="btn block" data-act="back">${t("common.back")}</button>`}
    </div>`;
}
export const previewHTML = m => `<div><b>${Math.round(m.kcal)}</b><span>${t("unit.kcal")}</span></div><div><b style="color:var(--protein)">${fm(m.protein)}</b><span>${t("macro.proteinShort")}</span></div><div><b style="color:var(--fat)">${fm(m.fat)}</b><span>${t("macro.fatShort")}</span></div><div><b style="color:var(--carbs)">${fm(m.carbs)}</b><span>${t("macro.carbsShort")}</span></div>`;
const closeBtn = () => `<button data-act="close" aria-label="${t("common.close")}">✕</button>`;

export function sheetAI(s) {
  const items = s.items || [];
  const tot = totals(items);
  return `<h3>${t("describe.title")}${closeBtn()}</h3>
    <div class="stack">
      <div class="field"><label for="aitext">${t("describe.label")}</label>
        <textarea id="aitext" placeholder="${t("describe.placeholder")}" data-autofocus>${esc(s.text || "")}</textarea></div>
      <button class="btn primary" data-act="runAI" ${s.busy ? "disabled" : ""}>${s.busy ? t("describe.busy") : items.length ? t("describe.again") : t("describe.run")}</button>
      <div class="status ${s.err ? "err" : ""}">${esc(s.status || "")}</div>
      ${items.length ? `<div class="list aiitems">${items.map((e, i) => `<div class="item"><div class="main"><div class="name">${esc(e.name)}</div><div class="sub num">${fm(e.grams)} ${t("unit.g")} · ${dots(e)}</div></div>
          <div class="kc num">${Math.round(e.kcal)}</div><button class="btn" data-act="aiDrop" data-i="${i}" aria-label="${t("describe.remove", { name: e.name })}" style="padding:4px 10px">✕</button></div>`).join("")}</div>
        <div class="preview num">${previewHTML(tot)}</div>
        <p class="small muted">${t("describe.estimate")}</p>
        <button class="btn primary block" data-act="aiAdd">${t("describe.addTo", { meal: mealLabel(s.meal), n: items.length })}</button>` : ""}
      <button class="btn block" data-act="back">${t("common.back")}</button>
    </div>`;
}

export function sheetFood(s) {
  const f = s.food || {};
  const v = k => f[k] == null ? "" : esc(f[k]);
  return `<h3>${s.id ? t("food.edit") : t("food.new")}${closeBtn()}</h3>
    <form class="stack" id="foodForm">
      <button type="button" class="btn" data-act="labelIntoForm">${s.busy ? t("food.reading") : t("food.fromLabel")}</button>
      <div class="status ${s.err ? "err" : ""}">${esc(s.status || "")}</div>
      ${!s.id && s.matches?.length ? matchesBlock(s.matches) : ""}
      <div class="field"><label for="f-name">${t("food.name")}</label><input id="f-name" type="text" required value="${v("name")}" placeholder="${t("food.namePlaceholder")}"></div>
      <div class="grid2">
        <div class="field"><label for="f-brand">${t("food.brand")}</label><input id="f-brand" type="text" value="${v("brand")}"></div>
        <div class="field"><label for="f-barcode">${t("food.barcode")}</label><input id="f-barcode" type="text" inputmode="numeric" value="${v("barcode")}"></div>
      </div>
      <p class="small muted" style="margin:0">${t("food.per100")}</p>
      <div class="grid4">
        <div class="field"><label for="f-kcal">${t("unit.kcal")}</label><input id="f-kcal" type="number" step="any" min="0" required value="${v("kcal")}"></div>
        <div class="field"><label for="f-protein">${t("macro.protein")}</label><input id="f-protein" type="number" step="any" min="0" required value="${v("protein")}"></div>
        <div class="field"><label for="f-fat">${t("macro.fat")}</label><input id="f-fat" type="number" step="any" min="0" required value="${v("fat")}"></div>
        <div class="field"><label for="f-carbs">${t("macro.carbsShort")}</label><input id="f-carbs" type="number" step="any" min="0" required value="${v("carbs")}"></div>
      </div>
      <div class="field"><label for="f-serving">${t("food.serving")}</label><input id="f-serving" type="number" step="any" min="0" value="${v("serving")}" placeholder="${t("food.servingPlaceholder")}"></div>
      <button class="btn primary" type="submit">${s.id ? t("food.save") : s.meal ? t("food.saveAndAmount") : t("food.save")}</button>
      ${s.id ? `<button type="button" class="btn danger" data-act="${s.confirmDel ? "delFood" : "askDelFood"}">${s.confirmDel ? t("common.confirmDelete") : t("food.delete")}</button>` : ""}
      ${s.meal ? `<button type="button" class="btn" data-act="back">${t("common.back")}</button>` : ""}
    </form>`;
}

/** Saved products that look like the one being added: tap one to use it instead of creating a duplicate. */
function matchesBlock(list) {
  return `<div class="matches stack"><p class="small" style="margin:0"><b>${t("food.matchesTitle")}</b></p>
    <div class="list">${list.map(f => `<button type="button" class="item" data-act="useMatch" data-id="${esc(f.id)}"><div class="main"><div class="name"><span class="nm">${esc(f.name)}${f.brand ? ` <span class="muted small">${esc(f.brand)}</span>` : ""}</span>${isOwnFood(f) ? ownTag() : ""}</div>
      <div class="sub num">${f.barcode ? esc(f.barcode) + " · " : ""}${t("search.per100", { kcal: Math.round(f.kcal) })} · ${dots(f)}</div></div></button>`).join("")}</div>
    <p class="small muted" style="margin:0">${t("food.matchesOther")}</p></div>`;
}

export function readFoodForm() {
  const g = id => $("#" + id)?.value.trim();
  const n = id => { const x = parseFloat(String(g(id) || "").replace(",", ".")); return isFinite(x) ? x : null; };
  return { name: g("f-name"), brand: g("f-brand") || null, barcode: (g("f-barcode") || "").replace(/\D/g, "") || null,
    kcal: n("f-kcal"), protein: n("f-protein"), fat: n("f-fat"), carbs: n("f-carbs"), serving: n("f-serving") };
}

export function setStatus(msg, err) { if (!ui.sheet) return; ui.sheet.status = msg; ui.sheet.err = !!err; renderSheet(); }

export function offBlock(s, row) {
  if (!navigator.onLine) return `<p class="small muted" style="margin-top:14px">${t("off.offline")}</p>`;
  const q = (s.q || "").trim();
  let h = `<div style="margin-top:14px" class="stack">`;
  if (q && !/^\d{8,14}$/.test(q)) h += `<button class="btn block" data-act="offSearch" ${s.offBusy ? "disabled" : ""}>${s.offBusy ? t("off.searching") : t("off.searchFor", { q }) + (I18N.lang !== "pl" && AI.ready() ? t("off.inPolish") : "")}</button>`;
  if (s.offErr) h += `<div class="status err">${esc(s.offErr)}</div>`;
  if (s.offResults && s.offFor === q) h += s.offResults.length ? `<p class="small muted" style="margin:0">Open Food Facts${s.offQuery && s.offQuery !== q ? t("off.resultsPolish", { q: s.offQuery }) : ""}</p><div class="results">${s.offResults.map(row).join("")}</div>` : `<p class="small muted" style="margin:0">${t("off.noResults")}</p>`;
  h += `<p class="small muted" style="margin:0">${offCredit()}</p></div>`;
  return h;
}
