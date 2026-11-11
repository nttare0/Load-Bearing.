"use client";

import { Check, Loader2, ShieldQuestion, X } from "lucide-react";
import type { Verdict } from "@/lib/resources";

/**
 * What the model wants to do, and what it is allowed to do.
 *
 * Safe operations are listed as already done. Deletions are listed as a
 * question: one line each, with the model's own reason beside it, and two
 * buttons. A model that could delete a user's work without this bar would
 * eventually do exactly that.
 */
export function ProposalBar({
  verdicts,
  note,
  busy,
  onApprove,
  onReject,
  onDismiss,
}: {
  verdicts: Verdict[];
  note?: string;
  busy: boolean;
  onApprove: (verdict: Verdict) => void;
  onReject: (verdict: Verdict) => void;
  onDismiss: () => void;
}) {
  if (verdicts.length === 0) return null;

  const applied = verdicts.filter((v) => v.applies);
  const pending = verdicts.filter((v) => v.needsApproval);
  const refused = verdicts.filter((v) => v.rejectedBecause);

  return (
    <div className="flex flex-col gap-[0.375rem] border border-[var(--to-border)] px-[0.5rem] py-[0.375rem]">
      <div className="flex items-center gap-[0.375rem]">
        <ShieldQuestion aria-hidden className="size-3 shrink-0 text-ink-3" />
        <span className="text-[0.75rem] text-ink-2">
          {pending.length > 0
            ? `${pending.length} deletion${pending.length === 1 ? "" : "s"} waiting for you`
            : `${applied.length} change${applied.length === 1 ? "" : "s"} applied`}
        </span>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="ml-auto rounded-[var(--to-radius-sm)] p-[0.125rem] text-ink-3 hover:text-foreground"
        >
          <X aria-hidden className="size-3" />
        </button>
      </div>

      {applied.length > 0 && (
        <ul className="flex flex-col gap-[0.125rem]">
          {applied.map((verdict, index) => (
            <li key={index} className="flex items-start gap-[0.25rem] text-[0.75rem] leading-[1.5] text-ink-3">
              <Check aria-hidden className="mt-[0.1875rem] size-3 shrink-0" />
              {verdict.summary}
            </li>
          ))}
        </ul>
      )}

      {pending.length > 0 && (
        <ul className="flex flex-col gap-[0.25rem]">
          {pending.map((verdict, index) => (
            <li key={index} className="flex flex-wrap items-center gap-[0.375rem]">
              <span className="min-w-0 flex-1 text-[0.75rem] leading-[1.5] text-ink-2">
                {verdict.summary}
                {verdict.action.reason && (
                  <span className="block text-[0.6875rem] text-ink-3">“{verdict.action.reason}”</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => onApprove(verdict)}
                disabled={busy}
                className="flex items-center gap-[0.1875rem] border border-[var(--to-border-strong)] px-[0.375rem] py-[0.125rem] text-[0.6875rem] disabled:opacity-40"
              >
                {busy ? <Loader2 aria-hidden className="size-3 animate-spin" /> : null}
                Delete
              </button>
              <button
                type="button"
                onClick={() => onReject(verdict)}
                className="px-[0.25rem] py-[0.125rem] text-[0.6875rem] text-ink-3 hover:text-foreground"
              >
                Keep
              </button>
            </li>
          ))}
        </ul>
      )}

      {refused.length > 0 && (
        <ul className="flex flex-col gap-[0.125rem]">
          {refused.map((verdict, index) => (
            <li key={index} className="text-[0.6875rem] leading-[1.5] text-ink-3">
              Skipped: {verdict.summary} — {verdict.rejectedBecause}
            </li>
          ))}
        </ul>
      )}

      {note && <p className="text-[0.6875rem] leading-[1.5] text-ink-3">{note}</p>}
    </div>
  );
}
