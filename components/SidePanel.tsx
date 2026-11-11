"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

/**
 * The thin right rail.
 *
 * It holds the state of the thing you are looking at — the report, its numbers,
 * the pipeline's own notes — in small cards rather than in the main column, so
 * the thread stays a thread. Every card can be folded away, because on a narrow
 * window the rail is the first thing that should get out of the way.
 */

export function SidePanel({ children }: { children: ReactNode }) {
  return (
    <aside
      aria-label="Report details"
      className="hidden w-[16.5rem] shrink-0 flex-col gap-[0.625rem] overflow-y-auto border-l border-[var(--to-border)] px-[0.75rem] py-[0.75rem] lg:flex"
    >
      {children}
    </aside>
  );
}

export function PanelCard({
  title,
  action,
  children,
  defaultOpen = true,
  flush = false,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  /** Rows already draw their own dividers. */
  flush?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="rounded-[0.5rem] border border-[var(--to-border)]">
      <div className="flex items-center gap-[0.25rem] px-[0.375rem] py-[0.25rem]">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-[0.25rem] rounded-[0.25rem] px-[0.125rem] py-[0.125rem] text-left"
        >
          {open ? (
            <ChevronDown aria-hidden className="size-3 shrink-0 text-ink-3" />
          ) : (
            <ChevronRight aria-hidden className="size-3 shrink-0 text-ink-3" />
          )}
          <span className="truncate text-[0.75rem] text-ink-2">{title}</span>
        </button>
        {action && <div className="shrink-0">{action}</div>}
      </div>

      {open && (
        <div className={flush ? "pb-[0.375rem]" : "px-[0.625rem] pb-[0.5rem]"}>{children}</div>
      )}
    </section>
  );
}

/** A label/value row, for the numbers the rail reports. */
export function PanelRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-[0.5rem] py-[0.125rem]">
      <span className="truncate text-[0.75rem] text-ink-3">{label}</span>
      <span className="shrink-0 text-[0.75rem] tabular-nums text-ink-2">{value}</span>
    </div>
  );
}
