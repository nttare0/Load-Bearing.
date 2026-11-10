import { hasApiKey, MODEL } from "@/lib/ai";
import { storageMode } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Reports capability only — never returns a key or any part of one.
 *
 * This is also the deployment's smoke test: it is the cheapest route that
 * exercises the Supabase client, so `storage: "supabase"` here means saved
 * reports and share links will work.
 */
export async function GET() {
  return Response.json({
    ok: true,
    ai: hasApiKey() ? "configured" : "demo",
    model: hasApiKey() ? MODEL : null,
    storage: await storageMode(),
    time: new Date().toISOString(),
  });
}
