"use client";

import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Analysis } from "@/lib/schema";
import type { Workspace } from "@/lib/workspace";
import { workspaceFacts } from "@/lib/workspace";
import { cn } from "@/lib/utils";

/**
 * The workspace panel.
 *
 * Hidden until asked for, and an overlay rather than a column: the reference
 * treats the workspace as somewhere you go, not a fixture taking 250px of every
 * screen. Identity lives here too, so the canvas above it has no header.
 */
export function WorkspacePanel({
  open,
  onClose,
  workspaces,
  currentId,
  analyses,
  onSelect,
  onCreate,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  workspaces: Workspace[];
  currentId: string | null;
  analyses: Record<string, Analysis>;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}) {
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/10" onClick={onClose} aria-hidden />}

      <aside
        aria-label="Workspaces"
        aria-hidden={!open}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[16.5rem] flex-col border-r border-border bg-background transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between gap-[0.5rem] px-[0.75rem] py-[0.625rem]">
          <a href="/" className="lb-wordmark flex items-center gap-[0.4em] text-[0.9375rem] text-foreground no-underline">
            <BeamMark />
            Load-Bearing
          </a>
          <Button variant="ghost" size="icon" className="size-7" onClick={onClose} aria-label="Close workspaces">
            <X className="size-3.5" />
          </Button>
        </div>

        <p className="lb-label px-[0.875rem] pb-[0.375rem] text-[0.6875rem]">Workspaces</p>

        <nav className="flex min-h-0 flex-1 flex-col gap-[0.125rem] overflow-y-auto px-[0.375rem]">
          {workspaces.map((workspace) => {
            const active = workspace.id === currentId;
            const facts = workspaceFacts(workspace, analyses);
            return (
              <div key={workspace.id} className="group/ws relative">
                <button
                  onClick={() => onSelect(workspace.id)}
                  title={workspace.name}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "flex w-full items-center gap-[0.5rem] rounded-[var(--to-radius-sm)] py-[0.4375rem] pr-[1.75rem] pl-[0.5rem] text-left transition-colors",
                    active ? "bg-[var(--to-accent-soft)]" : "hover:bg-[var(--to-surface-2)]"
                  )}
                >
                  <span className="min-w-0 flex-1 truncate text-[0.8125rem] leading-[1.4]">{workspace.name}</span>
                  <span className="lb-mono shrink-0 text-[0.6875rem] text-ink-3">{facts.reports}</span>
                </button>

                <button
                  onClick={() => setPendingDelete(workspace.id)}
                  className="absolute top-1/2 right-[0.375rem] hidden size-6 -translate-y-1/2 items-center justify-center rounded-[4px] text-ink-3 hover:text-[var(--lb-load)] group-hover/ws:flex"
                  aria-label={`Delete ${workspace.name}`}
                >
                  <Trash2 className="size-3" />
                </button>

                {pendingDelete === workspace.id && (
                  <div className="mt-[0.25rem] mb-[0.5rem] rounded-[var(--to-radius-sm)] border border-[var(--to-border)] p-[0.5rem]">
                    <p className="text-[0.75rem] leading-[1.45] text-ink-2">
                      Delete “{workspace.name}”? Reports kept in storage stay where they are.
                    </p>
                    <div className="mt-[0.375rem] flex gap-[0.25rem]">
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7 text-[0.75rem]"
                        onClick={() => {
                          onDelete(workspace.id);
                          setPendingDelete(null);
                        }}
                      >
                        Delete
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-[0.75rem]" onClick={() => setPendingDelete(null)}>
                        Keep
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="border-t border-border p-[0.5rem]">
          <Button variant="outline" size="sm" className="w-full justify-start gap-[0.5rem]" onClick={onCreate}>
            <Plus className="size-3.5" /> New workspace
          </Button>
        </div>
      </aside>
    </>
  );
}

function BeamMark() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className="size-[1em] shrink-0">
      <path d="M3 17 10 3l7 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M6.2 11h7.6M10 3v14" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
