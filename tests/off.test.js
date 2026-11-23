import { test } from "node:test";
import assert from "node:assert/strict";
import { offToFood, offComplete, cleanQuery, offQuery, offLangs, mergeFoods, searchURL, legacySearchURL, HOME_COUNTRIES, EU_COUNTRIES } from "../js/services/off.js";

test("offToFood maps an Open Food Facts product", () => {
  const f = offToFood({ code: "5900820000233", product_name_pl: "Twarożek", brands: "Piątnica, Other",
    nutriments: { "energy-kcal_100g": 180, proteins_100g: 8, fat_100g: 15.04, carbohydrates_100g: 3 }, serving_quantity: 150 });
  assert.equal(f.name, "Twarożek");
  assert.equal(f.brand, "Piątnica");
  assert.equal(f.fat, 15);
  assert.equal(f.serving, 150);
  assert.ok(offComplete(f));
});
test("offToFood converts kJ when kcal is missing", () => {
  const f = offToFood({ code: "12345678", product_name: "X", nutriments: { "energy-kj_100g": 418.4, proteins_100g: 1, fat_100g: 1, carbohydrates_100g: 1 } });
  assert.equal(f.kcal, 100);
});
test("offComplete rejects products without full nutrition", () => {
  assert.equal(offComplete(offToFood({ code: "22345678", product_name: "Y", nutriments: { "energy-kcal_100g": 50 } })), false);
});
test("search hits carry brands as an array", () => {
  assert.equal(offToFood({ code: "32345678", product_name: "Z", brands: ["Mlekovita"], nutriments: {} }).brand, "Mlekovita");
});
test("offToFood skips hits without a real barcode", () => {
  const n = { "energy-kcal_100g": 1, proteins_100g: 1, fat_100g: 1, carbohydrates_100g: 1 };
  assert.equal(offToFood({ product_name: "X", nutriments: n }), null);
  assert.equal(offToFood({ code: "abc", product_name: "X", nutriments: n }), null);
  assert.equal(offToFood(null), null);
});
test("offToFood prefers the product name in the UI language, then Polish", () => {
  const p = { code: "12345678", product_name: "Default", product_name_pl: "Polska", product_name_de: "Deutsch", nutriments: {} };
  assert.equal(offToFood(p, "de").name, "Deutsch");
  assert.equal(offToFood(p, "ru").name, "Polska");
});
test("cleanQuery removes query syntax but keeps words and Polish letters", () => {
  assert.equal(cleanQuery('Piątnica "twarożek": (light) OR*'), "Piątnica twarożek light or");
  assert.equal(cleanQuery("  a\\b  "), "a b");
  assert.equal(cleanQuery(null), "");
  assert.equal(cleanQuery("x".repeat(200)).length, 80);
});
test("offQuery searches any of the texts in the given countries", () => {
  assert.equal(offQuery(["twaróg", "quark"], ["poland"]), '((twaróg) OR (quark)) AND (countries_tags:"en:poland")');
  assert.equal(offQuery(["skyr", "skyr"], ["poland", "germany"]), '(skyr) AND (countries_tags:"en:poland" OR countries_tags:"en:germany")');
  assert.equal(offQuery(['""'], ["poland"]), "");
});
test("Russia is not among the searched countries", () => {
  assert.ok(!HOME_COUNTRIES.includes("russia") && !EU_COUNTRIES.includes("russia"));
  assert.ok(!EU_COUNTRIES.includes("belarus"));
});
test("offLangs puts Polish first and has no repeats", () => {
  assert.equal(offLangs("pl"), "pl,en,de");
  assert.equal(offLangs("de"), "pl,de,en");
});
test("mergeFoods keeps order, drops repeats and caps the list", () => {
  const a = [{ id: "1" }, { id: "2" }], b = [{ id: "2" }, { id: "3" }, null];
  assert.deepEqual(mergeFoods([a, b]).map(f => f.id), ["1", "2", "3"]);
  assert.deepEqual(mergeFoods([a, b], 2).map(f => f.id), ["1", "2"]);
});
test("search URLs encode the query", () => {
  assert.match(searchURL('(a b) AND (countries_tags:"en:poland")', "en"), /q=\(a%20b\)%20AND%20\(countries_tags%3A%22en%3Apoland%22\)&/);
  assert.match(legacySearchURL("twaróg & co"), /search_terms=twar%C3%B3g%20co&tagtype_0=countries/);
});
