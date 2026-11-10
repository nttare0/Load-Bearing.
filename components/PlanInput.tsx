"use client";

import { useRef, useState } from "react";
import { FileUp, Link2, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DEMO_PLAN_TEXT } from "@/lib/demo";

type Props = {
  onSubmit: (text: string, persist: boolean) => void;
  busy: boolean;
};

const EXAMPLES: { label: string; text: string }[] = [
  {
    label: "The budgeting app",
    text: DEMO_PLAN_TEXT,
  },
  {
    label: "A B2B pricing change",
    text: `We're moving our project-management tool from $12 per seat to $29 per workspace, unlimited seats.

Most of our customers have between 2 and 4 seats, so for them this is roughly a 40% price drop. The ones on 8+ seats get a much bigger bill, but those are only about 12% of accounts.

We think the smaller accounts will upgrade to the new plan immediately, and the big ones will grumble but stay because migrating a workspace is painful. Support will handle the complaints in a week or two. If this works, revenue per account should roughly double and we can stop worrying about seat expansion.`,
  },
  {
    label: "A research argument",
    text: `Remote work has permanently reduced demand for downtown commercial office space, and cities should convert it to housing.

Three years of occupancy data show downtown office vacancy above 18% in most large US cities, and tenants are renewing for less space than before. Companies have already invested in remote tooling and their employees do not want to return five days a week. Landlords will accept conversion because an empty building costs money.

Conversion is expensive but the buildings are structurally suitable, and cities can speed it up by loosening zoning. The main thing we would need is a tax incentive, which pays for itself through the new residents.`,
  },
];

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
      toast.success("Page text pulled in — trim it to the parts that matter.");
    } catch {
      toast.error("Could not reach that URL.");
    } finally {
      setFetching(false);
    }
  };

  const readFile = async (file: File) => {
    const MAX = 400_000;
    if (file.size > MAX) {
      toast.error("That file is too large. Paste the relevant section instead.");
      return;
    }
    const name = file.name.toLowerCase();
    try {
      if (name.endsWith(".txt") || name.endsWith(".md")) {
        setText(await file.text());
        return;
      }
      // For PDF/DOCX the server does the extraction.
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/extract", { method: "POST", body: form });
      const data = (await response.json()) as { text?: string; error?: string };
      if (!response.ok || !data.text) {
        toast.error(data.error ?? "Could not read that document.");
        return;
      }
      setText(data.text);
      toast.success("Document extracted. Check it before running.");
    } catch {
      toast.error("Could not read that file.");
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="plan" className="text-[12px] font-medium uppercase tracking-[0.12em] text-ink-faint">
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
            <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()} disabled={busy}>
              <FileUp className="h-3.5 w-3.5" /> Upload
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowUrl((v) => !v)} disabled={busy}>
              <Link2 className="h-3.5 w-3.5" /> From URL
            </Button>
          </div>
        </div>

        {showUrl && (
          <div className="flex gap-2">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/our-plan"
              onKeyDown={(e) => {
                if (e.key === "Enter") void fetchUrl();
              }}
            />
            <Button variant="outline" onClick={fetchUrl} disabled={fetching || !url.trim()}>
              {fetching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Pull"}
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
          placeholder="Paste the plan, idea, design decision, or argument you are about to commit to. Three rough paragraphs is plenty — the more specific the numbers, the more it has to work with."
          className="min-h-[220px] text-[15px]"
          disabled={busy}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-ink-faint">Try:</span>
            {EXAMPLES.map((example) => (
              <button
                key={example.label}
                type="button"
                onClick={() => setText(example.text)}
                disabled={busy}
                className="rounded-full border border-rule bg-paper px-2.5 py-1 text-[11.5px] text-ink-soft transition-colors hover:border-ink/25 hover:text-ink cursor-pointer disabled:opacity-50"
              >
                {example.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-[11.5px] text-ink-soft">
              <input
                type="checkbox"
                checked={persist}
                onChange={(e) => setPersist(e.target.checked)}
                className="h-3.5 w-3.5 accent-[#b4451f]"
                disabled={busy}
              />
              Keep this analysis
            </label>
            <span className={chars > 0 && !ready ? "text-[11px] text-[#96391b]" : "text-[11px] text-ink-faint"}>
              {chars.toLocaleString()} chars
            </span>
            <Button onClick={submit} disabled={!ready || busy} size="md">
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Working
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> Find the load-bearing claims
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-rule pt-3 text-[11px] text-ink-faint">
          <Badge tone="outline">⌘/Ctrl + Enter</Badge>
          <span>Your plan is sent to the AI provider to be read. It is not stored unless you tick “Keep this analysis”.</span>
        </div>
      </div>
    </Card>
  );
}
