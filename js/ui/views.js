import { testKey } from "../actions.js";
import { DEFAULT_GOALS, MEALS } from "../data/foods.js";
import { AI } from "../services/ai.js";
import { S } from "../state.js";
import { $, dateLabel, esc, fm } from "../util.js";

/* ---------- Rendering ---------- */
export function totals(list) { return list.reduce((t, e) => ({ kcal: t.kcal + (+e.kcal || 0), protein: t.protein + (+e.protein || 0), fat: t.fat + (+e.fat || 0), carbs: t.carbs + (+e.carbs || 0) }), { kcal: 0, protein: 0, fat: 0, carbs: 0 }); }

export function dial(t, g) {
  const R = 56, C = 2 * Math.PI * R, pct = Math.min(1, g.kcal ? t.kcal / g.kcal : 0), over = t.kcal > g.kcal;
  const left = Math.round(g.kcal - t.kcal);
  return `<div class="dial" role="img" aria-label="Съедено ${Math.round(t.kcal)} из ${g.kcal} ккал">
    <svg viewBox="0 0 132 132"><circle cx="66" cy="66" r="${R}" fill="none" stroke="var(--sunk)" stroke-width="12"/>
    ${pct > 0 ? `<circle cx="66" cy="66" r="${R}" fill="none" stroke="${over ? "var(--warn)" : "var(--accent)"}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${C * pct} ${C}"/>` : ""}</svg>
    <div class="center"><div class="big num">${Math.abs(left)}</div><div class="small">${left >= 0 ? "ккал осталось" : "ккал сверх нормы"}</div></div></div>`;
}
export function macroBar(label, key, t, g, color) {
  const pct = g[key] ? Math.min(100, t[key] / g[key] * 100) : 0;
  return `<div class="macro"><div class="row"><b>${label}</b><span class="num">${fm(t[key])} / ${g[key]} г</span></div>
    <div class="bar"><i style="width:${pct}%;background:var(${color})"></i></div></div>`;
}
export const dots = e => `<span class="dots num"><i class="p">${fm(e.protein)}</i><i class="f">${fm(e.fat)}</i><i class="c">${fm(e.carbs)}</i></span>`;

export function viewDiary() {
  const t = totals(S.entries), g = S.goals;
  let h = "";
  if (S.mode === "error") return `<div class="banner warn">${esc(S.error)}</div>`;
  if (!S.goalsSet && S.mode !== "loading") h += `<div class="banner">Сейчас стоят примерные цели: ${DEFAULT_GOALS.kcal} ккал. <button class="btn" data-act="tab" data-tab="settings" style="padding:4px 10px;margin-left:4px">Задать свои</button></div>`;
  h += `<section class="summary">${dial(t, g)}<div class="macros">
      ${macroBar("Белки", "protein", t, g, "--protein")}${macroBar("Жиры", "fat", t, g, "--fat")}${macroBar("Углеводы", "carbs", t, g, "--carbs")}</div>
      <div class="kcalline num"><span>Съедено <b>${Math.round(t.kcal)}</b> ккал</span><span>Цель <b>${g.kcal}</b> ккал</span></div></section>`;
  for (const [key, label] of MEALS) {
    const items = S.entries.filter(e => e.meal === key).sort((a, b) => a.createdAt - b.createdAt);
    const mt = totals(items);
    h += `<section class="meal"><div class="mhead"><h2>${label}</h2><span class="mk num">${items.length ? Math.round(mt.kcal) + " ккал" : ""}</span></div><div class="list">`;
    for (const e of items) h += `<button class="item" data-act="editEntry" data-id="${esc(e.id)}"><div class="main"><div class="name">${esc(e.name)}</div>
      <div class="sub num">${fm(e.grams)} г · ${dots(e)}</div></div><div class="kc num">${Math.round(e.kcal)}</div></button>`;
    h += `<button class="addrow" data-act="add" data-meal="${key}">Добавить продукт</button></div></section>`;
  }
  return h;
}

export function viewFoods() {
  const foods = [...S.foods].sort((a, b) => a.name.localeCompare(b.name));
  let h = `<div class="section-title">Мои продукты</div><p class="muted small">Продукты, которые вы создали или сфотографировали. Значения на 100 г.</p>`;
  h += `<button class="btn primary block" data-act="newFood" style="margin-bottom:12px">Создать продукт</button>`;
  if (!foods.length) return h + `<div class="card empty">Сохранённых продуктов пока нет. Создайте продукт или сфотографируйте этикетку, и он появится здесь.</div>`;
  h += `<div class="list">`;
  for (const f of foods) h += `<button class="item" data-act="editFood" data-id="${esc(f.id)}"><div class="main"><div class="name">${esc(f.name)}${f.brand ? ` <span class="muted small">${esc(f.brand)}</span>` : ""}</div>
    <div class="sub num">${f.barcode ? "▮▯▮ " + esc(f.barcode) + " · " : ""}${dots(f)}</div></div><div class="kc num">${Math.round(f.kcal)}<span class="muted small"> ккал</span></div></button>`;
  return h + `</div>`;
}

export function viewSettings() {
  const masked = AI.key ? AI.key.slice(0, 10) + "…" + AI.key.slice(-4) : "";
  return viewGoals() + `
  <div class="section-title" style="margin-top:22px">ИИ</div>
  <form class="card stack" id="keyForm">
    <p class="small muted" style="margin:0">Нужен для «Описать словами», чтения этикеток и перевода поиска. Ключ хранится только на этом телефоне и отправляется только выбранному сервису.</p>
    <div class="seg" role="group" aria-label="Сервис ИИ">
      <button type="button" data-act="provider" data-p="gemini" aria-pressed="${AI.provider === "gemini"}">Gemini (бесплатно)</button>
      <button type="button" data-act="provider" data-p="claude" aria-pressed="${AI.provider === "claude"}">Claude</button>
    </div>
    ${AI.provider === "gemini"
      ? `<p class="small muted" style="margin:0">Бесплатный ключ: aistudio.google.com → Get API key. На бесплатном тарифе есть дневной лимит запросов, и Google может использовать запросы для улучшения своих моделей.</p>`
      : `<p class="small muted" style="margin:0">Платно, примерно несколько центов в день. Ключ: console.anthropic.com → API Keys.</p>`}
    ${AI.key ? `<p class="small" style="margin:0">Сейчас: <span class="keybox">${esc(masked)}</span></p>` : ""}
    <div class="field"><label for="k-key">${AI.key ? "Заменить ключ" : "Ключ " + AI.label()}</label><input id="k-key" type="text" class="keybox" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${AI.provider === "gemini" ? "AIza…" : "sk-ant-…"}"></div>
    ${AI.provider === "gemini" ? `<div class="field"><label for="k-model">Модель Gemini</label><input id="k-model" type="text" class="keybox" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(AI.geminiModel)}"></div>` : ""}
    <div class="grid2"><button class="btn primary" type="submit">Сохранить</button>${AI.key ? `<button class="btn" type="button" data-act="testKey">Проверить</button>` : ""}</div>
    ${AI.key ? `<button class="btn danger" type="button" data-act="${S.confirmKeyDel ? "delKey" : "askDelKey"}">${S.confirmKeyDel ? "Нажмите ещё раз, чтобы удалить ключ" : "Удалить ключ"}</button>` : ""}
    <div class="status" id="keyStatus"></div>
  </form>
  <div class="section-title" style="margin-top:22px">Резервная копия</div>
  <div class="card stack">
    <p class="small muted" style="margin:0">Все данные хранятся на этом устройстве. Сохраняйте копию время от времени, например в «Файлы» или iCloud Drive.</p>
    <div class="grid2"><button class="btn" data-act="export">Сохранить копию</button><button class="btn" data-act="import">Восстановить</button></div>
    <div class="status" id="bkStatus"></div>
  </div>
  <p class="small muted" style="margin-top:18px">Данные о товарах: <a href="https://world.openfoodfacts.org" target="_blank" rel="noopener" style="color:inherit">Open Food Facts</a>, лицензия ODbL.</p>`;
}
export function viewGoals() {
  const g = S.goals, kFromMacros = Math.round(g.protein * 4 + g.fat * 9 + g.carbs * 4);
  return `<div class="section-title">Цели на день</div>
  <form class="card stack" id="goalsForm">
    <div class="field"><label for="g-kcal">Калории (ккал)</label><input id="g-kcal" type="number" inputmode="numeric" min="800" max="6000" value="${esc(g.kcal)}"></div>
    <div class="grid2">
      <div class="field"><label for="g-protein">Белки (г)</label><input id="g-protein" type="number" inputmode="numeric" min="0" value="${esc(g.protein)}"></div>
      <div class="field"><label for="g-fat">Жиры (г)</label><input id="g-fat" type="number" inputmode="numeric" min="0" value="${esc(g.fat)}"></div>
      <div class="field"><label for="g-carbs">Углеводы (г)</label><input id="g-carbs" type="number" inputmode="numeric" min="0" value="${esc(g.carbs)}"></div>
      <div class="field"><label>По БЖУ</label><div class="num" style="padding:10px 0" id="g-calc">${kFromMacros} ккал</div></div>
    </div>
    <p class="small muted">В грамме белков и углеводов 4 ккал, в грамме жиров 9. Сумма по БЖУ должна быть близка к цели по калориям.</p>
    <button class="btn primary" type="submit">Сохранить цели</button>
  </form>`;
}

export function render() {
  const app = $("#app");
  const head = `<header class="top"><div class="brand">Yummer</div>${S.tab === "diary" ? `<div class="datenav">
    <button data-act="day" data-d="-1" aria-label="Предыдущий день">‹</button><div class="label">${esc(dateLabel(S.date))}</div>
    <button data-act="day" data-d="1" aria-label="Следующий день">›</button></div>` : ""}</header>`;
  const body = S.mode === "loading" ? `<p class="muted">Загружаем дневник…</p>` : S.tab === "diary" ? viewDiary() : S.tab === "foods" ? viewFoods() : viewSettings();
  const active = document.activeElement?.id;
  app.innerHTML = head + body + `<div id="toast" class="status" role="status" style="margin-top:12px">${esc(S.toast || "")}</div>`;
  if (active && S.tab === "settings") { const el = document.getElementById(active); if (el) el.focus(); }
  renderTabs();
}
export function renderTabs() {
  let nav = $("nav.tabs");
  if (!nav) { nav = document.createElement("nav"); nav.className = "tabs"; nav.setAttribute("aria-label", "Разделы"); document.body.appendChild(nav); }
  nav.innerHTML = `<div class="in">${[["diary","Дневник"],["foods","Мои продукты"],["settings","Настройки"]].map(([k, l]) =>
    `<button data-act="tab" data-tab="${k}" ${S.tab === k ? 'aria-current="page"' : ""}>${l}</button>`).join("")}</div>`;
}
export let toastTimer;
export function toast(msg, isErr) { S.toast = msg; const el = $("#toast"); if (el) { el.textContent = msg; el.className = "status" + (isErr ? " err" : ""); } clearTimeout(toastTimer); toastTimer = setTimeout(() => { S.toast = ""; const e2 = $("#toast"); if (e2) e2.textContent = ""; }, 4000); }
