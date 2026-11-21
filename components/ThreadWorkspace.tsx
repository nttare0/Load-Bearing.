"use client";

import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Thread } from "@/components/Thread";
import { ReasoningPanel } from "@/components/ReasoningPanel";
import type { ReasonStep } from "@/lib/reasoning";
import { StatusLegend } from "@/components/Report";
import { EXAMPLES } from "@/lib/examples";
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
  reasoning,
  composer,
  mirofish,
  demo,
  onExample,
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
  /** The thinking steps of the run in progress, streamed. */
  reasoning?: ReasonStep[];
  composer: ReactNode;
  mirofish?: boolean;
  /** No model configured: what comes back is a worked example, not your plan. */
  demo?: boolean;
  /** Hand a worked example to the composer. */
  onExample?: (text: string) => void;
}) {
  if (!workspace) {
    return (
      <div className="flex flex-1 flex-col justify-center gap-[1rem]">
        <p className="text-center text-[0.875rem] text-ink-3">Loading…</p>
        {composer}
      </div>
    );
  }

  /**
   * A workspace with nothing in it **is** a new chat.
   *
   * That is the distinction the sidebar draws, and it has to hold here too: New
   * chat is a verb that opens this canvas, and this canvas stays "new" until
   * something is sent. The heading says so in the first line — `New chat` above
   * `What would you like to test?` — rather than leaving a person to work out
   * whether the blank column is a chat they already made or one they have not.
   */
  const empty = workspace.messages.length === 0;

  if (empty) {
    // A first run has no thread to hang the panel on, so it appears above the
    // composer instead — the same place, the same shape.
    const firstRun = busy ? <ReasoningPanel steps={reasoning ?? []} running /> : null;

    return (
      <div className="flex flex-1 flex-col justify-center gap-[1.5rem] pb-[3rem]">
        <div className="flex flex-col gap-[0.5rem]">
          {/* The label, not a heading: it marks the state this canvas is in. */}
          <p className="text-center text-[0.6875rem] uppercase tracking-[0.08em] text-ink-3">
            New chat · its own workspace
          </p>
          <h1 className="lb-serif text-center text-[2rem] leading-[1.1] tracking-[-0.01em] text-ink sm:text-[2.5rem]">
            What would you like to test?
          </h1>
          <p className="mx-auto max-w-[34rem] text-center text-[0.875rem] leading-[1.55] text-ink-3">
            Paste a plan — a business, a launch, a hire, a trip. You get back the assumptions it
            quietly rests on, ranked by what breaks if they are wrong, each with the cheapest test
            that could settle it.
          </p>
          {/* Where it will go, said before it goes there: the one thing a new
              chat cannot show you is the list it will join. */}
          <p className="mx-auto max-w-[34rem] text-center text-[0.75rem] leading-[1.5] text-ink-3">
            Sending starts this chat and names it after the plan. Until then nothing is saved,
            and asking for a new chat leaves this one blank.
          </p>
        </div>

        {/* No key: say so where it cannot be missed, and say exactly what that
            means — the report you get is a worked example, not your plan. */}
        {demo && <DemoNotice className="mx-auto max-w-[42rem]" />}

        {firstRun && <div className="mx-auto w-full max-w-[42rem]">{firstRun}</div>}

        <div className="mx-auto w-full max-w-[42rem]">{composer}</div>

        {onExample && (
          <div className="mx-auto flex w-full max-w-[42rem] flex-wrap items-center justify-center gap-[0.375rem]">
            <span className="text-[0.75rem] text-ink-3">Or start from</span>
            {EXAMPLES.map((example) => (
              <button
                key={example.label}
                type="button"
                onClick={() => onExample(example.text)}
                className="rounded-[var(--to-radius-pill)] border border-[var(--to-border)] px-[0.625rem] py-[0.1875rem] text-[0.75rem] text-ink-2 hover:border-[var(--to-border-strong)] hover:text-foreground"
              >
                {example.label}
              </button>
            ))}
          </div>
        )}

        <div className="mx-auto flex w-full max-w-[42rem] flex-col items-center gap-[0.75rem]">
          <StatusLegend />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-[1.5rem]">
      {demo && <DemoNotice />}
      <Thread
        mirofish={mirofish}
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
        /* The wait, with its contents: the panel streams what the model is
           doing and finding, above the composer that is currently disabled. */
        <div className="flex flex-col gap-[0.375rem]" role="status" aria-live="polite">
          <ReasoningPanel steps={reasoning ?? []} running />
          <p className="flex items-center gap-[0.375rem] text-[0.75rem] text-ink-3">
            <Loader2 className="size-3 animate-spin" aria-hidden />
            {stage ?? "starting"}
          </p>
        </div>
      )}
      {/* Pinned to the bottom of the column. It used to sit after the whole
          report, four screens down, so answering anything meant scrolling to
          find the box you type in. */}
      {/* Sits above the mobile bar rather than under it: the bar is 3rem plus the
          safe-area inset, and a composer you cannot see is not a composer. On
          md+ the inset is zero because the bar is not rendered. */}
      <div className="sticky bottom-[calc(3rem+env(safe-area-inset-bottom))] z-10 -mx-[1rem] bg-[var(--to-bg)]/92 px-[1rem] pt-[0.5rem] pb-[0.75rem] backdrop-blur-sm md:bottom-0">
        <div className="mx-auto w-full max-w-[42rem]">{composer}</div>
      </div>
    </div>
  );
}

/**
 * No key means no analysis of your plan. That was a 9px grey word in a footer
 * strip; on a page whose whole output is an argument, it belongs at the size of
 * a sentence. Shown above the thread as well as on the empty state, because the
 * report it produces looks exactly like a real one about your plan.
 */
function DemoNotice({ className = "" }: { className?: string }) {
  return (
    <p
      className={`flex flex-wrap items-center justify-center gap-[0.375rem] rounded-[var(--to-radius-sm)] border border-[var(--to-border-strong)] px-[0.75rem] py-[0.375rem] text-center text-[0.75rem] leading-[1.5] text-ink-2 ${className}`}
    >
      <span className="lb-mono text-[0.6875rem] uppercase tracking-wide">Demo</span>
      No model is configured, so every run returns the same worked example. The interface is
      real; the analysis is not about your plan.
    </p>
  );
}
