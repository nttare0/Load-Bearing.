"use client";

import { Check, CircleSlash, HelpCircle, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { progressOf, verdict } from "@/lib/progress";
import type { Analysis } from "@/lib/schema";
import { cn } from "@/lib/utils";

/**
 * "What you learned", as a panel.
 *
 * Two things it refuses to do: congratulate a plan nothing has been run
 * against, and hide a broken claim inside a count. The broken ones are listed
 * by name, above everything else.
 */
export function ProgressPanel({ analysis }: { analysis: Analysis }) {
  const progress = progressOf(analysis);
  if (progress.total === 0) return null;

  const pct = Math.round(progress.coverage * 100);

  return (
    <div className="rounded-[var(--to-radius)] border border-[var(--to-border)]">
      <div className="flex flex-col gap-[0.5rem] border-b border-[var(--to-border)] px-[0.875rem] py-[0.75rem]">
        <div className="flex flex-wrap items-baseline justify-between gap-x-[1rem] gap-y-[0.25rem]">
          <p className="lb-label text-[0.6875rem]">What you learned</p>
          <p className="lb-mono text-[0.6875rem] text-ink-3">
            {progress.tested}/{progress.total} tested
          </p>
        </div>
        <p className="text-[0.875rem] leading-[1.5] text-ink-2">{verdict(progress)}</p>

        {/* Coverage as a hairline, in position where a bar chart would be. */}
        <div
          className="mt-[0.125rem] flex h-[0.25rem] w-full overflow-hidden rounded-[2px] bg-[var(--to-border)]"
          role="img"
          aria-label={`${pct}% of claims tested`}
        >
          <span className="bg-[var(--lb-load)]" style={{ width: `${(progress.broken / progress.total) * 100}%` }} />
          <span className="bg-[var(--lb-fact)]" style={{ width: `${(progress.confirmed / progress.total) * 100}%` }} />
          <span
            className="bg-[var(--to-border-strong)]"
            style={{ width: `${(progress.inconclusive / progress.total) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-[1rem] gap-y-[0.375rem] px-[0.875rem] py-[0.625rem] text-[0.75rem] text-ink-3">
        <Tally icon={Check} tone="fact" n={progress.confirmed} label="holds" />
        <Tally icon={X} tone="load" n={progress.broken} label="broken" />
        <Tally icon={HelpCircle} tone="muted" n={progress.inconclusive} label="unclear" />
        <Tally icon={CircleSlash} tone="muted" n={progress.untested.length} label="untested" />
      </div>

      {progress.brokenClaims.length > 0 && (
        <ul className="flex flex-col gap-[0.5rem] border-t border-[var(--to-border)] px-[0.875rem] py-[0.75rem]">
          {progress.brokenClaims.map((claim) => (
            <li key={claim.id} className="flex flex-col gap-[0.25rem]">
              <div className="flex items-center gap-2">
                <Badge variant="contradicted">{claim.ref}</Badge>
                <span className="text-[0.875rem] leading-[1.45] font-medium text-foreground">{claim.claim}</span>
              </div>
              {claim.test?.breaks && (
                <p className="lb-mono text-[0.6875rem] leading-[1.5] text-[var(--lb-load)]">
                  your stop condition: “{claim.test.breaks}”
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Tally({
  icon: Icon,
  tone,
  n,
  label,
}: {
  icon: typeof Check;
  tone: "fact" | "load" | "muted";
  n: number;
  label: string;
}) {
  return (
    <span className="flex items-center gap-[0.375rem]">
      <Icon
        aria-hidden
        className={cn(
          "size-3",
          tone === "fact" ? "text-[var(--lb-fact)]" : tone === "load" ? "text-[var(--lb-load)]" : "text-ink-3"
        )}
      />
      <span className={cn("lb-mono", n === 0 && "text-ink-3")}>{n}</span>
      {label}
    </span>
  );
}
