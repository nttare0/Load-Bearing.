"use client";

import { useMemo, useState } from "react";
import {
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
        "lb-hover-ring w-[13.5rem] cursor-pointer rounded-[var(--to-radius)] border border-border bg-transparent px-[0.625rem] py-[0.5rem] text-left"
      )}
      style={{ borderTop: `2px solid ${accent}` }}
    >
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center justify-between gap-2">
        <span className="lb-mono text-[0.6875rem] text-ink-3">
          #{claim.rank} · {claim.ref}
        </span>
        <span
          className="rounded-full px-[0.375em] py-[0.0625em] text-[0.625rem] font-semibold uppercase tracking-[0.04em]"
          style={{ background: "var(--to-surface-2)", color: accent }}
        >
          {claim.status}
        </span>
      </div>
      <p className="mt-[0.25rem] line-clamp-3 text-[0.8125rem] leading-[1.4] font-medium text-foreground">{claim.claim}</p>
      <p className="lb-mono mt-[0.25rem] text-[0.625rem] text-ink-3">
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
    <div className="relative h-[32rem] w-full overflow-hidden rounded-[var(--to-radius)] border border-border bg-transparent">
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
        <Controls
          showInteractive={false}
          className="!rounded-[var(--to-radius-sm)] !border !border-border !bg-transparent !shadow-none [&>button]:!border-border [&>button]:!bg-transparent [&>button]:!text-ink-2"
        />
      </ReactFlow>

      {!hasEdges && (
        <p className="lb-hint pointer-events-none absolute left-1/2 bottom-3 -translate-x-1/2 text-[0.75rem]">
          No claim depends on another.
        </p>
      )}

      <div className="pointer-events-none absolute left-3 top-3 max-w-[15rem] rounded-[var(--to-radius-sm)] border border-border bg-background px-[0.5rem] py-[0.375rem] text-[0.75rem] leading-[1.4] text-ink-2">
        Read bottom-up: a node only matters if the claim above it is true.
      </div>

      {selected && (
        <div className="absolute right-3 top-3 max-w-[17rem] rounded-[var(--to-radius)] border border-border bg-background p-[0.625rem] text-[0.8125rem]">
          <p className="font-medium text-foreground">{selected.claim}</p>
          <p className="lb-hint mt-[0.25rem]">
            impact {selected.impact}/5 · {selected.confidence} · {selected.category}
          </p>
          <button
            className="mt-[0.5rem] text-[0.75rem] text-ink-3 underline underline-offset-2 hover:text-foreground"
            onClick={() => setSelected(null)}
          >
            dismiss
          </button>
        </div>
      )}
    </div>
  );
}
