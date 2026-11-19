import { describeProvider, hasApiKey, structuredPass } from "@/lib/ai";
import { ExtractionOutputSchema } from "@/lib/schema";
import { runPipeline } from "@/lib/pipeline";
import type { PipelineEvent } from "@/lib/schema";

/**
 * Ask the deployment, in its own words, whether its model works.
 *
 * The question this exists to answer: production holds the only model key, and
 * nobody outside can reach it — the sandbox has no key and cannot make an HTTPS
 * request to the deployment at all, and every page reader available shouts "failed"
 * for any status code it did not expect. So the only place this can be asked is
 * inside, and the only thing worth asking is the one thing health cannot say:
 * does the key Vercel holds actually return schema-valid claims?
 *
 *   GET /api/check/<token>            environment: provider, model, key present
 *   GET /api/check/<token>/extract    one real extraction pass on a fixed sample
 *   GET /api/check/<token>/pipeline   all five passes on the same sample
 *
 * Off unless CHECK_TOKEN is set. Everything happens in-process — a deployment
 * cannot reliably reach itself over localhost, and it should not have to.
 *
 * Nothing is persisted: the store gets no `persist`, so a check can never leave
 * a sample analysis behind in someone's workspace.
 */

export const runtime = "nodejs";
export const maxDuration = 300;

const SAMPLE = `We are launching a subscription meal-prep service for remote workers in Kigali.

The plan: one kitchen, four rotating menus, delivery between 11:00 and 13:00 on weekdays.
We will charge 45,000 RWF per month for 20 lunches, which undercuts the restaurants our
customers use today by about 30%. Our unit cost is 1,100 RWF per meal, so gross margin is
roughly 50% before delivery.

We expect 400 subscribers within six months based on the size of the coworking community.
Two riders can cover the whole city. We will not need a permit because we are cooking from
a home kitchen. Customers will prepay monthly, so we do not need working capital.

The founder has cooked professionally for three years and has 900 Instagram followers.`;

export async function GET(
  request: Request,
  context: { params: Promise<{ args?: string[] }> }
) {
  /**
   * Every outcome is a 200 with the verdict in the body.
   *
   * A diagnostic whose only clients read pages cannot read a 401 or a 500 — they
   * just see "failed", with no clue which failure. Status codes are for the app;
   * this route is a tool, and a tool answers in words.
   */
  const answer = (payload: Record<string, unknown>) => Response.json({ tool: "check", ...payload });

  const expected = process.env.CHECK_TOKEN;
  if (!expected) {
    return answer({
      ok: false,
      enabled: false,
      reason: "CHECK_TOKEN is not set on this deployment, so the check is off.",
    });
  }

  const { args = [] } = await context.params;
  const [token, ...rest] = args.flatMap((a) => a.split("/")).filter(Boolean);

  if (!token || !sameSecret(token, expected)) {
    return answer({
      ok: false,
      enabled: true,
      reason: "That token is not the one this deployment expects.",
      // Lengths only: enough to tell a stale value from an unset one, and not
      // enough to recover either secret.
      diagnostics: { receivedLength: token?.length ?? 0, expectedLength: expected.length },
    });
  }

  const route = rest[0] ?? "env";

  if (route === "env") {
    return answer({
      ok: true,
      env: {
        vercelEnv: process.env.VERCEL_ENV ?? null,
        region: process.env.VERCEL_REGION ?? null,
        commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      },
      ...describeProvider(),
      keyPresent: hasApiKey(),
      storage: process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? "supabase" : "local",
    });
  }

  if (!hasApiKey()) {
    return answer({
      ok: false,
      reason: "No model key on this deployment — nothing to test.",
      ...describeProvider(),
    });
  }

  if (route === "extract") {
    const started = Date.now();
    try {
      const pass = await structuredPass({
        system: "You extract the assumptions a plan rests on.",
        user: `THE PLAN\n\n${SAMPLE}\n\nExtract the claims the author states.`,
        schema: ExtractionOutputSchema,
        maxTokens: 4096,
      });
      return answer({
        ok: pass.data.claims.length > 0,
        asked: "one extraction pass",
        ms: Date.now() - started,
        ...describeProvider(),
        modelAnswered: pass.model,
        claims: pass.data.claims.length,
        summary: pass.data.summary?.slice(0, 200) ?? null,
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
      return answer({
        ok: false,
        asked: "one extraction pass",
        ms: Date.now() - started,
        ...describeProvider(),
        error: error instanceof Error ? error.message.slice(0, 600) : String(error),
      });
    }
  }

  if (route === "pipeline") {
    const started = Date.now();
    const stages: { stage: string; ms: number }[] = [];
    const errors: { stage: string; message: string }[] = [];
    let current = "start";
    let mark = started;
    let claims = 0;
    let tests = 0;
    let evidence = 0;

    try {
      const analysis = await runPipeline(SAMPLE, (event: PipelineEvent) => {
        if (event.type === "error") {
          errors.push({ stage: current, message: event.message.slice(0, 300) });
          return;
        }
        if (event.type !== "stage") return;
        const now = Date.now();
        stages.push({ stage: current, ms: now - mark });
        current = event.stage;
        mark = now;
      });
      claims = analysis.claims.length;
      tests = analysis.claims.filter((c) => c.test).length;
      evidence = analysis.claims.filter((c) => (c.evidence?.length ?? 0) > 0).length;
    } catch (error) {
      return answer({
        ok: false,
        asked: "all five passes",
        ms: Date.now() - started,
        ...describeProvider(),
        stages,
        errors,
        error: error instanceof Error ? error.message.slice(0, 600) : String(error),
      });
    }

    return answer({
      ok: claims > 0 && errors.length === 0,
      asked: "all five passes",
      ms: Date.now() - started,
      ...describeProvider(),
      stages,
      errors,
      claims,
      withTest: tests,
      withEvidence: evidence,
    });
  }

  return answer({
    ok: false,
    reason: "Unknown check. Use the token alone, /extract, or /pipeline.",
  });
}

function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
