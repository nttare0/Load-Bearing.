"use client";

import { ArrowUpRight, Brain, Settings2 } from "lucide-react";
import { ConnectorList, useConnectors } from "@/components/Connectors";
import { CardHead, CARD } from "@/components/rail/parts";
import { EFFORTS, THINKING, type Effort } from "@/lib/effort";

/**
 * Connectors, in their own card, with the one setting that changes how the
 * model behaves sitting above them.
 *
 * Separate from files because they answer a different question. Files are what
 * this workspace has produced; connectors are what this deployment *is* — the
 * repo, the host, the model, the storage. Mixing them put a fact about the
 * server underneath a list of your own documents.
 */
export function ConnectorRail({
  mode,
  model,
  storage,
  thinking,
  onThinking,
  llmKey,
  onOpenSettings,
}: {
  mode: "demo" | "live" | null;
  model: string | null;
  storage: string | null;
  /** How hard the model is asked to think on the next run. */
  thinking: Effort;
  onThinking: (effort: Effort) => void;
  llmKey: boolean;
  onOpenSettings: () => void;
}) {
  const connectors = useConnectors({ mode, model, storage });

  return (
    <div className="flex shrink-0 flex-col gap-[0.5rem]">
      {/* ---- how hard it thinks ---------------------------------------- */}
      <section className={CARD}>
        <CardHead title="Thinking">
          <span className="flex items-center gap-[0.1875rem] text-[0.625rem] text-ink-3">
            <Brain aria-hidden className="size-3" />
            {THINKING[thinking].hint}
          </span>
        </CardHead>

        <div
          role="radiogroup"
          aria-label="How hard the model thinks"
          className="flex gap-[0.25rem] border-t border-[var(--to-border)] p-[0.25rem]"
        >
          {EFFORTS.map((effort) => {
            const spec = THINKING[effort];
            const active = effort === thinking;
            return (
              <button
                key={effort}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onThinking(effort)}
                title={spec.detail}
                className={`flex flex-1 flex-col items-center gap-[0.0625rem] rounded-[0.375rem] border px-[0.25rem] py-[0.1875rem] transition-colors ${
                  active
                    ? "border-[var(--to-border-strong)] bg-[var(--to-surface-2)] text-foreground"
                    : "border-transparent text-ink-3 hover:bg-[var(--to-surface-2)] hover:text-foreground"
                }`}
              >
                <span className="text-[0.75rem]">{spec.label}</span>
                <span className="text-[0.5625rem] uppercase tracking-[0.04em] text-ink-3">
                  {spec.cost}
                </span>
              </button>
            );
          })}
        </div>

        {/* The honest note: for some providers this setting is not wired. */}
        <p className="border-t border-[var(--to-border)] px-[0.625rem] py-[0.375rem] text-[0.6875rem] leading-[1.5] text-ink-3">
          {mode === "live" && model && !/gemini/i.test(model)
            ? "Claude does not expose a thinking level here, so this changes the reading, not the reasoning."
            : "Set per run, from the composer's hold or from here. Deep thinking costs more tokens and takes longer."}
        </p>
      </section>

      {/* ---- what this is wired to -------------------------------------- */}
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
    </div>
  );
}
