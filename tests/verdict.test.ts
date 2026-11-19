import assert from "node:assert/strict";
import { test } from "node:test";
import { verdictOf } from "../lib/verdict";
import { demoAnalysis } from "../lib/demo";

/**
 * The headline at the top of a report is the whole product in one sentence, so
 * it must be derived from the report and never embellished. These pin the three
 * things that can go wrong: naming the wrong claim, inventing a test, and
 * congratulating a plan nobody has run anything against.
 */

test("the headline names the highest-priority claim, not the first one", () => {
  const base = demoAnalysis();
  const reversed = { ...base, claims: [...base.claims].reverse() };
  const a = verdictOf(base);
  const b = verdictOf(reversed);
  assert.ok(a.claim);
  assert.equal(a.claim?.ref, b.claim?.ref);
  assert.equal(a.claim?.priority, Math.max(...base.claims.map((c) => c.priority)));
});

test("the headline quotes the claim's own words rather than paraphrasing them", () => {
  const analysis = demoAnalysis();
  const verdict = verdictOf(analysis);
  assert.ok(verdict.claim);
  const claim = verdict.claim!.claim.trim().replace(/[.!?]+$/, "");
  assert.equal(verdict.detail, `${claim}.`);
});

test("a claim with no test produces 'no test yet', never an invented one", () => {
  const analysis = demoAnalysis();
  const claims = analysis.claims.map((c) => ({ ...c, test: null }));
  const verdict = verdictOf({ ...analysis, claims } as typeof analysis);
  assert.equal(verdict.test, null);
  assert.match(verdict.headline, /no test yet/);
});

test("an empty report says the run failed, not that the plan is fine", () => {
  const analysis = demoAnalysis();
  const verdict = verdictOf({ ...analysis, claims: [] } as typeof analysis);
  assert.equal(verdict.claim, null);
  assert.match(verdict.headline, /failure of the run/);
  assert.doesNotMatch(verdict.headline, /nothing to worry|no assumptions|clear/i);
});

test("an untouched report is marked untouched", () => {
  const analysis = demoAnalysis();
  const fresh = {
    ...analysis,
    claims: analysis.claims.map((c) => ({ ...c, outcome: undefined })),
  };
  assert.equal(verdictOf(fresh as typeof analysis).untouched, true);
  const tested = {
    ...analysis,
    claims: analysis.claims.map((c, i) =>
      i === 0 ? { ...c, outcome: { result: "confirmed" as const, at: "2026-01-01T00:00:00Z" } } : c
    ),
  };
  assert.equal(verdictOf(tested as typeof analysis).untouched, false);
});
