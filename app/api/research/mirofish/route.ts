import { MIROFISH_COST_WARNING, MIROFISH_LABEL, mirofishConfig, simulate } from "@/lib/mirofish";
import type { Prediction } from "@/lib/mirofish";

export const runtime = "nodejs";
// A run is: graph build, persona generation, up to 40 rounds, then a report.
// This is the ceiling Vercel allows; the client streams progress rather than
// waiting on a silent request.
export const maxDuration = 300;

/**
 * One simulation, about one question, for one existing plan.
 *
 * This route is a research tool, not part of the pipeline. It cannot create a
 * claim, change a score, or enter an evidence array — the response type here
 * has no field that could carry a claim or a URL. What it returns is a
 * prediction, labelled as one, for a human to read and disagree with.
 */

type Body = {
  question?: string;
  planText?: string;
  claims?: { ref: string; claim: string }[];
};

const LIMITS = { question: 500, planText: 10_000, claims: 16 } as const;

export async function POST(request: Request) {
  const config = mirofishConfig();
  if (!config) {
    return Response.json(
      {
        error: "MiroFish is not enabled. It needs MIROFISH_BASE_URL and MIROFISH_RESEARCH=1.",
        label: MIROFISH_LABEL,
      },
      { status: 409 }
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const question = (body.question ?? "").trim();
  if (question.length < 10) {
    return Response.json(
      { error: "Ask a question about the plan — something with an outcome, not a topic. “Will 400 subscribers sign up in six months?”" },
      { status: 400 }
    );
  }
  if (question.length > LIMITS.question) {
    return Response.json({ error: `Keep the question under ${LIMITS.question} characters.` }, { status: 413 });
  }

  // The simulation needs something to be about. If no claims are supplied there
  // is nothing to attach a prediction to, and a report about nothing is exactly
  // the failure mode this route is built to avoid.
  const claims = (body.claims ?? [])
    .filter((c) => typeof c?.ref === "string" && typeof c?.claim === "string")
    .slice(0, LIMITS.claims)
    .map((c) => ({ ref: c.ref.slice(0, 8), claim: c.claim.slice(0, 400) }));
  if (claims.length === 0) {
    return Response.json(
      { error: "Run an analysis first. A simulation needs claims to bear on, or it just invents a world." },
      { status: 400 }
    );
  }

  const planText = (body.planText ?? "").slice(0, LIMITS.planText);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      send({ type: "start", label: MIROFISH_LABEL, warning: MIROFISH_COST_WARNING });

      const result = await simulate({ question, planText, claims }, (stage, detail) => {
        send({ type: "stage", stage, detail });
      });

      if (!result.ok) {
        send({
          type: "error",
          error: result.error ?? "The simulation failed.",
          note: "The report is untouched. Nothing from a failed run is written anywhere.",
          stages: result.stages,
        });
        controller.close();
        return;
      }

      send({
        type: "done",
        // The word "prediction" is in the payload and on the screen, because
        // nobody should be able to read this list and mistake it for findings.
        predictions: result.predictions.map((p: Prediction) => ({ ...p, kind: "prediction" as const })),
        rounds: result.rounds,
        ms: result.ms,
        label: MIROFISH_LABEL,
        warning: MIROFISH_COST_WARNING,
        note: "Simulated behaviour, not observation. Nothing here can support a fact, contradict a claim, or enter an evidence list — it is a hypothesis with a narrative attached.",
        ...(result.warnings.length ? { warnings: result.warnings } : {}),
      });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
