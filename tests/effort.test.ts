import assert from "node:assert/strict";
import { test } from "node:test";
import { isEffort, thinkingFor } from "../lib/effort";

/**
 * The composer's hold-to-think is only honest if the level it charges to is the
 * level the model is given. These pin the mapping, and pin what happens when the
 * request carries something else entirely.
 */

test("each effort maps to one thinking level", () => {
  assert.equal(thinkingFor("quick"), "low");
  assert.equal(thinkingFor("think"), "medium");
  assert.equal(thinkingFor("deep"), "high");
});

test("an absent effort leaves the environment default in charge", () => {
  assert.equal(thinkingFor(undefined), undefined);
  assert.equal(thinkingFor(null), undefined);
  assert.equal(thinkingFor(""), undefined);
});

test("an invented effort is ignored rather than passed to the model", () => {
  assert.equal(thinkingFor("maximum"), undefined);
  assert.equal(thinkingFor(3), undefined);
  assert.equal(isEffort("DEEP"), false);
  assert.equal(isEffort("deep"), true);
});
