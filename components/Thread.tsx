"use client";

import { Fragment } from "react";
import { FlaskConical, Search, Sparkles } from "lucide-react";
import { Report } from "@/components/Report";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Analysis } from "@/lib/schema";
import type { Message } from "@/lib/workspace";

/**
 * The conversation, as the page's main column.
 *
 * Turns are not bubbles: a plan you pasted is a block of text set the way a
 * document would set it, and a report opens in place as a full report rather
 * than a summary that hides the evidence behind a link.
 */
export function Thread({
  messages,
  analyses,
  onOutcome,
  onDeleteReport,
}: {
  messages: Message[];
  analyses: Record<string, Analysis>;
  onOutcome: (analysisId: string, ref: string, outcome: "confirmed" | "broken" | "inconclusive") => void;
  onDeleteReport: (analysisId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-[1.5rem]">
      {messages.map((message) => {
        if (message.role === "user") {
          return (
            <div key={message.id} className="flex flex-col gap-[0.375rem]">
              <div className="flex items-center gap-[0.5rem]">
                <span className="lb-label text-[0.6875rem]">You</span>
                <span className="lb-mono text-[0.6875rem] text-ink-3">
                  {new Date(message.at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <p className="max-w-[46rem] whitespace-pre-wrap text-[0.9375rem] leading-[1.6] text-foreground">
                {message.text}
              </p>
            </div>
          );
        }

        const analysis = message.analysisId ? analyses[message.analysisId] : undefined;

        return (
          <div key={message.id} className="flex flex-col gap-[0.625rem]">
            <div className="flex flex-wrap items-center gap-[0.5rem]">
              <span className="lb-label flex items-center gap-[0.375rem] text-[0.6875rem]">
                {message.kind === "answer" ? (
                  <>
                    <Search className="size-3" aria-hidden /> Research
                  </>
                ) : message.kind === "error" ? (
                  <Badge variant="contradicted">did not finish</Badge>
                ) : (
                  <>
                    <FlaskConical className="size-3" aria-hidden /> Report
                  </>
                )}
              </span>
              {message.lookedAt && (
                <span className="lb-mono text-[0.6875rem] text-ink-3">
                  read {message.lookedAt.analyses} reports · {message.lookedAt.claims} claims ·{" "}
                  {message.lookedAt.tested} tested
                </span>
              )}
            </div>

            {message.kind === "answer" && (
              <div className="flex flex-col gap-[0.5rem] border-l-2 border-l-[var(--to-border-strong)] pl-[0.75rem]">
                <p className="max-w-[46rem] whitespace-pre-wrap text-[0.9375rem] leading-[1.6] text-ink-2">
                  {message.text}
                </p>
                <p className="lb-mono text-[0.6875rem] leading-[1.5] text-ink-3">
                  Answered from this workspace only. No sources were opened — run a claim&apos;s test for evidence.
                </p>
              </div>
            )}

            {message.kind === "error" && (
              <p className="text-[0.875rem] leading-[1.55] text-ink-2">{message.text}</p>
            )}

            {analysis && (
              <Fragment>
                <Report
                  analysis={analysis}
                  persisted
                  onOutcome={(ref, outcome) => onOutcome(analysis.id, ref, outcome)}
                  onDelete={() => onDeleteReport(analysis.id)}
                />
              </Fragment>
            )}

            {message.kind === "report" && !analysis && (
              <div className="flex items-center gap-[0.5rem] rounded-[var(--to-radius)] border border-[var(--to-border)] px-[0.75rem] py-[0.5rem]">
                <Sparkles className="size-3.5 text-ink-3" aria-hidden />
                <p className="text-[0.8125rem] text-ink-2">
                  This report is in storage but not loaded here.{" "}
                  <Button variant="link" size="sm" className="h-auto p-0 text-[0.8125rem]" onClick={() => onDeleteReport(message.analysisId!)}>
                    Forget this turn
                  </Button>
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
