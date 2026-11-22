import { test } from "node:test";
import assert from "node:assert/strict";
import { fm, r1, shift, scale, norm, dkey } from "../js/util.js";

test("fm rounds big numbers and keeps one decimal for small ones", () => {
  assert.equal(fm(123.6), "124");
  assert.equal(fm(9.94), "9.9");
  assert.equal(fm(undefined), "0");
});
test("r1 rounds to one decimal", () => assert.equal(r1(2.345), 2.3));
test("shift moves a date key across month ends", () => {
  assert.equal(shift("2026-11-30", 1), "2026-12-01");
  assert.equal(shift("2026-03-01", -1), "2026-02-28");
});
test("dkey formats local dates", () => assert.equal(dkey(new Date(2026, 0, 5)), "2026-01-05"));
test("scale converts per-100 g values to an amount", () => {
  assert.deepEqual(scale({ kcal: 200, protein: 10, fat: 5, carbs: 30 }, 150), { kcal: 300, protein: 15, fat: 7.5, carbs: 45 });
});
test("norm ignores case and Polish diacritics", () => assert.equal(norm("Twaróg ŁOWICZ"), "twarog lowicz"));
