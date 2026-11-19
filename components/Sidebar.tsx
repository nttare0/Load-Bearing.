"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  FolderClosed,
  FolderPlus,
  PanelLeftClose,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";
import { workspaceFacts } from "@/lib/workspace";
import { tree } from "@/lib/resources";
import type { Workspace } from "@/lib/workspace";

/**
 * The sidebar.
 *
 * Modelled on arena.ai/agent's: one primary action at the top, a couple of
 * quiet entries under it, then the history — here, workspaces — with their own
 * folders and files nested inside. Identity sits at the bottom.
 *
 * It is a column, not a drawer: the reference keeps it visible because moving
 * between pieces of work is the most common thing anyone does in it. It folds
 * to a rail below `md` rather than disappearing.
 */
export function Sidebar({
  workspaces,
  currentId,
  onSelect,
  onCreate,
  onDelete,
  onNewChat,
  collapsed,
  onToggleCollapse,
  onNewFolder,
  onOpenResource,
  onFileChanged,
}: {
  workspaces: { workspace: Workspace; reports: number }[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onNewChat: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onNewFolder: (workspaceId: string, name: string) => void;
  onOpenResource: (workspaceId: string, analysisId: string) => void;
  onFileChanged: (workspaceId: string, resourceId: string, folderId: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [folderFor, setFolderFor] = useState<string | null>(null);
  const [folderName, setFolderName] = useState("");

  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const term = query.trim().toLowerCase();
  const shown = term
    ? workspaces.filter(
        ({ workspace }) =>
          workspace.name.toLowerCase().includes(term) ||
          workspace.resources.some((r) => r.title.toLowerCase().includes(term))
      )
    : workspaces;

  if (collapsed) {
    return (
      <nav
        aria-label="Workspaces"
        className="hidden w-[3rem] shrink-0 flex-col items-center gap-[0.375rem] border-r border-[var(--to-border)] py-[0.625rem] md:flex"
      >
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label="Open the sidebar"
          className="rounded-[var(--to-radius-sm)] p-[0.3125rem] text-ink-3 hover:bg-[var(--to-surface-2)] hover:text-foreground"
        >
          <PanelLeftClose className="size-4 rotate-180" />
        </button>
        <button
          type="button"
          onClick={onNewChat}
          aria-label="New chat"
          className="rounded-[var(--to-radius-sm)] p-[0.3125rem] text-ink-3 hover:bg-[var(--to-surface-2)] hover:text-foreground"
        >
          <Plus className="size-4" />
        </button>
      </nav>
    );
  }

  return (
    <nav
      aria-label="Workspaces"
      className="hidden w-[15.5rem] shrink-0 flex-col border-r border-[var(--to-border)] md:flex"
    >
      <div className="flex items-center gap-[0.25rem] px-[0.5rem] py-[0.5rem]">
        <button
          type="button"
          onClick={onNewChat}
          className="flex min-w-0 flex-1 items-center gap-[0.375rem] rounded-[var(--to-radius-sm)] px-[0.375rem] py-[0.25rem] text-[0.8125rem] text-ink-2 hover:bg-[var(--to-surface-2)] hover:text-foreground"
        >
          <Plus aria-hidden className="size-3.5 shrink-0" />
          New chat
        </button>
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label="Fold the sidebar"
          className="rounded-[var(--to-radius-sm)] p-[0.25rem] text-ink-3 hover:bg-[var(--to-surface-2)] hover:text-foreground"
        >
          <PanelLeftClose className="size-3.5" />
        </button>
      </div>

      <div className="flex flex-col gap-[0.0625rem] px-[0.5rem] pb-[0.5rem]">
        <button
          type="button"
          onClick={() => setSearching((value) => !value)}
          aria-expanded={searching}
          className="flex items-center gap-[0.375rem] rounded-[var(--to-radius-sm)] px-[0.375rem] py-[0.25rem] text-left text-[0.8125rem] text-ink-2 hover:bg-[var(--to-surface-2)] hover:text-foreground"
        >
          <Search aria-hidden className="size-3.5 shrink-0" />
          Search
        </button>

        {searching && (
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
            className="mt-[0.125rem] border border-[var(--to-border)] bg-transparent px-[0.375rem] py-[0.1875rem] text-[0.8125rem] outline-none focus:border-[var(--to-border-strong)]"
          />
        )}

        <button
          type="button"
          onClick={() => setFolderFor(currentId ?? workspaces[0]?.workspace.id ?? null)}
          className="flex items-center gap-[0.375rem] rounded-[var(--to-radius-sm)] px-[0.375rem] py-[0.25rem] text-left text-[0.8125rem] text-ink-2 hover:bg-[var(--to-surface-2)] hover:text-foreground"
        >
          <FolderPlus aria-hidden className="size-3.5 shrink-0" />
          New folder
        </button>
      </div>

      {/* History: workspaces, each holding its folders and files. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-[0.375rem] pb-[0.5rem]">
        <p className="px-[0.5rem] pb-[0.1875rem] pt-[0.25rem] text-[0.6875rem] text-ink-3">
          {term ? `Matches for “${query.trim()}”` : "Workspaces"}
        </p>

        <ul className="flex flex-col">
          {shown.map(({ workspace, reports }) => {
            const active = workspace.id === currentId;
            // The workspace you are in shows its contents without asking: files
            // are how you find your way back to a report.
            const open = workspace.id === currentId || openIds.has(workspace.id) || Boolean(term);
            const view = tree(workspace);
            const empty = view.folders.length === 0 && view.root.length === 0;

            return (
              <li key={workspace.id}>
                <div
                  className={`group/ws flex items-center rounded-[var(--to-radius-sm)] ${
                    active ? "bg-[var(--to-surface-2)]" : "hover:bg-[var(--to-surface-2)]"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggle(workspace.id)}
                    aria-expanded={open}
                    aria-label={open ? "Hide contents" : "Show contents"}
                    className="shrink-0 py-[0.25rem] pl-[0.25rem] pr-[0.0625rem] text-ink-3"
                  >
                    <ChevronRight
                      aria-hidden
                      className={`size-3 transition-transform ${open ? "rotate-90" : ""}`}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelect(workspace.id)}
                    className="flex min-w-0 flex-1 items-center gap-[0.25rem] py-[0.25rem] text-left"
                  >
                    <span
                      className={`min-w-0 truncate text-[0.8125rem] ${
                        active ? "text-foreground" : "text-ink-2"
                      }`}
                    >
                      {workspace.name}
                    </span>
                    <span className="ml-auto shrink-0 pr-[0.25rem] text-[0.6875rem] tabular-nums text-ink-3">
                      {reports}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(workspace.id)}
                    aria-label={`Delete ${workspace.name}`}
                    className="mr-[0.25rem] shrink-0 rounded-[var(--to-radius-sm)] p-[0.125rem] text-ink-3 opacity-0 hover:text-[var(--to-danger)] focus-visible:opacity-100 group-hover/ws:opacity-100"
                  >
                    <Trash2 aria-hidden className="size-3" />
                  </button>
                </div>

                {open && !empty && (
                  <ul className="mb-[0.125rem] ml-[0.75rem] border-l border-[var(--to-border)] pl-[0.3125rem]">
                    {view.folders.map(({ folder, items }) => (
                      <li key={folder.id}>
                        <div className="flex items-center gap-[0.25rem] py-[0.125rem] text-[0.75rem] text-ink-2">
                          <FolderClosed aria-hidden className="size-3 shrink-0 text-ink-3" />
                          <span className="min-w-0 truncate">{folder.name}</span>
                          <span className="ml-auto shrink-0 text-[0.625rem] tabular-nums text-ink-3">
                            {items.length}
                          </span>
                        </div>
                        {items.length > 0 && (
                          <ul className="ml-[0.5rem] border-l border-[var(--to-border)] pl-[0.3125rem]">
                            {items.map((item) => (
                              <li key={item.id}>
                                <button
                                  type="button"
                                  onClick={() => item.analysisId && onOpenResource(workspace.id, item.analysisId)}
                                  disabled={!item.analysisId}
                                  className="flex w-full items-center gap-[0.25rem] py-[0.125rem] text-left text-[0.75rem] text-ink-3 hover:text-foreground disabled:cursor-default disabled:hover:text-ink-3"
                                >
                                  <FileText aria-hidden className="size-3 shrink-0" />
                                  <span className="min-w-0 truncate">{item.title}</span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}

                    {view.root.map((item) => (
                      <li key={item.id}>
                        <div className="group/file flex items-center">
                          <button
                            type="button"
                            onClick={() => item.analysisId && onOpenResource(workspace.id, item.analysisId)}
                            disabled={!item.analysisId}
                            className="flex min-w-0 flex-1 items-center gap-[0.25rem] py-[0.125rem] text-left text-[0.75rem] text-ink-3 hover:text-foreground disabled:cursor-default disabled:hover:text-ink-3"
                          >
                            <FileText aria-hidden className="size-3 shrink-0" />
                            <span className="min-w-0 truncate">{item.title}</span>
                          </button>
                          {view.folders.length > 0 && (
                            <select
                              aria-label={`File ${item.title} into a folder`}
                              value=""
                              onChange={(event) => {
                                if (event.target.value) {
                                  onFileChanged(workspace.id, item.id, event.target.value);
                                }
                                event.target.value = "";
                              }}
                              className="max-w-[4.5rem] shrink-0 bg-transparent text-[0.625rem] text-ink-3 opacity-0 focus-visible:opacity-100 group-hover/file:opacity-100"
                            >
                              <option value="">into…</option>
                              {view.folders.map(({ folder }) => (
                                <option key={folder.id} value={folder.id}>
                                  {folder.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {open && empty && (
                  <p className="mb-[0.125rem] ml-[0.75rem] border-l border-[var(--to-border)] pl-[0.4375rem] text-[0.6875rem] text-ink-3">
                    No files yet
                  </p>
                )}
              </li>
            );
          })}
        </ul>

        {shown.length === 0 && (
          <p className="px-[0.5rem] py-[0.25rem] text-[0.75rem] text-ink-3">Nothing matches.</p>
        )}
      </div>

      <div className="border-t border-[var(--to-border)] px-[0.5rem] py-[0.5rem]">
        <div className="flex items-center gap-[0.375rem] px-[0.25rem] text-[0.75rem] text-ink-3">
          <UserRound aria-hidden className="size-3.5 shrink-0" />
          <span className="min-w-0 truncate">This device</span>
          <Sparkles aria-hidden className="ml-auto size-3 shrink-0" />
        </div>
      </div>

      {/* Rename/delete confirmations, kept local so the sidebar owns them. */}
      {pendingDelete && (
        <div className="border-t border-[var(--to-border)] px-[0.5rem] py-[0.375rem]">
          <p className="text-[0.75rem] text-ink-2">
            Delete “{workspaces.find((w) => w.workspace.id === pendingDelete)?.workspace.name}”?
            Its reports are removed from this workspace.
          </p>
          <div className="mt-[0.25rem] flex items-center gap-[0.375rem]">
            <button
              type="button"
              onClick={() => {
                onDelete(pendingDelete);
                setPendingDelete(null);
              }}
              className="border border-[var(--to-border-strong)] px-[0.375rem] py-[0.125rem] text-[0.6875rem]"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setPendingDelete(null)}
              className="px-[0.25rem] text-[0.6875rem] text-ink-3 hover:text-foreground"
            >
              Keep
            </button>
          </div>
        </div>
      )}

      {folderFor && (
        <div className="border-t border-[var(--to-border)] px-[0.5rem] py-[0.375rem]">
          <input
            autoFocus
            value={folderName}
            onChange={(event) => setFolderName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && folderName.trim()) {
                onNewFolder(folderFor, folderName.trim());
                setFolderName("");
                setFolderFor(null);
              }
              if (event.key === "Escape") {
                setFolderName("");
                setFolderFor(null);
              }
            }}
            placeholder="Folder name"
            aria-label="New folder name"
            className="w-full border border-[var(--to-border)] bg-transparent px-[0.375rem] py-[0.1875rem] text-[0.8125rem] outline-none focus:border-[var(--to-border-strong)]"
          />
        </div>
      )}
    </nav>
  );
}
