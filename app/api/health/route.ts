import { describeProvider } from "@/lib/ai";
import { storageMode } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Reports capability only — never returns a key or any part of one.
 *
 * The provider and its project are named so a misconfigured key is diagnosable
 * from one request: "gemini · gen-lang-client-…" that fails is a different
 * problem from no key at all.
 */
export async function GET() {
  const ai = describeProvider();
  return Response.json({
    ok: true,
    ...ai,
    storage: await storageMode(),
    time: new Date().toISOString(),
  });
}
