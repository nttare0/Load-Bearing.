import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_EFFORT, EFFORTS, THINKING, isEffort, thinkingFor } from "../lib/effort";

/**
 * The thinking level now travels two ways — a tap on the spine's cycle, and the
 * composer's hold — and both must land on the same three names, or the model
 * receives a level the interface never showed.
 */

test("every level has a label, a hint and a cost", () => {
  for (const effort of EFFORTS) {
    const spec = THINKING[effort];
    assert.ok(spec.label.length > 0, `${effort} has no label`);
    assert.ok(spec.hint.length > 0, `${effort} has no hint`);
    assert.ok(spec.cost.length > 0, `${effort} has no cost`);
  }
});

test("the levels map onto the provider's own words", () => {
  assert.equal(thinkingFor("quick"), "low");
  assert.equal(thinkingFor("think"), "medium");
  assert.equal(thinkingFor("deep"), "high");
});

test("an unknown level falls through to the environment default", () => {
  assert.equal(thinkingFor("maximum"), undefined);
  assert.equal(thinkingFor(undefined), undefined);
  assert.equal(thinkingFor(null), undefined);
  assert.equal(thinkingFor(7), undefined);
});

test("the default is a real level, not an empty string", () => {
  assert.ok(isEffort(DEFAULT_EFFORT));
  assert.ok(EFFORTS.includes(DEFAULT_EFFORT));
  assert.notEqual(thinkingFor(DEFAULT_EFFORT), undefined);
});

test("the cycle walks the whole list and returns to the start", () => {
  // This is what the spine's button does: index + 1, wrapping.
  let at = 0;
  const seen: string[] = [];
  for (let i = 0; i < EFFORTS.length + 1; i += 1) {
    seen.push(EFFORTS[at]);
    at = (at + 1) % EFFORTS.length;
  }
  assert.deepEqual(seen, [...EFFORTS, EFFORTS[0]]);
});
