"use client";

import { useRef, useState } from "react";
import { ArrowUp, FileUp, Loader2, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * The composer.
 *
 * Two verbs, one box: paste a plan and it gets analysed; ask a question and the
 * assistant answers from the reports already in the workspace. The mode is
 * shown, not implied, because one of those actions creates claims and the other
 * only talks about them.
 */
export function Composer({
  onAnalyze,
  onAsk,
  busy,
  mode,
}: {
  onAnalyze: (text: string, keep: boolean) => void;
  onAsk: (question: string) => void;
  busy: boolean;
  mode: "demo" | "live" | null;
}) {
  const [text, setText] = useState("");
  const [keep, setKeep] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attached, setAttached] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // A question is short and ends in a question mark; a plan is a paragraph.
  // The heuristic is shown in the button, so it never acts silently.
  const trimmed = text.trim();
  const looksLikeQuestion = trimmed.length < 400 && (/\?\s*$/.test(trimmed) || /^(what|why|how|which|should|is|are|can|could|do|does|who)\b/i.test(trimmed));
  const action: "analyze" | "ask" = looksLikeQuestion ? "ask" : "analyze";

  const submit = () => {
    if (!trimmed || busy) return;
    if (action === "ask") {
      onAsk(trimmed);
    } else {
      onAnalyze(trimmed, keep);
    }
    setText("");
    setAttached(null);
  };

  const onFile = async (file: File) => {
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/extract", { method: "POST", body });
      const data = (await response.json()) as { text?: string; error?: string };
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
      <div
        className={cn(
          "flex flex-col rounded-[0.75rem] border border-[var(--to-border)] transition-colors focus-within:border-[var(--to-accent)]",
          "bg-transparent"
        )}
      >
        <label htmlFor="composer" className="sr-only">
          Paste a plan, or ask about the work in this workspace
        </label>
        <Textarea
          id="composer"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder="Paste a plan, or ask a question about this workspace…"
          rows={3}
          disabled={busy}
          className="min-h-[5.5rem] resize-none border-0 bg-transparent px-[0.875rem] pt-[0.75rem] text-[0.9375rem] leading-[1.55] shadow-none focus-visible:ring-0"
        />

        <div className="flex items-center justify-between gap-[0.5rem] px-[0.625rem] pb-[0.625rem]">
          <div className="flex min-w-0 items-center gap-[0.25rem]">
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
            <span className="lb-mono ml-[0.25rem] shrink-0 text-[0.6875rem] text-ink-3">
              {busy ? "working" : action === "ask" ? "answer from workspace" : "analyse plan"}
            </span>
          </div>

          <Button
            onClick={submit}
            disabled={!trimmed || busy}
            size="icon"
            className="size-8 shrink-0 rounded-[0.5rem]"
            aria-label={action === "ask" ? "Ask" : "Analyse this plan"}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-[0.5rem] text-[0.75rem] text-ink-3">
        <label className="flex cursor-pointer items-center gap-[0.375rem]">
          <input
            type="checkbox"
            checked={keep}
            onChange={(event) => setKeep(event.target.checked)}
            className="size-3 accent-[var(--to-accent)]"
          />
          Keep this analysis
        </label>
        <span className="lb-mono text-[0.6875rem]">
          {mode === "live" ? "live model" : mode === "demo" ? "demo — no key set" : ""}
        </span>
      </div>
    </div>
  );
}
