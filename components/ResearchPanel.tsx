"use client";

import { useState } from "react";
import type { Claim } from "@/lib/schema";

/**
 * MiroFish research, beside the report and never inside it.
 *
 * The distinction this component exists to draw: a claim's evidence is a page
 * someone opened. A simulation is a world someone imagined. They look similar
 * on a screen and are not similar at all, so this panel is visually separate,
 * says "prediction" on every row, and offers no way to promote anything into
 * the report.
 */

type Prediction = {
  ref: string | null;
  prediction: string;
  direction: "supports" | "undercuts" | "unclear";
  basis: string;
};

type State =
  | { phase: "idle" }
  | { phase: "running"; stage: string }
  | { phase: "done"; predictions: Prediction[]; rounds: number | null; note: string; label: string }
  | { phase: "error"; error: string; note?: string };

const DIRECTION_LABEL: Record<Prediction["direction"], string> = {
  supports: "leans for",
  undercuts: "leans against",
  unclear: "unclear",
};

export function ResearchPanel({ claims }: { claims: Claim[] }) {
  const [question, setQuestion] = useState("");
  const [state, setState] = useState<State>({ phase: "idle" });

  async function run() {
    setState({ phase: "running", stage: "starting" });
    try {
      const response = await fetch("/api/research/mirofish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          claims: claims.slice(0, 12).map((c) => ({ ref: c.ref, claim: c.claim })),
        }),
      });

      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setState({ phase: "error", error: payload.error ?? `Request failed (${response.status}).` });
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          const line = frame.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          let event: Record<string, unknown>;
          try {
            event = JSON.parse(line.slice(6)) as Record<string, unknown>;
          } catch {
            continue;
          }

          if (event.type === "start") {
            setState({ phase: "running", stage: "seeding" });
          } else if (event.type === "stage") {
            setState({ phase: "running", stage: String(event.stage) });
          } else if (event.type === "done") {
            setState({
              phase: "done",
              predictions: (event.predictions as Prediction[]) ?? [],
              rounds: (event.rounds as number | null) ?? null,
              note: String(event.note ?? ""),
              label: String(event.label ?? "Simulation"),
            });
          } else if (event.type === "error") {
            setState({
              phase: "error",
              error: String(event.error ?? "The simulation failed."),
              note: typeof event.note === "string" ? event.note : undefined,
            });
          }
        }
      }
    } catch (error) {
      setState({ phase: "error", error: error instanceof Error ? error.message : String(error) });
    }
  }

  const canRun = question.trim().length >= 10 && state.phase !== "running";

  return (
    <section className="border-t border-[var(--to-line)] pt-8" aria-labelledby="research-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 id="research-heading" className="text-[0.9375rem] font-medium">
          Simulate a reaction
        </h3>
        <span className="lb-mono text-[0.6875rem] text-[var(--to-muted)]">not evidence</span>
      </div>

      <p className="mt-2 max-w-[38rem] text-[0.875rem] leading-relaxed text-[var(--to-muted)]">
        Ask how the people in this plan might behave. MiroFish builds agents from it and runs a
        social simulation. The answer is a prediction — it never becomes a claim, a score, or a
        source.
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && canRun) void run();
          }}
          placeholder="Will 400 subscribers sign up within six months?"
          aria-label="Simulation question"
          className="min-w-0 flex-1 border border-[var(--to-line)] bg-transparent px-3 py-2 text-[0.875rem] outline-none placeholder:text-[var(--to-muted)] focus:border-[var(--to-ink)]"
        />
        <button
          type="button"
          onClick={() => void run()}
          disabled={!canRun}
          className="shrink-0 border border-[var(--to-ink)] px-4 py-2 text-[0.8125rem] disabled:border-[var(--to-line)] disabled:text-[var(--to-muted)]"
        >
          {state.phase === "running" ? "Simulating…" : "Simulate"}
        </button>
      </div>

      {state.phase === "running" && (
        <p className="mt-3 lb-mono text-[0.6875rem] text-[var(--to-muted)]" role="status">
          {state.stage}… this takes minutes and spends tokens on the MiroFish instance.
        </p>
      )}

      {state.phase === "error" && (
        <p className="mt-3 text-[0.8125rem] text-[var(--to-muted)]" role="alert">
          {state.error}
          {state.note ? ` ${state.note}` : ""}
        </p>
      )}

      {state.phase === "done" && (
        <div className="mt-5">
          <p className="lb-mono text-[0.6875rem] text-[var(--to-muted)]">
            {state.label}
            {state.rounds ? ` · ${state.rounds} rounds` : ""}
          </p>

          <ul className="mt-3 divide-y divide-[var(--to-line)]">
            {state.predictions.map((prediction, index) => (
              <li key={index} className="py-3">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="lb-mono text-[0.6875rem] text-[var(--to-muted)]">
                    {prediction.ref ? prediction.ref : "plan"}
                  </span>
                  <span className="lb-mono text-[0.6875rem] text-[var(--to-muted)]">
                    prediction · {DIRECTION_LABEL[prediction.direction]}
                  </span>
                </div>
                <p className="mt-1 text-[0.875rem] leading-relaxed">{prediction.prediction}</p>
              </li>
            ))}
          </ul>

          {state.predictions.length === 0 && (
            <p className="mt-2 text-[0.8125rem] text-[var(--to-muted)]">
              The simulation returned no prediction that maps to a claim. Nothing was added.
            </p>
          )}

          <p className="mt-3 text-[0.75rem] leading-relaxed text-[var(--to-muted)]">{state.note}</p>
        </div>
      )}
    </section>
  );
}
