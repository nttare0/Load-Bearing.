"use client";

import { useEffect, useMemo, useState } from "react";
import { Archive, Clock3, Plus, Search } from "lucide-react";
import { Card } from "@/components/rail/panels";
import { SessionRow } from "@/components/rail/SessionRow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { groupSessions, searchSessions, type SessionListItem } from "@/lib/session-list";

const PAGE_SIZE = 30;

/** The left-side session history; list state stays local to this panel. */
export function WorkspaceRail({
  workspaces,
  currentId,
  onSelect,
  onCreate,
  onDelete,
  onRename,
  onArchive,
  onRestore,
}: {
  workspaces: SessionListItem[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query), 180);
    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => setVisibleCount(PAGE_SIZE), [debouncedQuery, includeArchived]);

  const matches = useMemo(
    () => searchSessions(workspaces, debouncedQuery, includeArchived),
    [debouncedQuery, includeArchived, workspaces]
  );
  const groups = useMemo(() => groupSessions(matches.slice(0, visibleCount)), [matches, visibleCount]);
  const archivedMatches = useMemo(
    () => searchSessions(workspaces, debouncedQuery, true).filter(({ workspace }) => workspace.archivedAt).length,
    [debouncedQuery, workspaces]
  );

  return (
    <Card grow className="rounded-none border-0">
      <div className="flex shrink-0 flex-col gap-3 border-b border-[var(--to-border)] p-3">
        <a href="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
          <img src="/icon.svg" alt="" width="24" height="24" className="size-6" />
          <span>Load-Bearing</span>
        </a>

        <Button type="button" onClick={onCreate} className="w-full justify-start gap-2">
          <Plus aria-hidden className="size-4" /> New analysis
        </Button>

        <label className="relative block">
          <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search conversations"
            aria-label="Search conversations"
            className="h-9 pl-9 text-sm"
          />
        </label>

        <Button
          type="button"
          variant={includeArchived ? "secondary" : "ghost"}
          size="sm"
          aria-pressed={includeArchived}
          onClick={() => setIncludeArchived((value) => !value)}
          className="w-full justify-start gap-2 text-ink-3"
        >
          <Archive aria-hidden className="size-3.5" />
          Include archived
          {archivedMatches > 0 && <span className="ml-auto tabular-nums">{archivedMatches}</span>}
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between px-3 py-2">
          <h2 className="text-xs font-medium text-ink-2">Recent sessions</h2>
          <span className="text-xs tabular-nums text-ink-3">{matches.length}</span>
        </div>

        <ul aria-label="Conversation history" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 pb-2">
          {groups.map(({ label, items }) => (
            <li key={label}>
              <h3 className="sticky top-0 z-10 bg-[var(--to-surface)] px-2 py-1.5 text-[0.6875rem] font-medium uppercase tracking-wide text-ink-3">
                {label}
              </h3>
              <ul>
                {items.map((item) => (
                  <SessionRow
                    key={item.workspace.id}
                    item={item}
                    active={item.workspace.id === currentId}
                    onSelect={() => onSelect(item.workspace.id)}
                    onRename={(name) => onRename(item.workspace.id, name)}
                    onArchive={() => onArchive(item.workspace.id)}
                    onRestore={() => onRestore(item.workspace.id)}
                    onDelete={() => onDelete(item.workspace.id)}
                  />
                ))}
              </ul>
            </li>
          ))}

          {query !== debouncedQuery && (
            <li role="status" className="flex items-center gap-2 px-3 py-4 text-sm text-ink-3">
              <Clock3 aria-hidden className="size-4" /> Searching conversations…
            </li>
          )}

          {matches.length === 0 && query === debouncedQuery && (
            <li className="px-3 py-4 text-sm leading-relaxed text-ink-3">
              {query.trim() && archivedMatches > 0 && !includeArchived
                ? "Matching archived sessions are hidden. Turn on Include archived to see them."
                : query.trim()
                  ? "No conversations match that search."
                  : "Your saved analyses will appear here."}
            </li>
          )}
        </ul>

        {matches.length > visibleCount && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
            className="m-2 shrink-0"
          >
            Load more sessions
          </Button>
        )}
      </div>
    </Card>
  );
}
