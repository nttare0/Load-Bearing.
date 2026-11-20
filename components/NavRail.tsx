"use client";

import { MessagesSquare, PanelLeft, Plus, Settings2 } from "lucide-react";

/**
 * The sidebar.
 *
 * This column used to hold five destinations: New chat, Chats, Files, Settings,
 * Hide. Two of them — **Files** and the **connectors card** — are gone, because
 * they pointed at a second panel that no longer exists. What is left is the
 * layout arena.ai/agent actually uses: one place to start, one place to look
 * back, one place to configure, and a control for the panel itself.
 *
 * The idea being borrowed from Arena is not its pixels, it is its **distinction**:
 *
 *   - **New chat is not a place, it is an action.** It sits above the rule, has
 *     its own filled surface, and does not take a pressed state, because you
 *     cannot be in it. The thread underneath it *is* the new chat until
 *     something is in it, then it becomes a chat in the list.
 *   - **Chats is a place.** It has a pressed state, because the panel it opens
 *     is either showing or not, and the sidebar says which.
 *
 * That is the whole difference this file is drawing: one destination, one verb.
 */
const ITEM =
  "flex w-full flex-col items-center gap-[0.1875rem] rounded-[0.4375rem] px-[0.125rem] py-[0.375rem] text-ink-3 transition-colors hover:bg-[var(--to-surface-2)] hover:text-foreground";
const ON = "bg-[var(--to-surface-2)] text-foreground shadow-[inset_0_0_0_1px_var(--to-border)]";

export function NavRail({
  chatsOpen,
  onNewChat,
  onChats,
  onSettings,
}: {
  chatsOpen: boolean;
  onNewChat: () => void;
  onChats: () => void;
  onSettings: () => void;
}) {
  return (
    <nav
      aria-label="Chats and settings"
      className="hidden w-[3.5rem] shrink-0 flex-col items-center gap-[0.125rem] border-r border-[var(--to-border)] bg-[var(--to-surface)] px-[0.25rem] py-[0.5rem] md:flex"
    >
      {/* An action, not a destination: no pressed state to be in. */}
      <button
        type="button"
        onClick={onNewChat}
        title="New chat — starts its own workspace"
        className="flex w-full flex-col items-center gap-[0.1875rem] rounded-[0.4375rem] border border-[var(--to-border)] bg-[var(--to-bg)] px-[0.125rem] py-[0.375rem] text-ink-2 transition-colors hover:border-[var(--to-border-strong)] hover:text-foreground"
      >
        <Plus aria-hidden className="size-[1.125rem]" />
        <span className="text-[0.5625rem] leading-none">New chat</span>
      </button>

      <span aria-hidden className="my-[0.375rem] h-px w-[1.75rem] bg-[var(--to-border)]" />

      <Item label="Chats" on={chatsOpen} onClick={onChats} pressed={chatsOpen}>
        <MessagesSquare aria-hidden className="size-[1.125rem]" />
      </Item>

      <Item label="Settings" on={false} onClick={onSettings} pressed={false}>
        <Settings2 aria-hidden className="size-[1.125rem]" />
      </Item>

      {/* The panel toggle, at the bottom where a layout control belongs — and
          pressed when the panel is away, since its job is "bring it back". */}
      <Item label={chatsOpen ? "Hide chats" : "Show chats"} on={!chatsOpen} onClick={onChats} pressed={!chatsOpen}>
        <PanelLeft aria-hidden className="size-[1.125rem]" />
      </Item>
    </nav>
  );
}

function Item({
  label,
  on,
  pressed,
  onClick,
  children,
}: {
  label: string;
  on: boolean;
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={pressed} className={`${ITEM} ${on ? ON : ""}`}>
      {children}
      <span className="text-[0.5625rem] leading-none">{label}</span>
    </button>
  );
}
