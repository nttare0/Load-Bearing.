"use client";

import { useRef, useState, type FormEvent } from "react";
import { Archive, MoreHorizontal, RotateCcw, Trash2 } from "lucide-react";
import { DeleteButton } from "@/components/rare/delete-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SessionListItem } from "@/lib/session-list";

export function SessionRow({
  item,
  active,
  onSelect,
  onRename,
  onArchive,
  onRestore,
  onDelete,
}: {
  item: SessionListItem;
  active: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(item.title);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const menu = useRef<HTMLDetailsElement>(null);
  const { workspace, title, messages, reports } = item;
  const archived = Boolean(workspace.archivedAt);

  const commitRename = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = draft.trim();
    if (!next) return;
    onRename(next);
    setRenaming(false);
    menu.current?.removeAttribute("open");
  };

  return (
    <li className="group/session border-b border-[var(--to-border)]/70 last:border-0">
      <div className={`flex items-start gap-1 px-2 py-1.5 ${active ? "bg-[var(--to-surface-2)]" : "hover:bg-[var(--to-surface-2)]"}`}>
        <button
          type="button"
          onClick={onSelect}
          aria-current={active ? "page" : undefined}
          className="min-w-0 flex-1 rounded-sm px-1 py-0.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--to-accent)]"
        >
          <span className="flex min-w-0 items-center gap-1.5">
            {active && <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-[var(--to-accent)]" />}
            <span className={`truncate text-[0.8125rem] ${active ? "font-medium text-foreground" : "text-ink-2"}`}>
              {title}
            </span>
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 pl-3 text-[0.6875rem] text-ink-3">
            <span>{messages === 0 ? "New analysis" : `${messages} messages`}</span>
            {reports > 0 && <span>· {reports} {reports === 1 ? "report" : "reports"}</span>}
            {archived && <span className="rounded-sm border border-[var(--to-border)] px-1">Archived</span>}
            <time dateTime={workspace.updatedAt} suppressHydrationWarning>
              {formatUpdatedAt(workspace.updatedAt)}
            </time>
          </span>
        </button>

        <details ref={menu} className="relative shrink-0">
          <summary
            aria-label={`Actions for ${title}`}
            title={`Actions for ${title}`}
            className="flex size-8 cursor-pointer list-none items-center justify-center rounded-md text-ink-3 hover:bg-[var(--to-bg)] hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--to-accent)] [&::-webkit-details-marker]:hidden"
          >
            <MoreHorizontal aria-hidden className="size-4" />
          </summary>
          <div className="absolute right-0 top-full z-30 mt-1 w-40 rounded-md border border-[var(--to-border)] bg-[var(--to-surface)] p-1 shadow-sm">
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-ink-2 hover:bg-[var(--to-surface-2)]"
              onClick={() => {
                setDraft(title);
                setRenaming(true);
              }}
            >
              Rename
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-ink-2 hover:bg-[var(--to-surface-2)]"
              onClick={() => (archived ? onRestore() : onArchive())}
            >
              {archived ? <RotateCcw aria-hidden className="size-3.5" /> : <Archive aria-hidden className="size-3.5" />}
              {archived ? "Restore" : "Archive"}
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-[var(--to-danger)] hover:bg-[var(--to-surface-2)]"
              onClick={() => setConfirmingDelete(true)}
            >
              <Trash2 aria-hidden className="size-3.5" /> Delete
            </button>
          </div>
        </details>
      </div>

      {renaming && (
        <form onSubmit={commitRename} className="flex items-center gap-1 px-3 pb-2">
          <Input
            autoFocus
            aria-label={`Rename ${title}`}
            value={draft}
            maxLength={80}
            onChange={(event) => setDraft(event.target.value)}
            className="h-8 min-w-0 text-xs"
          />
          <Button type="submit" size="sm" className="h-8 px-2 text-xs">Save</Button>
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => setRenaming(false)}>
            Cancel
          </Button>
        </form>
      )}

      {confirmingDelete && (
        <div className="px-3 pb-2">
          <p className="text-xs leading-relaxed text-ink-3">
            Permanently delete “{title}” and its {reports === 1 ? "report" : `${reports} reports`}?
          </p>
          <DeleteButton
            tile={28}
            className="mt-1 rounded-md"
            onConfirm={() => {
              onDelete();
              setConfirmingDelete(false);
            }}
            onCancel={() => setConfirmingDelete(false)}
          />
        </div>
      )}
    </li>
  );
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
}
