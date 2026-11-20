"use client";

import type { ReactNode } from "react";

/**
 * Panels and the cards inside them — two separate things, kept separate.
 *
 * The bug this replaces: a rail's cards were wrapped in an intermediate
 * `flex flex-col gap-…` div, so the panel's direct children were a wrapper and
 * the cards were two levels down. Anything that wanted to space, bound, or
 * reorder the cards had to know about that wrapper, and the wrapper itself
 * carried no meaning — it only existed to hold a gap that the panel could have
 * held itself.
 *
 * So: `Panel` is the column, and its direct children are cards. `Card` is a
 * bordered section with an optional title row. Nothing in between.
 */

/** A panel's outer column. Its children should be `Card`s and nothing else. */
export function Panel({
  children,
  label,
  className,
}: {
  children: ReactNode;
  /** Named for screen readers, since the panel has no visible title of its own. */
  label?: string;
  className?: string;
}) {
  return (
    <aside
      aria-label={label}
      className={`flex min-h-0 shrink-0 flex-col gap-[0.5rem] px-[0.5rem] py-[0.5rem] ${className ?? ""}`}
    >
      {children}
    </aside>
  );
}

/**
 * A card. Direct child of a `Panel`, never of another card.
 *
 * `grow` is the one card that takes the leftover height (the file list, the chat
 * list); everything else keeps its natural height and sits above or below it.
 */
export function Card({
  children,
  grow,
  className,
}: {
  children: ReactNode;
  grow?: boolean;
  className?: string;
}) {
  return (
    <section
      className={`${
        grow ? "flex min-h-0 flex-1 flex-col" : "flex shrink-0 flex-col"
      } overflow-hidden rounded-[0.5rem] border border-[var(--to-border)] ${className ?? ""}`}
    >
      {children}
    </section>
  );
}

/** A card's title row: a name, then whatever controls belong to that card. */
export function CardTitle({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex h-[1.875rem] shrink-0 items-center gap-[0.25rem] px-[0.625rem]">
      <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-ink-2">{title}</span>
      {children}
    </div>
  );
}
