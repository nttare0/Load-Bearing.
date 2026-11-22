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
  /** A timestamp, when archived. Archived workspaces stay available for restore. */
  archivedAt?: string;
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
  const blank = workspaces.find((workspace) => !workspace.archivedAt && isNewChat(workspace));
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

export type WorkspacesReadResult =
  | { kind: "empty" }
  | { kind: "ok"; workspaces: Workspace[] }
  | { kind: "invalid"; raw: string }
  | { kind: "unavailable" };

/** Read workspace data without conflating an empty store with a failed read. */
export function readWorkspacesResult(): WorkspacesReadResult {
  let raw: string | null;
  try {
    if (typeof localStorage === "undefined") return { kind: "unavailable" };
    raw = localStorage.getItem(KEY);
  } catch {
    return { kind: "unavailable" };
  }
  if (raw === null) return { kind: "empty" };

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { kind: "invalid", raw };
    const values: unknown[] = parsed;
    if (values.length === 0) return { kind: "empty" };

    const workspaces: Workspace[] = [];
    for (const value of values) {
      if (!isPersistedWorkspace(value)) return { kind: "invalid", raw };
      workspaces.push({
        ...value,
        folders: value.folders ?? [],
        resources: value.resources ?? [],
      });
    }
    return { kind: "ok", workspaces };
  } catch {
    return { kind: "invalid", raw };
  }
}

export type WorkspaceReadIssue = Extract<WorkspacesReadResult, { kind: "invalid" | "unavailable" }>;

export type WorkspaceHydrationState = {
  workspaces: Workspace[];
  currentId: string;
  persistInitial: boolean;
  issue: WorkspaceReadIssue | null;
};

/** Resolve the initial session without treating a failed read as an empty store. */
export function hydrateWorkspaceState(
  result: WorkspacesReadResult,
  savedCurrentId: string | null,
  make: () => Workspace = createWorkspace
): WorkspaceHydrationState {
  if (result.kind === "ok" && result.workspaces.length > 0) {
    const current = result.workspaces.find((workspace) => workspace.id === savedCurrentId) ?? result.workspaces[0];
    return {
      workspaces: result.workspaces,
      currentId: current.id,
      persistInitial: false,
      issue: null,
    };
  }

  const workspace = make();
  return {
    workspaces: [workspace],
    currentId: workspace.id,
    persistInitial: result.kind === "empty" || result.kind === "ok",
    issue: result.kind === "invalid" || result.kind === "unavailable" ? result : null,
  };
}

/**
 * The outcome of a browser-local write. `saved: false` means the value is only
 * in this tab's memory: the browser refused it (full, or storage unavailable).
 * Callers must not describe a failed write as durably saved.
 */
export type WriteOutcome = { saved: true } | WriteFailure;
export type WriteFailure = { saved: false; reason: "quota" | "unavailable" };

/** Browsers report a full store in several ways; all of them mean "quota". */
function isQuotaError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const e = error as { name?: unknown; code?: unknown };
  return (
    e.name === "QuotaExceededError" ||
    e.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    e.code === 22 ||
    e.code === 1014
  );
}

function writeItem(key: string, value: string): WriteOutcome {
  try {
    if (typeof localStorage === "undefined") return { saved: false, reason: "unavailable" };
    localStorage.setItem(key, value);
    return { saved: true };
  } catch (error) {
    return { saved: false, reason: isQuotaError(error) ? "quota" : "unavailable" };
  }
}

/**
 * The exact text a recovery export contains: the same array format the store
 * uses, so an export can be read back by this app or inspected by hand.
 */
export function exportWorkspacesText(list: Workspace[]): string {
  return JSON.stringify(list, null, 2);
}

export function writeWorkspaces(list: Workspace[]): WriteOutcome {
  let value: string;
  try {
    value = JSON.stringify(list);
  } catch {
    return { saved: false, reason: "unavailable" };
  }
  return writeItem(KEY, value);
}

/** The current-workspace ID, or null. Storage that cannot be read is not an error here. */
export function readCurrentId(): string | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(CURRENT);
  } catch {
    return null;
  }
}

export function writeCurrentId(id: string): WriteOutcome {
  // Non-fatal on failure: it defaults to the first workspace on reload.
  return writeItem(CURRENT, id);
}

type PersistedWorkspace = Omit<Workspace, "folders" | "resources"> &
  Partial<Pick<Workspace, "folders" | "resources">>;
type MessagePass = NonNullable<Message["passes"]>[number];
type MessageLookedAt = NonNullable<Message["lookedAt"]>;
type MessageReasoning = NonNullable<Message["reasoning"]>[number];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isArrayOf<T>(value: unknown, isItem: (value: unknown) => value is T): value is T[] {
  return Array.isArray(value) && (value as unknown[]).every(isItem);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isMessagePass(value: unknown): value is MessagePass {
  return isObject(value) && typeof value.stage === "string" && isFiniteNumber(value.ms);
}

function isMessageLookedAt(value: unknown): value is MessageLookedAt {
  return isObject(value) &&
    isFiniteNumber(value.analyses) &&
    isFiniteNumber(value.claims) &&
    isFiniteNumber(value.tested);
}

function isMessageReasoning(value: unknown): value is MessageReasoning {
  return isObject(value) &&
    typeof value.pass === "string" &&
    (value.kind === "think" || value.kind === "found" || value.kind === "check" || value.kind === "warn") &&
    typeof value.text === "string" &&
    (value.ms === undefined || isFiniteNumber(value.ms));
}

function isMessage(value: unknown): value is Message {
  return isObject(value) &&
    typeof value.id === "string" &&
    (value.role === "user" || value.role === "assistant") &&
    typeof value.text === "string" &&
    typeof value.at === "string" &&
    (value.analysisId === undefined || typeof value.analysisId === "string") &&
    (value.kind === undefined || value.kind === "report" || value.kind === "answer" || value.kind === "error") &&
    (value.passes === undefined || isArrayOf(value.passes, isMessagePass)) &&
    (value.lookedAt === undefined || isMessageLookedAt(value.lookedAt)) &&
    (value.reasoning === undefined || isArrayOf(value.reasoning, isMessageReasoning));
}

function isPlan(value: unknown): value is Workspace["plans"][number] {
  return isObject(value) &&
    typeof value.id === "string" &&
    typeof value.text === "string" &&
    typeof value.at === "string" &&
    typeof value.title === "string";
}

function isFolder(value: unknown): value is Folder {
  return isObject(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    (value.parentId === null || typeof value.parentId === "string") &&
    typeof value.createdAt === "string" &&
    (value.origin === "you" || value.origin === "model");
}

function isResource(value: unknown): value is Resource {
  return isObject(value) &&
    typeof value.id === "string" &&
    (value.kind === "analysis" || value.kind === "note" || value.kind === "file") &&
    typeof value.title === "string" &&
    (value.body === undefined || typeof value.body === "string") &&
    (value.analysisId === undefined || typeof value.analysisId === "string") &&
    (value.folderId === null || typeof value.folderId === "string") &&
    typeof value.createdAt === "string" &&
    (value.origin === "you" || value.origin === "model" || value.origin === "attach");
}

function isPersistedWorkspace(value: unknown): value is PersistedWorkspace {
  return isObject(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string" &&
    (value.archivedAt === undefined || typeof value.archivedAt === "string") &&
    isArrayOf(value.messages, isMessage) &&
    isArrayOf(value.plans, isPlan) &&
    (value.folders === undefined || isArrayOf(value.folders, isFolder)) &&
    (value.resources === undefined || isArrayOf(value.resources, isResource));
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
