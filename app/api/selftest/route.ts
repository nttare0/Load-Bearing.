import { runPipeline } from "@/lib/pipeline";
import { structuredPass } from "@/lib/ai";
import { ExtractionOutputSchema } from "@/lib/schema";
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

/**
 * Off in production unless explicitly switched on.
 *
 * Every call spends real model requests — five passes for the full run — so a
 * public URL that any crawler or idle loop can hit is a way to empty someone's
 * quota in an afternoon. Set ALLOW_SELFTEST=1 to enable it in production.
 */
function allowed(): boolean {
  if (process.env.VERCEL_ENV !== "production") return true;
  return process.env.ALLOW_SELFTEST === "1";
}

export async function GET(request: Request) {
  if (!allowed()) {
    return Response.json(
      { error: "The self-test is off in production. Set ALLOW_SELFTEST=1 to enable it." },
      { status: 404 }
    );
  }

  const providerInfo = describeProvider();
  if (!hasApiKey()) {
    return Response.json({ ok: false, reason: "no key configured — nothing to test" }, { status: 409 });
  }

  // `?only=extract` runs just the first pass. Five passes take minutes and the
  // browser, a proxy or a cold start will give up long before that — but a
  // single pass answers the only question worth asking first: does this key,
  // this model and this schema produce valid claims, and how long does it take?
  const only = new URL(request.url).searchParams.get("only");
  if (only === "extract") {
    const t0 = Date.now();
    try {
      const pass = await structuredPass({
        system: "You extract the assumptions a plan rests on.",
        user: `THE PLAN\n\n${SAMPLE}\n\nExtract the claims the author states.`,
        schema: ExtractionOutputSchema,
        maxTokens: 4096,
      });
      return Response.json({
        ok: pass.data.claims.length > 0,
        ...providerInfo,
        ms: Date.now() - t0,
        model: pass.model,
        claims: pass.data.claims.length,
        summary: pass.data.summary?.slice(0, 200),
        tokens: { in: pass.inputTokens, out: pass.outputTokens },
        retries: pass.retries,
        sample: pass.data.claims.slice(0, 4).map((c) => ({
          ref: c.ref,
          status: c.status,
          impact: c.impact,
          claim: c.claim.slice(0, 110),
        })),
      });
    } catch (error) {
      return Response.json(
        { ok: false, ...providerInfo, ms: Date.now() - t0, error: error instanceof Error ? error.message.slice(0, 400) : String(error) },
        { status: 502 }
      );
    }
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
      // Every stage event marks a boundary: the previous stage ended here and
      // this one begins. An error carries the stage it came from.
      if (event.type === "error") {
        stageErrors.push({ stage: lastStage as StageError["stage"], message: event.message });
        return;
      }
      if (event.type !== "stage") return;
      const now = Date.now();
      stages.push({ stage: lastStage, ms: now - lastMark });
      lastStage = event.stage;
      lastMark = now;
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

  const everyFactCited = claims.every((claim) => claim.status !== "fact" || (claim.evidence?.length ?? 0) > 0);

  return Response.json({
    // Passing means claims came back, they were scored, and nothing claiming to
    // be a fact went without a citation. The third is the whole point of the app.
    ok: claims.length > 0 && scored.length > 0 && everyFactCited,
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
