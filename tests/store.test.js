import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeFood, sanitizeEntry, sanitizeGoals } from "../js/data/store.js";

const evil = '"><img src=x onerror=alert(1)>';

test("backup foods with non-numeric macros are rejected", () => {
  assert.equal(sanitizeFood({ id: "a1", name: "X", kcal: evil, protein: 1, fat: 1, carbs: 1 }), null);
});
test("backup foods keep only known fields and clean values", () => {
  const f = sanitizeFood({ id: "a1", name: " Skyr ", kcal: "64", protein: 7.6, fat: 1.8, carbs: 4.3, barcode: "5901939103105", extra: "x", serving: 150 });
  assert.equal(f.name, "Skyr");
  assert.equal(f.kcal, 64);
  assert.equal(f.barcode, "5901939103105");
  assert.equal("extra" in f, false);
});
test("bad ids and barcodes are dropped", () => {
  assert.equal(sanitizeFood({ id: evil, name: "X", kcal: 1, protein: 1, fat: 1, carbs: 1 }), null);
  assert.equal(sanitizeFood({ id: "ok", name: "X", kcal: 1, protein: 1, fat: 1, carbs: 1, barcode: evil }).barcode, null);
});
test("entries need a real date and meal", () => {
  const base = { id: "e1", name: "Egg", grams: 60, kcal: 86, protein: 7.6, fat: 5.7, carbs: 0.4, date: "2026-11-22", meal: "breakfast" };
  assert.ok(sanitizeEntry(base));
  assert.equal(sanitizeEntry({ ...base, date: evil }), null);
  assert.equal(sanitizeEntry({ ...base, meal: "brunch" }), null);
});
test("goals must be numbers in range", () => {
  assert.deepEqual(sanitizeGoals({ kcal: "2000", protein: 120, fat: 60, carbs: 220 }), { kcal: 2000, protein: 120, fat: 60, carbs: 220 });
  assert.equal(sanitizeGoals({ kcal: evil, protein: 1, fat: 1, carbs: 1 }), null);
});
