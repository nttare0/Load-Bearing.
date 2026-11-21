"use client";

import { useEffect, useRef, useState } from "react";
import { Brain, FileUp, Loader2, Paperclip, ShieldCheck, Sparkles } from "lucide-react";
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
 * **One box, one action.** There used to be an Ask/Agent toggle beside the send
 * button, which asked the person to classify their own message before the app
 * would route it. That is the app's job. `/api/intent` labels the message and the
 * caller dispatches — see `submit` below. The toggle is gone rather than
 * defaulted, because a control whose only correct setting is "whatever you were
 * about to type" is noise.
 *
 * The strip under the box is where this app differs. It names the workspace the
 * work lands in, how many reports are already there, and whether the run is live
 * or demo — state you can read without opening anything.
 */

/** The three levels the hold climbs through. Colour is only a hint; the id is
 *  what the pipeline actually receives. */
const EFFORTS: PromptEffort[] = [
  { id: "quick", label: "Quick" },
  { id: "think", label: "Think", color: "#F5A524" },
  { id: "deep", label: "Think deeply", color: "#F2552C" },
];

export function Composer({
  onSend,
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
  /**
   * Hand the message over. The page asks `/api/intent` and dispatches to the
   * pipeline or the research route; the composer does not care which.
   */
  onSend: (text: string, keep: boolean, effort?: string) => void | Promise<void>;
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
  const [uploading, setUploading] = useState(false);
  const [attached, setAttached] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const trimmed = text.trim();

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
          // No dispatch here: the page asks the classifier and routes. The
          // composer's job ends at handing over the text and the level.
          void onSend(prompt, keep, effort.id);
          setAttached(null);
        }}
        onStop={() => {
          // The run keeps going to the end: half an analysis would be a claim
          // list the app cannot stand behind. Stop only stops the composer's
          // own waiting, so say so rather than pretending the work halted.
          document.getElementById("composer-end")?.scrollIntoView({ behavior: "smooth" });
        }}
        efforts={EFFORTS}
        startingLevel={Math.max(0, EFFORTS.findIndex((item) => item.id === thinking))}
        placeholder={[
          "Paste a plan, or ask about the one you pasted…",
          "We will open three cafés in Kigali by June…",
          "Which claim would cost the most to be wrong?",
        ]}
        hint="Hold to think harder"
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

            {/* Not a control: a statement about what the app will do, which is
                the only thing the old toggle was ever really telling you. */}
            <span
              className="flex shrink-0 items-center gap-[0.3125rem] px-[0.25rem] text-[0.6875rem] text-ink-3"
              title="A plan gets analysed; a question gets answered from the reports in this chat."
            >
              <Sparkles className="size-3" aria-hidden />
              {trimmed.length === 0
                ? "plan or question"
                : trimmed.length > 0 && /\?\s*$/.test(trimmed)
                  ? "a question"
                  : "a plan"}
            </span>
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
