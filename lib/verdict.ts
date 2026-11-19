import type { Analysis, Claim } from "@/lib/schema";
import { bandLabel } from "@/lib/score";

/**
 * The answer, in one sentence.
 *
 * The product exists to say which assumption would sink the plan and how cheaply
 * it can be tested. That sentence used to live nowhere: you had to open a tab,
 * find claim #1 and read three badges before reaching it. This derives it once,
 * in one place, so the top of the page can state it and the export can repeat it
 * word for word.
 *
 * Derivation, not authorship: every part of the sentence comes from the claim
 * itself. When the model gave no test, the sentence says so rather than inventing
 * one — "no test yet" is a fact about the report, and the report should own it.
 */

export type Verdict = {
  claim: Claim | null;
  /** One sentence: what could sink this, and what to do about it. */
  headline: string;
  /** The claim's own words, for the line under the headline. */
  detail: string;
  /** The cheapest test, if the model designed one. */
  test: { method: string; cost: string; time: string; confirms: string; breaks: string } | null;
  /** How many claims are load-bearing, so "the rest" is quantified. */
  others: number;
  /** True when nothing has been run against this report yet. */
  untouched: boolean;
};

function sentence(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  const body = trimmed.replace(/[.!?]+$/, "");
  return `${body}.`;
}

export function verdictOf(analysis: Analysis): Verdict {
  const claims = analysis.claims;
  const untouched = claims.every((claim) => !claim.outcome);

  if (claims.length === 0) {
    return {
      claim: null,
      headline: "This run found no claims — a failure of the run, not a clean bill of health.",
      detail:
        "Nothing here says the plan is sound; it says the model returned nothing. Paste a longer plan, or run it again.",
      test: null,
      others: 0,
      untouched,
    };
  }

  // The list is already ranked, but say the rule out loud rather than trusting
  // it. Ties break on ref so the same report always yields the same sentence:
  // a headline that changes when the array is reordered is not a fact.
  const top = [...claims].sort(
    (a, b) => b.priority - a.priority || a.ref.localeCompare(b.ref, undefined, { numeric: true })
  )[0];
  const others = claims.filter((c) => c !== top && c.priority >= 8).length;

  const band = bandLabel(top.priority).toLowerCase();
  const opening =
    top.priority >= 8
      ? `The ${band} assumption is this plan is standing on`
      : top.priority >= 5
        ? `The most structural assumption in this plan`
        : `Nothing here is load-bearing; the biggest open question`;

  const headline = top.test
    ? `${opening}: ${sentence(top.test.breaks)}`
    : `${opening} has no test yet, so it is still an open gamble.`;

  return {
    claim: top,
    headline,
    detail: sentence(top.claim),
    test: top.test
      ? {
          method: top.test.method,
          cost: top.test.cost,
          time: top.test.time,
          confirms: top.test.confirms,
          breaks: top.test.breaks,
        }
      : null,
    others,
    untouched,
  };
}
