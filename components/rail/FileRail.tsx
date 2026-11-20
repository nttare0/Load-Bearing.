"use client";

import { useState } from "react";
import {
  ChevronRight,
  FileText,
  FolderClosed,
  FolderPlus,
  Loader2,
  Sparkles,
} from "lucide-react";
import { AiStatus } from "@/components/rare/ai-status";
import { DeleteButton } from "@/components/rare/delete-button";
import { CARD, FULL_ROW, InlineInput, Tab } from "@/components/rail/parts";
import { tree, type Verdict } from "@/lib/resources";
import type { Workspace } from "@/lib/workspace";

/**
 * Files and Activity, in their own card.
 *
 * They used to sit above Workspaces in one stack. Splitting them out is what
 * lets the left column be *where you are* and the right column be *what is in
 * it* — the two questions a person holds at once, and the reason they were
 * confusing when both answered from the same column.
 *
 * Nothing here deletes on its own: a deletion arrives in Activity as one line
 * with the model's own reason beside it, and the bin must be pressed twice.
 */
export function FileRail({
  workspace,
  proposal,
  tidyBusy,
  stage,
  mode,
  onTidy,
  onApprove,
  onReject,
  onDismissProposal,
  onNewFolder,
  onOpenResource,
  onFileChanged,
}: {
  workspace: Workspace | null;
  proposal: { verdicts: Verdict[]; note?: string } | null;
  tidyBusy: boolean;
  stage: string | null;
  mode: "demo" | "live" | null;
  onTidy: () => void;
  onApprove: (verdict: Verdict) => void;
  onReject: (verdict: Verdict) => void;
  onDismissProposal: () => void;
  onNewFolder: (name: string) => void;
  onOpenResource: (analysisId: string) => void;
  onFileChanged: (resourceId: string, folderId: string | null) => void;
}) {
  // Activity is where you land when the model is waiting on you: a question is
  // not something to go looking for.
  const pending = proposal?.verdicts.filter((v) => v.needsApproval) ?? [];
  const applied = proposal?.verdicts.filter((v) => v.applies) ?? [];
  const [picked, setPicked] = useState<"files" | "activity" | null>(null);
  const tab = picked ?? (pending.length > 0 ? "activity" : "files");

  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

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
      {/* What the run is doing right now, above the files it is producing. */}
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

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div role="tablist" aria-label="Files and activity" className="flex shrink-0 gap-[0.375rem]">
          <Tab
            label="Files"
            active={tab === "files"}
            onSelect={() => setPicked("files")}
            controls="panel-files"
          />
          <Tab
            label="Activity"
            active={tab === "activity"}
            onSelect={() => setPicked("activity")}
            badge={pending.length}
            controls="panel-activity"
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
              <InlineInput
                value={draft}
                onChange={setDraft}
                placeholder="Folder name"
                onSubmit={commitFolder}
                onCancel={() => {
                  setDraft("");
                  setCreating(false);
                }}
              />
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
    </div>
  );
}

/**
 * A stage name, in the status component's vocabulary. It has its own drawn icons
 * for thinking, researching, analysing and writing, so the pipeline's labels
 * only need mapping onto them.
 */
function statusState(stage: string): string {
  const label = stage.toLowerCase();
  if (/search|research|verif|evidence/.test(label)) return "researching";
  if (/writ|draft|report|summary|test/.test(label)) return "writing";
  if (/scor|rank|map|audit|claim/.test(label)) return "analyzing";
  return "thinking";
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
