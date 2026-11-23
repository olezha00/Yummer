import { test } from "node:test";
import assert from "node:assert/strict";
import { isOwnFood, ownFoodIds } from "../js/data/foods.js";

test("products the user made are own; Open Food Facts and generic ones are not", () => {
  assert.equal(isOwnFood({ source: "custom" }), true);
  assert.equal(isOwnFood({ source: "mine" }), true);
  assert.equal(isOwnFood({ source: "off" }), false);
  assert.equal(isOwnFood({ source: "generic" }), false);
  assert.equal(isOwnFood(null), false);
});
test("ownFoodIds lists only own products", () => {
  const ids = ownFoodIds([{ id: "a", source: "custom" }, { id: "b", source: "off" }, { id: "c", source: "mine" }]);
  assert.deepEqual([...ids].sort(), ["a", "c"]);
  assert.equal(ids.has(undefined), false);
});
