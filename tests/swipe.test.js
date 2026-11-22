import { test } from "node:test";
import assert from "node:assert/strict";
import { DEL_WIDTH, swipeTarget } from "../js/ui/swipe.js";

test("a long enough swipe left opens the row, a short one snaps back", () => {
  assert.deepEqual(swipeTarget(0, -60), { x: -60, open: true });
  assert.deepEqual(swipeTarget(0, -30), { x: -30, open: false });
});
test("the row never moves right of its place or too far left", () => {
  assert.equal(swipeTarget(0, 50).x, 0);
  assert.equal(swipeTarget(0, -1000).x, -DEL_WIDTH * 1.5);
});
test("swiping an open row back to the right closes it", () => {
  assert.equal(swipeTarget(-DEL_WIDTH, 70).open, false);
  assert.equal(swipeTarget(-DEL_WIDTH, 20).open, true);
});
