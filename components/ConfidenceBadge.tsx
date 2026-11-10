import { Badge } from "@/components/ui/badge";
import { bandLabel } from "@/lib/score";
import type { Claim, Status } from "@/lib/schema";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<Status, string> = {
  fact: "fact",
  guess: "guess",
  unverified: "unverified",
  contradicted: "contradicted",
};

const STATUS_TONE = {
  fact: "fact",
  guess: "guess",
  unverified: "unverified",
  contradicted: "contradicted",
} as const;

export function StatusBadge({ status }: { status: Status }) {
  return (
    <Badge variant={STATUS_TONE[status]}>
      <span
        aria-hidden
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status === "fact" && "bg-[var(--lb-light)]",
          status === "guess" && "bg-[var(--lb-structural)]",
          status === "unverified" && "bg-[var(--to-ink-3)]",
          status === "contradicted" && "bg-load-bearing"
        )}
      />
      {STATUS_LABEL[status]}
    </Badge>
  );
}

/** Impact and confidence as bands, never as a fake precise number. */
export function ScoreBadge({ claim }: { claim: Claim }) {
  const tone = claim.priority >= 8 ? "load" : claim.priority >= 5 ? "structural" : "light";
  return (
    <Badge variant={tone} className="font-mono-tight">
      {bandLabel(claim.priority)} · {claim.impact}/5 · {claim.confidence}
    </Badge>
  );
}

export function ImpactMeter({ impact }: { impact: number }) {
  return (
    <span className="inline-flex items-center gap-[3px]" aria-label={`Impact ${impact} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={cn(
            "h-3 w-[3px] rounded-full",
            n <= impact ? "bg-load-bearing" : "bg-foreground/10"
          )}
        />
      ))}
    </span>
  );
}
