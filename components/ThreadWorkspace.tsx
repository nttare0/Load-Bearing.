"use client";

import { Thread } from "@/components/Thread";
import { StatusLegend } from "@/components/Report";
import type { Analysis } from "@/lib/schema";
import type { Workspace } from "@/lib/workspace";

/**
 * One workspace's conversation, or the invitation that starts it.
 *
 * The empty state is not a marketing hero: it says what the tool needs (a
 * plan) and what it will do with it (quote the claims, rank them, design the
 * cheapest disproof), then stops.
 */
export function ThreadWorkspace({
  workspace,
  analyses,
  prevOf,
  planOf,
  onOutcome,
  onDeleteReport,
  onRerun,
  busy,
}: {
  workspace: Workspace | null;
  analyses: Record<string, Analysis>;
  prevOf: (analysisId: string) => Analysis | undefined;
  planOf: (analysisId: string) => string | undefined;
  onOutcome: (analysisId: string, ref: string, outcome: "confirmed" | "broken" | "inconclusive") => void;
  onDeleteReport: (analysisId: string) => void;
  onRerun: (planId: string) => void;
  busy: boolean;
}) {
  if (!workspace) {
    return (
      <div className="flex flex-1 items-center justify-center py-[3rem]">
        <p className="text-[0.875rem] text-ink-3">Loading workspace…</p>
      </div>
    );
  }

  if (workspace.messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col justify-center gap-[1.25rem] py-[2rem]">
        <div className="flex flex-col gap-[0.5rem]">
          <h1 className="lb-serif text-[1.75rem] leading-[1.15] tracking-[-0.01em] text-ink sm:text-[2.125rem]">
            What would you like to test?
          </h1>
          <p className="max-w-[38rem] text-[0.9375rem] leading-[1.6] text-ink-2">
            Paste a plan, a decision, or an argument. It comes back as the claims it rests on — ranked by
            what collapses if they are wrong — each with the cheapest test that could kill it.
          </p>
        </div>

        <StatusLegend />

        <ol className="flex flex-col gap-[0.5rem] border-t border-border pt-[1rem]">
          {[
            {
              title: "Quotes, never paraphrases",
              body: "Every claim carries a line from your plan, or the word implied.",
            },
            {
              title: "Ranked by what collapses",
              body: "Impact × uncertainty, on a fixed rubric, scored twice.",
            },
            {
              title: "Tested before it is built",
              body: "The cheapest disproof, with the number that means stop.",
            },
          ].map((item, i) => (
            <li key={item.title} className="flex gap-[0.625rem]">
              <span className="lb-mono mt-[0.125rem] shrink-0 text-[0.6875rem] text-ink-3">0{i + 1}</span>
              <span className="flex flex-col gap-[0.125rem]">
                <span className="text-[0.875rem] leading-[1.35] font-semibold">{item.title}</span>
                <span className="text-[0.875rem] leading-[1.5] text-ink-2">{item.body}</span>
              </span>
            </li>
          ))}
        </ol>

        <p className="text-[0.75rem] leading-[1.5] text-ink-3">
          Nothing is stored unless you tick “Keep this analysis”. Workspaces live in this browser.
        </p>
      </div>
    );
  }

  return (
    <Thread
      messages={workspace.messages}
      analyses={analyses}
      prevOf={prevOf}
      planOf={planOf}
      onOutcome={onOutcome}
      onDeleteReport={onDeleteReport}
      onRerun={onRerun}
      busy={busy}
    />
  );
}
