"use client";

import { ArrowUpRight, Settings2 } from "lucide-react";
import { ConnectorList, useConnectors } from "@/components/Connectors";
import { CardHead, CARD } from "@/components/rail/parts";

/**
 * Connectors, alone in the right column.
 *
 * There used to be a "Thinking" card above this one. It is gone: the thinking
 * level is a setting, and the one place a setting belongs is Settings. Keeping a
 * copy out here meant two controls for one value, which is how the two drift.
 *
 * What is left is the question this column answers — what is this deployment
 * wired to — and the way in to changing the one part of it a visitor can change.
 */
export function ConnectorRail({
  mode,
  model,
  storage,
  llmKey,
  onOpenSettings,
}: {
  mode: "demo" | "live" | null;
  model: string | null;
  storage: string | null;
  llmKey: boolean;
  onOpenSettings: () => void;
}) {
  const connectors = useConnectors({ mode, model, storage });

  return (
    <section className={CARD}>
      <CardHead title="Connectors">
        {llmKey && (
          <span
            className="shrink-0 text-[0.625rem] text-ink-3"
            title="Analysis runs on the key you pasted in Settings"
          >
            your key
          </span>
        )}
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Open settings"
          title="Open settings"
          className="shrink-0 rounded-[0.25rem] p-[0.125rem] text-ink-3 hover:bg-[var(--to-surface-2)] hover:text-foreground"
        >
          <Settings2 aria-hidden className="size-4" />
        </button>
      </CardHead>
      <ConnectorList connectors={connectors} />
      <button
        type="button"
        onClick={onOpenSettings}
        className="flex w-full items-center gap-[0.25rem] border-t border-[var(--to-border)] px-[0.625rem] py-[0.3125rem] text-left text-[0.75rem] text-ink-3 hover:bg-[var(--to-surface-2)] hover:text-foreground"
      >
        Manage model keys and connectors
        <ArrowUpRight aria-hidden className="size-3 shrink-0" />
      </button>
    </section>
  );
}
