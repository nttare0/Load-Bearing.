"use client";

import { useRef, useState } from "react";
import { ArrowUp, ChevronDown, FileUp, FlaskConical, Loader2, Paperclip, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/**
 * The composer.
 *
 * Follows the reference's anatomy: a quiet box with a few controls along its
 * bottom edge, the send arrow at the right of that row, and one line of context
 * underneath in its own bordered strip. The context strip is where this app
 * differs — it names the workspace being worked in, because everything else
 * here depends on which plan you are looking at.
 */

export type ComposerMode = "analyze" | "ask";

export function Composer({
  onAnalyze,
  onAsk,
  busy,
  aiMode,
  workspaceName,
  keep,
  onKeepChange,
  recent,
}: {
  onAnalyze: (text: string, keep: boolean) => void;
  onAsk: (question: string) => void;
  busy: boolean;
  aiMode: "demo" | "live" | null;
  workspaceName: string;
  keep: boolean;
  onKeepChange: (value: boolean) => void;
  recent: { id: string; title: string }[];
}) {
  const [text, setText] = useState("");
  const [override, setOverride] = useState<ComposerMode | null>(null);
  const [uploading, setUploading] = useState(false);
  const [attached, setAttached] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const trimmed = text.trim();
  // A short message that asks something is a question; anything else is a plan.
  const guessed: ComposerMode =
    trimmed.length < 400 &&
    (/\?\s*$/.test(trimmed) || /^(what|why|how|which|should|is|are|can|could|do|does|who)\b/i.test(trimmed))
      ? "ask"
      : "analyze";
  const mode = override ?? guessed;

  const submit = () => {
    if (!trimmed || busy) return;
    if (mode === "ask") onAsk(trimmed);
    else onAnalyze(trimmed, keep);
    setText("");
    setAttached(null);
    setOverride(null);
  };

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
      <div className="flex flex-col rounded-[0.75rem] border border-[var(--to-border)] bg-[var(--to-surface)] shadow-[0_1px_2px_rgba(16,18,25,0.04)] transition-colors focus-within:border-[var(--to-border-strong)]">
        <label htmlFor="composer" className="sr-only">
          Paste a plan, or ask about the work in this workspace
        </label>
        <Textarea
          id="composer"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={mode === "ask" ? "Ask about this workspace…" : "Paste a plan, a decision, or an argument…"}
          rows={2}
          disabled={busy}
          className="min-h-[4.25rem] resize-none border-0 bg-transparent px-[0.875rem] pt-[0.75rem] text-[0.9375rem] leading-[1.55] shadow-none focus-visible:ring-0"
        />

        <div className="flex items-center justify-between gap-[0.5rem] px-[0.5rem] pb-[0.5rem]">
          <div className="flex min-w-0 items-center gap-[0.125rem]">
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
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => fileRef.current?.click()}
              disabled={busy || uploading}
              aria-label="Attach a file"
            >
              {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Paperclip className="size-3.5" />}
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
              className="ml-[0.25rem] flex items-center gap-[0.375rem] rounded-[var(--to-radius-sm)] px-[0.375rem] py-[0.25rem] text-[0.8125rem] text-ink-2 hover:bg-[var(--to-surface-2)]"
            >
              {mode === "ask" ? <Search className="size-3.5" /> : <FlaskConical className="size-3.5" />}
              {mode === "ask" ? "Ask" : "Agent"}
              <ChevronDown className="size-3" />
            </button>
          </div>

          <Button
            onClick={submit}
            disabled={!trimmed || busy}
            size="icon"
            className="size-8 shrink-0 rounded-[0.5rem]"
            aria-label={mode === "ask" ? "Ask" : "Analyse this plan"}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
          </Button>
        </div>
      </div>

      {/* Context strip: which workspace, and what will happen to it. */}
      <div className="flex flex-wrap items-center justify-between gap-x-[0.5rem] gap-y-[0.25rem] rounded-[0.625rem] border border-[var(--to-border)] px-[0.5rem] py-[0.375rem]">
        <div className="flex min-w-0 items-center gap-[0.5rem]">
          <span className="flex min-w-0 items-center gap-[0.375rem] rounded-[var(--to-radius-sm)] px-[0.25rem] text-[0.75rem] text-ink-2">
            <span className="lb-mono shrink-0 text-ink-3">ws</span>
            <span className="truncate">{workspaceName}</span>
          </span>
          {recent.length > 0 && (
            <span className="lb-mono hidden truncate text-[0.6875rem] text-ink-3 sm:block">
              {recent.length} report{recent.length === 1 ? "" : "s"}
            </span>
          )}
        </div>

        <div className="flex items-center gap-[0.5rem]">
          <label className="flex cursor-pointer items-center gap-[0.375rem] text-[0.75rem] text-ink-3">
            <input
              type="checkbox"
              checked={keep}
              onChange={(event) => onKeepChange(event.target.checked)}
              className="size-3 accent-[var(--to-accent)]"
            />
            Keep
          </label>
          <span className="lb-mono text-[0.6875rem] text-ink-3">
            {aiMode === "live" ? "live" : aiMode === "demo" ? "demo" : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
