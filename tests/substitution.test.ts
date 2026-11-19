import { test } from "node:test";
import assert from "node:assert/strict";
import { substitutionNote } from "../lib/gemini";

/**
 * The fallback chain lets a busy model be replaced by a lighter one, which is
 * right. What is not right is doing it in silence: the report then carries a
 * weaker reading while the interface names the stronger model. These tests pin
 * the sentence that says so.
 */

test("the note names both models and the reason", () => {
  const note = substitutionNote({
    asked: "gemini-3.8-flash",
    answered: "gemini-3.5-flash-lite",
    reason: "out of quota, retry in 10h33m",
  });
  assert.match(note, /gemini-3\.5-flash-lite/);
  assert.match(note, /not gemini-3\.8-flash/);
  assert.match(note, /out of quota/);
});

test("the note says the report still stands, and is thinner", () => {
  const note = substitutionNote({ asked: "a", answered: "b", reason: "out of quota" });
  assert.match(note, /real/);
  assert.match(note, /lighter model/);
});

test("the note never leaks an undefined or empty slot", () => {
  const note = substitutionNote({ asked: "a", answered: "b", reason: "" });
  assert.doesNotMatch(note, /undefined|null|\(\)|\(\s*\)/);
});
