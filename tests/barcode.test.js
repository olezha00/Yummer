import { test } from "node:test";
import assert from "node:assert/strict";
import { checkDigitOk, fitScale, rotatedBox, SCAN_ANGLES } from "../js/services/barcode.js";

test("rotatedBox keeps the size at 0° and swaps it at 90°", () => {
  assert.deepEqual(rotatedBox(400, 200, 0), { w: 400, h: 200 });
  assert.deepEqual(rotatedBox(400, 200, 90), { w: 200, h: 400 });
  assert.deepEqual(rotatedBox(400, 200, -90), { w: 200, h: 400 });
});
test("rotatedBox grows to hold the corners of a turned image", () => {
  const b = rotatedBox(100, 100, 45);
  assert.equal(b.w, 141); assert.equal(b.h, 141);
  assert.deepEqual(rotatedBox(300, 100, 30), rotatedBox(300, 100, -30));
});
test("live angles, each also tried turned 90°, cover every tilt within 15°", () => {
  for (let tilt = 0; tilt < 180; tilt++) {
    const near = SCAN_ANGLES.flatMap(a => [a, a + 90]).some(a => { const d = Math.abs(((tilt - a) % 180 + 180) % 180); return Math.min(d, 180 - d) <= 15; });
    assert.ok(near, "tilt " + tilt);
  }
});
test("fitScale shrinks to the limit and never enlarges", () => {
  assert.equal(fitScale(1920, 1080, 960), 0.5);
  assert.equal(fitScale(640, 480, 960), 1);
});
test("checkDigitOk validates EAN-13, EAN-8 and UPC-A check digits", () => {
  assert.ok(checkDigitOk("5900259000002"));
  assert.ok(checkDigitOk("4006381333931"));
  assert.ok(!checkDigitOk("4006381333932"));
  assert.ok(checkDigitOk("96385074"));
  assert.ok(!checkDigitOk("96385075"));
  assert.ok(checkDigitOk("036000291452"));
  assert.ok(!checkDigitOk("036000291453"));
});
test("checkDigitOk lets codes without a GTIN check digit through", () => {
  assert.ok(checkDigitOk("12345"));
  assert.ok(checkDigitOk("ABC-123"));
});
