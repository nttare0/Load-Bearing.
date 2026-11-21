"use client";

import { MessagesSquare, Plus, Settings2 } from "lucide-react";

/**
 * The bottom bar, for screens too narrow for the sidebar.
 *
 * The sidebar is `hidden md:flex`, which meant that below 768px there was no way
 * to start a chat, no way to reach Settings, and no way back to the chat list —
 * the app rendered and then had nowhere to go. This is the same three
 * destinations, at 44px touch targets, pinned to the bottom where a thumb
 * reaches.
 *
 * It is a second surface for the same actions rather than a second component
 * system: the icons and the layout language are the sidebar's.
 *
 * `pb-[env(safe-area-inset-bottom)]` keeps it clear of the home indicator on an
 * iPhone, which otherwise sits on top of the buttons.
 */
const BUTTON =
  "flex min-h-[2.75rem] flex-1 flex-col items-center justify-center gap-[0.125rem] px-[0.25rem] py-[0.375rem] text-[0.625rem] leading-none";

export function MobileBar({
  onNewChat,
  onChats,
  onSettings,
}: {
  onNewChat: () => void;
  onChats: () => void;
  onSettings: () => void;
}) {
  return (
    <nav
      aria-label="Chats and settings"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-[var(--to-border)] bg-[var(--to-surface)] pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <button type="button" onClick={onNewChat} className={`${BUTTON} text-ink-2`}>
        <Plus aria-hidden className="size-[1.125rem]" />
        New chat
      </button>
      <button type="button" onClick={onChats} className={`${BUTTON} text-ink-3`}>
        <MessagesSquare aria-hidden className="size-[1.125rem]" />
        Chats
      </button>
      <button type="button" onClick={onSettings} className={`${BUTTON} text-ink-3`}>
        <Settings2 aria-hidden className="size-[1.125rem]" />
        Settings
      </button>
    </nav>
  );
}
