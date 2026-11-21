import { test } from "node:test";
import assert from "node:assert/strict";
import { guessIntent, intentSample, readIntent, INTENT_LABEL, INTENT_PROMPT } from "../lib/intent";

/**
 * The classifier is a model, so these test the parts that are ours: how the
 * sample is trimmed, how its answer is read, and what happens when it says
 * something unexpected. The routing decision itself is the model's, and is
 * checked by sending real messages.
 */

test("a plan and a question are read the way a person expects", () => {
  assert.equal(guessIntent("We will open three cafés in Kigali by June."), "plan");
  assert.equal(guessIntent("What did the last run get wrong?"), "question");
  assert.equal(guessIntent("Should we hire a third rider?"), "question");
  assert.equal(guessIntent("We will charge 45,000 RWF a month."), "plan");
});

test("a long message is a plan even with a question mark", () => {
  // 400+ characters ending in "?" is, in practice, a plan being hedged.
  const long = `${"We will do the thing. ".repeat(30)}Is that right?`;
  assert.equal(guessIntent(long), "plan");
});

test("the sample is trimmed, so the classifier is cheap", () => {
  const long = "x".repeat(2000);
  const sample = intentSample(long);
  assert.ok(sample.length <= 601);
  assert.ok(sample.endsWith("…"));
  assert.equal(intentSample("  short   text \n here "), "short text here");
});

test("the model's answer is read leniently", () => {
  assert.equal(readIntent("plan", "question"), "plan");
  assert.equal(readIntent("Question.", "plan"), "question");
  assert.equal(readIntent("  PLAN\n", "question"), "plan");
});

test("an unreadable answer falls back instead of throwing", () => {
  assert.equal(readIntent("I think this is probably a plan", "question"), "question");
  assert.equal(readIntent("", "plan"), "plan");
  assert.equal(readIntent("banana", "question"), "question");
});

test("the prompt pins the format to one word", () => {
  assert.match(INTENT_PROMPT, /exactly one word/i);
  assert.match(INTENT_PROMPT, /plan/);
  assert.match(INTENT_PROMPT, /question/);
});

test("both outcomes have a label, and neither says 'mode'", () => {
  for (const label of Object.values(INTENT_LABEL)) {
    assert.ok(label.length > 0);
    assert.doesNotMatch(label, /mode/i);
  }
});
