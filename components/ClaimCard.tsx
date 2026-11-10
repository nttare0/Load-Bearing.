"use client";

import { useState } from "react";
import { ChevronDown, ExternalLink, FlaskConical, Link2, ShieldQuestion } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ImpactMeter, ScoreBadge, StatusBadge } from "@/components/ConfidenceBadge";
import { cn } from "@/lib/utils";
import { bandLabel } from "@/lib/score";
import type { Claim } from "@/lib/schema";

type Props = {
  claim: Claim;
  claims: Claim[];
  outcome?: "confirmed" | "broken" | "inconclusive";
  onOutcome?: (ref: string, outcome: "confirmed" | "broken" | "inconclusive") => void;
  canRecord?: boolean;
};

export function ClaimCard({ claim, claims, outcome, onOutcome, canRecord }: Props) {
  const [open, setOpen] = useState(false);
  const dependencies = claim.dependsOn
    .map((ref) => claims.find((c) => c.ref === ref))
    .filter((c): c is Claim => Boolean(c));

  const accent =
    claim.priority >= 8
      ? "border-l-load-bearing"
      : claim.priority >= 5
        ? "border-l-structural"
        : "border-l-light-partition";

  return (
    <Card className={cn("animate-rise gap-0 overflow-hidden rounded-[var(--to-radius)] border-border border-l-2 py-0 shadow-[var(--to-shadow)] transition-[border-color,box-shadow] hover:shadow-[0_0_0_1px_var(--to-border-strong),var(--to-shadow)]", accent)}>
      <div className="flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono-tight text-[11px] text-muted-foreground">#{claim.rank}</span>
          <StatusBadge status={claim.status} />
          <Badge variant="outline">{claim.category}</Badge>
          <ScoreBadge claim={claim} />
          {outcome === "confirmed" && <Badge variant="fact">tested · holds</Badge>}
          {outcome === "broken" && <Badge variant="contradicted">tested · broken</Badge>}
          {outcome === "inconclusive" && <Badge variant="unverified">tested · unclear</Badge>}
        </div>

        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] leading-snug font-medium text-foreground">{claim.claim}</p>
            <p className="mt-2 flex items-start gap-1.5 text-[13px] leading-relaxed text-muted-foreground">
              <ShieldQuestion className="mt-[3px] h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              {claim.source === "implied" ? (
                <span className="italic">Implied — the plan never says this out loud.</span>
              ) : (
                <span>
                  “{claim.source}”
                </span>
              )}
            </p>
          </div>
          <div className="hidden shrink-0 flex-col items-end gap-1 pt-1 sm:flex">
            <ImpactMeter impact={claim.impact} />
            <span className="text-[10px] text-muted-foreground">impact</span>
          </div>
        </div>

        {dependencies.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-muted-foreground">
            <Link2 className="h-3 w-3" aria-hidden />
            <span>only matters if</span>
            {dependencies.map((d) => (
              <span
                key={d.ref}
                className="rounded border border-border bg-background px-1.5 py-0.5 font-mono-tight text-[11px] text-muted-foreground"
                title={d.claim}
              >
                {d.ref}
              </span>
            ))}
          </div>
        )}

        {claim.reasoning && (
          <p className="border-l-2 border-border pl-3 text-[13px] leading-relaxed text-muted-foreground">
            {claim.reasoning}
          </p>
        )}

        {claim.evidence.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {claim.evidence.map((item) => (
              <a
                key={item.url}
                href={item.url}
                target="_blank"
                rel="noreferrer noopener"
                className="group flex items-start gap-2 rounded-md border border-border bg-background px-3 py-2 transition-colors hover:border-foreground/25"
              >
                <Badge
                  variant={
                    item.supports === "supports"
                      ? "fact"
                      : item.supports === "contradicts"
                        ? "contradicted"
                        : "unverified"
                  }
                >
                  {item.supports}
                </Badge>
                <span className="min-w-0 flex-1 text-[12px] leading-relaxed">
                  <span className="block truncate font-medium text-foreground">{item.title}</span>
                  <span className="block text-muted-foreground">{item.snippet}</span>
                  <span className="mt-0.5 block truncate font-mono-tight text-[11px] text-muted-foreground">
                    {item.url}
                  </span>
                </span>
                <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-foreground" aria-hidden />
              </a>
            ))}
          </div>
        )}

        {claim.test ? (
          <div className="rounded-lg border border-border bg-background">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-[13px] font-medium text-foreground cursor-pointer"
              aria-expanded={open}
            >
              <span className="flex items-center gap-2">
                <FlaskConical className="h-3.5 w-3.5 text-load-bearing" aria-hidden />
                Cheapest test
                <span className="font-normal text-muted-foreground">
                  {claim.test.cost} · {claim.test.time}
                </span>
              </span>
              <ChevronDown
                className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
                aria-hidden
              />
            </button>
            {open && (
              <div className="border-t border-border px-3 py-3 text-[13px] leading-relaxed">
                <p className="text-foreground">{claim.test.method}</p>
                <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-[var(--lb-light)]">
                      proceed if
                    </dt>
                    <dd className="text-muted-foreground">{claim.test.confirms}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-[var(--lb-load)]">
                      stop if
                    </dt>
                    <dd className="text-muted-foreground">{claim.test.breaks}</dd>
                  </div>
                </dl>
                {canRecord && onOutcome && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">Ran it?</span>
                    <Button size="sm" variant={outcome === "confirmed" ? "default" : "outline"} onClick={() => onOutcome(claim.ref, "confirmed")}>
                      Holds
                    </Button>
                    <Button size="sm" variant={outcome === "broken" ? "destructive" : "outline"} onClick={() => onOutcome(claim.ref, "broken")}>
                      Broken
                    </Button>
                    <Button size="sm" variant={outcome === "inconclusive" ? "default" : "outline"} onClick={() => onOutcome(claim.ref, "inconclusive")}>
                      Unclear
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="text-[12px] text-muted-foreground">No test yet — this one sits below the top of the list.</p>
        )}
      </div>
    </Card>
  );
}

/** Compact row used under the graph and in the export preview. */
export function ClaimRow({ claim }: { claim: Claim }) {
  return (
    <AccordionItem value={claim.ref}>
      <AccordionTrigger>
        <span className="flex min-w-0 items-center gap-2">
          <span className="font-mono-tight text-[11px] text-muted-foreground">#{claim.rank}</span>
          <StatusBadge status={claim.status} />
          <span className="truncate">{claim.claim}</span>
        </span>
      </AccordionTrigger>
      <AccordionContent>
        <p className="text-muted-foreground">{claim.reasoning}</p>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {bandLabel(claim.priority)} · impact {claim.impact}/5 · confidence {claim.confidence}
        </p>
      </AccordionContent>
    </AccordionItem>
  );
}
