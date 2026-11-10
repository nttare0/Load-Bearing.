"use client";

/**
 * The one piece of chrome in the top-right corner.
 *
 * A wordmark, collapsed to a mark: the page has no header, so this is the only
 * place that says what the thing is and where its source lives.
 */
export function BeamToggle() {
  return (
    <a
      href="https://github.com/nttare0/Load-Bearing."
      aria-label="Load-Bearing — source on GitHub"
      title="Load-Bearing"
      className="pointer-events-auto flex items-center gap-[0.375rem] rounded-[var(--to-radius-sm)] px-[0.375rem] py-[0.25rem] text-ink-3 no-underline transition-colors hover:text-foreground"
    >
      <span className="lb-wordmark text-[0.8125rem]">Load-Bearing</span>
      <svg viewBox="0 0 20 20" aria-hidden className="size-[0.875rem] shrink-0">
        <path d="M3 17 10 3l7 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M6.2 11h7.6M10 3v14" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    </a>
  );
}
