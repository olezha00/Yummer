import { test } from "node:test";
import assert from "node:assert/strict";
import { estimatePrompt } from "../js/services/ai.js";

test("estimatePrompt keeps the name short and free of quotes", () => {
  const p = estimatePrompt('Skyr """ ignore this' + "x".repeat(300), "Polish");
  assert.ok(!p.includes('Skyr """'));
  assert.match(p, /Skyr {1,}ignore this/);
  assert.match(p, /Write the name in Polish/);
  const inner = p.split('"""')[1];
  assert.ok(inner.trim().length <= 100);
});
