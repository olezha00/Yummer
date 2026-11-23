import { test } from "node:test";
import assert from "node:assert/strict";
import { findMatches, matchScore } from "../js/data/match.js";

const saved = [
  { id: "a", name: "Skyr pitny waniliowy", brand: "Piątnica", barcode: "5900820011000", kcal: 64, protein: 7.6, fat: 1.8, carbs: 4.3 },
  { id: "b", name: "Творог полужирный", brand: null, barcode: null, kcal: 133, protein: 18.7, fat: 4.7, carbs: 3.7 },
  { id: "c", name: "Mleko 2%", brand: "Mlekovita", barcode: "5900512000000", kcal: 50, protein: 3.4, fat: 2, carbs: 4.8 },
];
test("the same barcode is a certain match", () => {
  assert.equal(matchScore({ barcode: "5900820011000", name: "x" }, saved[0]), 1);
});
test("similar name and brand match even without a barcode", () => {
  assert.deepEqual(findMatches({ name: "Skyr pitny wanilia", brand: "Piatnica", kcal: 66, protein: 7.5, fat: 1.8, carbs: 4.6 }, saved).map(f => f.id), ["a"]);
});
test("a name in another language matches when nutrition is the same and some words overlap or the brand matches", () => {
  assert.deepEqual(findMatches({ name: "Twaróg półtłusty", brand: "Piątnica", kcal: 133, protein: 18.7, fat: 4.7, carbs: 3.7 }, [{ ...saved[1], brand: "Piątnica" }]).map(f => f.id), ["b"]);
});
test("different products are not offered", () => {
  assert.deepEqual(findMatches({ name: "Ser gouda", brand: "Mlekovita", kcal: 356, protein: 25, fat: 27, carbs: 2 }, saved), []);
  assert.deepEqual(findMatches({ name: "Skyr naturalny", brand: "Bakoma", kcal: 62, protein: 11, fat: 0, carbs: 4 }, saved), []);
  assert.deepEqual(findMatches(null, saved), []);
});
