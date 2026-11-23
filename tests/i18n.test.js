import { test } from "node:test";
import assert from "node:assert/strict";
import { detectLang, DICTS, I18N, setLang, t } from "../js/i18n.js";
import { genericFoods, GENERIC_ROWS, mealLabel } from "../js/data/foods.js";
import { dateLabel, today } from "../js/util.js";

test("device language picks the first supported one", () => {
  assert.equal(detectLang(["pl-PL", "en-US"]), "pl");
  assert.equal(detectLang(["fr-FR", "de-AT"]), "de");
  assert.equal(detectLang(["ru"]), "ru");
  assert.equal(detectLang(["fr-FR", "ja"]), "en");
  assert.equal(detectLang([]), "en");
  assert.equal(detectLang(undefined), "en");
});
test("a chosen language overrides the device; unknown choices mean auto", () => {
  setLang("de"); assert.equal(I18N.lang, "de"); assert.equal(I18N.choice, "de");
  setLang("xx"); assert.equal(I18N.choice, "auto");
});
test("t() fills placeholders and falls back to English, then to the key", () => {
  setLang("pl");
  assert.equal(t("amount.added", { name: "Skyr", meal: "Obiad" }), "Dodano „Skyr”: Obiad.");
  assert.equal(t("no.such.key"), "no.such.key");
  setLang("ru");
  assert.equal(t("diary.eaten", { n: 5 }), "Съедено 5 ккал");
});
test("every language has the same keys", () => {
  const keys = Object.keys(DICTS.ru).sort();
  for (const d of Object.values(DICTS)) assert.deepEqual(Object.keys(d).sort(), keys);
});
test("generic foods and meals follow the language, ids stay stable", () => {
  setLang("en"); const en = genericFoods(); assert.equal(en[0].name, "Chicken breast, raw"); assert.equal(mealLabel("lunch"), "Lunch");
  setLang("de"); const de = genericFoods(); assert.equal(de[0].name, "Hähnchenbrust, roh"); assert.equal(mealLabel("nope"), "Mahlzeit");
  assert.deepEqual(en.map(f => f.id), de.map(f => f.id));
  for (const r of GENERIC_ROWS) assert.equal(r[0].length, 4, "each generic food has 4 names: " + r[0][0]);
});
test("date labels are translated", () => {
  setLang("pl"); assert.equal(dateLabel(today()), "Dziś");
  setLang("en"); assert.equal(dateLabel(today()), "Today");
});
test("t() escapes values for HTML, raw() opts out, tText() leaves text as is", async () => {
  const { raw, tText } = await import("../js/i18n.js");
  setLang("en");
  assert.equal(t("describe.remove", { name: "<b>x</b>" }), "Remove &lt;b&gt;x&lt;/b&gt;");
  assert.equal(t("diary.eaten", { n: raw("<b>5</b>") }), "Eaten <b>5</b> kcal");
  assert.equal(tText("describe.remove", { name: "A & B" }), "Remove A & B");
});
test("keys built at runtime exist in every language", async () => {
  const { MEAL_KEYS } = await import("../js/data/foods.js");
  const dynamic = [...MEAL_KEYS.map(k => "meal." + k), ...["protein", "fat", "carbs"].map(k => "macro." + k + "Short"), ...["diary", "foods", "settings"].map(k => "tab." + k)];
  for (const [l, d] of Object.entries(DICTS)) for (const k of dynamic) assert.ok(typeof d[k] === "string", `${l} is missing ${k}`);
});
test("built-in foods are found by any of their four names", () => {
  setLang("en");
  const quark = genericFoods().find(f => f.name === "Quark, half-fat");
  for (const w of ["twarog", "творог", "quark"]) assert.ok(quark.search.includes(w), w);
});
test("macro badge letters are one distinct letter each, Б/Ж/У in Russian", () => {
  for (const [lang, d] of Object.entries(DICTS)) {
    const letters = ["protein", "fat", "carbs"].map(k => d[`macro.${k}Letter`]);
    for (const l of letters) assert.equal([...l].length, 1, `${lang}: ${l}`);
    assert.equal(new Set(letters).size, 3, lang);
  }
  assert.deepEqual(["protein", "fat", "carbs"].map(k => DICTS.ru[`macro.${k}Letter`]), ["Б", "Ж", "У"]);
});
