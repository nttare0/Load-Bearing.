import assert from "node:assert/strict";
import { test } from "node:test";
import { band, enforceStatus, priorityOf, rankAndCleanClaims } from "../lib/score";
import { progressOf, verdict } from "../lib/progress";
import type { Analysis, Claim, Status } from "../lib/schema";

/**
 * Tests for the two things in this app that would be dishonest if they broke:
 * a claim cannot be called a fact without evidence, and a report cannot hide
 * what the user found. Run with `npm test`.
 */

function claim(over: Partial<Claim> = {}): Claim {
  return {
    id: over.ref ?? "id-1",
    ref: "C1",
    claim: "Founders will pay for a clearer view of their assumptions.",
    source: "implied",
    category: "behavioral",
    status: "guess" as Status,
    impact: 4,
    confidence: "low",
    dependsOn: [],
    verifiable: true,
    reasoning: "Nothing in the plan states willingness to pay.",
    rank: 1,
    priority: 8,
    evidence: [],
    test: null,
    ...over,
  };
}

function analysis(claims: Claim[]): Analysis {
  return {
    id: "a1",
    title: "Test plan",
    summary: "A plan about a plan.",
    createdAt: new Date().toISOString(),
    input: "the plan text",
    claims,
    failureModes: [],
    notes: [],
  };
}

test("a claim called a fact with no evidence URL is downgraded", () => {
  assert.deepEqual(enforceStatus("fact", 0), { status: "unverified", downgraded: true });
  assert.deepEqual(enforceStatus("contradicted", 0), { status: "unverified", downgraded: true });
});

test("evidence keeps a claim at its stated status", () => {
  assert.deepEqual(enforceStatus("fact", 2), { status: "fact", downgraded: false });
  assert.deepEqual(enforceStatus("guess", 0), { status: "guess", downgraded: false });
});

test("claims carrying an unparseable URL lose the evidence, not the claim", () => {
  const [cleaned] = rankAndCleanClaims([
    claim({
      status: "fact",
      evidence: [
        { ref: "C1", title: "Pricing", url: "https://example.com/pricing", snippet: "Actually there.", supports: "supports" },
        { ref: "C1", title: "Invented", url: "not a url", snippet: "Made up.", supports: "supports" },
      ],
    }),
  ]);
  assert.equal(cleaned.evidence.length, 1);
  assert.equal(cleaned.status, "fact");
});

test("priority bands are thresholds, not opinions", () => {
  assert.equal(band(priorityOf(5, "low")), "load-bearing"); // 10
  assert.equal(band(priorityOf(4, "low")), "load-bearing"); // 8
  assert.equal(band(priorityOf(3, "low")), "structural"); // 6
  assert.equal(band(priorityOf(3, "medium")), "light"); // 4.5, below the 5 cut
  assert.equal(band(priorityOf(4, "medium")), "structural"); // 6
  assert.equal(band(priorityOf(1, "high")), "light"); // 1
});

test("an untested report says so instead of reading as finished", () => {
  const p = progressOf(analysis([claim(), claim({ ref: "C2", id: "i2", priority: 3 })]));
  assert.equal(p.isEmpty, true);
  assert.equal(p.tested, 0);
  assert.match(verdict(p), /none tested yet/);
});

test("progress counts a recorded outcome and names untested load-bearing claims", () => {
  const p = progressOf(
    analysis([
      claim({ ref: "C1", status: "fact", outcome: { result: "confirmed", at: new Date().toISOString() } }),
      claim({ ref: "C2", id: "i2", priority: 9, rank: 2 }),
    ])
  );
  assert.equal(p.tested, 1);
  assert.equal(p.confirmed, 1);
  assert.equal(p.untestedLoadBearing.length, 1);
  assert.equal(p.untestedLoadBearing[0].ref, "C2");
  assert.match(verdict(p), /load-bearing claim is still unchecked/);
});

test("a broken claim leads the verdict, ahead of good news", () => {
  const p = progressOf(
    analysis([
      claim({ ref: "C1", status: "contradicted", outcome: { result: "broken", at: new Date().toISOString() } }),
      claim({ ref: "C2", id: "i2", rank: 2, status: "fact", outcome: { result: "confirmed", at: new Date().toISOString() } }),
    ])
  );
  assert.equal(p.broken, 1);
  assert.equal(p.brokenClaims[0].ref, "C1");
  assert.match(verdict(p), /^1 claim broke/);
});

test("coverage is derived, so it cannot drift from the claims", () => {
  const p = progressOf(
    analysis([
      claim({ ref: "C1", outcome: { result: "inconclusive", at: new Date().toISOString() } }),
      claim({ ref: "C2", id: "i2", rank: 2 }),
      claim({ ref: "C3", id: "i3", rank: 3 }),
      claim({ ref: "C4", id: "i4", rank: 4 }),
    ])
  );
  assert.equal(p.coverage, 0.25);
  assert.equal(p.isEmpty, false);
});

// ---------------------------------------------------------------------------
// Re-runs: the same assumption must be recognised across two analyses, or the
// diff reports noise as progress.
// ---------------------------------------------------------------------------

import { assignKeys, claimKey, diffRuns, diffVerdict } from "../lib/diff";
import { previousRun, recordRun, type Plan } from "../lib/plans";

test("the same assumption is keyed the same way however it is worded", () => {
  const a = claimKey("Founders will pay for a clearer view of their assumptions.");
  const b = claimKey("founders pay for clearer view of their assumptions");
  assert.equal(a, b);
  assert.notEqual(a, claimKey("Founders will not pay for this."));
});

test("a re-run inherits the test result of the assumption it repeats", () => {
  const first = claim({ status: "fact", outcome: { result: "confirmed", at: "2026-11-01T10:00:00Z" } });
  const second = claim({ id: "i2", ref: "C1", status: "guess", claim: "Founders will pay for a clearer view of their assumptions." });
  const [merged] = assignKeys([second], { claims: [first] });
  assert.equal(merged.outcome?.result, "confirmed");
  assert.equal(merged.status, "fact");
});

test("a diff separates what settled from what never moved", () => {
  const base: Analysis = {
    ...analysis([
      claim({ ref: "C1", priority: 10, status: "fact", outcome: { result: "confirmed", at: "2026-11-01T10:00:00Z" } }),
      claim({ ref: "C2", id: "i2", priority: 6, claim: "The app store listing alone drives installs." }),
    ]),
    run: 1,
  };
  const latest: Analysis = {
    ...analysis([
      claim({ ref: "C1", priority: 10, status: "fact", outcome: { result: "confirmed", at: "2026-11-08T10:00:00Z" } }),
      claim({ ref: "C2", id: "i2", priority: 6, claim: "The app store listing alone drives installs." }),
    ]),
    run: 2,
  };
  const diff = diffRuns(base, latest);
  assert.equal(diff.counts.settled, 1);
  assert.equal(diff.counts.unchanged, 1);
  assert.equal(diff.counts.new, 0);
  assert.match(diffVerdict(diff), /1 settled by a test/);
});

test("a run where nothing moved says so instead of implying progress", () => {
  const claims = [claim({ ref: "C1", priority: 8 }), claim({ ref: "C2", id: "i2", priority: 5, claim: "Store listing drives installs." })];
  const diff = diffRuns(analysis(claims), analysis(claims));
  assert.equal(diff.counts.unchanged, 2);
  assert.match(diffVerdict(diff), /^Nothing moved\./);
});

test("a claim the new run no longer makes is reported as gone", () => {
  const base = analysis([claim({ ref: "C1" }), claim({ ref: "C2", id: "i2", claim: "Store listing drives installs." })]);
  const latest = analysis([claim({ ref: "C1" })]);
  const diff = diffRuns(base, latest);
  assert.equal(diff.counts.dropped, 1);
  assert.equal(diff.claims.find((d) => d.movement === "dropped")?.claim.ref, "C2");
});

test("recording a second run keeps one plan, not two", () => {
  const first = { ...analysis([claim()]), id: "run-1", planId: "plan-1", run: 1 };
  const { plans, plan, isRerun } = recordRun([], first, "the plan text");
  assert.equal(plans.length, 1);
  assert.equal(isRerun, false);

  const second = { ...analysis([claim()]), id: "run-2", planId: "plan-1", run: 2 };
  const after = recordRun(plans, second, "the plan text");
  assert.equal(after.plans.length, 1);
  assert.equal(after.plan.runs.length, 2);
  assert.equal(after.isRerun, true);
  assert.equal(after.plans[0].id, plan.id);
});

test("re-pasting the same plan is the same plan even after a reload", () => {
  const first = { ...analysis([claim()]), id: "run-1" };
  const { plans } = recordRun([], first, "  A budgeting app for freelancers. ");
  const second = { ...analysis([claim()]), id: "run-2" };
  const after = recordRun(plans, second, "A budgeting app for freelancers.");
  assert.equal(after.plans.length, 1);
  assert.equal(after.plan.runs.length, 2);
});

test("the previous run is found by position, and the first run has none", () => {
  const first = { ...analysis([claim()]), id: "run-1" };
  const second = { ...analysis([claim()]), id: "run-2" };
  const { plans } = recordRun([], first, "plan");
  const { plan } = recordRun(plans, second, "plan");
  const store = { "run-1": first, "run-2": second };
  assert.equal(previousRun(plan, store, "run-2")?.id, "run-1");
  assert.equal(previousRun(plan, store, "run-1"), undefined);
  assert.equal(previousRun(undefined, store, "run-1"), undefined);
});

test("a plan whose stored analysis was forgotten still resolves by position", () => {
  const plan: Plan = {
    id: "p",
    text: "plan",
    title: "t",
    createdAt: "2026-11-01T00:00:00Z",
    updatedAt: "2026-11-02T00:00:00Z",
    runs: [
      { analysisId: "gone", at: "2026-11-01T00:00:00Z", claims: 3 },
      { analysisId: "here", at: "2026-11-02T00:00:00Z", claims: 3 },
    ],
  };
  assert.equal(previousRun(plan, { here: { ...analysis([claim()]), id: "here" } }, "here"), undefined);
});
