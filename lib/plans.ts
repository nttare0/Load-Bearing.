import type { Analysis } from "./schema";

/**
 * Plans and their runs.
 *
 * The app used to treat each analysis as a one-off. A plan is the durable
 * thing; a run is one reading of it. Keeping them apart is what allows "this
 * plan, again" to mean a comparison instead of a second unrelated report.
 *
 * Browser storage only, like workspaces. The server stores single analyses and
 * knows nothing about plan identity, which keeps the shared link honest: it
 * shows one run, not a history the reader cannot verify.
 */

export type Plan = {
  id: string;
  /** The plan text as last analysed. Re-running uses this unless it is edited. */
  text: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  /** Oldest first. Each id points at an Analysis held by the dashboard. */
  runs: { analysisId: string; at: string; claims: number }[];
};

const KEY = "load-bearing:plans";

export function readPlans(): Plan[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isPlan);
  } catch {
    return [];
  }
}

export function writePlans(plans: Plan[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(plans));
  } catch {
    // Quota: plan history is a convenience, never the source of truth.
  }
}

function isPlan(value: unknown): value is Plan {
  if (!value || typeof value !== "object") return false;
  const p = value as Partial<Plan>;
  return typeof p.id === "string" && typeof p.text === "string" && Array.isArray(p.runs);
}

/** The plan whose latest run is `analysisId`, if any. */
export function planForRun(plans: Plan[], analysisId: string): Plan | undefined {
  return plans.find((plan) => plan.runs.some((run) => run.analysisId === analysisId));
}

/**
 * Record a run against a plan.
 *
 * Matching is by planId first (set when the user re-runs deliberately), then by
 * identical plan text — because re-pasting the same plan is the same plan, even
 * if the app was reloaded since.
 */
export function recordRun(
  plans: Plan[],
  analysis: Analysis,
  text: string
): { plans: Plan[]; plan: Plan; isRerun: boolean } {
  const now = new Date().toISOString();
  const trimmed = text.trim();

  const existing =
    plans.find((plan) => plan.id === analysis.planId) ??
    plans.find((plan) => plan.text.trim() === trimmed);

  const run = { analysisId: analysis.id, at: analysis.createdAt, claims: analysis.claims.length };

  if (existing) {
    const next: Plan = {
      ...existing,
      text: trimmed,
      title: analysis.title,
      updatedAt: now,
      runs: [...existing.runs.filter((r) => r.analysisId !== analysis.id), run],
    };
    return {
      plans: plans.map((p) => (p.id === next.id ? next : p)),
      plan: next,
      isRerun: existing.runs.length > 0,
    };
  }

  const plan: Plan = {
    id: analysis.planId ?? analysis.id,
    text: trimmed,
    title: analysis.title,
    createdAt: analysis.createdAt,
    updatedAt: now,
    runs: [run],
  };
  return { plans: [plan, ...plans], plan, isRerun: false };
}

/** The run before `analysisId` for the same plan, if there is one. */
export function previousRun(
  plan: Plan | undefined,
  analyses: Record<string, Analysis>,
  analysisId: string
): Analysis | undefined {
  if (!plan) return undefined;
  const index = plan.runs.findIndex((run) => run.analysisId === analysisId);
  if (index <= 0) return undefined;
  return analyses[plan.runs[index - 1].analysisId];
}
