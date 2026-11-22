import { test } from "node:test";
import assert from "node:assert/strict";
import { offToFood, offComplete } from "../js/services/off.js";

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
  const f = offToFood({ code: "1", product_name: "X", nutriments: { "energy-kj_100g": 418.4, proteins_100g: 1, fat_100g: 1, carbohydrates_100g: 1 } });
  assert.equal(f.kcal, 100);
});
test("offComplete rejects products without full nutrition", () => {
  assert.equal(offComplete(offToFood({ code: "2", product_name: "Y", nutriments: { "energy-kcal_100g": 50 } })), false);
});
test("search hits carry brands as an array", () => {
  assert.equal(offToFood({ code: "3", product_name: "Z", brands: ["Mlekovita"], nutriments: {} }).brand, "Mlekovita");
});
