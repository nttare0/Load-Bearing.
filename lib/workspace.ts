import type { Analysis } from "./schema";
import type { Folder, Resource } from "./resources";

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
  /**
   * What each pass cost in wall clock, when the turn produced a report. Kept
   * with the turn so a slow run is visible after the fact, not only while it
   * is running.
   */
  passes?: { stage: string; ms: number }[];
  /** Naming what this turn looked at, so a thread is auditable. */
  lookedAt?: { analyses: number; claims: number; tested: number };
  /**
   * The thinking steps this turn produced.
   *
   * Kept with the turn rather than thrown away when the report renders: the
   * reasoning panel collapses to a summary, but the summary is only honest if
   * the steps behind it are still there to open.
   */
  reasoning?: { pass: string; kind: "think" | "found" | "check" | "warn"; text: string; ms?: number }[];
};

export type Workspace = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
  /** Saved plans, so a report can be traced back to the text that produced it. */
  plans: { id: string; text: string; at: string; title: string }[];
  /** Folders and the things in them. Shapes live in lib/resources.ts. */
  folders: Folder[];
  resources: Resource[];
};

const KEY = "load-bearing:workspaces";
const CURRENT = "load-bearing:current-workspace";

export function newId(): string {
  // crypto.randomUUID is not in every browser this might run in.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * A workspace with nothing in it is a **new chat**, not a workspace with a bad
 * name.
 *
 * This is the distinction the interface now makes, following arena.ai/agent:
 * "New chat" is a verb that opens a blank thread, and it stays a new chat until
 * the first thing lands in it. The moment a plan is sent, the title comes from
 * the plan's own words and the row in the list becomes a chat you can find
 * again. Naming the empty state "Untitled workspace" put a filing-cabinet label
 * on something that was really an invitation to type.
 */
export const NEW_CHAT_TITLE = "New chat";

/** Whether a workspace is still the blank one a new chat opens. */
export function isNewChat(workspace: Pick<Workspace, "messages" | "plans">): boolean {
  return workspace.messages.length === 0 && workspace.plans.length === 0;
}

/** The row's title: its name, or the truth about it if nobody has named it yet. */
export function titleOf(workspace: Workspace): string {
  if (isNewChat(workspace)) return NEW_CHAT_TITLE;
  return workspace.name;
}

/**
 * Where pressing **New chat** should land.
 *
 * Either the blank chat that already exists, or a fresh one. Pulled out of the
 * page so the rule can be tested without a browser: pressing New chat twice must
 * not make two blanks.
 */
export function newChatTarget(
  workspaces: Workspace[],
  make: () => Workspace = createWorkspace
): { workspace: Workspace; reused: boolean } {
  const blank = workspaces.find(isNewChat);
  return blank ? { workspace: blank, reused: true } : { workspace: make(), reused: false };
}

export function createWorkspace(name = NEW_CHAT_TITLE): Workspace {
  const now = new Date().toISOString();
  return {
    id: newId(),
    name: name.trim() || NEW_CHAT_TITLE,
    createdAt: now,
    updatedAt: now,
    messages: [],
    plans: [],
    folders: [],
    resources: [],
  };
}

/**
 * The title a chat takes from its first plan.
 *
 * Two things were wrong with the old version, and both produced the same bad
 * title:
 *
 *   - a first line of one or two words ("Meals.") passed the length check and
 *     became the title, so a real plan about a real kitchen was filed as "Meals";
 *   - anything shorter than that fell back to "Untitled workspace", which is the
 *     filing-cabinet label this interface is trying to stop using.
 *
 * A line is only a title if it is at least three words. Otherwise the title comes
 * from the plan's first clause, which is always there — you cannot send a plan
 * with nothing in it — and only an empty string is a new chat.
 */
export function nameFromPlan(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return NEW_CHAT_TITLE;

  /** Trim a candidate to a readable length, without punctuation at the end. */
  const tidy = (value: string) =>
    value.trim().split(" ").slice(0, 7).join(" ").replace(/[.,;:!?]+$/, "").trim();

  const firstLine = text.trim().split(/\n/)[0]?.replace(/\s+/g, " ").trim() ?? "";
  if (firstLine.split(" ").filter(Boolean).length >= 3) {
    const candidate = tidy(firstLine);
    if (candidate.length > 3) return candidate;
  }

  // Short first line: the first *sentence* with enough words to be a title, and
  // the first clause of that. Skipping the short ones matters — "Meals." is a
  // label above the plan, not the plan.
  for (const sentence of clean.split(/(?<=[.!?])\s+/)) {
    if (sentence.split(" ").filter(Boolean).length < 3) continue;
    const candidate = tidy(sentence.split(/[,;:]/)[0] ?? sentence);
    if (candidate.length > 3) return candidate;
  }
  return NEW_CHAT_TITLE;
}

export function readWorkspaces(): Workspace[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Workspaces stored before folders existed simply have none.
    return parsed.filter(isWorkspace).map((w) => ({
      ...w,
      folders: Array.isArray(w.folders) ? w.folders : [],
      resources: Array.isArray(w.resources) ? w.resources : [],
    }));
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
