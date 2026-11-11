"use client";

import { useState } from "react";

/**
 * What the run actually did, and how long each part took.
 *
 * Borrowed from rakazo's tool-activity disclosure: a run is a sequence of
 * steps, not a spinner, and the step that took the longest is the one worth
 * knowing about. Ours are fixed five passes rather than arbitrary tool calls,
 * so the trace is a small bar rather than a nested log — but the principle is
 * theirs, and it is a better account of a 17-second wait than "thinking…".
 *
 * Deliberately quiet: no animation, no colour beyond weight, one line.
 */

const LABELS: Record<string, string> = {
  extract: "read the plan",
  hidden: "hidden assumptions",
  premortem: "pre-mortem",
  score: "scored twice",
  evidence: "checked sources",
  tests: "designed tests",
};

export function PassTrace({ passes }: { passes: { stage: string; ms: number }[] }) {
  const [open, setOpen] = useState(false);
  const total = passes.reduce((sum, pass) => sum + pass.ms, 0) || 1;
  const slowest = passes.reduce((a, b) => (b.ms > a.ms ? b : a), passes[0]);

  return (
    <div className="min-w-0">
      {/* The shape of the run, readable at a glance: width is time spent. */}
      <div className="flex h-[3px] w-full max-w-[22rem] overflow-hidden rounded-full bg-[var(--to-border)]" aria-hidden>
        {passes.map((pass) => (
          <span
            key={pass.stage}
            className="h-full"
            style={{
              width: `${(pass.ms / total) * 100}%`,
              background:
                pass.stage === slowest.stage
                  ? "var(--to-border-strong)"
                  : "color-mix(in oklab, var(--to-border-strong) 45%, transparent)",
            }}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="mt-[0.25rem] text-[0.75rem] text-ink-3 hover:text-foreground"
      >
        {open ? "Hide" : "Show"} the {passes.length} passes
      </button>

      {open && (
        <ul className="mt-[0.375rem] flex flex-col gap-[0.125rem]">
          {passes.map((pass) => (
            <li key={pass.stage} className="flex items-baseline justify-between gap-[0.75rem] max-w-[22rem]">
              <span className="text-[0.75rem] text-ink-2">{LABELS[pass.stage] ?? pass.stage}</span>
              <span className="lb-mono shrink-0 text-[0.6875rem] tabular-nums text-ink-3">
                {pass.ms < 1000 ? `${pass.ms}ms` : `${Math.round(pass.ms / 100) / 10}s`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
