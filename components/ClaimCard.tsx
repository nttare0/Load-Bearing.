"use client";

import { useState } from "react";
import { ChevronDown, ExternalLink, FlaskConical, Link2, ShieldQuestion } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ImpactMeter, ScoreBadge, StatusBadge } from "@/components/ConfidenceBadge";
import { cn } from "@/components/ui/utils";
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
      ? "border-l-[#b4451f]"
      : claim.priority >= 5
        ? "border-l-[#9a6b12]"
        : "border-l-[#4a6b57]";

  return (
    <Card className={cn("animate-rise overflow-hidden border-l-[3px]", accent)}>
      <div className="flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono-tight text-[11px] text-ink-faint">#{claim.rank}</span>
          <StatusBadge status={claim.status} />
          <Badge tone="outline">{claim.category}</Badge>
          <ScoreBadge claim={claim} />
          {outcome === "confirmed" && <Badge tone="fact">tested · holds</Badge>}
          {outcome === "broken" && <Badge tone="contradicted">tested · broken</Badge>}
          {outcome === "inconclusive" && <Badge tone="unverified">tested · unclear</Badge>}
        </div>

        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] leading-snug font-medium text-ink">{claim.claim}</p>
            <p className="mt-2 flex items-start gap-1.5 text-[13px] leading-relaxed text-ink-soft">
              <ShieldQuestion className="mt-[3px] h-3.5 w-3.5 shrink-0 text-ink-faint" aria-hidden />
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
            <span className="text-[10px] text-ink-faint">impact</span>
          </div>
        </div>

        {dependencies.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-ink-faint">
            <Link2 className="h-3 w-3" aria-hidden />
            <span>only matters if</span>
            {dependencies.map((d) => (
              <span
                key={d.ref}
                className="rounded border border-rule bg-paper px-1.5 py-0.5 font-mono-tight text-[11px] text-ink-soft"
                title={d.claim}
              >
                {d.ref}
              </span>
            ))}
          </div>
        )}

        {claim.reasoning && (
          <p className="border-l-2 border-rule pl-3 text-[13px] leading-relaxed text-ink-soft">
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
                className="group flex items-start gap-2 rounded-md border border-rule bg-paper px-3 py-2 transition-colors hover:border-ink/25"
              >
                <Badge
                  tone={
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
                  <span className="block truncate font-medium text-ink">{item.title}</span>
                  <span className="block text-ink-soft">{item.snippet}</span>
                  <span className="mt-0.5 block truncate font-mono-tight text-[11px] text-ink-faint">
                    {item.url}
                  </span>
                </span>
                <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint group-hover:text-ink" aria-hidden />
              </a>
            ))}
          </div>
        )}

        {claim.test ? (
          <div className="rounded-lg border border-rule bg-paper">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-[13px] font-medium text-ink cursor-pointer"
              aria-expanded={open}
            >
              <span className="flex items-center gap-2">
                <FlaskConical className="h-3.5 w-3.5 text-[#b4451f]" aria-hidden />
                Cheapest test
                <span className="font-normal text-ink-faint">
                  {claim.test.cost} · {claim.test.time}
                </span>
              </span>
              <ChevronDown
                className={cn("h-4 w-4 shrink-0 text-ink-faint transition-transform", open && "rotate-180")}
                aria-hidden
              />
            </button>
            {open && (
              <div className="border-t border-rule px-3 py-3 text-[13px] leading-relaxed">
                <p className="text-ink">{claim.test.method}</p>
                <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-[#3c5b49]">
                      proceed if
                    </dt>
                    <dd className="text-ink-soft">{claim.test.confirms}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-[#96391b]">
                      stop if
                    </dt>
                    <dd className="text-ink-soft">{claim.test.breaks}</dd>
                  </div>
                </dl>
                {canRecord && onOutcome && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-ink-faint">Ran it?</span>
                    <Button size="sm" variant={outcome === "confirmed" ? "primary" : "outline"} onClick={() => onOutcome(claim.ref, "confirmed")}>
                      Holds
                    </Button>
                    <Button size="sm" variant={outcome === "broken" ? "load" : "outline"} onClick={() => onOutcome(claim.ref, "broken")}>
                      Broken
                    </Button>
                    <Button size="sm" variant={outcome === "inconclusive" ? "primary" : "outline"} onClick={() => onOutcome(claim.ref, "inconclusive")}>
                      Unclear
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="text-[12px] text-ink-faint">No test yet — this one sits below the top of the list.</p>
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
          <span className="font-mono-tight text-[11px] text-ink-faint">#{claim.rank}</span>
          <StatusBadge status={claim.status} />
          <span className="truncate">{claim.claim}</span>
        </span>
      </AccordionTrigger>
      <AccordionContent>
        <p className="text-ink-soft">{claim.reasoning}</p>
        <p className="mt-2 text-[11px] text-ink-faint">
          {bandLabel(claim.priority)} · impact {claim.impact}/5 · confidence {claim.confidence}
        </p>
      </AccordionContent>
    </AccordionItem>
  );
}
