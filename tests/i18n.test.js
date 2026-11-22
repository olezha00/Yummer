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
