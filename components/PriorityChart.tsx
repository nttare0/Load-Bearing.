"use client";

import { Bar } from "@/components/charts/bar";
import { BarChart } from "@/components/charts/bar-chart";
import { ChartTooltip, type TooltipRow } from "@/components/charts/tooltip";
import { Grid } from "@/components/charts/grid";
import { BarYAxis } from "@/components/charts/bar-y-axis";
import { band, bandLabel } from "@/lib/score";
import type { Claim } from "@/lib/schema";

/**
 * The ranking, drawn.
 *
 * Three series rather than one, because a bar can only carry one colour and
 * here the colour *is* the finding: how much timber sits on this claim. Each
 * claim appears in exactly one series — the band its priority falls in — so
 * the lengths can be compared down the list and the colours still mean what
 * they mean everywhere else on the page.
 *
 * Built on Bklit UI's bar chart (vendored from its registry), so the motion,
 * the tooltip and the axis are theirs; the palette is this app's.
 */

type Row = Record<string, unknown> & {
  claim: string;
  ref: string;
  load: number;
  structural: number;
  light: number;
};

const SERIES = [
  { key: "load", fill: "var(--lb-load)", label: "Load-bearing" },
  { key: "structural", fill: "var(--lb-structural)", label: "Structural" },
  { key: "light", fill: "var(--lb-light)", label: "Light partition" },
] as const;

function toRow(claim: Claim): Row {
  const priority = Number(claim.priority.toFixed(1));
  return {
    claim: claim.claim,
    ref: claim.ref,
    load: band(claim.priority) === "load-bearing" ? priority : 0,
    structural: band(claim.priority) === "structural" ? priority : 0,
    light: band(claim.priority) === "light" ? priority : 0,
  };
}

export function PriorityChart({ claims }: { claims: Claim[] }) {
  // Bklit draws the first data row at the bottom of the y-band, so reverse to
  // keep the strongest claim at the top where the list starts.
  const data = claims
    .slice()
    .sort((a, b) => a.rank - b.rank)
    .map(toRow)
    .reverse();

  if (data.length === 0) return null;

  const rows = Object.fromEntries(data.map((d) => [d.ref as string, d]));

  return (
    <div className="lb-surface overflow-hidden rounded-[var(--to-radius)] border border-[var(--to-border)]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-[1rem] gap-y-[0.25rem] border-b border-[var(--to-border)] px-[1rem] py-[0.75rem]">
        <p className="lb-label text-[0.6875rem]">Priority by band</p>
        <ul className="flex flex-wrap items-center gap-x-[1rem] gap-y-[0.25rem]">
          {SERIES.map((series) => (
            <li key={series.key} className="flex items-center gap-[0.375rem] text-[0.6875rem] text-ink-3">
              <span
                aria-hidden
                className="size-[0.5rem] shrink-0 rounded-[2px]"
                style={{ background: series.fill }}
              />
              {series.label}
            </li>
          ))}
        </ul>
      </div>

      <div className="px-[0.5rem] pt-[0.5rem]">
        <BarChart
          data={data}
          xDataKey="ref"
          orientation="horizontal"
          margin={{ top: 8, right: 24, bottom: 32, left: 8 }}
          aspectRatio="16 / 9"
          className="text-[0.75rem]"
          barGap={0.3}
        >
          <Grid horizontal={false} vertical fadeVertical />
          {SERIES.map((series) => (
            <Bar
              key={series.key}
              dataKey={series.key}
              fill={series.fill}
              lineCap={2}
              minBarHeight={0}
            />
          ))}
          <BarYAxis />
          <ChartTooltip
            showCrosshair={false}
            rows={(point) => {
              const row = rows[String(point.ref)];
              if (!row) return [];
              const hit = SERIES.find((series) => row[series.key] !== 0);
              return [
                {
                  label: "Ref",
                  value: String(row.ref),
                  color: hit?.fill ?? "var(--to-ink-3)",
                },
                {
                  label: "Priority",
                  value: `${String(hit ? row[hit.key] : 0)} — ${bandLabel(hit ? row[hit.key] as number : 0)}`,
                  color: hit?.fill ?? "var(--to-ink-3)",
                },
                {
                  label: "Claim",
                  value: String(row.claim),
                  color: hit?.fill ?? "var(--to-ink-3)",
                },
              ];
            }}
          />
        </BarChart>
      </div>
    </div>
  );
}
