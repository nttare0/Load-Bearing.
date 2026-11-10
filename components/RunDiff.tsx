"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { diffRuns, diffVerdict, type ClaimMovement } from "@/lib/diff";
import type { Analysis } from "@/lib/schema";
import { bandLabel } from "@/lib/score";
import { cn } from "@/lib/utils";

/**
 * What moved since the last run of this plan.
 *
 * Only three kinds of claim are shown by default — settled, new, dropped — plus
 * anything that changed band. The unchanged ones are collapsed into a count,
 * because listing them would bury the four lines that matter. That is the whole
 * argument of this panel: a second report is not progress, a changed one is.
 */

const MOVEMENT_COPY: Record<ClaimMovement, string> = {
  settled: "Settled",
  new: "New",
  reordered: "Moved",
  dropped: "Gone",
  unchanged: "Unchanged",
};

export function RunDiff({ base, latest }: { base: Analysis; latest: Analysis }) {
  const [showAll, setShowAll] = useState(false);
  const diff = diffRuns(base, latest);

  const notable = diff.claims.filter(
    (d) => d.movement !== "unchanged" || Math.abs((d.was ?? d.claim.priority) - d.claim.priority) >= 0.5
  );
  const shown = showAll ? diff.claims : notable;

  const ago = new Date(base.createdAt).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });

  return (
    <section className="flex flex-col rounded-[var(--to-radius)] border border-[var(--to-border)]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-[1rem] gap-y-[0.25rem] border-b border-[var(--to-border)] px-[0.875rem] py-[0.625rem]">
        <p className="lb-label text-[0.6875rem]">
          Since run {base.run ?? 1} · {ago}
        </p>
        <p className="lb-mono text-[0.6875rem] text-ink-3">
          {diff.counts.settled} settled · {diff.counts.reordered} moved · {diff.counts.unchanged} unchanged
        </p>
      </div>

      <p className="border-b border-[var(--to-border)] px-[0.875rem] py-[0.625rem] text-[0.875rem] leading-[1.5] text-ink-2">
        {diffVerdict(diff)}
      </p>

      <ul className="flex flex-col">
        {shown.map((row) => (
          <li
            key={`${row.movement}-${row.claim.id}`}
            className="flex flex-col gap-[0.25rem] border-b border-[var(--to-border)] px-[0.875rem] py-[0.625rem] last:border-b-0"
          >
            <div className="flex flex-wrap items-center gap-[0.5rem]">
              <Badge
                variant={
                  row.movement === "settled"
                    ? row.claim.outcome?.result === "broken"
                      ? "contradicted"
                      : "fact"
                    : row.movement === "dropped"
                      ? "outline"
                      : row.movement === "new"
                        ? "structural"
                        : "unverified"
                }
              >
                {MOVEMENT_COPY[row.movement]}
              </Badge>
              <span className="lb-mono text-[0.6875rem] text-ink-3">{row.claim.ref}</span>
              <span className="min-w-0 flex-1 text-[0.875rem] leading-[1.45] text-foreground">
                {row.claim.claim}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-[0.75rem] gap-y-[0.125rem] text-[0.75rem] text-ink-3">
              {row.was !== undefined && row.wasBand && row.wasBand !== bandLabel(row.claim.priority) && (
                <span>
                  <span className="lb-mono">{row.was}</span> → <span className="lb-mono">{row.claim.priority}</span>{" "}
                  · {bandLabel(row.claim.priority)}
                </span>
              )}
              {row.wasStatus && row.wasStatus !== row.claim.status && (
                <span className="lb-mono">
                  {row.wasStatus} → {row.claim.status}
                </span>
              )}
              {row.movement === "unchanged" && <span>nothing changed</span>}
              {row.movement === "dropped" && (
                <span>was ranked {row.claim.rank} · no longer claimed by this plan</span>
              )}
            </div>
          </li>
        ))}
      </ul>

      {diff.claims.length > notable.length && (
        <div className={cn("flex items-center justify-between gap-[0.5rem] px-[0.875rem] py-[0.5rem]")}>
          <p className="text-[0.75rem] text-ink-3">
            {showAll
              ? `Showing all ${diff.claims.length} claims.`
              : `${diff.claims.length - notable.length} unchanged claims hidden.`}
          </p>
          <Button variant="ghost" size="sm" className="h-7 gap-[0.25rem] text-[0.75rem]" onClick={() => setShowAll((v) => !v)}>
            <ChevronDown className={cn("size-3 transition-transform", showAll && "rotate-180")} />
            {showAll ? "Show only what moved" : "Show all"}
          </Button>
        </div>
      )}
    </section>
  );
}
