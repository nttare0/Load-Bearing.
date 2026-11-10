import { runPipeline } from "@/lib/pipeline";
import { hasApiKey } from "@/lib/ai";
import { NOT_A_PLAN_RESPONSE } from "@/lib/prompts";
import { saveAnalysis } from "@/lib/store";
import { demoAnalysis } from "@/lib/demo";
import type { PipelineEvent } from "@/lib/schema";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_INPUT = 24_000;

export async function POST(request: Request) {
  let body: { text?: unknown; persist?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send JSON with a text field." }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const persist = body.persist === true;

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
        if (!hasApiKey()) {
          // Demo mode: no key configured, so run the worked example from the
          // build plan through the same event stream. The UI is fully usable.
          await streamDemo(send);
          return;
        }

        await runPipeline(
          text,
          send,
          persist ? { persist: (analysis) => saveAnalysis(analysis) } : {}
        );
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

/** Emits the worked example from the plan, same shape as a live run. */
async function streamDemo(send: (event: PipelineEvent) => void) {
  const analysis = demoAnalysis();
  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  send({ type: "stage", stage: "extract", detail: "Demo mode — no ANTHROPIC_API_KEY set, so this is the worked example from the build plan." });
  await delay(500);
  send({ type: "stage", stage: "premortem", detail: "Looking for what must be true that nobody wrote down." });
  await delay(400);
  send({
    type: "claims",
    claims: analysis.claims.map((c) => ({ ...c, test: null, evidence: [] })),
    summary: analysis.summary,
    title: analysis.title,
    notes: ["Running on the built-in example. Add ANTHROPIC_API_KEY to analyse your own plan."],
  });
  await delay(700);
  send({ type: "failureModes", failureModes: analysis.failureModes });
  await delay(500);
  send({ type: "stage", stage: "evidence", detail: "Checking 2 checkable claims against public sources." });
  await delay(500);
  send({ type: "evidence", evidence: [], notes: ["Demo mode does not call the web."] });
  await delay(400);
  send({ type: "stage", stage: "tests", detail: "Designing the cheapest disproof for the top claims." });
  await delay(500);
  send({ type: "tests", claims: analysis.claims });
  await delay(200);
  send({ type: "done", analysis, persisted: false });
}
