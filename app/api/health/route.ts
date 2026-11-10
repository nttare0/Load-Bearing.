import { describeProvider, provider } from "@/lib/ai";
import { geminiKey, generate } from "@/lib/gemini";
import { storageMode } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Reports capability only — never returns a key or any part of one.
 *
 * The provider and its project are named so a misconfigured key is diagnosable
 * from one request: "gemini · gen-lang-client-…" that fails is a different
 * problem from no key at all.
 *
 * `?check=1` goes one step further and asks the model for a single token. A key
 * that is present is not the same as a key that authenticates — Google has been
 * issuing keys that pass validation and still return 401 — so the difference
 * should be visible without spending a whole analysis to find out.
 */
export async function GET(request: Request) {
  const ai = describeProvider();
  const check = new URL(request.url).searchParams.get("check");

  if (check && ai.ai === "configured") {
    return Response.json({
      ok: true,
      ...ai,
      storage: await storageMode(),
      check: ai.provider === "gemini" ? await checkGemini() : { ran: false, note: "no live check for this provider" },
      time: new Date().toISOString(),
    });
  }

  return Response.json({
    ok: true,
    ...ai,
    storage: await storageMode(),
    time: new Date().toISOString(),
  });
}

async function checkGemini(): Promise<{ ran: boolean; ok: boolean; ms: number; error?: string }> {
  if (!geminiKey()) return { ran: false, ok: false, ms: 0, error: "no key" };
  if (provider() !== "gemini") return { ran: false, ok: false, ms: 0, error: "gemini is not the active provider" };

  const started = Date.now();
  try {
    const result = await generate({ user: "Reply with the single word: ok", maxTokens: 16, temperature: 0 });
    return {
      ran: true,
      ok: result.text.length > 0,
      ms: Date.now() - started,
      ...(result.text.length ? {} : { error: "the model returned an empty reply" }),
    };
  } catch (error) {
    // The message is Google's own text, which is what makes a 401 or an
    // unsupported-key-type failure actionable.
    const message = error instanceof Error ? error.message : String(error);
    return { ran: true, ok: false, ms: Date.now() - started, error: clean(message) };
  }
}

/** Google's auth errors can be long and quote the request; keep the verdict. */
function clean(message: string): string {
  const detail = message.match(/"message"\s*:\s*"([^"]{1,200})"/);
  if (detail) return detail[1];
  return message.replace(/\s+/g, " ").slice(0, 200);
}
