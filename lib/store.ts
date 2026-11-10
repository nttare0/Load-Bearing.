import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Analysis } from "./schema";
import { AnalysisSchema } from "./schema";

/**
 * Storage.
 *
 * v1 behaviour from the build plan: localStorage first, no accounts. When
 * Supabase is configured, a server-side save also happens so a report has a
 * shareable link and survives a refresh on another device.
 *
 * Two rules that matter more than the storage choice:
 *   1. Nothing is written unless the user asked for it ("Keep this analysis").
 *   2. A delete really deletes — the row is gone, not flagged.
 * Plans are never sent to storage by the analysis pipeline itself.
 */

export const ANALYSIS_TABLE = "analyses";

/** Saved reports expire. A plan that rests on an unreleased decision should
 *  not sit in a database forever because someone forgot the delete button. */
export const RETENTION_DAYS = 30;

export function supabaseAdmin(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    // Health checks answer fast, and a save that cannot reach the network
    // reports back instead of stalling the end of a long analysis.
    global: {
      fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(8000) }),
    },
  });
}

export function isStorageConfigured(): boolean {
  return Boolean(
    process.env.SUPABASE_URL &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY ??
        process.env.SUPABASE_SECRET_KEY ??
        process.env.SUPABASE_ANON_KEY)
  );
}

/** "supabase" only once we know the table actually answers. */
export async function storageMode(): Promise<"supabase" | "local"> {
  const db = supabaseAdmin();
  if (!db) return "local";

  try {
    const { error } = await db.from(ANALYSIS_TABLE).select("id", { head: true, count: "exact" });
    return error ? "local" : "supabase";
  } catch {
    return "local";
  }
}

export async function saveAnalysis(analysis: Analysis): Promise<boolean> {
  const db = supabaseAdmin();
  if (!db) return false;

  try {
    const { error } = await db.from(ANALYSIS_TABLE).upsert({
      id: analysis.id,
      title: analysis.title,
      summary: analysis.summary,
      created_at: analysis.createdAt,
      payload: analysis,
    });

    if (error) {
      console.error("saveAnalysis failed:", error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.error("saveAnalysis failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

export async function loadAnalysis(id: string): Promise<Analysis | null> {
  const db = supabaseAdmin();
  if (!db) return null;

  try {
    const { data, error } = await db
      .from(ANALYSIS_TABLE)
      .select("payload, created_at")
      .eq("id", id)
      .maybeSingle();

    if (error || !data?.payload) return null;

    const age = Date.now() - new Date(data.created_at as string).getTime();
    if (age > RETENTION_DAYS * 24 * 60 * 60 * 1000) {
      await deleteAnalysis(id).catch(() => undefined);
      return null;
    }

    const parsed = AnalysisSchema.safeParse(data.payload);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function deleteAnalysis(id: string): Promise<boolean> {
  const db = supabaseAdmin();
  if (!db) return false;

  try {
    const { error } = await db.from(ANALYSIS_TABLE).delete().eq("id", id);
    if (error) {
      console.error("deleteAnalysis failed:", error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.error("deleteAnalysis failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

/** Marks an assumption as tested and records what actually happened (v3). */
export type TestOutcome = "confirmed" | "broken" | "inconclusive";

export async function recordOutcome(
  id: string,
  ref: string,
  outcome: TestOutcome
): Promise<Analysis | null> {
  const analysis = await loadAnalysis(id);
  if (!analysis) return null;

  const claims = analysis.claims.map((claim) =>
    claim.ref === ref
      ? {
          ...claim,
          // A confirmed test is the only way an assumption becomes a fact:
          // the user checked it themselves, so there is no URL requirement.
          status: (outcome === "confirmed"
            ? "fact"
            : outcome === "broken"
              ? "contradicted"
              : claim.status) as typeof claim.status,
          outcome,
        }
      : claim
  );

  const updated = { ...analysis, claims } as Analysis;
  const saved = await saveAnalysis(updated);
  return saved ? updated : null;
}
