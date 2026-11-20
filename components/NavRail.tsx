"use client";

import { useRef } from "react";
import {
  Brain,
  ChevronLeft,
  FolderTree,
  MessageSquarePlus,
  PanelLeftClose,
  Settings2,
} from "lucide-react";
import { EFFORTS, THINKING, type Effort } from "@/lib/effort";

/**
 * The spine, on the left edge.
 *
 * It used to be on the right, which put it between the app and the files it was
 * opening. It belongs on the left, where a person's eye starts: the destinations
 * first, then the thread, then the things belonging to the thread on the right.
 *
 * Four controls, in the order they are reached for:
 *
 *   new chat · workspaces · files & activity · settings
 *
 * and, pinned to the bottom, the current thinking level — because "how hard is
 * it thinking" is a setting a person wants to see without opening settings.
 */
const ITEM =
  "relative flex size-[1.875rem] items-center justify-center rounded-[0.375rem] text-ink-3 transition-colors hover:bg-[var(--to-surface-2)] hover:text-foreground";

export function NavRail({
  active,
  workspaces,
  thinking,
  onThinking,
  onNewChat,
  onWorkspaces,
  onFiles,
  onSettings,
  onTogglePanel,
}: {
  active: "workspaces" | "files" | "settings" | null;
  /** How many chats there are, for the count beside the workspaces icon. */
  workspaces: number;
  thinking: Effort;
  onThinking: (effort: Effort) => void;
  onNewChat: () => void;
  onWorkspaces: () => void;
  onFiles: () => void;
  onSettings: () => void;
  onTogglePanel: () => void;
}) {
  return (
    <nav
      aria-label="Chat, workspaces, files and settings"
      className="hidden w-[2.25rem] shrink-0 flex-col items-center gap-[0.125rem] border-r border-[var(--to-border)] py-[0.375rem] md:flex"
    >
      <button
        type="button"
        onClick={onNewChat}
        aria-label="New chat"
        title="New chat — starts its own workspace"
        className={ITEM}
      >
        <MessageSquarePlus aria-hidden className="size-4" />
      </button>

      <RailItem label="Workspaces" current={active === "workspaces"} onClick={onWorkspaces} badge={workspaces}>
        <FolderTree aria-hidden className="size-4" />
      </RailItem>

      <RailItem label="Files and activity" current={active === "files"} onClick={onFiles}>
        <PanelLeftClose aria-hidden className="size-4" />
      </RailItem>

      <span aria-hidden className="my-[0.25rem] h-px w-[1.125rem] bg-[var(--to-border)]" />

      <RailItem label="Settings" current={active === "settings"} onClick={onSettings}>
        <Settings2 aria-hidden className="size-4" />
      </RailItem>

      {/* The thinking level, cycling in place: low → medium → high → low. It is
          a setting, but it is one whose value matters on every message, so it
          gets a permanent home rather than a row inside a sheet. */}
      <ThinkingCycle effort={thinking} onCycle={onThinking} />

      <button
        type="button"
        onClick={onTogglePanel}
        aria-label="Hide the side panel"
        title="Hide the side panel"
        className={`${ITEM} mt-auto`}
      >
        <ChevronLeft aria-hidden className="size-4" />
      </button>
    </nav>
  );
}

function RailItem({
  label,
  current,
  onClick,
  badge,
  children,
}: {
  label: string;
  current: boolean;
  onClick: () => void;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-current={current ? "page" : undefined}
      title={label}
      className={`${ITEM} ${current ? "bg-[var(--to-surface-2)] text-foreground" : ""}`}
    >
      {children}
      {Boolean(badge) && (
        <span className="pointer-events-none absolute -right-[0.0625rem] -top-[0.0625rem] min-w-[0.75rem] rounded-[var(--to-radius-pill)] bg-[var(--to-surface-2)] px-[0.1875rem] text-center text-[0.5rem] leading-[0.75rem] tabular-nums text-ink-3">
          {badge! > 99 ? "99" : badge}
        </span>
      )}
    </button>
  );
}

/**
 * One button that shows the level and steps it.
 *
 * The three dots beneath it are the cheapest possible legend: filled means how
 * far up the scale you are. Cycling beats a menu here — there are three states
 * and no ambiguity about which one you are in.
 */
function ThinkingCycle({ effort, onCycle }: { effort: Effort; onCycle: (effort: Effort) => void }) {
  const index = EFFORTS.indexOf(effort);
  const spec = THINKING[effort];
  // A double-click flies past a level, so hold the step count to one per tap.
  const busy = useRef(false);

  return (
    <button
      type="button"
      onClick={() => {
        if (busy.current) return;
        busy.current = true;
        window.setTimeout(() => (busy.current = false), 180);
        onCycle(EFFORTS[(index + 1) % EFFORTS.length]);
      }}
      aria-label={`Thinking: ${spec.label}. Press to change.`}
      title={`Thinking: ${spec.label} — ${spec.detail}`}
      className={`${ITEM} mt-[0.25rem] flex-col gap-0`}
    >
      <Brain aria-hidden className="size-4" />
      <span aria-hidden className="mt-[0.0625rem] flex items-center gap-[0.125rem]">
        {EFFORTS.map((step, i) => (
          <span
            key={step}
            className={`size-[0.1875rem] rounded-full transition-colors ${
              i <= index ? "bg-[var(--to-accent)]" : "bg-[var(--to-border-strong)]"
            }`}
          />
        ))}
      </span>
    </button>
  );
}
