"use client";

import { PanelsTopLeft } from "lucide-react";
import { ThreadTitle } from "@/components/ThreadTitle";
import { Button } from "@/components/ui/button";

/**
 * The threaded view's top line: which workspace you are in on the left, and the
 * rail toggle on the right.
 *
 * It is a bar only when there is a thread to host. An empty workspace keeps the
 * bare canvas the reference uses for a new conversation, where the only control
 * is the corner one.
 */
export function TopBar({
  name,
  workspaces,
  currentId,
  chatsOpen,
  onToggleChats,
  onRename,
  onSelect,
  onDelete,
  onCreate,
}: {
  name: string;
  workspaces: { id: string; name: string; reports: number }[];
  currentId: string | null;
  chatsOpen: boolean;
  onToggleChats: () => void;
  onRename: (name: string) => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
}) {
  return (
    <div className="sticky top-0 z-20 flex h-[2.75rem] items-center gap-[0.25rem] border-b border-[var(--to-border)] bg-[var(--to-bg)]/85 px-[0.5rem] backdrop-blur-sm">
      <ThreadTitle
        name={name}
        workspaces={workspaces}
        currentId={currentId}
        onRename={onRename}
        onSelect={onSelect}
        onDelete={onDelete}
        onCreate={onCreate}
      />

      <div className="ml-auto flex shrink-0 items-center gap-[0.125rem]">
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-ink-3 hover:text-foreground"
          onClick={onToggleChats}
          aria-label={chatsOpen ? "Hide the chat list" : "Show the chat list"}
          aria-expanded={chatsOpen}
        >
          <PanelsTopLeft className="size-4" />
        </Button>
      </div>
    </div>
  );
}
