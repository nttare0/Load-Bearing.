"use client";

import type { ReactNode } from "react";

/**
 * The rail's shared vocabulary.
 *
 * Three panels now stand at the edges of the app — workspaces on the left, files
 * and connectors on the right — and they used to be one stack of cards. Pulling
 * the measurements out here is what keeps them looking like one product after
 * the split: the same 8px radius, the same 30px header row, the same 13px
 * heading, the same hover.
 */

export const CARD = "rounded-[0.5rem] border border-[var(--to-border)]";
export const HEAD_ROW = "flex h-[1.875rem] items-center gap-[0.25rem] px-[0.625rem]";
export const FULL_ROW =
  "flex w-full items-center gap-[0.4375rem] border-t border-b border-[var(--to-border)] bg-[var(--to-surface)] px-[0.625rem] py-[0.375rem] text-left text-[0.8125rem] text-ink-2 hover:bg-[var(--to-surface-2)] hover:text-foreground";

/** A card's top row: a title, then whatever controls belong to it. */
export function CardHead({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className={HEAD_ROW}>
      <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-ink-2">{title}</span>
      {children}
    </div>
  );
}

export function IconButton({
  label,
  expanded,
  onClick,
  children,
}: {
  label: string;
  expanded?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-expanded={expanded}
      title={label}
      className="shrink-0 rounded-[0.25rem] p-[0.125rem] text-ink-3 hover:bg-[var(--to-surface-2)] hover:text-foreground"
    >
      {children}
    </button>
  );
}

/** A tab in a segmented pair, as on the reference panel. */
export function Tab({
  label,
  active,
  badge,
  onSelect,
  controls,
}: {
  label: string;
  active: boolean;
  badge?: number;
  onSelect: () => void;
  controls?: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-controls={controls}
      onClick={onSelect}
      className={`flex flex-1 items-center justify-center gap-[0.25rem] rounded-[0.375rem] border px-[0.375rem] py-[0.1875rem] text-[0.8125rem] transition-colors ${
        active
          ? "border-[var(--to-border)] bg-[var(--to-surface-2)] text-foreground"
          : "border-transparent text-ink-3 hover:text-foreground"
      }`}
    >
      {label}
      {Boolean(badge) && (
        <span className="rounded-[var(--to-radius-pill)] bg-[var(--to-warning)] px-[0.25rem] text-[0.5625rem] leading-[1.4] tabular-nums text-[var(--to-bg)]">
          {badge}
        </span>
      )}
    </button>
  );
}

/** The small input that appears under a header when you ask to search or name. */
export function InlineInput({
  value,
  onChange,
  placeholder,
  onSubmit,
  onCancel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  onSubmit?: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="border-t border-[var(--to-border)] px-[0.625rem] py-[0.375rem]">
      <input
        autoFocus
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onSubmit?.();
          if (event.key === "Escape") onCancel();
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full rounded-[0.25rem] border border-[var(--to-border)] bg-transparent px-[0.375rem] py-[0.1875rem] text-[0.8125rem] outline-none focus:border-[var(--to-border-strong)]"
      />
    </div>
  );
}
