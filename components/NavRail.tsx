"use client";

import { MessageSquarePlus, PanelRightClose, Settings2, SquarePen } from "lucide-react";

/**
 * The spine on the far right.
 *
 * Two things live here that a person reaches for constantly and that should not
 * cost a menu: **a new message**, and **settings**. Everything else — files,
 * activity, workspaces, connectors — is already in the panel beside it, so this
 * strip stays narrow enough to ignore until it is wanted.
 *
 * It sits *outside* the files panel rather than above it, so it is present in
 * both states: with the panel open, and with it folded away. That is the whole
 * point of a rail — the two controls that get you out of whatever you are stuck
 * in cannot be inside the thing you are stuck in.
 *
 * The badge on Chat is the count of messages in the current workspace, which is
 * the only honest number to put on it: not notifications (there are none), not
 * unread (everything is read).
 */

const ITEM =
  "relative flex size-[1.875rem] items-center justify-center rounded-[0.375rem] text-ink-3 transition-colors hover:bg-[var(--to-surface-2)] hover:text-foreground";

export function NavRail({
  active,
  messages,
  panelOpen,
  onNewMessage,
  onChat,
  onSettings,
  onTogglePanel,
}: {
  /** Which face of the app the user is looking at, if either. */
  active: "chat" | "settings" | null;
  /** Messages in the current workspace, for the count. */
  messages: number;
  panelOpen: boolean;
  onNewMessage: () => void;
  onChat: () => void;
  onSettings: () => void;
  onTogglePanel: () => void;
}) {
  return (
    <nav
      aria-label="Chat and settings"
      className="flex w-[2.25rem] shrink-0 flex-col items-center gap-[0.125rem] border-l border-[var(--to-border)] py-[0.375rem]"
    >
      {/* A new message is the one action here that is not a place, so it sits
          above the divider and is the first thing the eye lands on. */}
      <button
        type="button"
        onClick={onNewMessage}
        aria-label="New message"
        title="New message"
        className={ITEM}
      >
        <MessageSquarePlus aria-hidden className="size-4" />
      </button>

      <span aria-hidden className="my-[0.25rem] h-px w-[1.125rem] bg-[var(--to-border)]" />

      <button
        type="button"
        onClick={onChat}
        aria-label="Chat"
        aria-current={active === "chat" ? "page" : undefined}
        title="Chat"
        className={`${ITEM} ${
          active === "chat" ? "bg-[var(--to-surface-2)] text-foreground" : ""
        }`}
      >
        <SquarePen aria-hidden className="size-4" />
        {messages > 0 && (
          <span className="pointer-events-none absolute -right-[0.0625rem] -top-[0.0625rem] min-w-[0.75rem] rounded-[var(--to-radius-pill)] bg-[var(--to-surface-2)] px-[0.1875rem] text-center text-[0.5rem] leading-[0.75rem] tabular-nums text-ink-3">
            {messages > 99 ? "99" : messages}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={onSettings}
        aria-label="Settings"
        aria-current={active === "settings" ? "page" : undefined}
        title="Settings"
        className={`${ITEM} ${
          active === "settings" ? "bg-[var(--to-surface-2)] text-foreground" : ""
        }`}
      >
        <Settings2 aria-hidden className="size-4" />
      </button>

      {/* The panel toggle lives down here, away from the two destinations: it
          changes the layout rather than taking you somewhere. */}
      <button
        type="button"
        onClick={onTogglePanel}
        aria-label={panelOpen ? "Hide files and workspaces" : "Show files and workspaces"}
        aria-expanded={panelOpen}
        title={panelOpen ? "Hide files and workspaces" : "Show files and workspaces"}
        className={`${ITEM} mt-auto`}
      >
        <PanelRightClose
          aria-hidden
          className={`size-4 transition-transform duration-200 ${panelOpen ? "" : "rotate-180"}`}
        />
      </button>
    </nav>
  );
}
