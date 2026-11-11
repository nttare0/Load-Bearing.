import assert from "node:assert/strict";
import { test } from "node:test";
import { isVerbatim, judgeSource } from "../lib/quotes";
import { heuristicClaims, heuristicTitle } from "../lib/heuristic";
import { priorityOf, rankAndCleanClaims } from "../lib/score";
import type { Claim } from "../lib/schema";

/**
 * Three promises, tested:
 *   1. a quote either appears in the plan or it is labelled a paraphrase.
 *   2. a report still exists when no model answers.
 *   3. the number behind the band is the number the ranking used.
 */

const PLAN = `We are launching a subscription meal-prep service for remote workers in Kigali.

The plan: one kitchen, four rotating menus, delivery between 11:00 and 13:00 on weekdays.
We will charge 45,000 RWF per month for 20 lunches, which undercuts the restaurants our
customers use today by about 30%. Our unit cost is 1,100 RWF per meal, so gross margin is
roughly 50% before delivery.

We expect 400 subscribers within six months based on the size of the coworking community.
Two riders can cover the whole city. We will not need a permit because we are cooking from
a home kitchen.`;

test("a real quote is accepted, punctuation and curly quotes and all", () => {
  assert.equal(isVerbatim("We will charge 45,000 RWF per month for 20 lunches", PLAN), true);
  assert.equal(isVerbatim("we will not need a permit", PLAN), true);
  // Typographic drift is forgiven: the words are the words.
  assert.equal(isVerbatim("Our unit cost is 1,100 RWF per meal", PLAN), true);
});

test("an ellipsis may join two phrases that are both in the plan, in order", () => {
  assert.equal(isVerbatim("We expect 400 subscribers within six months … Two riders can cover", PLAN), true);
  // Out of order is not a quote.
  assert.equal(isVerbatim("Two riders can cover … We expect 400 subscribers", PLAN), false);
});

test("a paraphrase wearing quotation marks is caught", () => {
  // The one thing this check exists for: same meaning, different words.
  assert.equal(isVerbatim("We will charge 45,000 RWF monthly for twenty lunches", PLAN), false);
  assert.equal(isVerbatim("We think 400 people will subscribe within half a year", PLAN), false);

  const verdict = judgeSource("We think 400 people will subscribe within half a year", PLAN);
  assert.equal(verdict.status, "paraphrase");
  // The text is kept — it is still informative — but it is no longer presented
  // as a quote.
  assert.equal(verdict.source, "We think 400 people will subscribe within half a year");
});

test("a model saying 'implied' is believed, because there is nothing to check", () => {
  const verdict = judgeSource("implied", PLAN);
  assert.equal(verdict.status, "implied");
  assert.equal(verdict.source, "implied");
});

test("a quote too short to mean anything is not accepted as verbatim", () => {
  assert.equal(isVerbatim("the", PLAN), false);
  assert.equal(isVerbatim("", PLAN), false);
});

test("the heuristic extractor finds the sentences that carry weight", () => {
  const claims = heuristicClaims(PLAN);

  assert.ok(claims.length >= 4, `expected at least 4 claims, got ${claims.length}`);
  assert.ok(claims.length <= 8);

  // Every heuristic claim is quoted from the text, so the quote check passes by
  // construction. If this fails, the extractor is inventing.
  for (const claim of claims) {
    assert.equal(claim.sourceStatus, "verbatim", `${claim.ref} quote is not from the plan`);
    assert.ok(isVerbatim(claim.source, PLAN), `${claim.ref}: "${claim.source}"`);
  }

  // The number-bearing and permit sentences are the ones worth surfacing.
  const text = claims.map((c) => c.claim.toLowerCase()).join(" ");
  assert.match(text, /45,000|permit|subscribers/);

  // Nothing from here may be typed as a fact, and nothing may claim high
  // confidence, because no evidence was gathered for it.
  for (const claim of claims) {
    assert.notEqual(claim.status, "fact");
    assert.equal(claim.confidence, "low");
    assert.equal(claim.verifiable, false, "a heuristic cannot know what the web settles");
    assert.equal(claim.heuristic, true);
  }

  // Refs are assigned in order and ids are unique, so the graph and keys hold.
  assert.deepEqual(
    claims.map((c) => c.ref),
    claims.map((_, i) => `C${i + 1}`)
  );
  assert.equal(new Set(claims.map((c) => c.id)).size, claims.length);
});

test("the heuristic extractor will not manufacture claims from prose that asserts nothing", () => {
  const empty = heuristicClaims("The. A. It. Hello there friend. Nothing here at all.");
  assert.deepEqual(empty, []);
});

test("a title is derived without a model", () => {
  assert.ok(heuristicTitle(PLAN).length > 0);
  assert.ok(heuristicTitle(PLAN).length <= 80);
});

test("the priority shown is the priority the ranking used", () => {
  // The band is a word; if the number under it came from somewhere else, the
  // list would be sorted by one thing and read as another.
  function claim(ref: string, impact: number, confidence: Claim["confidence"]): Claim {
    return {
      id: ref,
      ref,
      claim: "A claim that is long enough to be real.",
      source: "implied",
      category: "market",
      status: "guess",
      impact,
      confidence,
      dependsOn: [],
      verifiable: true,
      reasoning: "Because the rubric says so.",
      rank: 0,
      priority: priorityOf(impact, confidence),
      evidence: [],
      test: null,
    };
  }

  const ranked = rankAndCleanClaims([
    claim("C1", 2, "low"),
    claim("C2", 5, "high"),
    claim("C3", 4, "medium"),
  ]);

  // Recompute from the fields the card displays, and compare to the sort order.
  for (const item of ranked) {
    assert.equal(item.priority, priorityOf(item.impact, item.confidence));
  }
  assert.deepEqual(
    ranked.map((c) => c.ref),
    [...ranked].sort((a, b) => b.priority - a.priority).map((c) => c.ref)
  );
});
