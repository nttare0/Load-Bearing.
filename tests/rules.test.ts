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
