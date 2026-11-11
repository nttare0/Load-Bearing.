"use client";

import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";

/**
 * A collapsible row, the way a tool call reads in a transcript.
 *
 * The label is the sentence; the contents are what it did. Closed by default,
 * because the point of a thread is the conclusion and the machinery is only
 * there for when someone doubts it.
 */
export function CollapsibleRow({
  icon,
  label,
  meta,
  children,
  defaultOpen = false,
  dense = false,
}: {
  icon?: ReactNode;
  label: ReactNode;
  meta?: ReactNode;
  children?: ReactNode;
  defaultOpen?: boolean;
  /** `dense` keeps the row inline instead of indenting, for use inside a panel. */
  dense?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="group flex w-full items-center gap-[0.5rem] py-[0.3125rem] text-left"
      >
        <ChevronRight
          aria-hidden
          className="size-3 shrink-0 text-ink-3 transition-transform duration-150 group-hover:text-foreground"
          style={open ? { transform: "rotate(90deg)" } : undefined}
        />
        {icon}
        <span
          className={`truncate text-[0.8125rem] ${open ? "text-foreground" : "text-ink-2"} group-hover:text-foreground`}
        >
          {label}
        </span>
        {meta && <span className="ml-auto shrink-0 text-[0.6875rem] text-ink-3">{meta}</span>}
      </button>

      {open && children && <div className={dense ? "pb-[0.375rem]" : "pb-[0.5rem] pl-[1.25rem]"}>{children}</div>}
    </div>
  );
}
