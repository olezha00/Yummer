import { DEFAULT_GOALS, meals } from "../data/foods.js";
import { deviceLang, DICTS, I18N, LANGS, raw, t } from "../i18n.js";
import { AI } from "../services/ai.js";
import { APP_VERSION } from "../services/updates.js";
import { S } from "../state.js";
import { $, dateLabel, esc, fm } from "../util.js";

/* ---------- Rendering ---------- */
export function totals(list) { return list.reduce((sum, e) => ({ kcal: sum.kcal + (+e.kcal || 0), protein: sum.protein + (+e.protein || 0), fat: sum.fat + (+e.fat || 0), carbs: sum.carbs + (+e.carbs || 0) }), { kcal: 0, protein: 0, fat: 0, carbs: 0 }); }

export function dial(tot, g) {
  const R = 56, C = 2 * Math.PI * R, pct = Math.min(1, g.kcal ? tot.kcal / g.kcal : 0), over = tot.kcal > g.kcal;
  const left = Math.round(g.kcal - tot.kcal);
  return `<div class="dial" role="img" aria-label="${t("diary.dialAria", { eaten: Math.round(tot.kcal), goal: g.kcal })}">
    <svg viewBox="0 0 132 132"><circle cx="66" cy="66" r="${R}" fill="none" stroke="var(--sunk)" stroke-width="12"/>
    ${pct > 0 ? `<circle cx="66" cy="66" r="${R}" fill="none" stroke="${over ? "var(--warn)" : "var(--accent)"}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${C * pct} ${C}"/>` : ""}</svg>
    <div class="center"><div class="big num">${Math.abs(left)}</div><div class="small">${left >= 0 ? t("diary.left") : t("diary.over")}</div></div></div>`;
}
export function macroBar(label, key, tot, g, color) {
  const pct = g[key] ? Math.min(100, tot[key] / g[key] * 100) : 0;
  return `<div class="macro"><div class="row"><b>${label}</b><span class="num">${fm(tot[key])} / ${g[key]} ${t("unit.g")}</span></div>
    <div class="bar"><i style="width:${pct}%;background:var(${color})"></i></div></div>`;
}
export const dots = e => `<span class="dots num"><i class="p">${fm(e.protein)}</i><i class="f">${fm(e.fat)}</i><i class="c">${fm(e.carbs)}</i></span>`;

export function viewDiary() {
  const tot = totals(S.entries), g = S.goals;
  let h = "";
  if (S.mode === "error") return `<div class="banner warn">${esc(S.error)}</div>`;
  if (!S.goalsSet && S.mode !== "loading") h += `<div class="banner">${t("diary.defaultGoals", { kcal: DEFAULT_GOALS.kcal })} <button class="btn" data-act="tab" data-tab="settings" style="padding:4px 10px;margin-left:4px">${t("diary.setGoals")}</button></div>`;
  h += `<section class="summary">${dial(tot, g)}<div class="macros">
      ${macroBar(t("macro.protein"), "protein", tot, g, "--protein")}${macroBar(t("macro.fat"), "fat", tot, g, "--fat")}${macroBar(t("macro.carbs"), "carbs", tot, g, "--carbs")}</div>
      <div class="kcalline num"><span>${t("diary.eaten", { n: raw(`<b>${Math.round(tot.kcal)}</b>`) })}</span><span>${t("diary.goal", { n: raw(`<b>${g.kcal}</b>`) })}</span></div></section>`;
  for (const [key, label] of meals()) {
    const items = S.entries.filter(e => e.meal === key).sort((a, b) => a.createdAt - b.createdAt);
    const mt = totals(items);
    h += `<section class="meal"><div class="mhead"><h2>${label}</h2><span class="mk num">${items.length ? Math.round(mt.kcal) + " " + t("unit.kcal") : ""}</span></div><div class="list">`;
    for (const e of items) h += `<div class="swipe"><button class="swipe-del" data-act="swipeDel" data-id="${esc(e.id)}" aria-label="${t("diary.deleteEntry", { name: e.name })}">${t("diary.delete")}</button>
      <button class="item" data-act="editEntry" data-id="${esc(e.id)}"><div class="main"><div class="name">${esc(e.name)}</div>
      <div class="sub num">${fm(e.grams)} ${t("unit.g")} · ${dots(e)}</div></div><div class="kc num">${Math.round(e.kcal)}</div></button></div>`;
    h += `<button class="addrow" data-act="add" data-meal="${key}">${t("diary.addFood")}</button></div></section>`;
  }
  return h;
}

export function viewFoods() {
  const foods = [...S.foods].sort((a, b) => a.name.localeCompare(b.name));
  let h = `<div class="section-title">${t("foods.title")}</div><p class="muted small">${t("foods.intro")}</p>`;
  h += `<button class="btn primary block" data-act="newFood" style="margin-bottom:12px">${t("foods.create")}</button>`;
  if (!foods.length) return h + `<div class="card empty">${t("foods.empty")}</div>`;
  h += `<div class="list">`;
  for (const f of foods) h += `<button class="item" data-act="editFood" data-id="${esc(f.id)}"><div class="main"><div class="name">${esc(f.name)}${f.brand ? ` <span class="muted small">${esc(f.brand)}</span>` : ""}</div>
    <div class="sub num">${f.barcode ? "▮▯▮ " + esc(f.barcode) + " · " : ""}${dots(f)}</div></div><div class="kc num">${Math.round(f.kcal)}<span class="muted small"> ${t("unit.kcal")}</span></div></button>`;
  return h + `</div>`;
}

export function viewSettings() {
  const masked = AI.key ? AI.key.slice(0, 4) + "…" + AI.key.slice(-4) : "";
  return viewGoals() + viewLanguage() + `
  <div class="section-title" style="margin-top:22px">${t("ai.title")}</div>
  <form class="card stack" id="keyForm">
    <p class="small muted" style="margin:0">${t("ai.intro")}</p>
    <div class="seg" role="group" aria-label="${t("ai.providerAria")}">
      <button type="button" data-act="provider" data-p="gemini" aria-pressed="${AI.provider === "gemini"}">${t("ai.geminiFree")}</button>
      <button type="button" data-act="provider" data-p="claude" aria-pressed="${AI.provider === "claude"}">Claude</button>
    </div>
    ${AI.provider === "gemini"
      ? `<p class="small muted" style="margin:0">${t("ai.geminiHelp")}</p>`
      : `<p class="small muted" style="margin:0">${t("ai.claudeHelp")}</p>`}
    ${AI.key ? `<p class="small" style="margin:0">${t("ai.current")} <span class="keybox">${esc(masked)}</span></p>` : ""}
    <div class="field"><label for="k-key">${AI.key ? t("ai.replaceKey") : t("ai.keyFor", { provider: AI.label() })}</label><input id="k-key" type="password" class="keybox" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${AI.provider === "gemini" ? "AIza…" : "sk-ant-…"}"></div>
    ${AI.provider === "gemini" ? `<div class="field"><label for="k-model">${t("ai.model")}</label><input id="k-model" type="text" class="keybox" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(AI.geminiModel)}"></div>` : ""}
    <div class="grid2"><button class="btn primary" type="submit">${t("common.save")}</button>${AI.key ? `<button class="btn" type="button" data-act="testKey">${t("ai.test")}</button>` : ""}</div>
    ${AI.key ? `<button class="btn danger" type="button" data-act="${S.confirmKeyDel ? "delKey" : "askDelKey"}">${S.confirmKeyDel ? t("ai.confirmDeleteKey") : t("ai.deleteKey")}</button>` : ""}
    <div class="status" id="keyStatus"></div>
  </form>
  <div class="section-title" style="margin-top:22px">${t("backup.title")}</div>
  <div class="card stack">
    <p class="small muted" style="margin:0">${t("backup.intro")}</p>
    <div class="grid2"><button class="btn" data-act="export">${t("backup.export")}</button><button class="btn" data-act="import">${t("backup.import")}</button></div>
    <div class="status" id="bkStatus"></div>
  </div>
  <p class="small muted" style="margin-top:18px">${offCredit()}</p>
  <p class="small muted" style="margin-top:4px">Yummer ${esc(APP_VERSION.replace("yummer-", ""))}</p>`;
}
export const offCredit = () => t("common.offData", { link: raw('<a href="https://world.openfoodfacts.org" target="_blank" rel="noopener" style="color:inherit">Open Food Facts</a>') });
export function viewLanguage() {
  const opt = (v, label) => `<option value="${v}" ${I18N.choice === v ? "selected" : ""}>${label}</option>`; // label is t() output or a dictionary constant
  return `<div class="section-title" style="margin-top:22px">${t("lang.title")}</div>
  <div class="card"><select id="langSel" aria-label="${t("lang.title")}">
    ${opt("auto", t("lang.auto", { name: DICTS[deviceLang()]["lang.name"] }))}${LANGS.map(l => opt(l, DICTS[l]["lang.name"])).join("")}
  </select></div>`;
}
export function viewGoals() {
  const g = S.goals, kFromMacros = Math.round(g.protein * 4 + g.fat * 9 + g.carbs * 4);
  return `<div class="section-title">${t("goals.title")}</div>
  <form class="card stack" id="goalsForm">
    <div class="field"><label for="g-kcal">${t("goals.kcal")}</label><input id="g-kcal" type="number" inputmode="numeric" min="800" max="6000" value="${esc(g.kcal)}"></div>
    <div class="grid2">
      <div class="field"><label for="g-protein">${t("goals.protein")}</label><input id="g-protein" type="number" inputmode="numeric" min="0" value="${esc(g.protein)}"></div>
      <div class="field"><label for="g-fat">${t("goals.fat")}</label><input id="g-fat" type="number" inputmode="numeric" min="0" value="${esc(g.fat)}"></div>
      <div class="field"><label for="g-carbs">${t("goals.carbs")}</label><input id="g-carbs" type="number" inputmode="numeric" min="0" value="${esc(g.carbs)}"></div>
      <div class="field"><label>${t("goals.fromMacros")}</label><div class="num" style="padding:10px 0" id="g-calc">${kFromMacros} ${t("unit.kcal")}</div></div>
    </div>
    <p class="small muted">${t("goals.hint")}</p>
    <button class="btn primary" type="submit">${t("goals.save")}</button>
  </form>`;
}

export function render() {
  const app = $("#app");
  const head = `<header class="top"><div class="brand">Yummer</div>${S.tab === "diary" ? `<div class="datenav">
    <button data-act="day" data-d="-1" aria-label="${t("day.prev")}">‹</button><div class="label">${esc(dateLabel(S.date))}</div>
    <button data-act="day" data-d="1" aria-label="${t("day.next")}">›</button></div>` : ""}</header>`;
  const body = S.mode === "loading" ? `<p class="muted">${t("app.loading")}</p>` : S.tab === "diary" ? viewDiary() : S.tab === "foods" ? viewFoods() : viewSettings();
  const active = document.activeElement?.id;
  app.innerHTML = head + body + `<div id="toast" class="toast${S.toastErr ? " err" : ""}" role="status">${toastHTML()}</div>`;
  if (active && S.tab === "settings") { const el = document.getElementById(active); if (el) el.focus(); }
  renderTabs();
}
export function renderTabs() {
  let nav = $("nav.tabs");
  if (!nav) { nav = document.createElement("nav"); nav.className = "tabs"; nav.setAttribute("aria-label", t("tab.aria")); document.body.appendChild(nav); }
  nav.innerHTML = `<div class="in">${["diary", "foods", "settings"].map(k => [k, t("tab." + k)]).map(([k, l]) =>
    `<button data-act="tab" data-tab="${k}" ${S.tab === k ? 'aria-current="page"' : ""}>${l}</button>`).join("")}</div>`;
}
export let toastTimer;
/** Toast message above the tab bar. action = { label, act } adds a button (e.g. Undo) handled by data-act. */
const toastHTML = () => S.toast ? `<span>${esc(S.toast)}</span>${S.toastAction ? `<button class="toast-act" data-act="${esc(S.toastAction.act)}">${esc(S.toastAction.label)}</button>` : ""}` : "";
export function toast(msg, isErr, action) {
  S.toast = msg; S.toastErr = !!isErr; S.toastAction = action || null;
  const paint = () => { const el = $("#toast"); if (el) { el.innerHTML = toastHTML(); el.classList.toggle("err", S.toastErr); } };
  paint(); clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { S.toast = ""; S.toastAction = null; paint(); }, action ? 6000 : 4000);
}
export function clearToast() { clearTimeout(toastTimer); S.toast = ""; S.toastAction = null; const el = $("#toast"); if (el) el.innerHTML = ""; }
