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
        toast.success("Report copied as Markdown — share links need storage, so the full text is on your clipboard.");
        return;
      }
      await navigator.clipboard.writeText(`${window.location.origin}/r/${analysis.id}`);
      toast.success("Share link copied");
    } catch {
      toast.error("Could not copy to the clipboard.");
    }
  }, [analysis.id, markdown, persisted]);

  return (
    <div className="flex flex-col gap-5">
      <Card className="gap-0 overflow-hidden rounded-[var(--to-radius)] border-border py-0 shadow-[var(--to-shadow)]">
        <div className="flex flex-col gap-4 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="lb-label text-[0.6875rem] text-[var(--lb-load)]">
                Load-Bearing report
              </p>
              <h2 className="lb-wordmark mt-1.5 text-[1.375rem] leading-[1.2] sm:text-[1.625rem]">{analysis.title}</h2>
              <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
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

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3 text-[12px] text-muted-foreground">
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
              {persisted ? "saved to your account" : "on this device only"}
            </span>
          </div>
        </div>
      </Card>

      {analysis.notes.length > 0 && (
        <div className="rounded-lg border border-[var(--lb-structural)]/25 bg-[var(--lb-structural-soft)]/60 px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--lb-structural)]">
            About this run
          </p>
          <ul className="mt-1.5 flex flex-col gap-1 text-[12.5px] leading-relaxed text-[var(--to-ink-2)]">
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

        <TabsContent value="ranked" className="flex flex-col gap-3">
          <p className="px-1 text-[12px] text-muted-foreground">
            Sorted by impact × uncertainty. The top of this list is what you should check before writing code.
          </p>
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
            <p className="text-[13px] text-muted-foreground">No pre-mortem was generated for this run.</p>
          ) : (
            analysis.failureModes.map((mode, i) => {
              const claim = analysis.claims.find((c) => c.ref === mode.claimRef);
              return (
                <Card key={`${mode.claimRef}-${i}`} className="gap-3 rounded-[var(--to-radius)] border-border py-4 shadow-[var(--to-shadow)]">
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
                    <p className="text-[12.5px] text-muted-foreground">
                      <span className="font-medium text-foreground">First sign: </span>
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
            <pre className="max-h-[560px] overflow-auto rounded-lg border border-border bg-background-raised p-4 font-mono text-[11.5px] leading-relaxed text-muted-foreground whitespace-pre-wrap">
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

      <div className="flex flex-col gap-1 border-t border-border pt-4 text-[11.5px] leading-relaxed text-muted-foreground">
        <p>
          A claim marked <span className="text-muted-foreground">fact</span> or{" "}
          <span className="text-muted-foreground">contradicted</span> has a URL behind it. Everything else is unverified —
          that is the point of the label.
        </p>
        <p>
          Plans are not stored unless you ask. {persisted ? "This one is saved; delete it any time with the bin icon." : "This one lives in your browser only."}
        </p>
      </div>
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
  const items = [
    { status: "fact" as const, text: "You can point at a source." },
    { status: "guess" as const, text: "The author asserts it, nothing backs it." },
    { status: "unverified" as const, text: "Checkable, nobody has checked." },
    { status: "contradicted" as const, text: "Something on the record says otherwise." },
  ];
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      {items.map((item) => (
        <span key={item.status} className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
          <StatusBadge status={item.status} />
          {item.text}
        </span>
      ))}
    </div>
  );
}

export { bandLabel };
