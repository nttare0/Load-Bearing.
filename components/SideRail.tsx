"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  ChevronRight,
  ChevronsRight,
  FileText,
  FolderPlus,
  FolderClosed,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { AiStatus } from "@/components/rare/ai-status";
import { AnimatedCounter } from "@/components/rare/animated-counter";
import { DeleteButton } from "@/components/rare/delete-button";
import { tree, type Verdict } from "@/lib/resources";
import type { Workspace } from "@/lib/workspace";

/**
 * The right rail.
 *
 * Follows the reference's panel: a collapse chevron at the top, then a tabbed
 * card that takes the height, then a smaller card with a header and a `+`.
 * Everything is sized off one scale — 13px card headings, 12.5px rows, 30px
 * header rows, 8px card radius — so the cards line up with each other instead
 * of each inventing its own rhythm.
 *
 * Nothing here deletes on its own: a deletion arrives in Activity as one line
 * with the model's own reason beside it, and the bin has to be pressed twice.
 */

const CARD = "rounded-[0.5rem] border border-[var(--to-border)]";
const HEAD_ROW = "flex h-[1.875rem] items-center gap-[0.25rem] px-[0.625rem]";
const FULL_ROW =
  "flex w-full items-center gap-[0.4375rem] border-t border-b border-[var(--to-border)] bg-[var(--to-surface)] px-[0.625rem] py-[0.375rem] text-left text-[0.8125rem] text-ink-2 hover:bg-[var(--to-surface-2)] hover:text-foreground";

/**
 * A stage name, in the reference's vocabulary. The status component has its own
 * drawn icons for thinking, researching, analysing and writing, so the pipeline's
 * labels only need mapping onto them.
 */
function statusState(stage: string): string {
  const label = stage.toLowerCase();
  if (/search|research|verif|evidence/.test(label)) return "researching";
  if (/writ|draft|report|summary|test/.test(label)) return "writing";
  if (/scor|rank|map|audit|claim/.test(label)) return "analyzing";
  return "thinking";
}

export function SideRail({
  workspace,
  workspaces,
  currentId,
  proposal,
  tidyBusy,
  stage,
  mode,
  tools,
  onTidy,
  onApprove,
  onReject,
  onDismissProposal,
  onNewFolder,
  onOpenResource,
  onFileChanged,
  onSelect,
  onNewChat,
  onDelete,
}: {
  workspace: Workspace | null;
  workspaces: { workspace: Workspace; reports: number }[];
  currentId: string | null;
  proposal: { verdicts: Verdict[]; note?: string } | null;
  tidyBusy: boolean;
  /** The pipeline stage running right now, if one is. */
  stage: string | null;
  mode: "demo" | "live" | null;
  /** What this deployment is actually wired to. Absent means "not configured". */
  tools: { model: string | null; storage: string | null };
  onTidy: () => void;
  onApprove: (verdict: Verdict) => void;
  onReject: (verdict: Verdict) => void;
  onDismissProposal: () => void;
  onNewFolder: (name: string) => void;
  onOpenResource: (analysisId: string) => void;
  onFileChanged: (resourceId: string, folderId: string | null) => void;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onDelete: (id: string) => void;
}) {
  // Files is where you land — unless the model is waiting on you, in which case
  // the question is the first thing in the rail, not something you must find.
  const [picked, setPicked] = useState<"files" | "activity" | null>(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  // Read after mount so the server's HTML and the client's first render agree.
  const [onVercel, setOnVercel] = useState(false);
  useEffect(() => setOnVercel(/\.vercel\.app$/.test(window.location.hostname)), []);

  const term = query.trim().toLowerCase();
  const shown = term
    ? workspaces.filter(
        ({ workspace: w }) =>
          w.name.toLowerCase().includes(term) ||
          w.resources.some((r) => r.title.toLowerCase().includes(term))
      )
    : workspaces;

  const pending = proposal?.verdicts.filter((v) => v.needsApproval) ?? [];
  const applied = proposal?.verdicts.filter((v) => v.applies) ?? [];
  const tab = picked ?? (pending.length > 0 ? "activity" : "files");

  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const commitFolder = () => {
    const name = draft.trim();
    if (name) onNewFolder(name);
    setDraft("");
    setCreating(false);
  };

  const view = workspace ? tree(workspace) : null;
  const empty = !view || (view.root.length === 0 && view.folders.every((f) => f.items.length === 0));

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[0.5rem]">
      {/* What the run is doing, in the reference's inline status: a drawn icon
          that changes with the work, a shimmering label, and the clock. */}
      {stage && (
        <div className={`${CARD} shrink-0 px-[0.5rem] py-[0.3125rem]`}>
          <AiStatus
            state={statusState(stage)}
            label={stage}
            detail={mode === "demo" ? "demo" : undefined}
            className="h-6 gap-[0.375rem] text-[0.8125rem] text-ink-2 dark:text-ink-2"
          />
        </div>
      )}

      {/* Files and Activity: the card that takes the height and scrolls inside. */}
      <section className={`${CARD} flex min-h-0 flex-1 flex-col overflow-hidden`}>
        <div role="tablist" aria-label="Files and activity" className="flex shrink-0 gap-[0.375rem] p-[0.25rem]">
          <Tab id="files" label="Files" active={tab === "files"} onSelect={setPicked} />
          <Tab
            id="activity"
            label="Activity"
            active={tab === "activity"}
            onSelect={setPicked}
            badge={pending.length}
          />
        </div>

        {tab === "files" ? (
          <>
            <button
              type="button"
              onClick={() => {
                setCreating((value) => !value);
                setDraft("");
              }}
              className={FULL_ROW}
            >
              <FolderPlus aria-hidden className="size-4 shrink-0 text-ink-3" />
              New folder
              <ChevronRight aria-hidden className="ml-auto size-4 shrink-0 text-ink-3" />
            </button>

            {creating && (
              <div className="shrink-0 border-b border-[var(--to-border)] px-[0.625rem] py-[0.375rem]">
                <input
                  autoFocus
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onBlur={commitFolder}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") commitFolder();
                    if (event.key === "Escape") {
                      setDraft("");
                      setCreating(false);
                    }
                  }}
                  placeholder="Folder name"
                  aria-label="New folder name"
                  className="w-full rounded-[0.25rem] border border-[var(--to-border)] bg-transparent px-[0.375rem] py-[0.1875rem] text-[0.8125rem] outline-none focus:border-[var(--to-border-strong)]"
                />
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto py-[0.1875rem]">
              {empty && !creating && (
                <p className="px-[0.625rem] py-[0.375rem] text-[0.8125rem] leading-[1.5] text-ink-3">
                  Reports and notes collect here once you run a plan. Make a folder to keep them
                  apart.
                </p>
              )}

              <ul className="flex flex-col">
                {view?.folders.map(({ folder, items }) => {
                  const open = openIds.has(folder.id);
                  return (
                    <li key={folder.id}>
                      <button
                        type="button"
                        onClick={() => toggle(folder.id)}
                        aria-expanded={open}
                        className="flex w-full min-w-0 items-center gap-[0.3125rem] px-[0.625rem] py-[0.3125rem] text-left hover:bg-[var(--to-surface-2)]"
                      >
                        <ChevronRight
                          aria-hidden
                          className={`size-3.5 shrink-0 text-ink-3 transition-transform ${
                            open ? "rotate-90" : ""
                          }`}
                        />
                        <FolderClosed aria-hidden className="size-4 shrink-0 text-ink-3" />
                        <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-ink-2">
                          {folder.name}
                        </span>
                        <span className="shrink-0 text-[0.6875rem] tabular-nums text-ink-3">
                          {items.length}
                        </span>
                      </button>

                      {open && (
                        <ul className="ml-[1.125rem] border-l border-[var(--to-border)] pl-[0.25rem]">
                          {items.length === 0 && (
                            <li className="px-[0.5rem] py-[0.1875rem] text-[0.75rem] text-ink-3">
                              Empty
                            </li>
                          )}
                          {items.map((item) => (
                            <li key={item.id} className="group/row">
                              <FileRow
                                title={item.title}
                                onOpen={
                                  item.analysisId
                                    ? () => onOpenResource(item.analysisId!)
                                    : undefined
                                }
                                onOut={() => onFileChanged(item.id, null)}
                              />
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}

                {view?.root.map((item) => {
                  const analysisId = item.analysisId;
                  return (
                    <li key={item.id} className="group/row">
                      <FileRow
                        title={item.title}
                        onOpen={analysisId ? () => onOpenResource(analysisId) : undefined}
                        folders={view.folders.map((f) => ({ id: f.folder.id, name: f.folder.name }))}
                        onFileInto={(folderId) => onFileChanged(item.id, folderId)}
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <button
              type="button"
              onClick={onTidy}
              disabled={tidyBusy || empty}
              aria-label="Ask the model to tidy the files"
              className={`${FULL_ROW} disabled:opacity-50 disabled:hover:bg-[var(--to-surface)]`}
            >
              {tidyBusy ? (
                <Loader2 aria-hidden className="size-4 shrink-0 animate-spin text-ink-3" />
              ) : (
                <Sparkles aria-hidden className="size-4 shrink-0 text-ink-3" />
              )}
              {tidyBusy ? "Tidying…" : "Tidy the files"}
              <ChevronRight aria-hidden className="ml-auto size-4 shrink-0 text-ink-3" />
            </button>

            <div className="flex flex-col gap-[0.4375rem] px-[0.625rem] py-[0.5rem]">
              {!proposal && (
                <p className="text-[0.8125rem] leading-[1.5] text-ink-3">
                  Nothing proposed yet. Tidying asks the model to group what you have — it can
                  suggest a change, it cannot delete one.
                </p>
              )}

              {proposal && (
                <>
                  <p className="text-[0.75rem] text-ink-3">
                    {pending.length > 0
                      ? `${pending.length} deletion${pending.length === 1 ? "" : "s"} waiting for you`
                      : applied.length > 0
                        ? `${applied.length} change${applied.length === 1 ? "" : "s"} applied`
                        : "Nothing was changed"}
                  </p>

                  {applied.length > 0 && (
                    <ul className="flex flex-col gap-[0.1875rem]">
                      {applied.map((verdict, index) => (
                        <li
                          key={index}
                          className="flex items-start gap-[0.3125rem] text-[0.75rem] leading-[1.5] text-ink-3"
                        >
                          <span aria-hidden className="mt-[0.0625rem] shrink-0 text-[var(--to-success)]">
                            ✓
                          </span>
                          {verdict.summary}
                        </li>
                      ))}
                    </ul>
                  )}

                  {pending.length > 0 && (
                    <ul className="flex flex-col gap-[0.4375rem] border-t border-[var(--to-border)] pt-[0.4375rem]">
                      {pending.map((verdict, index) => (
                        <li key={index} className="flex flex-col gap-[0.25rem]">
                          <span className="text-[0.75rem] leading-[1.5] text-ink-2">
                            {verdict.summary}
                            {verdict.action.reason && (
                              <span className="block text-[0.6875rem] text-ink-3">
                                “{verdict.action.reason}”
                              </span>
                            )}
                          </span>
                          {/* The bin, from the reference: press it and it opens;
                              the tick deletes, the cross keeps. */}
                          <span className="flex items-center gap-[0.375rem]">
                            <DeleteButton
                              tile={26}
                              className="rounded-[0.375rem]"
                              onConfirm={() => onApprove(verdict)}
                              onCancel={() => onReject(verdict)}
                            />
                            <span className="text-[0.6875rem] text-ink-3">delete, or keep it</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {proposal.note && (
                    <p className="text-[0.6875rem] leading-[1.5] text-ink-3">{proposal.note}</p>
                  )}

                  <button
                    type="button"
                    onClick={onDismissProposal}
                    className="self-start text-[0.6875rem] text-ink-3 underline-offset-2 hover:text-foreground hover:underline"
                  >
                    Dismiss
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Workspaces: the smaller card, header with search and `+`. */}
      <section className={`${CARD} shrink-0`}>
        <div className={HEAD_ROW}>
          <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-ink-2">Workspaces</span>
          <AnimatedCounter
            value={workspaces.length}
            separator=""
            className="shrink-0 pr-[0.125rem] text-[0.6875rem] tabular-nums text-ink-3"
          />
          <IconButton label="Find a workspace or file" expanded={searching} onClick={() => setSearching((v) => !v)}>
            <Search aria-hidden className="size-4" />
          </IconButton>
          <IconButton label="New chat" onClick={onNewChat}>
            <Plus aria-hidden className="size-4" />
          </IconButton>
        </div>

        {searching && (
          <div className="border-t border-[var(--to-border)] px-[0.625rem] py-[0.375rem]">
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setQuery("");
                  setSearching(false);
                }
              }}
              placeholder="Find a workspace or file"
              aria-label="Find a workspace or file"
              className="w-full rounded-[0.25rem] border border-[var(--to-border)] bg-transparent px-[0.375rem] py-[0.125rem] text-[0.8125rem] outline-none focus:border-[var(--to-border-strong)]"
            />
          </div>
        )}

        <ul className="max-h-[12rem] overflow-y-auto border-t border-[var(--to-border)] py-[0.1875rem]">
          {shown.map(({ workspace: w, reports }) => {
            const active = w.id === currentId;
            const deleting = pendingDelete === w.id;
            return (
              <li key={w.id} className="group/row">
                <div
                  className={`flex items-center ${
                    active ? "bg-[var(--to-surface-2)]" : "hover:bg-[var(--to-surface-2)]"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(w.id)}
                    className="flex min-w-0 flex-1 items-center gap-[0.375rem] px-[0.625rem] py-[0.3125rem] text-left"
                  >
                    <span
                      className={`min-w-0 flex-1 truncate text-[0.8125rem] ${
                        active ? "text-foreground" : "text-ink-2"
                      }`}
                    >
                      {w.name}
                    </span>
                    <span className="shrink-0 text-[0.6875rem] tabular-nums text-ink-3">
                      {reports}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(w.id)}
                    aria-label={`Delete ${w.name}`}
                    className="mr-[0.5rem] shrink-0 rounded-[0.25rem] p-[0.0625rem] text-ink-3 opacity-0 hover:text-[var(--to-danger)] focus-visible:opacity-100 group-hover/row:opacity-100"
                  >
                    <Trash2 aria-hidden className="size-3.5" />
                  </button>
                </div>

                {deleting && (
                  <div className="bg-[var(--to-surface)] px-[0.625rem] py-[0.375rem]">
                    <p className="text-[0.6875rem] leading-[1.5] text-ink-3">
                      Delete “{w.name}” and the reports in it?
                    </p>
                    <DeleteButton
                      tile={26}
                      className="mt-[0.25rem] rounded-[0.375rem]"
                      onConfirm={() => {
                        onDelete(w.id);
                        setPendingDelete(null);
                      }}
                      onCancel={() => setPendingDelete(null)}
                    />
                  </div>
                )}
              </li>
            );
          })}

          {shown.length === 0 && (
            <li className="px-[0.625rem] py-[0.25rem] text-[0.8125rem] text-ink-3">
              Nothing matches.
            </li>
          )}
        </ul>
      </section>

      {/* Connectors: what this deployment is actually wired to. A row says
          "on" only when the server reported it configured; nothing here is
          decoration, so a missing key reads as not connected. */}
      <section className={`${CARD} shrink-0`}>
        <div className={HEAD_ROW}>
          <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-ink-2">Connectors</span>
        </div>
        <ul className="border-t border-[var(--to-border)] py-[0.1875rem]">
          <ConnectorRow
            label="GitHub"
            detail="source"
            on={REPO !== null}
            icon={<GithubMark />}
          />
          <ConnectorRow
            label="Vercel"
            detail="hosting"
            on={onVercel}
            icon={<VercelMark />}
          />
          <ConnectorRow
            label={tools.model ? titleCase(tools.model) : "Model"}
            detail={mode === "live" ? "live" : mode === "demo" ? "no key" : "unknown"}
            on={mode === "live"}
            icon={<SparkMark />}
          />
          <ConnectorRow
            label={tools.storage && tools.storage !== "local" ? titleCase(tools.storage) : "Storage"}
            detail={tools.storage === "local" ? "this device" : (tools.storage ?? "unknown")}
            on={Boolean(tools.storage && tools.storage !== "local")}
            icon={<StoreMark />}
          />
        </ul>
        <p className="border-t border-[var(--to-border)] px-[0.625rem] py-[0.3125rem] text-[0.6875rem] leading-[1.4] text-ink-3">
          Connected apps are read from the server, not assumed.
        </p>
      </section>

      {/* Rare UI's licence asks for a visible credit wherever its components
          ship. This is it. */}
      <p className="shrink-0 px-[0.25rem] text-[0.625rem] leading-[1.4] text-ink-3">
        Components from{" "}
        <a
          href="https://www.rareui.com"
          target="_blank"
          rel="noreferrer noopener"
          className="underline underline-offset-2 hover:text-foreground"
        >
          Rare UI
        </a>
      </p>
    </div>
  );
}

export function RailCollapseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Hide the rail"
      className="flex h-[1.75rem] w-[1.75rem] shrink-0 items-center justify-center rounded-[0.375rem] text-ink-3 hover:bg-[var(--to-surface-2)] hover:text-foreground"
    >
      {/* Two chevrons pointing out of the panel, as on the reference. */}
      <ChevronsRight aria-hidden className="size-4" />
    </button>
  );
}

function Tab({
  id,
  label,
  active,
  badge,
  onSelect,
}: {
  id: "files" | "activity";
  label: string;
  active: boolean;
  badge?: number;
  onSelect: (id: "files" | "activity") => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      id={`tab-${id}`}
      aria-selected={active}
      aria-controls={`panel-${id}`}
      onClick={() => onSelect(id)}
      className={`flex flex-1 items-center justify-center gap-[0.25rem] rounded-[0.375rem] border px-[0.375rem] py-[0.1875rem] text-[0.8125rem] transition-colors ${
        active
          ? "border-[var(--to-border)] bg-[var(--to-surface-2)] text-foreground"
          : "border-transparent text-ink-3 hover:text-foreground"
      }`}
    >
      {label}
      {Boolean(badge) && (
        <span className="rounded-[var(--to-radius-pill)] bg-[var(--to-warning)] px-[0.25rem] text-[0.5625rem] leading-[1.4] tabular-nums text-[var(--to-bg)]">
          {badge}
        </span>
      )}
    </button>
  );
}

function IconButton({
  label,
  expanded,
  onClick,
  children,
}: {
  label: string;
  expanded?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-expanded={expanded}
      className="shrink-0 rounded-[0.25rem] p-[0.125rem] text-ink-3 hover:bg-[var(--to-surface-2)] hover:text-foreground"
    >
      {children}
    </button>
  );
}

function ConnectorRow({
  label,
  detail,
  on,
  icon,
}: {
  label: string;
  detail: string;
  on: boolean;
  icon: ReactNode;
}) {
  return (
    <li className="flex items-center gap-[0.5rem] px-[0.625rem] py-[0.3125rem]">
      <span className="flex size-4 shrink-0 items-center justify-center text-ink-2">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-ink-2">{label}</span>
      <span className="shrink-0 text-[0.6875rem] text-ink-3">{detail}</span>
      <span
        aria-label={on ? "connected" : "not connected"}
        title={on ? "connected" : "not connected"}
        className={`size-[0.375rem] shrink-0 rounded-full ${
          on ? "bg-[var(--to-success)]" : "border border-[var(--to-border-strong)]"
        }`}
      />
    </li>
  );
}

/** The repo the source link in the header already points at. Kept in one
 *  place so the connectors card cannot claim a connection the app lacks. */
const REPO = "https://github.com/nttare0/Load-Bearing.";

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** GitHub's mark, drawn rather than fetched. */
function GithubMark() {
  return (
    <svg viewBox="0 0 16 16" width={14} height={14} aria-hidden fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-2.91-.88-2.91-2.71 0-.54.19-1.03.51-1.4-.05-.13-.23-.67.05-1.39 0 0 .42-.13 1.36.51a4.7 4.7 0 0 1 1.25-.17c.43 0 .86.06 1.25.17.94-.64 1.36-.51 1.36-.51.28.72.1 1.26.05 1.39.32.37.51.86.51 1.4 0 1.84-1.13 2.51-2.92 2.71.29.25.55.73.55 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

/** Vercel's triangle, drawn rather than fetched. */
function VercelMark() {
  return (
    <svg viewBox="0 0 16 16" width={13} height={13} aria-hidden fill="currentColor">
      <path d="M8 1.5 15 14H1L8 1.5Z" />
    </svg>
  );
}

function SparkMark() {
  return (
    <svg viewBox="0 0 16 16" width={13} height={13} aria-hidden fill="currentColor">
      <path d="M8 1c.3 3.2 1.4 5.4 3 6.7 1.1.9 2.4 1.3 4 1.3-3.2.3-5.4 1.4-6.7 3-.9 1.1-1.3 2.4-1.3 4-.3-3.2-1.4-5.4-3-6.7C2.9 8.4 1.6 8 .1 8c3.2-.3 5.4-1.4 6.7-3C7.7 3.9 8 2.6 8 1Z" />
    </svg>
  );
}

function StoreMark() {
  return (
    <svg
      viewBox="0 0 16 16"
      width={13}
      height={13}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
    >
      <ellipse cx="8" cy="4" rx="5.5" ry="2.2" />
      <path d="M2.5 4v8c0 1.2 2.5 2.2 5.5 2.2s5.5-1 5.5-2.2V4" />
      <path d="M2.5 8c0 1.2 2.5 2.2 5.5 2.2s5.5-1 5.5-2.2" />
    </svg>
  );
}

function FileRow({
  title,
  onOpen,
  folders,
  onFileInto,
  onOut,
}: {
  title: string;
  onOpen?: () => void;
  folders?: { id: string; name: string }[];
  onFileInto?: (folderId: string) => void;
  onOut?: () => void;
}) {
  return (
    <div className="flex items-center pr-[0.5rem] hover:bg-[var(--to-surface-2)]">
      <button
        type="button"
        onClick={onOpen}
        disabled={!onOpen}
        className="flex min-w-0 flex-1 items-center gap-[0.3125rem] px-[0.625rem] py-[0.3125rem] text-left text-[0.8125rem] text-ink-3 hover:text-foreground disabled:cursor-default disabled:hover:text-ink-3"
      >
        <FileText aria-hidden className="size-3.5 shrink-0" />
        <span className="min-w-0 truncate">{title}</span>
      </button>

      {folders && folders.length > 0 && onFileInto && (
        <select
          aria-label={`File ${title} into a folder`}
          value=""
          onChange={(event) => {
            if (event.target.value) onFileInto(event.target.value);
            event.target.value = "";
          }}
          className="mr-[0.25rem] max-w-[4.5rem] shrink-0 bg-transparent text-[0.6875rem] text-ink-3 opacity-0 focus-visible:opacity-100 group-hover/row:opacity-100"
        >
          <option value="">into…</option>
          {folders.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {folder.name}
            </option>
          ))}
        </select>
      )}

      {onOut && (
        <button
          type="button"
          onClick={onOut}
          className="shrink-0 px-[0.125rem] text-[0.6875rem] text-ink-3 opacity-0 hover:text-foreground focus-visible:opacity-100 group-hover/row:opacity-100"
        >
          out
        </button>
      )}
    </div>
  );
}
