import { deleteAnalysis, loadAnalysis, recordOutcome, saveAnalysis } from "@/lib/store";
import type { TestOutcome } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "Missing id." }, { status: 400 });

  const analysis = await loadAnalysis(id);
  if (!analysis) return Response.json({ error: "Not found." }, { status: 404 });
  return Response.json({ analysis });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const payload = body as {
    action?: string;
    analysis?: unknown;
    id?: string;
    ref?: string;
    outcome?: TestOutcome;
  };

  if (payload.action === "save" && payload.analysis) {
    const saved = await saveAnalysis(payload.analysis as never);
    return Response.json({ saved });
  }

  if (payload.action === "outcome" && payload.id && payload.ref && payload.outcome) {
    const updated = await recordOutcome(payload.id, payload.ref, payload.outcome);
    if (!updated) return Response.json({ error: "Not found." }, { status: 404 });
    return Response.json({ analysis: updated });
  }

  return Response.json({ error: "Unknown action." }, { status: 400 });
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "Missing id." }, { status: 400 });

  const deleted = await deleteAnalysis(id);
  if (!deleted) {
    return Response.json(
      { error: "Nothing was deleted — either storage is not configured or the analysis is gone." },
      { status: 404 }
    );
  }
  return Response.json({ deleted: true });
}
