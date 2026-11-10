import { runPipeline } from "@/lib/pipeline";
import { describeProvider, hasApiKey } from "@/lib/ai";
import type { Analysis, PipelineEvent } from "@/lib/schema";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Runs the whole five-pass pipeline on a fixed sample and reports what came
 * back. It exists because the interesting failure in this app is not "the
 * route throws" — it is "the model answered, and every claim is quietly wrong
 * or empty". Only a real run can tell those apart.
 *
 * It never persists anything: the store is passed no `persist`, so a self-test
 * cannot leave a sample analysis in someone's workspace.
 */

const SAMPLE = `We are launching a subscription meal-prep service for remote workers in Kigali.

The plan: one kitchen, four rotating menus, delivery between 11:00 and 13:00 on weekdays.
We will charge 45,000 RWF per month for 20 lunches, which undercuts the restaurants our
customers use today by about 30%. Our unit cost is 1,100 RWF per meal, so gross margin is
roughly 50% before delivery.

We expect 400 subscribers within six months based on the size of the coworking community.
Two riders can cover the whole city. We will not need a permit because we are cooking from
a home kitchen. Customers will prepay monthly, so we do not need working capital.

The founder has cooked professionally for three years and has 900 Instagram followers.`;

type StageTiming = { stage: string; ms: number };
type StageError = { stage: "extract" | "premortem" | "score" | "evidence" | "tests" | "unknown"; message: string };

export async function GET() {
  const providerInfo = describeProvider();
  if (!hasApiKey()) {
    return Response.json({ ok: false, reason: "no key configured — nothing to test" }, { status: 409 });
  }

  const started = Date.now();
  const stages: StageTiming[] = [];
  const stageErrors: StageError[] = [];
  let lastStage = "unknown";
  let lastMark = started;

  let analysis: Analysis | null = null;
  let failure: string | null = null;

  try {
    analysis = await runPipeline(SAMPLE, (event: PipelineEvent) => {
      if (event.type !== "stage") return;
      const now = Date.now();
      stages.push({ stage: lastStage, ms: now - lastMark });
      lastStage = event.stage;
      lastMark = now;
      // A stage that emits an error event is a pass that threw; record where.
      if (event.type === "stage" && event.detail && /fail|error/i.test(event.detail)) {
        stageErrors.push({ stage: event.stage, message: event.detail });
      }
    });
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
  }

  if (!analysis) {
    return Response.json(
      {
        ok: false,
        ...providerInfo,
        failedAt: lastStage,
        stages,
        error: failure,
        ms: Date.now() - started,
      },
      { status: 502 }
    );
  }

  const claims = analysis.claims ?? [];
  const withRefs = claims.filter((claim) => claim.ref);
  const scored = claims.filter((claim) => typeof claim.priority === "number");
  const cited = claims.filter((claim) => (claim.evidence?.length ?? 0) > 0);

  return Response.json({
    ok: claims.length > 0 && scored.length > 0,
    ...providerInfo,
    ms: Date.now() - started,
    stages,
    counts: {
      claims: claims.length,
      refs: withRefs.length,
      scored: scored.length,
      dependencies: claims.reduce((n, claim) => n + (claim.dependsOn?.length ?? 0), 0),
      tests: claims.filter((claim) => claim.test).length,
      failureModes: analysis.failureModes?.length ?? 0,
      notes: analysis.notes?.length ?? 0,
      // Under Gemini the evidence pass is skipped by design. A claim typed as
      // `fact` with no citation would be the one thing this app must never do,
      // so it is counted explicitly rather than assumed absent.
      cited: cited.length,
      factsWithoutCitation: claims.filter((c) => c.status === "fact" && (c.evidence?.length ?? 0) === 0).length,
      unverified: claims.filter((claim) => claim.status === "unverified").length,
    },
    sample: {
      title: analysis.title,
      summary: analysis.summary?.slice(0, 160),
      topClaims: claims.slice(0, 3).map((claim) => ({
        ref: claim.ref,
        status: claim.status,
        impact: claim.impact,
        priority: claim.priority,
        evidence: claim.evidence?.length ?? 0,
        claim: claim.claim.slice(0, 120),
        hasTest: Boolean(claim.test),
      })),
    },
    stageErrors,
    notes: analysis.notes?.slice(0, 6),
  });
}
