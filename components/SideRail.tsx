"use client";

import { useState } from "react";
import {
  ChevronRight,
  FileText,
  FolderPlus,
  FolderClosed,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";
import { tree, type Verdict } from "@/lib/resources";
import type { Workspace } from "@/lib/workspace";

/**
 * The right rail: your files on top, your workspaces underneath.
 *
 * It follows the reference's right panel — a tabbed card that takes the height,
 * a smaller card below it with a header and a `+`. Files are the tab you land
 * on, because that is what you come here to find; Activity is everything the
 * model proposed and what it was allowed to do.
 *
 * Nothing here deletes on its own. A deletion arrives in Activity as one line
 * with the model's own reason beside it and two buttons.
 */
export function SideRail({
  workspace,
  workspaces,
  currentId,
  proposal,
  tidyBusy,
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
    <>
      {/* Card one: the tabbed shelf. Takes the height, scrolls inside. */}
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--to-radius)] border border-[var(--to-border)]">
        <div
          role="tablist"
          aria-label="Files and activity"
          className="flex shrink-0 gap-[0.25rem] p-[0.25rem]"
        >
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
            {/* The reference's full-width row inside the card. */}
            <button
              type="button"
              onClick={() => {
                setCreating((value) => !value);
                setDraft("");
              }}
              className="flex w-full shrink-0 items-center gap-[0.375rem] border-t border-b border-[var(--to-border)] bg-[var(--to-surface)] px-[0.5rem] py-[0.375rem] text-left text-[0.75rem] text-ink-2 hover:bg-[var(--to-surface-2)] hover:text-foreground"
            >
              <FolderPlus aria-hidden className="size-3.5 shrink-0 text-ink-3" />
              New folder
              <ChevronRight aria-hidden className="ml-auto size-3 shrink-0 text-ink-3" />
            </button>

            {creating && (
              <div className="shrink-0 border-b border-[var(--to-border)] px-[0.5rem] py-[0.375rem]">
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
                  className="w-full border border-[var(--to-border)] bg-transparent px-[0.375rem] py-[0.1875rem] text-[0.75rem] outline-none focus:border-[var(--to-border-strong)]"
                />
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto py-[0.1875rem]">
              {empty && !creating && (
                <p className="px-[0.5rem] py-[0.375rem] text-[0.75rem] leading-[1.5] text-ink-3">
                  Reports and notes collect here once you run a plan. Make a folder to keep them
                  apart.
                </p>
              )}

              <ul className="flex flex-col">
                {view?.folders.map(({ folder, items }) => {
                  const open = openIds.has(folder.id);
                  return (
                    <li key={folder.id}>
                      <div className="group/row flex items-center pr-[0.25rem] hover:bg-[var(--to-surface-2)]">
                        <button
                          type="button"
                          onClick={() => toggle(folder.id)}
                          aria-expanded={open}
                          className="flex min-w-0 flex-1 items-center gap-[0.25rem] px-[0.5rem] py-[0.25rem] text-left"
                        >
                          <ChevronRight
                            aria-hidden
                            className={`size-3 shrink-0 text-ink-3 transition-transform ${
                              open ? "rotate-90" : ""
                            }`}
                          />
                          <FolderClosed aria-hidden className="size-3.5 shrink-0 text-ink-3" />
                          <span className="min-w-0 truncate text-[0.75rem] text-ink-2">
                            {folder.name}
                          </span>
                          <span className="ml-auto shrink-0 text-[0.625rem] tabular-nums text-ink-3">
                            {items.length}
                          </span>
                        </button>
                      </div>

                      {open && (
                        <ul className="ml-[1rem] border-l border-[var(--to-border)] pl-[0.3125rem]">
                          {items.length === 0 && (
                            <li className="px-[0.375rem] py-[0.125rem] text-[0.6875rem] text-ink-3">
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
            {/* The same full-width row, for the model's own pass over the files. */}
            <button
              type="button"
              onClick={onTidy}
              disabled={tidyBusy || empty}
              aria-label="Ask the model to tidy the files"
              className="flex w-full items-center gap-[0.375rem] border-t border-b border-[var(--to-border)] bg-[var(--to-surface)] px-[0.5rem] py-[0.375rem] text-left text-[0.75rem] text-ink-2 hover:bg-[var(--to-surface-2)] hover:text-foreground disabled:opacity-50 disabled:hover:bg-[var(--to-surface)]"
            >
              {tidyBusy ? (
                <Loader2 aria-hidden className="size-3.5 shrink-0 animate-spin text-ink-3" />
              ) : (
                <Sparkles aria-hidden className="size-3.5 shrink-0 text-ink-3" />
              )}
              {tidyBusy ? "Tidying…" : "Tidy the files"}
              <ChevronRight aria-hidden className="ml-auto size-3 shrink-0 text-ink-3" />
            </button>

            <div className="flex flex-col gap-[0.375rem] px-[0.5rem] py-[0.5rem]">
              {!proposal && (
                <p className="text-[0.75rem] leading-[1.5] text-ink-3">
                  Nothing proposed yet. Tidying asks the model to group what you have — it can
                  suggest a change, it cannot delete one.
                </p>
              )}

              {proposal && (
                <>
                  <p className="text-[0.6875rem] text-ink-3">
                    {pending.length > 0
                      ? `${pending.length} deletion${pending.length === 1 ? "" : "s"} waiting for you`
                      : applied.length > 0
                        ? `${applied.length} change${applied.length === 1 ? "" : "s"} applied`
                        : "Nothing was changed"}
                  </p>

                  {applied.length > 0 && (
                    <ul className="flex flex-col gap-[0.125rem]">
                      {applied.map((verdict, index) => (
                        <li
                          key={index}
                          className="flex items-start gap-[0.25rem] text-[0.6875rem] leading-[1.5] text-ink-3"
                        >
                          <span aria-hidden className="mt-[0.125rem] shrink-0 text-[var(--to-success)]">
                            ✓
                          </span>
                          {verdict.summary}
                        </li>
                      ))}
                    </ul>
                  )}

                  {pending.length > 0 && (
                    <ul className="flex flex-col gap-[0.375rem] border-t border-[var(--to-border)] pt-[0.375rem]">
                      {pending.map((verdict, index) => (
                        <li key={index} className="flex flex-col gap-[0.1875rem]">
                          <span className="text-[0.6875rem] leading-[1.5] text-ink-2">
                            {verdict.summary}
                            {verdict.action.reason && (
                              <span className="block text-[0.625rem] text-ink-3">
                                “{verdict.action.reason}”
                              </span>
                            )}
                          </span>
                          <span className="flex items-center gap-[0.25rem]">
                            <button
                              type="button"
                              onClick={() => onApprove(verdict)}
                              className="border border-[var(--to-border-strong)] px-[0.3125rem] py-[0.0625rem] text-[0.625rem] hover:bg-[var(--to-surface-2)]"
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => onReject(verdict)}
                              className="px-[0.25rem] py-[0.0625rem] text-[0.625rem] text-ink-3 hover:text-foreground"
                            >
                              Keep
                            </button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {proposal.note && (
                    <p className="text-[0.625rem] leading-[1.5] text-ink-3">{proposal.note}</p>
                  )}

                  <button
                    type="button"
                    onClick={onDismissProposal}
                    className="self-start text-[0.625rem] text-ink-3 underline-offset-2 hover:text-foreground hover:underline"
                  >
                    Dismiss
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Card two: the smaller box, header with `+`, then the workspaces. */}
      <section className="shrink-0 rounded-[var(--to-radius)] border border-[var(--to-border)]">
        <div className="flex items-center gap-[0.25rem] px-[0.5rem] py-[0.3125rem]">
          <span className="min-w-0 flex-1 truncate text-[0.75rem] text-ink-2">Workspaces</span>
          <button
            type="button"
            onClick={() => setSearching((value) => !value)}
            aria-label="Find a workspace or file"
            aria-expanded={searching}
            className="rounded-[var(--to-radius-sm)] p-[0.125rem] text-ink-3 hover:bg-[var(--to-surface-2)] hover:text-foreground"
          >
            <Search aria-hidden className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onNewChat}
            aria-label="New chat"
            className="rounded-[var(--to-radius-sm)] p-[0.125rem] text-ink-3 hover:bg-[var(--to-surface-2)] hover:text-foreground"
          >
            <Plus aria-hidden className="size-3.5" />
          </button>
        </div>

        {searching && (
          <div className="border-t border-[var(--to-border)] px-[0.5rem] py-[0.3125rem]">
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
              className="w-full border border-[var(--to-border)] bg-transparent px-[0.375rem] py-[0.125rem] text-[0.75rem] outline-none focus:border-[var(--to-border-strong)]"
            />
          </div>
        )}

        <ul className="max-h-[13rem] overflow-y-auto border-t border-[var(--to-border)] py-[0.1875rem]">
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
                    className="flex min-w-0 flex-1 items-center gap-[0.375rem] px-[0.5rem] py-[0.25rem] text-left"
                  >
                    <span
                      className={`min-w-0 truncate text-[0.75rem] ${
                        active ? "text-foreground" : "text-ink-2"
                      }`}
                    >
                      {w.name}
                    </span>
                    <span className="ml-auto shrink-0 text-[0.625rem] tabular-nums text-ink-3">
                      {reports}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(w.id)}
                    aria-label={`Delete ${w.name}`}
                    className="mr-[0.375rem] shrink-0 rounded-[var(--to-radius-sm)] p-[0.0625rem] text-ink-3 opacity-0 hover:text-[var(--to-danger)] focus-visible:opacity-100 group-hover/row:opacity-100"
                  >
                    <Trash2 aria-hidden className="size-3" />
                  </button>
                </div>

                {deleting && (
                  <div className="bg-[var(--to-surface)] px-[0.5rem] py-[0.25rem]">
                    <p className="text-[0.6875rem] leading-[1.5] text-ink-3">
                      Delete “{w.name}” and the reports in it?
                    </p>
                    <span className="mt-[0.125rem] flex items-center gap-[0.25rem]">
                      <button
                        type="button"
                        onClick={() => {
                          onDelete(w.id);
                          setPendingDelete(null);
                        }}
                        className="border border-[var(--to-border-strong)] px-[0.3125rem] py-[0.0625rem] text-[0.625rem]"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(null)}
                        className="px-[0.25rem] py-[0.0625rem] text-[0.625rem] text-ink-3 hover:text-foreground"
                      >
                        Keep
                      </button>
                    </span>
                  </div>
                )}
              </li>
            );
          })}

          {shown.length === 0 && (
            <li className="px-[0.5rem] py-[0.25rem] text-[0.75rem] text-ink-3">Nothing matches.</li>
          )}
        </ul>
      </section>
    </>
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
      className={`flex flex-1 items-center justify-center gap-[0.25rem] rounded-[var(--to-radius-sm)] border px-[0.375rem] py-[0.1875rem] text-[0.75rem] transition-colors ${
        active
          ? "border-[var(--to-border)] bg-[var(--to-surface-2)] text-foreground"
          : "border-transparent text-ink-3 hover:text-foreground"
      }`}
    >
      {label}
      {Boolean(badge) && (
        <span className="rounded-[var(--to-radius-pill)] bg-[var(--to-warning)] px-[0.25rem] text-[0.5625rem] leading-[1.4] text-[var(--to-bg)] tabular-nums">
          {badge}
        </span>
      )}
    </button>
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
    <div className="flex items-center pr-[0.25rem] hover:bg-[var(--to-surface-2)]">
      <button
        type="button"
        onClick={onOpen}
        disabled={!onOpen}
        className="flex min-w-0 flex-1 items-center gap-[0.25rem] px-[0.5rem] py-[0.25rem] text-left text-[0.75rem] text-ink-3 hover:text-foreground disabled:cursor-default disabled:hover:text-ink-3"
      >
        <FileText aria-hidden className="size-3 shrink-0" />
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
          className="mr-[0.25rem] max-w-[4.5rem] shrink-0 bg-transparent text-[0.625rem] text-ink-3 opacity-0 focus-visible:opacity-100 group-hover/row:opacity-100"
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
          className="shrink-0 px-[0.125rem] text-[0.625rem] text-ink-3 opacity-0 hover:text-foreground focus-visible:opacity-100 group-hover/row:opacity-100"
        >
          out
        </button>
      )}
    </div>
  );
}
