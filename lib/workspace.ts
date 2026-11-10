import type { Analysis } from "./schema";

/**
 * Workspaces.
 *
 * A workspace is how the left rail groups work: it owns the plans, the reports
 * made from them, and the thread you had about each one. It is a browser
 * concept — nothing here is sent anywhere, and the server only ever sees a
 * single analysis it is asked to store.
 *
 * Kept deliberately unlike the rest of the app's schemas: the shapes are small,
 * hand-rolled and forgiving on read, because a workspace is a convenience and
 * must never be the reason a report is lost.
 */

export type MessageRole = "user" | "assistant";

/** One turn of research. The report a turn produced is referenced, not copied. */
export type Message = {
  id: string;
  role: MessageRole;
  /** What the user pasted, or what the analyst said back. */
  text: string;
  at: string;
  /** Set on the turn that produced a report. */
  analysisId?: string;
  /** Set on the turn that only read the workspace and answered in prose. */
  kind?: "report" | "answer" | "error";
  /** Naming what this turn looked at, so a thread is auditable. */
  lookedAt?: { analyses: number; claims: number; tested: number };
};

export type Workspace = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
  /** Saved plans, so a report can be traced back to the text that produced it. */
  plans: { id: string; text: string; at: string; title: string }[];
};

const KEY = "load-bearing:workspaces";
const CURRENT = "load-bearing:current-workspace";

export function newId(): string {
  // crypto.randomUUID is not in every browser this might run in.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createWorkspace(name = "Untitled workspace"): Workspace {
  const now = new Date().toISOString();
  return { id: newId(), name: name.trim() || "Untitled workspace", createdAt: now, updatedAt: now, messages: [], plans: [] };
}

/** The title a workspace takes from its first plan, so the rail is never all "Untitled". */
export function nameFromPlan(text: string): string {
  const firstLine = text.trim().split(/\n/)[0]?.replace(/\s+/g, " ").trim() ?? "";
  const words = firstLine.split(" ").slice(0, 7).join(" ");
  return words.length > 3 ? words.replace(/[.,;:]$/, "") : "Untitled workspace";
}

export function readWorkspaces(): Workspace[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isWorkspace);
  } catch {
    return [];
  }
}

export function writeWorkspaces(list: Workspace[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Quota or private mode. The chat still works for this session.
  }
}

export function readCurrentId(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(CURRENT);
}

export function writeCurrentId(id: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(CURRENT, id);
  } catch {
    // Non-fatal: it will default to the first workspace on reload.
  }
}

function isWorkspace(value: unknown): value is Workspace {
  if (!value || typeof value !== "object") return false;
  const w = value as Partial<Workspace>;
  return (
    typeof w.id === "string" &&
    typeof w.name === "string" &&
    Array.isArray(w.messages) &&
    Array.isArray(w.plans)
  );
}

/**
 * Roll a workspace up for the rail: what it holds and how much of it is
 * settled. Reading count is derived from the messages, never counted twice.
 */
export function workspaceFacts(workspace: Workspace, analyses: Record<string, Analysis>) {
  const reports = workspace.messages.filter((m) => m.analysisId && analyses[m.analysisId]);
  let tested = 0;
  let total = 0;
  for (const message of reports) {
    const analysis = analyses[message.analysisId!];
    if (!analysis) continue;
    total += analysis.claims.length;
    tested += analysis.claims.filter((c) => c.outcome).length;
  }
  return { reports: reports.length, tested, total };
}
