"use client";

import { useState } from "react";
import { ChevronLeft, MessageSquare, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Workspace } from "@/lib/workspace";
import type { Analysis } from "@/lib/schema";
import { workspaceFacts } from "@/lib/workspace";

/**
 * The workspace rail.
 *
 * Collapses to a strip of icons and opens to a list, like the reference: the
 * count of reports is the only number shown, because it is the only one the
 * user can act on from here. Everything else is a name.
 */
export function WorkspaceRail({
  workspaces,
  currentId,
  analyses,
  onSelect,
  onCreate,
  onDelete,
  collapsed,
  onToggle,
}: {
  workspaces: Workspace[];
  currentId: string | null;
  analyses: Record<string, Analysis>;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  return (
    <aside
      className={cn(
        // Below lg the rail is an overlay that slides in, because there is no
        // room to keep it. At lg it is a column that collapses to icons.
        "fixed inset-y-0 left-0 z-40 flex h-dvh w-[15.5rem] shrink-0 flex-col border-r border-border bg-background transition-[transform,width] duration-150",
        "lg:sticky lg:top-0 lg:z-auto lg:translate-x-0",
        collapsed ? "-translate-x-full lg:w-[3.25rem]" : "translate-x-0 lg:w-[15.5rem]"
      )}
      aria-label="Workspaces"
    >
      <div className={cn("flex h-[var(--to-header-h)] items-center border-b border-border", collapsed ? "justify-center" : "justify-between px-[0.875rem]")}>
        {!collapsed && <span className="lb-label text-[0.6875rem]">Workspaces</span>}
        <div className="flex items-center gap-[0.25rem]">
          {!collapsed && (
            <Button variant="ghost" size="icon" className="size-7" onClick={onCreate} aria-label="New workspace">
              <Plus className="size-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={onToggle}
            aria-label={collapsed ? "Open workspaces" : "Close workspaces"}
            aria-expanded={!collapsed}
          >
            <ChevronLeft className={cn("size-3.5 transition-transform", collapsed && "rotate-180")} />
          </Button>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-[0.125rem] overflow-y-auto p-[0.375rem]">
        {workspaces.length === 0 && (
          <p className={collapsed ? "sr-only" : "px-[0.5rem] py-[0.5rem] text-[0.8125rem] leading-[1.5] text-ink-3"}>
            No workspaces yet. One is created for you on first load.
          </p>
        )}

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
                  "flex w-full items-center gap-[0.5rem] rounded-[var(--to-radius-sm)] py-[0.4375rem] text-left transition-colors",
                  collapsed ? "justify-center px-0" : "px-[0.5rem]",
                  active
                    ? "bg-[var(--to-accent-soft)] text-foreground"
                    : "text-ink-2 hover:bg-[var(--to-surface-2)]"
                )}
              >
                <MessageSquare className="size-3.5 shrink-0" aria-hidden />
                {!collapsed && (
                  <>
                    <span className="min-w-0 flex-1 truncate text-[0.8125rem] leading-[1.4]">{workspace.name}</span>
                    <span className="lb-mono shrink-0 text-[0.6875rem] text-ink-3">{facts.reports}</span>
                  </>
                )}
              </button>

              {!collapsed && (
                <button
                  onClick={() => setPendingDelete(workspace.id)}
                  className="absolute top-1/2 right-[0.25rem] hidden size-6 -translate-y-1/2 items-center justify-center rounded-[4px] text-ink-3 hover:text-[var(--lb-load)] group-hover/ws:flex"
                  aria-label={`Delete ${workspace.name}`}
                >
                  <Trash2 className="size-3" />
                </button>
              )}

              {pendingDelete === workspace.id && (
                <div className="mt-[0.25rem] mb-[0.375rem] rounded-[var(--to-radius-sm)] border border-[var(--to-border)] p-[0.5rem]">
                  <p className="text-[0.75rem] leading-[1.45] text-ink-2">
                    Delete “{workspace.name}” and its thread? Reports saved to storage stay where they are.
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

      <div className={cn("border-t border-border p-[0.5rem]", collapsed && "flex justify-center")}>
        <Button
          variant="outline"
          size="sm"
          className={cn("gap-[0.5rem]", collapsed ? "size-8 p-0" : "w-full justify-start")}
          onClick={onCreate}
          aria-label="New workspace"
        >
          <Plus className="size-3.5" />
          {!collapsed && "New workspace"}
        </Button>
      </div>
    </aside>
  );
}
