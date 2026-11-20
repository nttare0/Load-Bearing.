import { test } from "node:test";
import assert from "node:assert/strict";
import { PASS_LABEL, shouldBeOpen, summaryOf, type ReasonStep } from "../lib/reasoning";

/**
 * The reasoning panel has one behaviour worth pinning: it is open while the
 * model thinks and closed once it has answered, and the folded line still says
 * something true. Those two things are tested here rather than in a browser.
 */

const steps: ReasonStep[] = [
  { pass: "extract", kind: "think", text: "reading the plan for claims it states outright", ms: 420 },
  { pass: "extract", kind: "found", text: "found 9 claims the plan states", ms: 2100 },
  { pass: "hidden", kind: "found", text: "4 assumptions the plan relies on but never states", ms: 1800 },
  { pass: "evidence", kind: "warn", text: "no source could be tied to a claim", ms: 40 },
];

test("the panel is open while the model is running", () => {
  assert.equal(shouldBeOpen(null, true), true);
});

test("the panel folds when the run stops", () => {
  assert.equal(shouldBeOpen(null, false), false);
});

test("a manual choice beats the default, both ways", () => {
  // Opened mid-run and left open.
  assert.equal(shouldBeOpen(true, false), true);
  // Closed mid-run to read the report underneath.
  assert.equal(shouldBeOpen(false, true), false);
});

test("the collapsed summary counts findings, not lines", () => {
  const line = summaryOf(steps);
  assert.match(line, /2 findings/);
  assert.match(line, /1 problem/);
  // Think steps are not findings: 4 steps, 2 findings.
  assert.doesNotMatch(line, /4 findings/);
});

test("the collapsed summary reports elapsed time only when the run is over", () => {
  assert.match(summaryOf(steps), /4\.4s|4\.3s|4\.36s/);
  assert.doesNotMatch(summaryOf(steps, { running: true }), /\d\.\ds$/);
});

test("a run with nothing but thinking still says something", () => {
  const line = summaryOf([{ pass: "extract", kind: "think", text: "reading", ms: 100 }]);
  assert.match(line, /1 step/);
});

test("an empty panel mid-run says it is thinking, not that nothing happened", () => {
  assert.match(summaryOf([], { running: true }), /Thinking/);
  assert.doesNotMatch(summaryOf([], { running: true }), /Nothing was thought/);
});

test("every pass the pipeline emits has a human label", () => {
  for (const pass of ["extract", "hidden", "premortem", "score", "evidence", "tests"]) {
    assert.ok(PASS_LABEL[pass], `${pass} has no label`);
    assert.doesNotMatch(PASS_LABEL[pass], /_/, "labels should be words, not ids");
  }
});
