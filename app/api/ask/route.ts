import { hasApiKey, prose } from "@/lib/ai";
import type { Analysis } from "@/lib/schema";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Ask about the work already in the workspace.
 *
 * This route is read-only on purpose: it is handed a summary of reports and can
 * only answer in prose. It cannot add a claim, change a score or mark a test —
 * the pipeline is the only thing that may create claims, because every claim
 * has to arrive with a quote, a score and a test. A research answer is not
 * evidence, and the interface says so next to anything this returns.
 */

type Turn = { role: "user" | "assistant"; content: string };

type Body = {
  question?: string;
  history?: Turn[];
  context?: {
    title?: string;
    summary?: string;
    claims?: (Pick<
      Analysis["claims"][number],
      "ref" | "claim" | "status" | "impact" | "confidence" | "priority" | "category" | "source" | "reasoning"
    > & { outcome?: string; testStop?: string })[];
    notes?: string[];
  };
};

const SYSTEM = `You are the research assistant inside Load-Bearing, a tool that finds the assumptions a plan depends on.

You are given the reports already in the user's workspace: claims, their scores, their statuses, and any test results the user recorded.

Rules, in order:
- Answer only from the workspace given to you. If the answer is not in it, say what is missing and what would settle it. Never invent a claim, a number, a source or a test result.
- Never describe something as "verified" — you did not search anything. If the user asks you to check the web, tell them to run a claim's test, which is where evidence comes from.
- Be brief. Two to five sentences unless asked to go long. No preamble, no restating the question.
- When you refer to a claim, name its ref (e.g. C3) so the user can find it.
- If the user asks what to do next, prefer the untested load-bearing claims.`;

/** Demo mode has no model, so it answers from the data it was given, honestly. */
function demoAnswer(body: Body): string {
  const claims = body.context?.claims ?? [];
  if (claims.length === 0) {
    return "There is no report in this workspace yet, so there is nothing to reason about. Paste a plan in the composer and I will extract the claims it rests on — then you can ask me about them.";
  }

  const untested = claims.filter((c) => !c.outcome);
  const loadBearing = untested.filter((c) => c.priority >= 8);
  const broken = claims.filter((c) => c.outcome === "broken");
  const question = (body.question ?? "").toLowerCase();

  if (/next|what should|priorit|start where/.test(question)) {
    if (loadBearing.length) {
      return `Start with ${loadBearing[0].ref} (${loadBearing[0].claim}) — it carries the most weight and nothing has been run against it yet. ${
        loadBearing[0].testStop ? `Your own stop condition: “${loadBearing[0].testStop}”.` : ""
      }${loadBearing.length > 1 ? ` ${loadBearing.length - 1} other load-bearing ${loadBearing.length - 1 === 1 ? "claim is" : "claims are"} also unchecked.` : ""}`;
    }
    return untested.length
      ? `Nothing load-bearing is untested. The highest-ranked open question is ${untested[0].ref} — ${untested[0].claim}`
      : "Every claim has a recorded result, so there is nothing left to test. Re-run the plan if you have changed it.";
  }

  if (broken.length) {
    return `${broken.length} ${broken.length === 1 ? "claim has" : "claims have"} broken — starting with ${broken[0].ref}: ${broken[0].claim}. Whatever depends on it needs rethinking before you spend more.`;
  }

  return `This workspace holds ${claims.length} ${claims.length === 1 ? "claim" : "claims"}, ${claims.length - untested.length} of them tested and ${loadBearing.length} load-bearing ones still unchecked. Demo mode: no ANTHROPIC_API_KEY is set, so I am answering from the report data rather than reasoning about it.`;
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const question = (body.question ?? "").trim();
  if (!question) return Response.json({ error: "Ask something." }, { status: 400 });
  if (question.length > 2000) {
    return Response.json({ error: "That question is long. Keep it under 2,000 characters." }, { status: 413 });
  }

  if (!hasApiKey()) {
    return Response.json({ answer: demoAnswer(body), mode: "demo" });
  }

  const context = body.context ?? {};
  const claims = (context.claims ?? [])
    .map(
      (c) =>
        `- ${c.ref} [${c.priority}/10, ${c.status}${c.outcome ? `, tested: ${c.outcome}` : ", untested"}] ${c.claim}\n  why it scored that way: ${c.reasoning}${c.testStop ? `\n  stop condition: ${c.testStop}` : ""}`
    )
    .join("\n");

  const workspace = `Report: ${context.title ?? "untitled"}
Summary: ${context.summary ?? "none"}
Claims:
${claims || "(none)"}
${context.notes?.length ? `\nPipeline notes:\n${context.notes.map((n) => `- ${n}`).join("\n")}` : ""}`;

  const history = (body.history ?? []).slice(-8).map((t) => ({
    role: t.role,
    content: t.content.slice(0, 4000),
  }));

  try {
    const { text } = await prose({
      system: SYSTEM,
      maxTokens: 1024,
      turns: [
        { role: "user", content: `Here is the workspace.\n\n${workspace}` },
        { role: "assistant", content: "Understood. I will answer only from this workspace." },
        ...history,
        { role: "user", content: question },
      ],
    });

    return Response.json({ answer: text || "The model returned nothing. Ask again.", mode: "live" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/rate|429|529|overloaded/i.test(message)) {
      return Response.json({ error: "The model is rate-limiting right now. Wait a minute." }, { status: 429 });
    }
    if (/api[_ ]?key|authentication|401/i.test(message)) {
      return Response.json({ error: "The Anthropic key was rejected." }, { status: 401 });
    }
    return Response.json({ error: "Research failed. The reports are untouched." }, { status: 502 });
  }
}
