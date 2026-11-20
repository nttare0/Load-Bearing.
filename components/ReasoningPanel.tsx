"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronRight, Dot, Sparkles, TriangleAlert } from "lucide-react";
import { PASS_LABEL, shouldBeOpen, summaryOf, type ReasonKind, type ReasonStep } from "@/lib/reasoning";

/**
 * The reasoning panel.
 *
 * The behaviour, in three acts:
 *
 * 1. **It streams.** While the model works, the panel is open and lines arrive
 *    underneath each other — what it is doing, then what it found, then what it
 *    is doing next. Not a spinner with a caption: the actual findings, in the
 *    order they landed, so a 17-second wait is legible instead of opaque.
 *
 * 2. **It collapses into a summary.** When the answer arrives the panel folds to
 *    one line — `4 findings · 1 check · 1 problem · 16.8s` — which is the shape
 *    of the work rather than a count of lines. The line stays; the work behind it
 *    is one click away, because a person rereads reasoning far more often than
 *    they read it the first time.
 *
 * 3. **Then the answer.** The panel sits above the report, and folding it is
 *    what lets the report be the thing on screen. It is deliberately the same
 *    width and the same left edge as the answer below it, so collapsing it does
 *    not move the text.
 *
 * A manual toggle wins over the default for as long as the run lasts: if you
 * open it mid-run to read, it will not slam shut when the answer lands.
 */

const GLYPH: Record<ReasonKind, typeof Check> = {
  think: Dot,
  found: Sparkles,
  check: Check,
  warn: TriangleAlert,
};

export function ReasoningPanel({
  steps,
  running,
  /** Set when the run ended: the panel then has an answer to collapse for. */
  finished,
}: {
  steps: ReasonStep[];
  running: boolean;
  finished?: boolean;
}) {
  const [override, setOverride] = useState<boolean | null>(null);
  const open = shouldBeOpen(override, running && !finished);
  const listRef = useRef<HTMLOListElement>(null);
  const regionId = useId();

  // Follow the tail while it streams, so new lines are visible without scrolling.
  useEffect(() => {
    if (!open || !running) return;
    const list = listRef.current;
    if (!list) return;
    const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 64;
    if (nearBottom) list.scrollTop = list.scrollHeight;
  }, [steps.length, open, running]);

  // A finished run forgets the manual override, so the next run starts collapsed
  // by its own rules rather than by a click from ten minutes ago.
  useEffect(() => {
    if (!running && finished) setOverride(null);
  }, [running, finished]);

  if (steps.length === 0 && !running) return null;

  const summary = summaryOf(steps, { running });

  return (
    <section
      aria-label="Reasoning"
      className="overflow-hidden rounded-[var(--to-radius)] border border-[var(--to-border)] bg-[var(--to-surface)]"
    >
      <button
        type="button"
        onClick={() => setOverride(!open)}
        aria-expanded={open}
        aria-controls={regionId}
        className="flex w-full items-center gap-[0.5rem] px-[0.75rem] py-[0.5rem] text-left hover:bg-[var(--to-surface-2)]"
      >
        <ChevronRight
          aria-hidden
          className={`size-3.5 shrink-0 text-ink-3 transition-transform duration-200 ${
            open ? "rotate-90" : ""
          }`}
        />

        {/* While it runs, a live dot; once it stops, the same glyph, still. */}
        <span className="relative flex size-[0.4375rem] shrink-0 items-center justify-center">
          <span
            aria-hidden
            className={`size-[0.4375rem] rounded-full ${
              running ? "animate-pulse bg-[var(--to-accent)]" : "bg-[var(--to-border-strong)]"
            }`}
          />
        </span>

        <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-ink-2">
          {running ? "Thinking" : "Thought process"}
          <span aria-hidden className="px-[0.375rem] text-ink-3">
            ·
          </span>
          <span className="text-ink-3">{summary}</span>
        </span>
      </button>

      {open && (
        <ol
          id={regionId}
          ref={listRef}
          className="max-h-[16rem] overflow-y-auto border-t border-[var(--to-border)] px-[0.75rem] py-[0.5rem]"
        >
          {steps.map((step, index) => {
            const Glyph = GLYPH[step.kind];
            const last = index === steps.length - 1;
            const previousPass = index > 0 ? steps[index - 1].pass : null;
            const newPass = step.pass !== previousPass;

            return (
              <li key={index} className="flex gap-[0.5rem]">
                {/* The rail: a line down the left, so the steps read as one
                    continuous thought rather than a list of bullet points. */}
                <span aria-hidden className="relative flex w-[0.875rem] shrink-0 justify-center">
                  <span
                    className={`absolute top-[0.875rem] bottom-0 w-px ${
                      last ? "bg-transparent" : "bg-[var(--to-border)]"
                    }`}
                  />
                  <Glyph
                    className={`mt-[0.1875rem] size-3 shrink-0 ${
                      step.kind === "warn"
                        ? "text-[var(--to-warning)]"
                        : step.kind === "found"
                          ? "text-[var(--to-success)]"
                          : "text-ink-3"
                    }`}
                  />
                </span>

                <div className="min-w-0 flex-1 pb-[0.4375rem]">
                  {newPass && (
                    <p className="lb-mono text-[0.625rem] uppercase tracking-[0.06em] text-ink-3">
                      {PASS_LABEL[step.pass] ?? step.pass}
                    </p>
                  )}
                  <p
                    className={`text-[0.8125rem] leading-[1.5] ${
                      step.kind === "warn" ? "text-[var(--to-warning)]" : "text-ink-2"
                    }`}
                  >
                    {step.text}
                    {step.ms !== undefined && step.ms > 400 && (
                      <span className="lb-mono pl-[0.375rem] text-[0.625rem] tabular-nums text-ink-3">
                        {step.ms < 1000 ? `${step.ms}ms` : `${Math.round(step.ms / 100) / 10}s`}
                      </span>
                    )}
                  </p>
                </div>
              </li>
            );
          })}

          {running && (
            <li className="flex gap-[0.5rem]" aria-live="polite">
              <span aria-hidden className="flex w-[0.875rem] shrink-0 justify-center">
                <span className="mt-[0.3125rem] size-[0.3125rem] shrink-0 animate-ping rounded-full bg-[var(--to-accent)]" />
              </span>
              <span className="pb-[0.25rem] text-[0.8125rem] leading-[1.5] text-ink-3">
                still working…
              </span>
            </li>
          )}
        </ol>
      )}
    </section>
  );
}
