"use client";

import { useRef, useState } from "react";
import { FileUp, Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { EXAMPLES } from "@/lib/examples";

type Props = {
  onSubmit: (text: string, persist: boolean) => void;
  busy: boolean;
};

export function PlanInput({ onSubmit, busy }: Props) {
  const [text, setText] = useState("");
  const [persist, setPersist] = useState(false);
  const [url, setUrl] = useState("");
  const [showUrl, setShowUrl] = useState(false);
  const [fetching, setFetching] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const chars = text.trim().length;
  const ready = chars >= 40;

  const submit = () => {
    if (!ready || busy) return;
    onSubmit(text.trim(), persist);
  };

  const fetchUrl = async () => {
    if (!url.trim()) return;
    setFetching(true);
    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = (await response.json()) as { text?: string; error?: string };
      if (!response.ok || !data.text) {
        toast.error(data.error ?? "Could not read that page.");
        return;
      }
      setText((prev) => (prev ? `${prev}\n\n${data.text}` : data.text!));
      setShowUrl(false);
      setUrl("");
    } catch {
      toast.error("Could not reach that URL.");
    } finally {
      setFetching(false);
    }
  };

  const readFile = async (file: File) => {
    if (file.size > 400_000) {
      toast.error("That file is too large. Paste the relevant section.");
      return;
    }
    const name = file.name.toLowerCase();
    try {
      if (name.endsWith(".txt") || name.endsWith(".md")) {
        setText(await file.text());
        return;
      }
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/extract", { method: "POST", body: form });
      const data = (await response.json()) as { text?: string; error?: string };
      if (!response.ok || !data.text) {
        toast.error(data.error ?? "Could not read that document.");
        return;
      }
      setText(data.text);
    } catch {
      toast.error("Could not read that file.");
    }
  };

  return (
    <Card className="gap-0 overflow-hidden rounded-[var(--to-radius)] border-border bg-transparent py-0">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
        <label htmlFor="plan" className="lb-label text-[0.75rem]">
          The plan
        </label>
        <div className="flex items-center gap-1">
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.md,.pdf,.docx,text/plain,application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void readFile(file);
              e.target.value = "";
            }}
          />
          <Button variant="ghost" size="xs" onClick={() => fileRef.current?.click()} disabled={busy}>
            <FileUp /> Upload
          </Button>
          <Button variant="ghost" size="xs" onClick={() => setShowUrl((v) => !v)} disabled={busy}>
            <Link2 /> URL
          </Button>
        </div>
      </div>

      {showUrl && (
        <div className="flex gap-2 border-b border-border px-4 py-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://"
            className="h-8 text-[0.8125rem]"
            onKeyDown={(e) => {
              if (e.key === "Enter") void fetchUrl();
            }}
          />
          <Button variant="outline" size="xs" onClick={fetchUrl} disabled={fetching || !url.trim()}>
            {fetching ? <Loader2 className="animate-spin" /> : "Add"}
          </Button>
        </div>
      )}

      <Textarea
        id="plan"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
        }}
        placeholder="Paste the plan, idea, or argument you are about to commit to."
        className="min-h-[200px] rounded-none border-0 bg-transparent px-4 py-3 text-[0.9375rem] leading-[1.6] shadow-none focus-visible:ring-0"
        disabled={busy}
      />

      {/* The bar: examples on the left, action on the right. */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="lb-hint text-[0.75rem]">Try</span>
          {EXAMPLES.map((example) => (
            <button
              key={example.label}
              type="button"
              onClick={() => setText(example.text)}
              disabled={busy}
              className="h-7 rounded-[var(--to-radius-sm)] border border-border px-2 text-[0.75rem] text-ink-3 transition-colors hover:border-[var(--to-accent)] hover:text-foreground disabled:opacity-50"
            >
              {example.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label className="lb-hint flex cursor-pointer items-center gap-1.5 text-[0.75rem]">
            <input
              type="checkbox"
              checked={persist}
              onChange={(e) => setPersist(e.target.checked)}
              className="size-3.5 accent-[var(--to-accent)]"
              disabled={busy}
            />
            Keep
          </label>
          <Button size="sm" onClick={submit} disabled={!ready || busy}>
            {busy ? <Loader2 className="animate-spin" /> : null}
            {busy ? "Working" : "Find claims"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
