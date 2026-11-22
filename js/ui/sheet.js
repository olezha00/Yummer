import { runAI } from "../actions.js";
import { GENERIC, MEALS, mealLabel } from "../data/foods.js";
import { AI } from "../services/ai.js";
import { S, ui } from "../state.js";
import { dots, totals } from "./views.js";
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
  const mine = S.foods.map(f => ({ ...f, source: "mine" }));
  let results;
  if (q) {
    const words = q.split(/\s+/).filter(Boolean);
    const hit = f => { const n = norm(f.name + " " + (f.brand || "")); return words.every(w => n.includes(w)); };
    const code = s.q.trim();
    results = [...mine.filter(f => hit(f) || (f.barcode && f.barcode === code)), ...GENERIC.filter(hit)].slice(0, 30);
  } else results = null;
  const tools = `<div class="tools">
    <button class="tool" data-act="scan">${ICON.scan}Штрихкод</button>
    <button class="tool" data-act="labelPhoto">${ICON.label}Фото этикетки</button>
    <button class="tool" data-act="toAI">${ICON.ai}Описать словами</button></div>`;
  let list = "";
  const row = f => `<button class="item" data-act="pick" data-src="${f.source}" data-id="${esc(f.id)}"><div class="main"><div class="name">${esc(f.name)}${f.source === "generic" ? '<span class="tag">базовый</span>' : f.source === "recent" ? '<span class="tag">недавнее</span>' : f.source === "off" ? '<span class="tag">OFF</span>' : ""}</div>
    <div class="sub num">${f.brand ? esc(f.brand) + " · " : ""}${Math.round(f.kcal)} ккал / 100 г · ${dots(f)}</div></div></button>`;
  if (results) list = results.length ? `<div class="results">${results.map(row).join("")}</div>` :
    `<div class="empty">По запросу «${esc(s.q)}» ничего не найдено. Попробуйте «Описать словами» или <button class="btn" data-act="newFood" style="padding:4px 10px">создайте продукт</button></div>`;
  else if (s.recent?.length) list = `<p class="small muted" style="margin:4px 0">Недавно ели</p><div class="results">${s.recent.map(e => row({ id: "r:" + e.name, name: e.name, ...e.per100, source: "recent" })).join("")}</div>`;
  else list = `<p class="small muted">Ищите среди своих продуктов и ${GENERIC.length} базовых продуктов, ищите товары польских магазинов в Open Food Facts, сканируйте штрихкод или опишите еду своими словами.</p>`;
  return `<h3>${esc(mealLabel(s.meal))}: добавить<button data-act="close" aria-label="Закрыть">✕</button></h3>
    <input type="search" id="q" placeholder="Поиск: творог, skyr, Danone…" value="${esc(s.q || "")}" autocomplete="off" data-autofocus>
    ${tools}<div class="status ${s.err ? "err" : ""}" id="sstatus">${esc(s.status || "")}</div>${list}
    ${offBlock(s, row)}`;
}

export function sheetAmount(s) {
  const f = s.food, g = +s.grams || 0, m = scale(f, g);
  const unit = f.serving ? `<div class="seg" role="group" aria-label="Единицы">
      <button data-act="unit" data-u="g" aria-pressed="${s.unit !== "srv"}">Граммы</button>
      <button data-act="unit" data-u="srv" aria-pressed="${s.unit === "srv"}">Порции (${fm(f.serving)} г)</button></div>` : "";
  const qty = s.unit === "srv" ? r1(g / f.serving) : g;
  const isEdit = s.step === "editEntry";
  return `<h3>${esc(f.name)}<button data-act="close" aria-label="Закрыть">✕</button></h3>
    <div class="stack">
      ${unit}
      <div class="grid2">
        <div class="field"><label for="amt">${s.unit === "srv" ? "Порции" : "Количество (г)"}</label><input id="amt" type="number" inputmode="decimal" min="0" step="any" value="${qty || ""}" data-autofocus></div>
        <div class="field"><label for="mealSel">Приём пищи</label><select id="mealSel">${MEALS.map(([k, l]) => `<option value="${k}" ${k === s.meal ? "selected" : ""}>${l}</option>`).join("")}</select></div>
      </div>
      <div class="preview num" id="pv">${previewHTML(m)}</div>
      <p class="small muted">На 100 г: ${Math.round(f.kcal)} ккал, белки ${fm(f.protein)} г, жиры ${fm(f.fat)} г, углеводы ${fm(f.carbs)} г.</p>
      <button class="btn primary block" data-act="${isEdit ? "saveEntry" : "addEntry"}">${isEdit ? "Сохранить" : "Добавить в дневник"}</button>
      ${isEdit ? `<button class="btn danger block" data-act="${s.confirmDel ? "delEntry" : "askDel"}">${s.confirmDel ? "Нажмите ещё раз, чтобы удалить" : "Удалить из дневника"}</button>` : `<button class="btn block" data-act="back">Назад к поиску</button>`}
    </div>`;
}
export const previewHTML = m => `<div><b>${Math.round(m.kcal)}</b><span>ккал</span></div><div><b style="color:var(--protein)">${fm(m.protein)}</b><span>белки</span></div><div><b style="color:var(--fat)">${fm(m.fat)}</b><span>жиры</span></div><div><b style="color:var(--carbs)">${fm(m.carbs)}</b><span>углев.</span></div>`;

export function sheetAI(s) {
  const items = s.items || [];
  const t = totals(items);
  return `<h3>Опишите, что вы съели<button data-act="close" aria-label="Закрыть">✕</button></h3>
    <div class="stack">
      <div class="field"><label for="aitext">Напишите так, как сказали бы вслух</label>
        <textarea id="aitext" placeholder="например: омлет из 2 яиц на масле, кусок ржаного хлеба и кофе с молоком" data-autofocus>${esc(s.text || "")}</textarea></div>
      <button class="btn primary" data-act="runAI" ${s.busy ? "disabled" : ""}>${s.busy ? "Считаем…" : items.length ? "Посчитать заново" : "Посчитать"}</button>
      <div class="status ${s.err ? "err" : ""}">${esc(s.status || "")}</div>
      ${items.length ? `<div class="list aiitems">${items.map((e, i) => `<div class="item"><div class="main"><div class="name">${esc(e.name)}</div><div class="sub num">${fm(e.grams)} г · ${dots(e)}</div></div>
          <div class="kc num">${Math.round(e.kcal)}</div><button class="btn" data-act="aiDrop" data-i="${i}" aria-label="Убрать ${esc(e.name)}" style="padding:4px 10px">✕</button></div>`).join("")}</div>
        <div class="preview num">${previewHTML(t)}</div>
        <p class="small muted">Это оценка. Количество можно поправить в дневнике после добавления.</p>
        <button class="btn primary block" data-act="aiAdd">Добавить в «${esc(mealLabel(s.meal))}»: ${items.length} шт.</button>` : ""}
      <button class="btn block" data-act="back">Назад к поиску</button>
    </div>`;
}

export function sheetFood(s) {
  const f = s.food || {};
  const v = k => f[k] == null ? "" : f[k];
  return `<h3>${s.id ? "Изменить продукт" : "Новый продукт"}<button data-act="close" aria-label="Закрыть">✕</button></h3>
    <form class="stack" id="foodForm">
      <button type="button" class="btn" data-act="labelIntoForm">${s.busy ? "Читаем этикетку…" : "Заполнить по фото этикетки"}</button>
      <div class="status ${s.err ? "err" : ""}">${esc(s.status || "")}</div>
      <div class="field"><label for="f-name">Название</label><input id="f-name" type="text" required value="${esc(v("name"))}" placeholder="например: Skyr pitny waniliowy"></div>
      <div class="grid2">
        <div class="field"><label for="f-brand">Бренд (необязательно)</label><input id="f-brand" type="text" value="${esc(v("brand"))}"></div>
        <div class="field"><label for="f-barcode">Штрихкод (необязательно)</label><input id="f-barcode" type="text" inputmode="numeric" value="${esc(v("barcode"))}"></div>
      </div>
      <p class="small muted" style="margin:0">Пищевая ценность на 100 г (или 100 мл)</p>
      <div class="grid4">
        <div class="field"><label for="f-kcal">ккал</label><input id="f-kcal" type="number" step="any" min="0" required value="${v("kcal")}"></div>
        <div class="field"><label for="f-protein">Белки</label><input id="f-protein" type="number" step="any" min="0" required value="${v("protein")}"></div>
        <div class="field"><label for="f-fat">Жиры</label><input id="f-fat" type="number" step="any" min="0" required value="${v("fat")}"></div>
        <div class="field"><label for="f-carbs">Углев.</label><input id="f-carbs" type="number" step="any" min="0" required value="${v("carbs")}"></div>
      </div>
      <div class="field"><label for="f-serving">Порция в граммах (необязательно)</label><input id="f-serving" type="number" step="any" min="0" value="${v("serving")}" placeholder="например, 150 для одной баночки"></div>
      <button class="btn primary" type="submit">${s.id ? "Сохранить продукт" : s.meal ? "Сохранить и выбрать количество" : "Сохранить продукт"}</button>
      ${s.id ? `<button type="button" class="btn danger" data-act="${s.confirmDel ? "delFood" : "askDelFood"}">${s.confirmDel ? "Нажмите ещё раз, чтобы удалить" : "Удалить продукт"}</button>` : ""}
      ${s.meal ? `<button type="button" class="btn" data-act="back">Назад к поиску</button>` : ""}
    </form>`;
}

export function readFoodForm() {
  const g = id => $("#" + id)?.value.trim();
  const n = id => { const x = parseFloat(String(g(id) || "").replace(",", ".")); return isFinite(x) ? x : null; };
  return { name: g("f-name"), brand: g("f-brand") || null, barcode: (g("f-barcode") || "").replace(/\D/g, "") || null,
    kcal: n("f-kcal"), protein: n("f-protein"), fat: n("f-fat"), carbs: n("f-carbs"), serving: n("f-serving") };
}

export function setStatus(msg, err) { if (!ui.sheet) return; ui.sheet.status = msg; ui.sheet.err = !!err; renderSheet(); }

export function offBlock(s, row) {
  if (!navigator.onLine) return `<p class="small muted" style="margin-top:14px">Нет интернета: поиск в Open Food Facts недоступен.</p>`;
  const q = (s.q || "").trim();
  let h = `<div style="margin-top:14px" class="stack">`;
  if (q && !/^\d{8,14}$/.test(q)) h += `<button class="btn block" data-act="offSearch" ${s.offBusy ? "disabled" : ""}>${s.offBusy ? "Ищем в Open Food Facts…" : "Искать «" + esc(q) + "» в Open Food Facts" + (/[а-яё]/i.test(q) && AI.ready() ? " (по-польски)" : "")}</button>`;
  if (s.offErr) h += `<div class="status err">${esc(s.offErr)}</div>`;
  if (s.offResults && s.offFor === q) h += s.offResults.length ? `<p class="small muted" style="margin:0">Open Food Facts${s.offQuery && s.offQuery !== q ? " (по-польски: «" + esc(s.offQuery) + "»)" : ""}</p><div class="results">${s.offResults.map(row).join("")}</div>` : `<p class="small muted" style="margin:0">В Open Food Facts ничего не нашлось.</p>`;
  h += `<p class="small muted" style="margin:0">Данные о товарах: <a href="https://world.openfoodfacts.org" target="_blank" rel="noopener" style="color:inherit">Open Food Facts</a>, лицензия ODbL.</p></div>`;
  return h;
}
