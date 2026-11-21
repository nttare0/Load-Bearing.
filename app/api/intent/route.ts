import { hasApiKey, prose } from "@/lib/ai";
import { credentialFrom, withVisitor } from "@/lib/visitor";
import { guessIntent, intentSample, readIntent, INTENT_PROMPT } from "@/lib/intent";

export const runtime = "nodejs";
export const maxDuration = 20;

/**
 * Which path does this message take — plan or question?
 *
 * A separate, tiny route rather than a branch inside `/api/analyze`, because the
 * cost profile is different: this is one short call with 16 output tokens, and it
 * has to happen *before* we decide which of two expensive routes to call.
 *
 * It never fails the send. If there is no key, or the model is unreachable, or it
 * answers with something that is not a label, the caller gets `guessIntent` with
 * `"fallback": true` and the composer keeps working.
 */
export async function POST(request: Request) {
  let body: { text?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send JSON with a text field." }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (text.length < 2) {
    return Response.json({ error: "Nothing to classify." }, { status: 400 });
  }

  const fallback = guessIntent(text);

  const { credential, error } = credentialFrom(request);
  if (error) return Response.json({ intent: fallback, fallback: true });

  // Demo mode: no model anywhere, so the rule-based guess is the honest answer.
  if (!hasApiKey() && !credential) {
    return Response.json({ intent: fallback, fallback: true, mode: "demo" });
  }

  try {
    const result = await withVisitor(credential, () =>
      prose({
        system: INTENT_PROMPT,
        turns: [{ role: "user", content: intentSample(text) }],
        maxTokens: 16,
        // Labelling, not reasoning: no thinking level, and no need for one.
      })
    );

    return Response.json({ intent: readIntent(result.text, fallback), label: result.text.trim() });
  } catch {
    return Response.json({ intent: fallback, fallback: true });
  }
}
