import type { Claim, Confidence, RawClaim, Status } from "./schema";

/**
 * The scoring rubric, in code.
 *
 * The model proposes impact and confidence; this file decides what they mean.
 * Priority = impact x uncertainty, shown in bands so nobody reads a fake
 * second decimal into it.
 */

const UNCERTAINTY: Record<Confidence, number> = {
  high: 1,
  medium: 1.5,
  low: 2,
};

const CONFIDENCE_FOR_UNCERTAINTY: Record<Confidence, number> = {
  high: 1,
  medium: 2,
  low: 3,
};

/** impact x uncertainty, normalised to a 1-10 band. */
export function priorityOf(impact: number, confidence: Confidence): number {
  return Math.round(impact * UNCERTAINTY[confidence] * 10) / 10;
}

/** A priority as plain language, so the ranking is legible without a key. */
export function band(priority: number): "load-bearing" | "structural" | "light" {
  if (priority >= 8) return "load-bearing";
  if (priority >= 5) return "structural";
  return "light";
}

export function bandLabel(priority: number): string {
  const b = band(priority);
  if (b === "load-bearing") return "Load-bearing";
  if (b === "structural") return "Structural";
  return "Light partition";
}

/**
 * Two scoring runs that disagree is a signal, not a bug. When pass 4
 * lands on a different impact number we keep the wider one (the model should
 * not get to quietly soften a claim) and record the disagreement.
 */
export function reconcile(
  first: Pick<RawClaim, "impact" | "confidence">,
  audit: Pick<RawClaim, "impact" | "confidence"> | undefined
): { impact: number; confidence: Confidence; disagreement: number | null; note: string | null } {
  if (!audit) {
    return { impact: first.impact, confidence: first.confidence, disagreement: null, note: null };
  }

  const impactDisagreement = Math.abs(audit.impact - first.impact);
  const confidenceDisagreement = Math.abs(
    CONFIDENCE_FOR_UNCERTAINTY[audit.confidence] - CONFIDENCE_FOR_UNCERTAINTY[first.confidence]
  );

  const impact = Math.max(first.impact, audit.impact);
  const confidence =
    confidenceDisagreement >= 2
      ? first.confidence === "low" || audit.confidence === "low"
        ? "low"
        : "medium"
      : first.confidence;

  const notes: string[] = [];
  if (impactDisagreement > 0) {
    notes.push(
      `scoring runs disagreed on impact (${first.impact} vs ${audit.impact}); kept the higher`
    );
  }
  if (confidenceDisagreement >= 2) {
    notes.push(`scoring runs disagreed on confidence (${first.confidence} vs ${audit.confidence})`);
  }

  return {
    impact,
    confidence,
    disagreement: impactDisagreement,
    note: notes.length ? notes.join("; ") : null,
  };
}

/**
 * Safeguard #1: no invented evidence.
 * A "fact" label requires a URL. Without one it is downgraded to unverified.
 * "contradicted" also has to be backed by a URL, otherwise it is a guess
 * dressed up as a finding.
 */
export function enforceStatus(
  status: Status,
  evidenceUrls: number
): { status: Status; downgraded: boolean } {
  if ((status === "fact" || status === "contradicted") && evidenceUrls === 0) {
    return { status: "unverified", downgraded: true };
  }
  return { status, downgraded: false };
}

/** Rank + drop dangling dependency refs so the graph can always be drawn. */
export function rankAndCleanClaims(claims: Claim[]): Claim[] {
  const refs = new Set(claims.map((c) => c.ref));
  const cleaned = claims.map((c) => {
    const dependsOn = c.dependsOn.filter((ref) => ref !== c.ref && refs.has(ref));
    const evidence = c.evidence.filter((e) => {
      try {
        return Boolean(new URL(e.url));
      } catch {
        return false;
      }
    });
    const { status } = enforceStatus(c.status, evidence.length);
    return {
      ...c,
      dependsOn,
      evidence,
      status,
      priority: priorityOf(c.impact, c.confidence),
    };
  });

  return cleaned
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      if (b.impact !== a.impact) return b.impact - a.impact;
      return a.claim.localeCompare(b.claim);
    })
    .map((c, i) => ({ ...c, rank: i + 1 }));
}

/**
 * A tiny sanity check on claims: anything that is really a restatement of a
 * claim we already have gets folded into it rather than shown twice.
 */
export function dedupeClaims<T extends { claim: string }>(claims: T[]): T[] {
  const seen: string[] = [];
  return claims.filter((c) => {
    const key = normalise(c.claim);
    if (!key) return false;
    const duplicate = seen.some((s) => similarity(s, key) > 0.82);
    if (duplicate) return false;
    seen.push(key);
    return true;
  });
}

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Jaccard word overlap. Crude, but enough to catch "users will pay" vs "users pay". */
function similarity(a: string, b: string): number {
  const A = new Set(a.split(" ").filter((w) => w.length > 3));
  const B = new Set(b.split(" ").filter((w) => w.length > 3));
  if (!A.size || !B.size) return 0;
  let shared = 0;
  A.forEach((w) => {
    if (B.has(w)) shared += 1;
  });
  return shared / (A.size + B.size - shared);
}

/** A readable title from the plan, without asking the model again. */
export function deriveTitle(input: string): string {
  const firstLine = input
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 12);
  const base = (firstLine ?? input).replace(/^#+\s*/, "").replace(/\s+/g, " ");
  const clipped = base.length > 62 ? `${base.slice(0, 59).trimEnd()}...` : base;
  return clipped || "Untitled plan";
}
