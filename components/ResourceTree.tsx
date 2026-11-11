"use client";

import { useState } from "react";
import { ChevronRight, FileText, Folder as FolderIcon, FolderPlus, Loader2, Sparkles, Trash2 } from "lucide-react";
import { tree } from "@/lib/resources";
import type { Workspace } from "@/lib/workspace";

/**
 * The workspace's shelf: folders and what is in them.
 *
 * A person can make a folder and file things by hand; the model can propose the
 * same, and its deletions arrive here as a single question rather than a fait
 * accompli. Nothing in this component can lose work without a click.
 */
export function ResourceTree({
  workspace,
  onOpen,
  onNewFolder,
  onMove,
  onDelete,
  onTidy,
  tidyBusy,
}: {
  workspace: Workspace;
  onOpen: (analysisId: string) => void;
  onNewFolder: (name: string) => void;
  onMove: (resourceId: string, folderId: string | null) => void;
  onDelete: (target: { resourceId?: string; folderId?: string }) => void;
  onTidy: () => void;
  tidyBusy: boolean;
}) {
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const view = tree(workspace);
  const empty = view.root.length === 0 && view.folders.every((f) => f.items.length === 0);

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

  return (
    <div className="flex flex-col gap-[0.375rem]">
      <div className="flex items-center justify-between gap-[0.5rem]">
        <span className="lb-label text-[0.625rem] text-ink-3">Workspace</span>
        <div className="flex items-center gap-[0.25rem]">
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex items-center gap-[0.1875rem] rounded-[var(--to-radius-sm)] px-[0.1875rem] text-[0.6875rem] text-ink-3 hover:text-foreground"
          >
            <FolderPlus aria-hidden className="size-3" /> Folder
          </button>
          <button
            type="button"
            onClick={onTidy}
            disabled={tidyBusy || empty}
            className="flex items-center gap-[0.1875rem] rounded-[var(--to-radius-sm)] px-[0.1875rem] text-[0.6875rem] text-ink-3 hover:text-foreground disabled:opacity-40"
          >
            {tidyBusy ? <Loader2 aria-hidden className="size-3 animate-spin" /> : <Sparkles aria-hidden className="size-3" />}
            Tidy
          </button>
        </div>
      </div>

      {creating && (
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
          className="border border-[var(--to-border)] bg-transparent px-[0.375rem] py-[0.1875rem] text-[0.8125rem] outline-none focus:border-[var(--to-border-strong)]"
        />
      )}

      {empty && !creating && (
        <p className="px-[0.125rem] py-[0.125rem] text-[0.75rem] leading-[1.5] text-ink-3">
          Reports and notes will collect here. Make a folder to keep them apart.
        </p>
      )}

      <ul className="flex flex-col">
        {view.folders.map(({ folder, items }) => {
          const open = openIds.has(folder.id);
          return (
            <li key={folder.id}>
              <div className="group/row flex items-center">
                <button
                  type="button"
                  onClick={() => toggle(folder.id)}
                  aria-expanded={open}
                  className="flex min-w-0 flex-1 items-center gap-[0.25rem] py-[0.1875rem] text-left"
                >
                  <ChevronRight
                    aria-hidden
                    className={`size-3 shrink-0 text-ink-3 transition-transform ${open ? "rotate-90" : ""}`}
                  />
                  <FolderIcon aria-hidden className="size-3.5 shrink-0 text-ink-3" />
                  <span className="truncate text-[0.8125rem] text-ink-2">{folder.name}</span>
                  <span className="ml-auto shrink-0 text-[0.6875rem] tabular-nums text-ink-3">{items.length}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onDelete({ folderId: folder.id })}
                  aria-label={`Delete the folder ${folder.name}`}
                  className="ml-[0.25rem] rounded-[var(--to-radius-sm)] p-[0.125rem] text-ink-3 opacity-0 hover:text-[var(--to-danger)] focus-visible:opacity-100 group-hover/row:opacity-100"
                >
                  <Trash2 aria-hidden className="size-3" />
                </button>
              </div>

              {open && (
                <ul className="ml-[1.125rem] border-l border-[var(--to-border)] pl-[0.375rem]">
                  {items.length === 0 && <li className="py-[0.125rem] text-[0.75rem] text-ink-3">Empty</li>}
                  {items.map((resource) => (
                    <Row
                      key={resource.id}
                      title={resource.title}
                      kind={resource.kind}
                      onOpen={resource.analysisId ? () => onOpen(resource.analysisId!) : undefined}
                      onDelete={() => onDelete({ resourceId: resource.id })}
                      onMoveToRoot={resource.folderId ? () => onMove(resource.id, null) : undefined}
                    />
                  ))}
                </ul>
              )}
            </li>
          );
        })}

        {view.root.map((resource) => (
          <li key={resource.id}>
            <Row
              title={resource.title}
              kind={resource.kind}
              onOpen={resource.analysisId ? () => onOpen(resource.analysisId!) : undefined}
              onDelete={() => onDelete({ resourceId: resource.id })}
              onMoveToFolder={
                view.folders.length
                  ? (folderId) => onMove(resource.id, folderId)
                  : undefined
              }
              folders={view.folders.map((f) => ({ id: f.folder.id, name: f.folder.name }))}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Row({
  title,
  kind,
  onOpen,
  onDelete,
  onMoveToRoot,
  onMoveToFolder,
  folders,
}: {
  title: string;
  kind: string;
  onOpen?: () => void;
  onDelete: () => void;
  onMoveToRoot?: () => void;
  onMoveToFolder?: (folderId: string) => void;
  folders?: { id: string; name: string }[];
}) {
  return (
    <div className="group/row flex items-center">
      <button
        type="button"
        onClick={onOpen}
        disabled={!onOpen}
        className="flex min-w-0 flex-1 items-center gap-[0.3125rem] py-[0.1875rem] text-left disabled:cursor-default"
      >
        <FileText aria-hidden className="size-3 shrink-0 text-ink-3" />
        <span className="min-w-0 truncate text-[0.8125rem] text-ink-2">{title}</span>
        <span className="ml-auto shrink-0 text-[0.625rem] text-ink-3">{kind}</span>
      </button>

      {folders && folders.length > 0 && onMoveToFolder && (
        <select
          aria-label={`File ${title} into a folder`}
          value=""
          onChange={(event) => {
            if (event.target.value) onMoveToFolder(event.target.value);
            event.target.value = "";
          }}
          className="mr-[0.25rem] max-w-[5rem] bg-transparent text-[0.6875rem] text-ink-3 opacity-0 focus-visible:opacity-100 group-hover/row:opacity-100"
        >
          <option value="">File into…</option>
          {folders.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {folder.name}
            </option>
          ))}
        </select>
      )}

      {onMoveToRoot && (
        <button
          type="button"
          onClick={onMoveToRoot}
          className="rounded-[var(--to-radius-sm)] px-[0.1875rem] text-[0.625rem] text-ink-3 opacity-0 hover:text-foreground focus-visible:opacity-100 group-hover/row:opacity-100"
        >
          out
        </button>
      )}

      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${title}`}
        className="rounded-[var(--to-radius-sm)] p-[0.125rem] text-ink-3 opacity-0 hover:text-[var(--to-danger)] focus-visible:opacity-100 group-hover/row:opacity-100"
      >
        <Trash2 aria-hidden className="size-3" />
      </button>
    </div>
  );
}
