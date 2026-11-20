import { describeProvider } from "@/lib/ai";
import { GEMINI_MODELS, generate } from "@/lib/gemini";
import { credentialFrom, withVisitor } from "@/lib/visitor";
import { credentialNote } from "@/lib/byok";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Settings, as the server sees them.
 *
 * Two jobs:
 *   GET  — what is in play right now, and whose it is. This is the fact the
 *          Connectors card never had: "gemini-3.8-flash" is either the
 *          operator's key or a key the visitor pasted, and those are very
 *          different situations for the person reading the screen.
 *   POST — try a key for real. Verifying a pasted key by using it is the only
 *          honest test; a shape check proves the paste, not the key.
 *
 * Nothing here stores or logs a key. The POST uses the key for one call and
 * returns only whether it worked.
 */
export async function GET(request: Request) {
  const { credential, error } = credentialFrom(request);
  return withVisitor(credential, async () => {
    const provider = describeProvider();
    return Response.json({
      ...provider,
      source: credential ? "your key" : provider.ai === "configured" ? "this deployment" : "none",
      ...(error ? { note: error } : {}),
      ...(credential ? { note: credentialNote(credential.provider) } : {}),
    });
  });
}

export async function POST(request: Request) {
  const { credential, error } = credentialFrom(request);
  if (error) return Response.json({ ok: false, reason: error }, { status: 400 });
  if (!credential) {
    return Response.json({ ok: false, reason: "No key in the request." }, { status: 400 });
  }

  const started = Date.now();

  return withVisitor(credential, async () => {
    try {
      if (credential.provider === "gemini") {
        // Ask the requested model, then whatever the account can see: the answer
        // to "does this key work" is not the same as "does it work on 3.8".
        const result = await generate({
          system: "Answer with one word.",
          user: "Say OK.",
          maxTokens: 32,
          temperature: 0,
          thinkingLevel: "",
        });
        return Response.json({
          ok: true,
          provider: "gemini",
          model: result.model,
          ms: Date.now() - started,
          note:
            result.model === GEMINI_MODELS[0]
              ? null
              : `This key answered from ${result.model}. ${GEMINI_MODELS[0]} was unavailable — likely out of quota on a free-tier key.`,
        });
      }

      // Anthropic: the cheapest real call is a one-token reply. The SDK retries
      // a bad key a few times on its own, so a failure here means rejected.
      const { prose } = await import("@/lib/ai");
      const { text } = await prose({
        system: "Answer with one word.",
        turns: [{ role: "user", content: "Say OK." }],
        maxTokens: 16,
      });
      return Response.json({
        ok: Boolean(text),
        provider: "anthropic",
        ms: Date.now() - started,
        note: text ? null : "The key worked but the model returned nothing.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Response.json({
        ok: false,
        provider: credential.provider,
        ms: Date.now() - started,
        // Google and Anthropic both say what is wrong in their own words; those
        // words are the whole value of this endpoint.
        reason: explain(message),
      });
    }
  });
}

/** Turn a provider error into a sentence a person can act on. */
function explain(message: string): string {
  if (/quota|rate.?limit|429|resource.?exhausted/i.test(message)) {
    const retry = message.match(/retry in ([^.]+)\./i);
    return `The key works, but it is out of quota${retry ? ` — retry in ${retry[1].trim()}` : ""}.`;
  }
  if (/401|403|api.?key|unauthor|permission|invalid/i.test(message)) {
    return "The key was rejected. Check it was copied whole, and that it has not been revoked.";
  }
  if (/not found|does not exist|unsupported/i.test(message)) {
    return "The provider does not recognise the model this app asks for on this key.";
  }
  return message.replace(/\s+/g, " ").slice(0, 220);
}
