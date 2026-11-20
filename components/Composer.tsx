"use client";

import { useEffect, useRef, useState } from "react";
import { Brain, ChevronDown, FileUp, FlaskConical, Loader2, Paperclip, Search, ShieldCheck } from "lucide-react";
import { PromptBox, type PromptEffort } from "@/components/rare/prompt-box";
import { Button } from "@/components/ui/button";
import { THINKING, type Effort } from "@/lib/effort";

/**
 * The composer.
 *
 * Built on the reference prompt box: type a plan and tap send, or hold the
 * button to charge it — Quick, Think, Think deeply — and let go to send at that
 * level. The level is not decoration: it is sent with the plan and sets how hard
 * the model thinks, so holding longer buys more reasoning.
 *
 * The strip under the box is where this app differs. It names the workspace the
 * work lands in, how many reports are already there, and whether the run is live
 * or demo — state you can read without opening anything.
 */

export type ComposerMode = "analyze" | "ask";

/** The three levels the hold climbs through. Colour is only a hint; the id is
 *  what the pipeline actually receives. */
const EFFORTS: PromptEffort[] = [
  { id: "quick", label: "Quick" },
  { id: "think", label: "Think", color: "#F5A524" },
  { id: "deep", label: "Think deeply", color: "#F2552C" },
];

export function Composer({
  onAnalyze,
  onAsk,
  busy,
  aiMode,
  workspaceName,
  keep,
  onKeepChange,
  recent,
  stage,
  draft,
  thinking,
  onThinking,
}: {
  onAnalyze: (text: string, keep: boolean, effort?: string) => void;
  onAsk: (question: string) => void;
  busy: boolean;
  aiMode: "demo" | "live" | null;
  workspaceName: string;
  keep: boolean;
  onKeepChange: (value: boolean) => void;
  recent: { id: string; title: string }[];
  /** The pipeline stage currently running, when one is. */
  stage?: string | null;
  /** Text pushed in from outside, e.g. an example chip on the empty state. */
  draft?: string;
  /** The level a plain tap sends at — the same value the spine shows. */
  thinking: Effort;
  onThinking: (effort: Effort) => void;
}) {
  const [text, setText] = useState("");
  // An example arrives as a new string each time, so the same chip pressed twice
  // still refills the box after you have cleared it.
  useEffect(() => {
    if (draft) setText(draft);
  }, [draft]);
  const [override, setOverride] = useState<ComposerMode | null>(null);
  const [uploading, setUploading] = useState(false);
  const [attached, setAttached] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const trimmed = text.trim();
  // A short message that asks something is a question; anything else is a plan.
  const guessed: ComposerMode =
    trimmed.length < 400 &&
    (/\?\s*$/.test(trimmed) ||
      /^(what|why|how|which|should|is|are|can|could|do|does|who)\b/i.test(trimmed))
      ? "ask"
      : "analyze";
  const mode = override ?? guessed;

  const onFile = async (file: File) => {
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/extract", { method: "POST", body });
      const data = (await response.json()) as { text?: string };
      if (data.text) {
        setText((prev) => (prev ? `${prev}\n\n${data.text}` : data.text!));
        setAttached(file.name);
      }
    } catch {
      // The composer stays usable; the file just did not load.
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-[0.5rem]">
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.docx,.md,.txt,text/plain,application/pdf"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void onFile(file);
          event.target.value = "";
        }}
      />

      <PromptBox
        value={text}
        onValueChange={setText}
        status={busy ? "streaming" : "idle"}
        onSubmit={(prompt, effort) => {
          if (mode === "ask") onAsk(prompt);
          else onAnalyze(prompt, keep, effort.id);
          setAttached(null);
          setOverride(null);
        }}
        onStop={() => {
          // The run keeps going to the end: half an analysis would be a claim
          // list the app cannot stand behind. Stop only stops the composer's
          // own waiting, so say so rather than pretending the work halted.
          document.getElementById("composer-end")?.scrollIntoView({ behavior: "smooth" });
        }}
        efforts={EFFORTS}
        startingLevel={Math.max(0, EFFORTS.findIndex((item) => item.id === thinking))}
        placeholder={
          mode === "ask"
            ? ["Ask about this workspace…", "What did the last run get wrong?"]
            : [
                "Paste a plan, a decision, or an argument…",
                "We will open three cafés in Kigali by June…",
                "One rider, 40 orders a day, 12,000 RWF a meal…",
              ]
        }
        hint={mode === "ask" ? undefined : "Hold to think harder"}
        className="w-full rounded-[var(--to-radius)] border-[var(--to-border)] bg-[var(--to-surface)] text-foreground dark:text-foreground"
        actions={
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 shrink-0"
              onClick={() => fileRef.current?.click()}
              disabled={busy || uploading}
              aria-label="Attach a file"
            >
              {uploading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Paperclip className="size-3.5" />
              )}
            </Button>

            {attached && (
              <span className="lb-mono flex min-w-0 items-center gap-[0.25rem] truncate text-[0.6875rem] text-ink-3">
                <FileUp className="size-3 shrink-0" /> {attached}
              </span>
            )}

            {/* The mode is a control, not just a label: clicking it flips a
                question into a plan, or the other way round. */}
            <button
              type="button"
              onClick={() => setOverride(mode === "ask" ? "analyze" : "ask")}
              className="flex shrink-0 items-center gap-[0.3125rem] rounded-[var(--to-radius-sm)] px-[0.375rem] py-[0.25rem] text-[0.75rem] text-ink-2 hover:bg-[var(--to-surface-2)]"
            >
              {mode === "ask" ? <Search className="size-3.5" /> : <FlaskConical className="size-3.5" />}
              {mode === "ask" ? "Ask" : "Agent"}
              <ChevronDown className="size-3" />
            </button>
          </>
        }
      />

      {/* The strip under the box is attached to it, the way the reference
          attaches its repo and branch: state you can read without opening
          anything. Here it names where the work lands and what the run does. */}
      <div className="flex flex-wrap items-center gap-x-[0.5rem] gap-y-[0.25rem] px-[0.25rem] text-[0.75rem] text-ink-3">
        {/* Where the work lands. `New chat` until it is one, which is the same
            word the sidebar's action and the canvas heading use. */}
        <span className="flex min-w-0 items-center gap-[0.3125rem]">
          <span className="lb-mono shrink-0 text-[0.6875rem]">chat</span>
          <span className="max-w-[11rem] truncate text-ink-2">{workspaceName}</span>
        </span>

        <span aria-hidden className="text-[var(--to-border-strong)]">
          ·
        </span>

        <span className="lb-mono shrink-0 text-[0.6875rem]">
          {recent.length} report{recent.length === 1 ? "" : "s"}
        </span>

        {busy && stage && (
          <>
            <span aria-hidden className="text-[var(--to-border-strong)]">
              ·
            </span>
            <span
              className="lb-mono flex min-w-0 items-center gap-[0.25rem] text-[0.6875rem] text-ink-2"
              role="status"
            >
              <Loader2 className="size-3 shrink-0 animate-spin" aria-hidden />
              <span className="truncate">{stage}</span>
            </span>
          </>
        )}

        <span className="ml-auto flex items-center gap-[0.5rem]">
          <label className="flex cursor-pointer items-center gap-[0.3125rem] text-[0.75rem] text-ink-3">
            <input
              type="checkbox"
              checked={keep}
              onChange={(event) => onKeepChange(event.target.checked)}
              className="size-3 accent-[var(--to-accent)]"
            />
            Keep
          </label>
          {/* The level, right where it is spent. Tapping cycles it; the spine's
              dots show the same value, so the two can never disagree. */}
          <button
            type="button"
            onClick={() => {
              const at = EFFORTS.findIndex((item) => item.id === thinking);
              onThinking(EFFORTS[(at + 1) % EFFORTS.length].id as Effort);
            }}
            aria-label={`Thinking: ${THINKING[thinking].label}. Press to change.`}
            title={THINKING[thinking].detail}
            className="flex items-center gap-[0.25rem] rounded-[var(--to-radius-sm)] px-[0.25rem] py-[0.125rem] text-[0.75rem] text-ink-3 hover:bg-[var(--to-surface-2)] hover:text-foreground"
          >
            <Brain aria-hidden className="size-3" />
            {THINKING[thinking].label}
          </button>
          <span className="lb-mono flex items-center gap-[0.25rem] text-[0.6875rem]">
            <ShieldCheck aria-hidden className="size-3" />
            {aiMode === "live" ? "live" : aiMode === "demo" ? "demo" : "—"}
          </span>
        </span>
      </div>
      <div id="composer-end" />
    </div>
  );
}
