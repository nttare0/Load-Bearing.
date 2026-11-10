"use client";

import { useCallback, useMemo, useState } from "react";
import { Download, FileJson, FileText, Link as LinkIcon, Share2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ClaimCard } from "@/components/ClaimCard";
import { DependencyGraph } from "@/components/DependencyGraph";
import { StatusBadge } from "@/components/ConfidenceBadge";
import { toJson, toMarkdown } from "@/lib/export";
import { downloadPdf } from "@/lib/pdf";
import { bandLabel } from "@/lib/score";
import type { Analysis } from "@/lib/schema";
import { cn } from "@/lib/utils";

type Props = {
  analysis: Analysis;
  persisted: boolean;
  onDelete?: () => void;
  onOutcome?: (ref: string, outcome: "confirmed" | "broken" | "inconclusive") => void;
  outcomes?: Record<string, "confirmed" | "broken" | "inconclusive">;
};

export function Report({ analysis, persisted, onDelete, onOutcome, outcomes = {} }: Props) {
  const [busy, setBusy] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c = { load: 0, structural: 0, light: 0, fact: 0, guess: 0, unverified: 0, contradicted: 0 };
    for (const claim of analysis.claims) {
      if (claim.priority >= 8) c.load += 1;
      else if (claim.priority >= 5) c.structural += 1;
      else c.light += 1;
      c[claim.status] += 1;
    }
    return c;
  }, [analysis.claims]);

  const markdown = useMemo(() => toMarkdown(analysis), [analysis]);

  const download = useCallback(
    async (kind: "md" | "json" | "pdf") => {
      setBusy(kind);
      try {
        if (kind === "pdf") {
          await downloadPdf(analysis);
        } else {
          const blob = new Blob([kind === "md" ? markdown : toJson(analysis)], {
            type: kind === "md" ? "text/markdown" : "application/json",
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${slug(analysis.title)}.${kind}`;
          a.click();
          URL.revokeObjectURL(url);
        }
        toast.success(`Report exported as ${kind.toUpperCase()}`);
      } catch {
        toast.error("The export failed. Try the Markdown version.");
      } finally {
        setBusy(null);
      }
    },
    [analysis, markdown]
  );

  const copyShareLink = useCallback(async () => {
    // A link only means something once the report is in storage. Without it,
    // hand over the report text instead of a URL that would 404 for whoever
    // you sent it to.
    try {
      if (!persisted) {
        await navigator.clipboard.writeText(markdown);
        toast.success("Report copied. Share links need storage, so the text went to the clipboard.");
        return;
      }
      await navigator.clipboard.writeText(`${window.location.origin}/r/${analysis.id}`);
      toast.success("Share link copied");
    } catch {
      toast.error("Could not copy to the clipboard.");
    }
  }, [analysis.id, markdown, persisted]);

  return (
    <div className="flex flex-col gap-[1rem]">
      <Card className="gap-0 overflow-hidden rounded-[var(--to-radius)] border-border py-0 shadow-[var(--to-shadow)]">
        <div className="flex flex-col gap-[0.75rem] p-[1rem]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="lb-wordmark text-[1.375rem] leading-[1.2] sm:text-[1.625rem]">{analysis.title}</h2>
              <p className="mt-[0.5rem] max-w-[38rem] text-[0.9375rem] leading-[1.6] text-ink-2">
                {analysis.summary}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => download("md")} disabled={busy === "md"}>
                <FileText className="h-3.5 w-3.5" /> Markdown
              </Button>
              <Button variant="outline" size="sm" onClick={() => download("pdf")} disabled={busy === "pdf"}>
                <Download className="h-3.5 w-3.5" /> PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => download("json")} disabled={busy === "json"}>
                <FileJson className="h-3.5 w-3.5" /> JSON
              </Button>
              <Button variant="outline" size="sm" onClick={copyShareLink}>
                <Share2 className="h-3.5 w-3.5" /> Share
              </Button>
              {onDelete && (
                <Button variant="ghost" size="sm" onClick={onDelete} aria-label="Delete this analysis">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-[0.5em] border-t border-border pt-[0.75rem] text-[0.75rem] text-ink-3">
            <Badge variant="load">{counts.load} load-bearing</Badge>
            <Badge variant="structural">{counts.structural} structural</Badge>
            <Badge variant="light">{counts.light} light</Badge>
            <span className="mx-1 h-3 w-px bg-rule" aria-hidden />
            <span>{counts.fact} fact</span>
            <span>·</span>
            <span>{counts.guess} guess</span>
            <span>·</span>
            <span>{counts.unverified} unverified</span>
            {counts.contradicted > 0 && (
              <>
                <span>·</span>
                <span className="text-[var(--lb-load)]">{counts.contradicted} contradicted</span>
              </>
            )}
            <span className="ml-auto flex items-center gap-1.5">
              <LinkIcon className="h-3 w-3" />
              {persisted ? "saved" : "this device"}
            </span>
          </div>
        </div>
      </Card>

      {analysis.notes.length > 0 && (
        <div className="rounded-[var(--to-radius)] border border-[var(--lb-structural)]/40 bg-[var(--lb-structural-soft)] px-[0.75rem] py-[0.5rem]">
          <p className="lb-label text-[0.6875rem] text-[var(--lb-structural)]">Notes</p>
          <ul className="mt-[0.375rem] flex flex-col gap-[0.25rem] text-[0.8125rem] leading-[1.5] text-ink-2">
            {analysis.notes.map((note) => (
              <li key={note}>— {note}</li>
            ))}
          </ul>
        </div>
      )}

      <Tabs defaultValue="ranked">
        <TabsList>
          <TabsTrigger value="ranked">Ranked list</TabsTrigger>
          <TabsTrigger value="graph">Dependency map</TabsTrigger>
          <TabsTrigger value="premortem">Pre-mortem</TabsTrigger>
          <TabsTrigger value="markdown">Report text</TabsTrigger>
        </TabsList>

        <TabsContent value="ranked" className="flex flex-col gap-[0.75rem]">
          <p className="lb-hint text-[0.75rem]">Ranked by impact × uncertainty.</p>
          {analysis.claims.map((claim) => (
            <ClaimCard
              key={claim.id}
              claim={claim}
              claims={analysis.claims}
              outcome={outcomes[claim.ref]}
              onOutcome={onOutcome}
              canRecord={persisted}
            />
          ))}
        </TabsContent>

        <TabsContent value="graph">
          <DependencyGraph
            claims={analysis.claims}
            onFocus={(_claim) => {
              document.querySelector('[data-state="inactive"][value="ranked"]');
            }}
          />
        </TabsContent>

        <TabsContent value="premortem" className="flex flex-col gap-3">
          {analysis.failureModes.length === 0 ? (
            <p className="lb-hint text-[0.875rem]">No pre-mortem for this run.</p>
          ) : (
            analysis.failureModes.map((mode, i) => {
              const claim = analysis.claims.find((c) => c.ref === mode.claimRef);
              return (
                <Card key={`${mode.claimRef}-${i}`} className="gap-[0.5rem] rounded-[var(--to-radius)] border-border py-[0.875rem] shadow-[var(--to-shadow)]">
                  <CardHeader>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={
                          mode.likelihood === "high"
                            ? "contradicted"
                            : mode.likelihood === "medium"
                              ? "guess"
                              : "fact"
                        }
                      >
                        {mode.likelihood} likelihood
                      </Badge>
                      {claim && (
                        <Badge variant="outline" className="max-w-full truncate">
                          maps to {claim.ref}: {claim.claim}
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="mt-1 text-[0.9375rem] leading-[1.6] font-normal">
                      {mode.scenario}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-[0.8125rem] text-ink-2">
                      <span className="font-semibold text-foreground">First sign </span>
                      {mode.earlyWarning}
                    </p>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="markdown">
          <div className="relative">
            <pre className="lb-mono max-h-[32rem] overflow-auto rounded-[var(--to-radius)] border border-border bg-[var(--to-surface-2)] p-[0.75rem] text-[0.75rem] leading-[1.6] text-ink-2 whitespace-pre-wrap">
              {markdown}
            </pre>
            <Button
              size="sm"
              variant="outline"
              className="absolute right-3 top-3"
              onClick={async () => {
                await navigator.clipboard.writeText(markdown);
                toast.success("Markdown copied");
              }}
            >
              Copy
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      <p className="border-t border-border pt-[0.75rem] text-[0.75rem] leading-[1.5] text-ink-3">
        {persisted ? "Saved. Delete it any time." : "On this device only."}
      </p>
    </div>
  );
}

function slug(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "load-bearing-report"
  );
}

/** Small helper so the empty state and the report share one status vocabulary. */
export function StatusLegend() {
  return (
    <div className="flex flex-wrap items-center gap-[0.375em]">
      {(["fact", "guess", "unverified", "contradicted"] as const).map((status) => (
        <StatusBadge key={status} status={status} />
      ))}
    </div>
  );
}

export { bandLabel };
