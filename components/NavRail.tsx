"use client";

import { Files, MessagesSquare, PanelLeft, Plus, Settings2 } from "lucide-react";

/**
 * The left sidebar.
 *
 * The first version was wrong in a way worth naming: a column of unlabelled
 * icons, one of which was a brain that changed a value rather than going
 * anywhere, with a paragraph of legend underneath explaining the icons. If a
 * menu needs a key, the menu is the problem.
 *
 * What it does now:
 *
 *   - **every item is a place, and every item is named.** Icon over a 9px label,
 *     in a 56px column. Nothing here sets a value; the thinking level lives in
 *     Settings, which is where it can be explained.
 *   - **the two panels are independent.** Workspaces on the left, Files and
 *     Connectors on the right, and either can be closed without the other. The
 *     pressed state tells you which is open, so the sidebar is a status as well
 *     as a menu.
 *   - **new chat is primary**, separated above the destinations by a rule and
 *     by a filled surface.
 */
const ITEM =
  "flex w-full flex-col items-center gap-[0.1875rem] rounded-[0.4375rem] px-[0.125rem] py-[0.375rem] text-ink-3 transition-colors hover:bg-[var(--to-surface-2)] hover:text-foreground";
const ON = "bg-[var(--to-surface-2)] text-foreground shadow-[inset_0_0_0_1px_var(--to-border)]";

export function NavRail({
  workspacesOpen,
  filesOpen,
  settingsOpen,
  onNewChat,
  onWorkspaces,
  onFiles,
  onSettings,
  onCollapse,
}: {
  workspacesOpen: boolean;
  filesOpen: boolean;
  settingsOpen: boolean;
  onNewChat: () => void;
  onWorkspaces: () => void;
  onFiles: () => void;
  onSettings: () => void;
  onCollapse: () => void;
}) {
  return (
    <nav
      aria-label="Chats, files and settings"
      className="hidden w-[3.5rem] shrink-0 flex-col items-center gap-[0.125rem] border-r border-[var(--to-border)] bg-[var(--to-surface)] px-[0.25rem] py-[0.5rem] md:flex"
    >
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

      <Item label="Chats" on={workspacesOpen} onClick={onWorkspaces} pressed={workspacesOpen}>
        <MessagesSquare aria-hidden className="size-[1.125rem]" />
      </Item>

      <Item label="Files" on={filesOpen} onClick={onFiles} pressed={filesOpen}>
        <Files aria-hidden className="size-[1.125rem]" />
      </Item>

      <Item label="Settings" on={settingsOpen} onClick={onSettings} pressed={settingsOpen}>
        <Settings2 aria-hidden className="size-[1.125rem]" />
      </Item>

      <button
        type="button"
        onClick={onCollapse}
        title="Hide the side panels"
        className={`${ITEM} mt-auto`}
      >
        <PanelLeft aria-hidden className="size-[1.125rem]" />
        <span className="text-[0.5625rem] leading-none">Hide</span>
      </button>
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
