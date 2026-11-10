"use client";

import { useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Claim } from "@/lib/schema";
import { cn } from "@/lib/utils";

type ClaimNodeData = {
  claim: Claim;
  onFocus: (claim: Claim) => void;
};

function ClaimNode({ data }: NodeProps) {
  const { claim, onFocus } = data as unknown as ClaimNodeData;
  const accent =
    claim.priority >= 8
      ? "var(--lb-load)"
      : claim.priority >= 5
        ? "var(--lb-structural)"
        : "var(--lb-light)";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onFocus(claim)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onFocus(claim);
      }}
      className={cn(
        "w-[228px] cursor-pointer rounded-lg border border-border bg-background-raised px-3 py-2.5 text-left shadow-card transition-shadow hover:shadow-md"
      )}
      style={{ borderTop: `3px solid ${accent}` }}
    >
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono-tight text-[10px] text-muted-foreground">
          #{claim.rank} · {claim.ref}
        </span>
        <span
          className="rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide"
          style={{ background: "var(--to-surface-2)", color: accent }}
        >
          {claim.status}
        </span>
      </div>
      <p className="mt-1 line-clamp-3 text-[12px] leading-snug font-medium text-foreground">{claim.claim}</p>
      <p className="mt-1 text-[10px] text-muted-foreground">
        impact {claim.impact}/5 · {claim.confidence}
      </p>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

const nodeTypes = { claim: ClaimNode };

/**
 * Layered layout, done by hand so there is no extra dependency: claims that
 * nothing depends on sit at the bottom, and each level up is one more
 * dependency removed. Reading bottom-up tells you the order to check things.
 */
function layout(claims: Claim[]): { nodes: Node[]; edges: Edge[] } {
  const byRef = new Map(claims.map((c) => [c.ref, c]));
  const depth = new Map<string, number>();

  const resolve = (ref: string, seen: Set<string> = new Set()): number => {
    if (depth.has(ref)) return depth.get(ref)!;
    if (seen.has(ref)) return 0;
    seen.add(ref);
    const claim = byRef.get(ref);
    if (!claim || claim.dependsOn.length === 0) {
      depth.set(ref, 0);
      return 0;
    }
    const parents = claim.dependsOn.filter((r) => byRef.has(r));
    const value = parents.length ? Math.max(...parents.map((p) => resolve(p, seen))) + 1 : 0;
    depth.set(ref, value);
    return value;
  };

  claims.forEach((c) => resolve(c.ref));

  const levels = new Map<number, Claim[]>();
  for (const claim of claims) {
    const level = depth.get(claim.ref) ?? 0;
    levels.set(level, [...(levels.get(level) ?? []), claim]);
  }

  const maxLevel = Math.max(...Array.from(levels.keys()), 0);
  const nodes: Node[] = [];
  const gapX = 260;
  const gapY = 170;

  for (const [level, items] of levels) {
    const sorted = [...items].sort((a, b) => a.rank - b.rank);
    const offset = ((sorted.length - 1) * gapX) / 2;
    sorted.forEach((claim, i) => {
      nodes.push({
        id: claim.ref,
        type: "claim",
        position: { x: i * gapX - offset, y: (maxLevel - level) * gapY },
        data: { claim } as unknown as Record<string, unknown>,
        draggable: true,
      });
    });
  }

  const edges: Edge[] = [];
  for (const claim of claims) {
    for (const dep of claim.dependsOn) {
      if (!byRef.has(dep)) continue;
      edges.push({
        id: `${dep}->${claim.ref}`,
        source: dep,
        target: claim.ref,
        animated: false,
        style: { stroke: claim.priority >= 8 ? "var(--to-border-strong)" : "var(--to-border)" },
      });
    }
  }

  return { nodes, edges };
}

export function DependencyGraph({
  claims,
  onFocus,
}: {
  claims: Claim[];
  onFocus: (claim: Claim) => void;
}) {
  const [selected, setSelected] = useState<Claim | null>(null);

  const { nodes, edges } = useMemo(() => {
    const base = layout(claims);
    return {
      ...base,
      nodes: base.nodes.map((n) => ({
        ...n,
        data: { claim: (n.data as unknown as ClaimNodeData).claim, onFocus: (c: Claim) => { setSelected(c); onFocus(c); } },
      })),
    };
  }, [claims, onFocus]);

  const hasEdges = edges.length > 0;

  return (
    <div className="relative h-[520px] w-full overflow-hidden rounded-[var(--radius-card)] border border-border bg-background-raised">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.3}
        maxZoom={1.4}
        nodesConnectable={false}
        edgesFocusable={false}
        panOnScroll
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="var(--to-border)" />
        <Controls
          showInteractive={false}
          className="!rounded-lg !border !border-border !bg-background-raised !shadow-none [&>button]:!border-border [&>button]:!bg-background-raised [&>button]:!text-muted-foreground"
        />
      </ReactFlow>

      {!hasEdges && (
        <p className="pointer-events-none absolute left-1/2 bottom-4 -translate-x-1/2 rounded-full border border-border bg-background px-3 py-1 text-[11px] text-muted-foreground">
          No claim depends on another yet — every node here stands alone.
        </p>
      )}

      <div className="pointer-events-none absolute left-3 top-3 max-w-[220px] rounded-lg border border-border bg-background/90 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground backdrop-blur">
        Read bottom-up. A node only matters if the claim above it is true. Click a node to jump to its card.
      </div>

      {selected && (
        <div className="absolute right-3 top-3 max-w-[280px] rounded-lg border border-border bg-background-raised p-3 text-[12px] shadow-card">
          <p className="font-medium text-foreground">{selected.claim}</p>
          <p className="mt-1 text-muted-foreground">
            Impact {selected.impact}/5 · confidence {selected.confidence} · {selected.category}
          </p>
          <button
            className="mt-2 text-[11px] text-foreground underline underline-offset-2 cursor-pointer"
            onClick={() => setSelected(null)}
          >
            dismiss
          </button>
        </div>
      )}
    </div>
  );
}
