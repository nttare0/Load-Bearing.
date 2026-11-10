import type { Analysis, Claim, Outcome } from "./schema";
import { band } from "./score";

/**
 * What the tests have actually settled.
 *
 * This is derived, never stored: it reads the outcomes off the claims every
 * time, so a shared link and the owner's view cannot drift apart, and there is
 * no second copy of the truth to keep in sync.
 */

export type Progress = {
  total: number;
  tested: number;
  confirmed: number;
  broken: number;
  inconclusive: number;
  /** Not tested yet, in rank order. */
  untested: Claim[];
  /** Claims whose test result means the plan needs rethinking. */
  brokenClaims: Claim[];
  /** What still carries the plan and has not been checked. */
  untestedLoadBearing: Claim[];
  /** 0-1. Tested over total, for the bar and for sentences. */
  coverage: number;
  /** Nothing has been run yet — the page should not pretend otherwise. */
  isEmpty: boolean;
};

export function progressOf(analysis: Analysis): Progress {
  const claims = analysis.claims;
  const result = (claim: Claim): Outcome | undefined => claim.outcome?.result;

  const confirmed = claims.filter((c) => result(c) === "confirmed");
  const broken = claims.filter((c) => result(c) === "broken");
  const inconclusive = claims.filter((c) => result(c) === "inconclusive");
  const untested = claims.filter((c) => !c.outcome).sort((a, b) => a.rank - b.rank);

  return {
    total: claims.length,
    tested: confirmed.length + broken.length + inconclusive.length,
    confirmed: confirmed.length,
    broken: broken.length,
    inconclusive: inconclusive.length,
    untested,
    brokenClaims: broken,
    untestedLoadBearing: untested.filter((c) => band(c.priority) === "load-bearing"),
    coverage: claims.length === 0 ? 0 : (confirmed.length + broken.length + inconclusive.length) / claims.length,
    isEmpty: claims.every((c) => !c.outcome),
  };
}

/**
 * The one sentence worth putting at the top of a report. Deliberately not
 * cheerful: an untested load-bearing claim is the thing this app exists to
 * make visible, so that is what it says first.
 */
export function verdict(progress: Progress): string {
  if (progress.isEmpty) {
    return progress.total === 0
      ? "No claims to test."
      : `${count(progress.total, "claim")}, none tested yet.`;
  }
  if (progress.broken > 0) {
    return `${count(progress.broken, "claim")} broke. Rework the plan around what held before spending more.`;
  }
  if (progress.untestedLoadBearing.length > 0) {
    return `${count(progress.tested, "claim")} tested and nothing broke, but ${progress.untestedLoadBearing.length} load-bearing ${progress.untestedLoadBearing.length === 1 ? "claim is" : "claims are"} still unchecked.`;
  }
  if (progress.untested.length > 0) {
    return `${count(progress.tested, "claim")} tested, nothing load-bearing left untested. ${progress.untested.length} lighter ones remain.`;
  }
  return `All ${progress.total} tested. Nothing left to guess at.`;
}

function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}
