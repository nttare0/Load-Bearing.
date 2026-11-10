import { hasApiKey, MODEL } from "@/lib/ai";
import { storageMode } from "@/lib/store";

export const runtime = "nodejs";

/** Reports capability only — never returns a key or any part of one. */
export async function GET() {
  return Response.json({
    ok: true,
    ai: hasApiKey() ? "configured" : "demo",
    model: hasApiKey() ? MODEL : null,
    storage: await storageMode(),
    time: new Date().toISOString(),
  });
}
