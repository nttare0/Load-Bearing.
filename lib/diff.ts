import type { Analysis, Claim, Status } from "./schema";
import { band } from "./score";

/**
 * Re-runs.
 *
 * The same plan, analysed twice, produces two reports whose claims are worded
 * slightly differently every time. Comparing them by wording would show noise.
 * So a claim carries a stable `key` — its normalised statement — and when a
 * later run produces a claim with the same key, it is treated as the same
 * assumption being tested again, not a new one.
 *
 * What the user actually wants after a week of work is not a second report. It
 * is the answer to "what moved": which assumptions I killed, which I checked,
 * which are still exactly as unproven as they were on day one.
 */

/** Lowercase, strip punctuation and filler, keep the words that carry meaning. */
export function claimKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(the|a|an|and|or|but|that|this|these|those|will|would|can|could|is|are|was|were|be|been|of|to|for|in|on|at|by|with|from|as|it|its|their|our|we|they)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Attach the stable key to each claim. Existing evidence and outcomes are
 * carried over when the same assumption comes back, so a re-run never wipes
 * work the user has already done.
 */
export function assignKeys(
  claims: Claim[],
  previous?: Pick<Analysis, "claims">
): Claim[] {
  const before = new Map<string, Claim>();
  for (const claim of previous?.claims ?? []) {
    before.set(claim.key ?? claimKey(claim.claim), claim);
  }

  return claims.map((claim) => {
    const key = claimKey(claim.claim);
    const prior = before.get(key);
    const inheritedOutcome = prior?.outcome ?? claim.outcome;
    const inheritedEvidence = claim.evidence.length ? claim.evidence : (prior?.evidence ?? []);
    const status: Status =
      inheritedOutcome?.result === "confirmed"
        ? "fact"
        : inheritedOutcome?.result === "broken"
          ? "contradicted"
          : claim.status;
    return {
      ...claim,
      key,
      status,
      evidence: inheritedEvidence,
      outcome: inheritedOutcome,
    };
  });
}

export type ClaimMovement =
  /** A run produced this assumption for the first time. */
  | "new"
  /** The same assumption, still untested, but its weight changed. */
  | "reordered"
  /** The same assumption, same band, same status — nothing moved. */
  | "unchanged"
  /** A test result arrived since the previous run. */
  | "settled"
  /** It was in the earlier run and this one does not contain it. */
  | "dropped";

export type ClaimDiff = {
  claim: Claim;
  movement: ClaimMovement;
  /** Previous priority, when there is one to show. */
  was?: number;
  wasBand?: string;
  wasStatus?: Status;
};

export type RunDiff = {
  base: Analysis;
  latest: Analysis;
  claims: ClaimDiff[];
  counts: Record<ClaimMovement, number>;
  unchangedKeys: string[];
};

/**
 * Compare the latest run of a plan to the run before it.
 *
 * Deliberately quiet: an assumption that has not changed says nothing about
 * itself, and is only counted. A diff that flags everything is a diff nobody
 * reads.
 */
export function diffRuns(base: Analysis, latest: Analysis): RunDiff {
  const before = new Map<string, Claim>();
  for (const claim of base.claims) before.set(claim.key ?? claimKey(claim.claim), claim);

  const diffs: ClaimDiff[] = [];
  const seen = new Set<string>();

  for (const claim of latest.claims) {
    const key = claim.key ?? claimKey(claim.claim);
    const prior = before.get(key);
    if (!prior) {
      diffs.push({ claim, movement: "new" });
      continue;
    }
    seen.add(key);

    const settledNow = claim.outcome && claim.outcome.at !== prior.outcome?.at;
    const reordered = Math.abs(claim.priority - prior.priority) >= 0.5 || band(claim.priority) !== band(prior.priority);

    if (settledNow) {
      diffs.push({ claim, movement: "settled", was: prior.priority, wasBand: band(prior.priority), wasStatus: prior.status });
    } else if (reordered) {
      diffs.push({ claim, movement: "reordered", was: prior.priority, wasBand: band(prior.priority), wasStatus: prior.status });
    } else {
      diffs.push({ claim, movement: "unchanged", was: prior.priority, wasBand: band(prior.priority), wasStatus: prior.status });
    }
  }

  for (const claim of base.claims) {
    const key = claim.key ?? claimKey(claim.claim);
    if (!seen.has(key)) diffs.push({ claim, movement: "dropped", was: claim.priority, wasBand: band(claim.priority), wasStatus: claim.status });
  }

  const counts = { new: 0, reordered: 0, unchanged: 0, settled: 0, dropped: 0 };
  for (const d of diffs) counts[d.movement] += 1;

  return {
    base,
    latest,
    claims: diffs,
    counts,
    unchangedKeys: diffs.filter((d) => d.movement === "unchanged").map((d) => d.claim.key ?? claimKey(d.claim.claim)),
  };
}

/**
 * One sentence for the top of a re-run. Says the uncomfortable thing first:
 * work that did not move is the common case and the reason plans stall.
 */
export function diffVerdict(diff: RunDiff): string {
  const { counts } = diff;
  const moved = counts.settled + counts.reordered + counts.new + counts.dropped;
  if (moved === 0) {
    return counts.unchanged === 0
      ? "Nothing to compare."
      : `Nothing moved. All ${counts.unchanged} assumptions are exactly as unproven as they were last run.`;
  }
  const parts: string[] = [];
  if (counts.settled) parts.push(`${counts.settled} settled by a test`);
  if (counts.new) parts.push(`${counts.new} new`);
  if (counts.dropped) parts.push(`${counts.dropped} gone from this run`);
  if (counts.reordered) parts.push(`${counts.reordered} moved in the ranking`);
  parts.push(`${counts.unchanged} unchanged`);
  return `${parts.join(", ")}.`;
}
