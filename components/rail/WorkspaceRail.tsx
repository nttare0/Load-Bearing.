"use client";

import { useState } from "react";
import { MessageSquarePlus, Search, Trash2 } from "lucide-react";
import { AnimatedCounter } from "@/components/rare/animated-counter";
import { DeleteButton } from "@/components/rare/delete-button";
import { CardHead, CARD, IconButton, InlineInput } from "@/components/rail/parts";
import type { Workspace } from "@/lib/workspace";

/**
 * Workspaces live on the left.
 *
 * They used to share a card stack with files, activity and connectors on the
 * right, which made the right column a drawer of four unrelated things. A chat
 * list belongs where chat lists belong — beside the thread it switches between,
 * on the side the eye already reads first.
 *
 * One chat, one workspace: this list is the whole of that idea. Every entry is
 * a thread with its own messages, its own plans, its own reports and its own
 * folders. Making a new chat makes a new workspace in the same breath, so the
 * two can never drift apart.
 */
export function WorkspaceRail({
  workspaces,
  currentId,
  onSelect,
  onCreate,
  onDelete,
}: {
  workspaces: { workspace: Workspace; reports: number; messages: number }[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const term = query.trim().toLowerCase();
  const shown = term
    ? workspaces.filter(
        ({ workspace: w }) =>
          w.name.toLowerCase().includes(term) ||
          w.resources.some((r) => r.title.toLowerCase().includes(term)) ||
          w.messages.some((m) => m.text.toLowerCase().includes(term))
      )
    : workspaces;

  return (
    <section className={`${CARD} flex min-h-0 flex-1 flex-col overflow-hidden`}>
      <CardHead title="Workspaces">
        <AnimatedCounter
          value={workspaces.length}
          separator=""
          className="shrink-0 pr-[0.125rem] text-[0.6875rem] tabular-nums text-ink-3"
        />
        <IconButton
          label="Find a workspace"
          expanded={searching}
          onClick={() => setSearching((v) => !v)}
        >
          <Search aria-hidden className="size-4" />
        </IconButton>
        <IconButton label="New chat" onClick={onCreate}>
          <MessageSquarePlus aria-hidden className="size-4" />
        </IconButton>
      </CardHead>

      {searching && (
        <InlineInput
          value={query}
          onChange={setQuery}
          placeholder="Find a workspace or report"
          onCancel={() => {
            setQuery("");
            setSearching(false);
          }}
        />
      )}

      <ul className="min-h-0 flex-1 overflow-y-auto border-t border-[var(--to-border)] py-[0.1875rem]">
        {shown.map(({ workspace: w, reports, messages }) => {
          const active = w.id === currentId;
          const deleting = pendingDelete === w.id;
          const empty = messages === 0;

          return (
            <li key={w.id} className="group/row">
              <div className={`flex items-center ${active ? "bg-[var(--to-surface-2)]" : "hover:bg-[var(--to-surface-2)]"}`}>
                <button
                  type="button"
                  onClick={() => onSelect(w.id)}
                  aria-current={active ? "true" : undefined}
                  className="flex min-w-0 flex-1 flex-col gap-[0.0625rem] px-[0.625rem] py-[0.3125rem] text-left"
                >
                  <span
                    className={`min-w-0 w-full truncate text-[0.8125rem] ${
                      active ? "text-foreground" : "text-ink-2"
                    }`}
                  >
                    {w.name}
                  </span>
                  {/* What is in it, in the smallest honest words: a chat with
                      nothing in it says so rather than showing two zeros. */}
                  <span className="flex items-center gap-[0.25rem] text-[0.625rem] text-ink-3">
                    {empty ? (
                      "empty"
                    ) : (
                      <>
                        <span>{messages === 1 ? "1 message" : `${messages} messages`}</span>
                        <span aria-hidden>·</span>
                        <span>{reports === 1 ? "1 report" : `${reports} reports`}</span>
                      </>
                    )}
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
                    Delete “{w.name}” and the {reports === 1 ? "report" : `${reports} reports`} in it?
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
          <li className="px-[0.625rem] py-[0.25rem] text-[0.8125rem] leading-[1.5] text-ink-3">
            Nothing matches.
          </li>
        )}
      </ul>
    </section>
  );
}
