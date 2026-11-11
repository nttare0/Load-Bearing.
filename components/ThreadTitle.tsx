"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Plus, Trash2 } from "lucide-react";

/**
 * The thread's name, top-left, as a control rather than a heading.
 *
 * The reference puts the thing you are working on in the corner with a caret
 * beside it: clicking it switches what you are looking at, and renames it in
 * place. Nothing here is a separate settings screen, because a workspace is one
 * name and a list of reports.
 */
export function ThreadTitle({
  name,
  workspaces,
  currentId,
  onRename,
  onSelect,
  onDelete,
  onCreate,
}: {
  name: string;
  workspaces: { id: string; name: string; reports: number }[];
  currentId: string | null;
  onRename: (name: string) => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const commit = () => {
    const next = (draft ?? "").trim();
    if (next && next !== name) onRename(next);
    setDraft(null);
  };

  return (
    <div ref={rootRef} className="relative min-w-0">
      <div className="flex h-7 min-w-0 items-center">
        {draft === null ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-haspopup="menu"
            className="flex min-w-0 items-center gap-[0.3125rem] rounded-[var(--to-radius-sm)] px-[0.25rem] text-[0.875rem] text-ink-2 hover:bg-[var(--to-surface-2)] hover:text-foreground"
          >
            <span className="max-w-[14rem] truncate">{name}</span>
            <ChevronDown aria-hidden className="size-3.5 shrink-0 text-ink-3" />
          </button>
        ) : (
          <input
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === "Enter") commit();
              if (event.key === "Escape") setDraft(null);
            }}
            aria-label="Workspace name"
            className="w-[14rem] rounded-[var(--to-radius-sm)] border border-[var(--to-border-strong)] bg-transparent px-[0.25rem] text-[0.875rem] outline-none"
          />
        )}
      </div>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-[1.875rem] z-50 w-[16rem] rounded-[0.5rem] border border-[var(--to-border)] bg-[var(--to-surface)] py-[0.25rem] shadow-[var(--to-shadow-pop)]"
        >
          <div className="flex items-center justify-between px-[0.5rem] py-[0.1875rem]">
            <span className="lb-label text-[0.625rem] text-ink-3">Workspaces</span>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onCreate();
              }}
              className="flex items-center gap-[0.1875rem] rounded-[var(--to-radius-sm)] px-[0.1875rem] text-[0.6875rem] text-ink-3 hover:text-foreground"
            >
              <Plus aria-hidden className="size-3" /> New
            </button>
          </div>

          <ul className="max-h-[16rem] overflow-y-auto">
            {workspaces.map((workspace) => {
              const active = workspace.id === currentId;
              return (
                <li key={workspace.id} className="group/row flex items-center">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onSelect(workspace.id);
                      setOpen(false);
                    }}
                    className="flex min-w-0 flex-1 items-center gap-[0.375rem] px-[0.5rem] py-[0.3125rem] text-left hover:bg-[var(--to-surface-2)]"
                  >
                    <Check
                      aria-hidden
                      className={`size-3 shrink-0 ${active ? "text-foreground" : "text-transparent"}`}
                    />
                    <span
                      className={`min-w-0 truncate text-[0.8125rem] ${active ? "text-foreground" : "text-ink-2"}`}
                    >
                      {workspace.name}
                    </span>
                    <span className="ml-auto shrink-0 text-[0.6875rem] tabular-nums text-ink-3">
                      {workspace.reports}
                    </span>
                  </button>
                  {workspaces.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onDelete(workspace.id)}
                      aria-label={`Delete ${workspace.name}`}
                      className="mr-[0.375rem] rounded-[var(--to-radius-sm)] p-[0.1875rem] text-ink-3 opacity-0 hover:text-[var(--to-danger)] focus-visible:opacity-100 group-hover/row:opacity-100"
                    >
                      <Trash2 aria-hidden className="size-3" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="mt-[0.1875rem] border-t border-[var(--to-border)] pt-[0.1875rem]">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setDraft(name);
              }}
              className="w-full px-[0.5rem] py-[0.3125rem] text-left text-[0.75rem] text-ink-2 hover:bg-[var(--to-surface-2)] hover:text-foreground"
            >
              Rename this workspace
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
