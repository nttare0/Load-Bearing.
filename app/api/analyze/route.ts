import { runPipeline } from "@/lib/pipeline";
import { hasApiKey } from "@/lib/ai";
import { NOT_A_PLAN_RESPONSE } from "@/lib/prompts";
import { saveAnalysis } from "@/lib/store";
import { demoAnalysis } from "@/lib/demo";
import { thinkingFor } from "@/lib/effort";
import { credentialFrom, withVisitor } from "@/lib/visitor";
import type { Analysis, PipelineEvent } from "@/lib/schema";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_INPUT = 24_000;

export async function POST(request: Request) {
  let body: { text?: unknown; persist?: unknown; effort?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send JSON with a text field." }, { status: 400 });
  }

  // A visitor's own key, when they brought one. Checked before anything runs:
  // a malformed key should be a sentence, not a five-pass failure.
  const { credential, error: credentialError } = credentialFrom(request);
  if (credentialError) {
    return Response.json({ error: credentialError }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const persist = body.persist === true;
  // The composer's hold-to-think. Anything unrecognised falls back to the
  // environment default rather than failing the run.
  const thinkingLevel = thinkingFor(body.effort);

  if (text.length < 40) {
    return Response.json({ error: NOT_A_PLAN_RESPONSE }, { status: 400 });
  }
  if (text.length > MAX_INPUT) {
    return Response.json(
      { error: `That's ${text.length.toLocaleString()} characters. The limit is ${MAX_INPUT.toLocaleString()} — trim to the parts that carry weight.` },
      { status: 413 }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: PipelineEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        // Everything that touches a model happens inside this scope, so the
        // visitor's key reaches all five passes without any of them knowing.
        await withVisitor(credential, async () => {
          if (!hasApiKey()) {
            // Demo mode: no key anywhere, so run the worked example from the
            // build plan through the same event stream. The UI is fully usable.
            await streamDemo(send);
            return;
          }

          await runPipeline(text, send, {
            ...(persist ? { persist: (analysis: Analysis) => saveAnalysis(analysis) } : {}),
            ...(thinkingLevel ? { thinkingLevel } : {}),
          });
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "The analysis failed for an unknown reason.";
        send({ type: "error", message: humanise(message) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

function humanise(message: string): string {
  if (/api[_ ]?key|authentication|401/i.test(message)) {
    return "The Anthropic API key was rejected. Check ANTHROPIC_API_KEY in your environment.";
  }
  if (/rate|429|overloaded|529/i.test(message)) {
    return "The AI provider is rate-limiting right now. Wait a minute and run it again.";
  }
  return message;
}

/**
 * Emits the worked example from the plan, same shape as a live run — including
 * the thinking steps, because the reasoning panel is part of the interface and
 * a demo that skipped it would be showing a different product.
 */
async function streamDemo(send: (event: PipelineEvent) => void) {
  const analysis = demoAnalysis();
  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const reason = (pass: string, kind: "think" | "found" | "check" | "warn", text: string, ms: number) =>
    send({ type: "reason", pass, kind, text, ms });

  send({
    type: "stage",
    stage: "extract",
    detail: "Demo mode — no key is configured, so this is the worked example from the build plan.",
  });
  reason("extract", "think", "reading the plan for claims it states outright", 420);
  await delay(500);
  reason("extract", "found", `found ${analysis.claims.length} claims the plan states`, 380);
  await delay(400);

  send({ type: "stage", stage: "premortem", detail: "Looking for what must be true that nobody wrote down." });
  reason("hidden", "think", "looking for what the plan depends on but never says", 300);
  await delay(400);
  reason("hidden", "warn", "demo mode does not call a model, so no hidden assumptions are generated", 200);
  await delay(300);

  send({
    type: "claims",
    claims: analysis.claims.map((c) => ({ ...c, test: null, evidence: [] })),
    summary: analysis.summary,
    title: analysis.title,
    notes: ["Running on the built-in example. Add a model key in Settings to analyse your own plan."],
  });

  reason("premortem", "found", `${analysis.failureModes.length} ways this most plausibly fails`, 700);
  send({ type: "failureModes", failureModes: analysis.failureModes });
  await delay(500);

  send({ type: "stage", stage: "evidence", detail: "Checking 2 checkable claims against public sources." });
  reason("evidence", "check", "checking 2 claims against public sources", 500);
  await delay(500);
  reason("evidence", "warn", "demo mode does not search, so nothing is verified", 120);
  send({ type: "evidence", evidence: [], notes: ["Demo mode does not call the web."] });
  await delay(400);

  send({ type: "stage", stage: "tests", detail: "Designing the cheapest disproof for the top claims." });
  reason("tests", "think", "designing the cheapest disproof for the top claims", 300);
  await delay(400);
  reason("tests", "found", `${analysis.claims.filter((c) => c.test).length} tests designed, cheapest first`, 220);
  send({ type: "tests", claims: analysis.claims });
  await delay(200);
  send({ type: "done", analysis, persisted: false });
}
