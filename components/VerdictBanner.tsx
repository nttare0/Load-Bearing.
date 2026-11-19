"use client";

import { ChevronRight, FlaskConical } from "lucide-react";
import { bandLabel } from "@/lib/score";
import type { Verdict } from "@/lib/verdict";

/**
 * The answer, at the top of the report, above every tab.
 *
 * Before this existed, the top claim was the first card inside the "Ranked list"
 * tab, one of five equal tabs, behind eight pieces of metadata and a collapsed
 * test. Someone could read the whole page and never learn which assumption would
 * sink the plan. This says it in one sentence, then points at the test.
 *
 * It states only what the report holds: the claim's own words, the band it sits
 * in, and the test the model designed. When there is no test it says that
 * instead of quietly omitting the row, because "we don't know how to check this"
 * is the most useful thing a report can admit.
 */
export function VerdictBanner({
  verdict,
  onJump,
}: {
  verdict: Verdict;
  /** Scroll to the claim's card. Absent on a shared, read-only report. */
  onJump?: () => void;
}) {
  const { claim, headline, detail, test, others } = verdict;

  return (
    <section
      aria-label="The short answer"
      className="rounded-[var(--to-radius)] border border-[var(--to-border)] bg-[var(--to-surface)]"
    >
      <div className="flex flex-col gap-[0.5rem] px-[1rem] py-[0.875rem]">
        <div className="flex flex-wrap items-center gap-[0.5rem]">
          <span className="lb-label text-[0.625rem] text-ink-3">Short answer</span>
          {claim && (
            <span className="lb-mono text-[0.625rem] text-ink-3">
              {bandLabel(claim.priority)} · {claim.priority.toFixed(1)}
            </span>
          )}
          {others > 0 && (
            <span className="text-[0.625rem] text-ink-3">
              and {others} other{others === 1 ? "" : "s"} at that level
            </span>
          )}
        </div>

        <p className="text-[1.0625rem] leading-[1.45] text-foreground">{headline}</p>

        <p className="text-[0.8125rem] leading-[1.5] text-ink-2">{detail}</p>

        {test ? (
          <div className="mt-[0.125rem] flex flex-col gap-[0.25rem] rounded-[var(--to-radius-sm)] border border-[var(--to-border)] px-[0.75rem] py-[0.5rem]">
            <p className="flex flex-wrap items-baseline gap-x-[0.5rem] gap-y-[0.125rem]">
              <span className="flex items-center gap-[0.25rem] text-[0.625rem] text-ink-3">
                <FlaskConical aria-hidden className="size-3" />
                cheapest test
              </span>
              <span className="lb-mono text-[0.625rem] text-ink-3">
                {test.cost} · {test.time}
              </span>
            </p>
            <p className="text-[0.8125rem] leading-[1.5] text-ink-2">{test.method}</p>
            <p className="text-[0.75rem] leading-[1.5] text-ink-3">
              <span className="text-ink-2">Stop if</span> {stripPeriod(test.breaks)}
            </p>
          </div>
        ) : (
          <p className="text-[0.8125rem] text-[var(--to-warning)]">
            No test was designed for this one, so treat it as unverified until you find a way to check it.
          </p>
        )}

        {claim && onJump && (
          <button
            type="button"
            onClick={onJump}
            className="flex items-center gap-[0.1875rem] self-start text-[0.75rem] text-ink-3 hover:text-foreground"
          >
            Read the claim
            <ChevronRight aria-hidden className="size-3" />
          </button>
        )}
      </div>
    </section>
  );
}

/** "Stop if this happens." → "this happens", since the label already says when. */
function stripPeriod(text: string): string {
  const trimmed = text.trim().replace(/[.!?]+$/, "");
  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
}
