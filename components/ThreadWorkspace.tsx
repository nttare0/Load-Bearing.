"use client";

import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Thread } from "@/components/Thread";
import { StatusLegend } from "@/components/Report";
import type { Analysis } from "@/lib/schema";
import type { Workspace } from "@/lib/workspace";

/**
 * The canvas.
 *
 * The reference's page is one centred column: a question in serif, the composer
 * under it, everything else out of the way. That is the shape here too when a
 * workspace is empty — except the composer is passed in and stays mounted in
 * the same place, so starting work never moves the thing you are typing into.
 *
 * Once there is work, the heading collapses to a line and the thread takes the
 * column, with the composer sitting under it rather than pinned over it.
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
  stage,
  composer,
}: {
  workspace: Workspace | null;
  analyses: Record<string, Analysis>;
  prevOf: (analysisId: string) => Analysis | undefined;
  planOf: (analysisId: string) => string | undefined;
  onOutcome: (analysisId: string, ref: string, outcome: "confirmed" | "broken" | "inconclusive") => void;
  onDeleteReport: (analysisId: string) => void;
  onRerun: (planId: string) => void;
  busy: boolean;
  /** The pass currently running, already in plain language. */
  stage?: string | null;
  composer: ReactNode;
}) {
  if (!workspace) {
    return (
      <div className="flex flex-1 flex-col justify-center gap-[1rem]">
        <p className="text-center text-[0.875rem] text-ink-3">Loading…</p>
        {composer}
      </div>
    );
  }

  const empty = workspace.messages.length === 0;

  if (empty) {
    return (
      <div className="flex flex-1 flex-col justify-center gap-[1.5rem] pb-[3rem]">
        <h1 className="lb-serif text-center text-[2rem] leading-[1.1] tracking-[-0.01em] text-ink sm:text-[2.5rem]">
          What would you like to test?
        </h1>
        <div className="mx-auto w-full max-w-[42rem]">{composer}</div>
        <div className="mx-auto flex w-full max-w-[42rem] flex-col items-center gap-[0.75rem]">
          <StatusLegend />
          <p className="max-w-[34rem] text-center text-[0.75rem] leading-[1.55] text-ink-3">
            Claims come back ranked by what collapses if they are wrong, each with the cheapest test that
            could kill it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-[1.5rem]">
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
      {busy && (
        /* During a run the thread says which pass is running, so the wait has
           a shape. The composer below is disabled and carries the same text. */
        <p className="flex items-center gap-[0.375rem] text-[0.8125rem] text-ink-3" role="status">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          {stage ?? "starting"}
        </p>
      )}
      <div className="mx-auto w-full max-w-[42rem]">{composer}</div>
    </div>
  );
}
