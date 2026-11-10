"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Database, History, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PlanInput } from "@/components/PlanInput";
import { Report, StatusLegend } from "@/components/Report";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Analysis, Claim, FailureMode, PipelineEvent, PipelineStage } from "@/lib/schema";

const STAGES: { key: PipelineStage; label: string; detail: string }[] = [
  { key: "extract", label: "Extract", detail: "Quoting the claims the plan states" },
  { key: "premortem", label: "Hidden assumptions", detail: "What must be true that nobody wrote down" },
  { key: "score", label: "Score", detail: "Impact × uncertainty, against a fixed rubric" },
  { key: "evidence", label: "Evidence", detail: "Checking checkable claims against sources" },
  { key: "tests", label: "Design tests", detail: "The cheapest way to kill the top claims" },
];

const LS_KEY = "load-bearing:last-analysis";
const LS_HISTORY = "load-bearing:history";

type StoredHistory = { id: string; title: string; createdAt: string; claims: number };

export default function Home() {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [failureModes, setFailureModes] = useState<FailureMode[]>([]);
  const [stage, setStage] = useState<PipelineStage | null>(null);
  const [detail, setDetail] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [persisted, setPersisted] = useState(false);
  const [storage, setStorage] = useState<"supabase" | "local">("local");
  const [history, setHistory] = useState<StoredHistory[]>([]);
  const [outcomes, setOutcomes] = useState<Record<string, "confirmed" | "broken" | "inconclusive">>({});
  const resultsRef = useRef<HTMLDivElement>(null);

  // Restore the last analysis, per the plan's localStorage-first approach.
  useEffect(() => {
    try {
      const last = localStorage.getItem(LS_KEY);
      if (last) {
        const parsed = JSON.parse(last) as { analysis: Analysis; persisted: boolean };
        setAnalysis(parsed.analysis);
        setClaims(parsed.analysis.claims);
        setFailureModes(parsed.analysis.failureModes);
        setPersisted(Boolean(parsed.persisted));
        setStage("tests");
      }
      const stored = localStorage.getItem(LS_HISTORY);
      if (stored) setHistory(JSON.parse(stored) as StoredHistory[]);
    } catch {
      // A corrupt cache is not worth a dialog.
    }

    fetch("/api/health")
      .then((r) => r.json())
      .then((data: { storage?: "supabase" | "local" }) => {
        if (data.storage) setStorage(data.storage);
      })
      .catch(() => undefined);
  }, []);

  const remember = useCallback((next: Analysis, saved: boolean) => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ analysis: next, persisted: saved }));
      const entry: StoredHistory = {
        id: next.id,
        title: next.title,
        createdAt: next.createdAt,
        claims: next.claims.length,
      };
      const list = [entry, ...readHistory().filter((h) => h.id !== next.id)].slice(0, 6);
      localStorage.setItem(LS_HISTORY, JSON.stringify(list));
      setHistory(list);
    } catch {
      // Quota or private mode: the report still works, it just will not persist.
    }
  }, []);

  const run = useCallback(
    async (text: string, keep: boolean) => {
      setBusy(true);
      setError(null);
      setAnalysis(null);
      setClaims([]);
      setFailureModes([]);
      setOutcomes({});
      setStage("extract");
      setDetail("Reading the plan and quoting the claims it states.");
      setPersisted(false);

      try {
        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, persist: keep }),
        });

        if (!response.ok) {
          const data = (await response.json().catch(() => ({}))) as { error?: string };
          setError(data.error ?? `The analysis failed (${response.status}).`);
          setBusy(false);
          return;
        }
        if (!response.body) {
          setError("The browser could not read the streamed response.");
          setBusy(false);
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const frames = buffer.split("\n\n");
          buffer = frames.pop() ?? "";

          for (const frame of frames) {
            const line = frame.split("\n").find((l) => l.startsWith("data: "));
            if (!line) continue;
            let event: PipelineEvent;
            try {
              event = JSON.parse(line.slice(6)) as PipelineEvent;
            } catch {
              continue;
            }
            handleEvent(event);
          }
        }
      } catch {
        setError("The connection dropped mid-analysis. Run it again — nothing was saved.");
      } finally {
        setBusy(false);
        requestAnimationFrame(() => {
          resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }

      function handleEvent(event: PipelineEvent) {
        switch (event.type) {
          case "stage":
            setStage(event.stage);
            setDetail(event.detail ?? "");
            break;
          case "claims":
            setClaims(event.claims);
            break;
          case "failureModes":
            setFailureModes(event.failureModes);
            break;
          case "evidence":
            setClaims((prev) =>
              prev.map((claim) => {
                const evidence = event.evidence.filter((e) => e.ref === claim.ref);
                return evidence.length ? { ...claim, evidence } : claim;
              })
            );
            break;
          case "tests":
            setClaims(event.claims);
            break;
          case "done":
            setAnalysis(event.analysis);
            setClaims(event.analysis.claims);
            setFailureModes(event.analysis.failureModes);
            setPersisted(event.persisted);
            setStage("tests");
            remember(event.analysis, event.persisted);
            if (event.analysis.claims.length) {
              toast.success(
                `${event.analysis.claims.length} claims found — ${event.analysis.claims[0].claim.slice(0, 44)}… leads the list`
              );
            }
            break;
          case "error":
            setError(event.message);
            break;
        }
      }
    },
    [remember]
  );

  const recordOutcome = useCallback(
    async (ref: string, outcome: "confirmed" | "broken" | "inconclusive") => {
      setOutcomes((prev) => ({ ...prev, [ref]: outcome }));

      if (!analysis || !persisted) {
        toast.success("Marked as tested on this device.");
        return;
      }
      try {
        const response = await fetch("/api/analysis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "outcome", id: analysis.id, ref, outcome }),
        });
        const data = (await response.json()) as { analysis?: Analysis; error?: string };
        if (data.analysis) {
          setAnalysis(data.analysis);
          setClaims(data.analysis.claims);
          toast.success("Outcome saved. The plan now knows what was tested.");
        } else {
          toast.error(data.error ?? "Could not save the outcome.");
        }
      } catch {
        toast.error("Could not reach storage. The mark is local only.");
      }
    },
    [analysis, persisted]
  );

  const remove = useCallback(async () => {
    if (!analysis) return;
    try {
      if (persisted) {
        await fetch(`/api/analysis?id=${encodeURIComponent(analysis.id)}`, { method: "DELETE" });
      }
    } catch {
      // Fall through: clearing locally is still the user's intent.
    }
    localStorage.removeItem(LS_KEY);
    setAnalysis(null);
    setClaims([]);
    setFailureModes([]);
    setOutcomes({});
    setStage(null);
    setPersisted(false);
    setHistory(readHistory().filter((h) => h.id !== analysis.id));
    toast.success("Deleted. Nothing about that plan is stored anywhere now.");
  }, [analysis, persisted]);

  const loadHistory = useCallback(async (id: string) => {
    try {
      const cached = localStorage.getItem(LS_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as { analysis: Analysis; persisted: boolean };
        if (parsed.analysis.id === id) {
          setAnalysis(parsed.analysis);
          setClaims(parsed.analysis.claims);
          setFailureModes(parsed.analysis.failureModes);
          setPersisted(Boolean(parsed.persisted));
          return;
        }
      }
      const response = await fetch(`/api/analysis?id=${encodeURIComponent(id)}`);
      const data = (await response.json()) as { analysis?: Analysis; error?: string };
      if (!data.analysis) {
        toast.error(data.error ?? "That analysis is not in storage.");
        return;
      }
      setAnalysis(data.analysis);
      setClaims(data.analysis.claims);
      setFailureModes(data.analysis.failureModes);
      setPersisted(true);
    } catch {
      toast.error("Could not load that analysis.");
    }
  }, []);

  const started = busy || claims.length > 0 || Boolean(analysis);

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Nav, not document: the wordmark in Plex Serif at the column's edge,
          one plain action at the other end, a hairline under it. */}
      <header className="to-header sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="to-column flex h-[var(--to-header-h)] items-center justify-between gap-[var(--to-gutter)]">
          <a href="/" className="lb-wordmark flex items-center gap-[0.5em] text-[1.375rem] text-foreground no-underline">
            <BeamMark />
            Load-Bearing
          </a>
          <div className="flex items-center gap-[0.375em]">
            <Button variant="ghost" size="sm" asChild>
              <a href="#how" className="no-underline">
                How it works
              </a>
            </Button>
          </div>
        </div>
      </header>

      <main className="to-column flex flex-1 flex-col gap-[1.5rem] py-[1.5rem]">
        <div className="flex flex-col gap-[0.75rem]">
          <h1 className="max-w-[42rem] text-[1.5rem] leading-[1.15] font-semibold tracking-[-0.02em] sm:text-[1.875rem]">
            Find the assumptions your plan depends on.
          </h1>
          <p className="max-w-[38rem] text-[0.9375rem] leading-[1.6] text-ink-2">
            A few claims carry a plan. Most of them are never written down, so nobody checks them until
            something collapses.
          </p>
          <StatusLegend />
        </div>

        <PlanInput onSubmit={run} busy={busy} />

        {history.length > 0 && !started && (
          <section className="flex flex-col gap-[0.5rem]">
            <h2 className="to-head3 flex items-center gap-[0.5em]">
              <History className="size-3.5" /> Recent
            </h2>
            <ul className="flex flex-col">
              {history.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => void loadHistory(item.id)}
                    className="flex w-full items-center justify-between gap-[1em] rounded-[var(--to-radius-sm)] px-[0.5em] py-[0.5em] text-left transition-colors hover:bg-[var(--to-accent-soft)]"
                  >
                    <span className="truncate text-[0.875rem] text-foreground">{item.title}</span>
                    <span className="lb-mono shrink-0 text-[0.75rem] text-ink-3">
                      {item.claims} · {new Date(item.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div ref={resultsRef} />

        {error && (
          <div
            role="alert"
            className="flex items-start gap-[0.5em] rounded-[var(--to-radius)] border border-[var(--lb-load)] bg-[var(--lb-load-soft)] px-[0.75em] py-[0.5em]"
          >
            <AlertTriangle className="mt-[0.15em] size-4 shrink-0 text-[var(--lb-load)]" />
            <div className="flex flex-col gap-[0.25em]">
              <p className="text-[0.875rem] font-semibold text-[var(--lb-load)]">That run did not finish</p>
              <p className="text-[0.875rem] leading-[1.5] text-ink-2">{error}</p>
            </div>
          </div>
        )}

        {busy && !analysis && <Progress stage={stage} detail={detail} claims={claims} />}

        {analysis ? (
          <Report
            analysis={analysis}
            persisted={persisted}
            onDelete={remove}
            onOutcome={recordOutcome}
            outcomes={outcomes}
          />
        ) : (
          !busy &&
          claims.length === 0 &&
          !error && (
            <section id="how" className="flex flex-col gap-[0.75rem] border-t border-border pt-[1.25rem]">
              <h2 className="to-head3">How it reads a plan</h2>
              <ol className="grid gap-[0.75rem] sm:grid-cols-3">
                {[
                  { title: "Quotes, never paraphrases", body: "Every claim carries a line from your plan, or the word implied." },
                  { title: "Ranked by what collapses", body: "Impact × uncertainty, on a fixed rubric, scored twice." },
                  { title: "Tested before it is built", body: "The cheapest disproof, with the number that means stop." },
                ].map((item, i) => (
                  <li key={item.title} className="lb-surface flex flex-col gap-[0.375rem] p-[0.875rem]">
                    <span className="lb-mono text-[0.6875rem] text-ink-3">0{i + 1}</span>
                    <span className="text-[0.875rem] font-semibold leading-[1.3]">{item.title}</span>
                    <span className="text-[0.875rem] leading-[1.5] text-ink-2">{item.body}</span>
                  </li>
                ))}
              </ol>
            </section>
          )
        )}

        <footer className="mt-auto flex flex-wrap items-center justify-between gap-[0.5em] border-t border-border pt-[0.75rem] text-[0.75rem] text-ink-3">
          <span className="flex items-center gap-[0.375em]">
            <Database className="size-3" />
            {storage === "supabase" ? "Saved reports available" : "Stored on this device only"}
          </span>
          <span>No accounts. No tracking.</span>
        </footer>
      </main>
    </div>
  );
}

function readHistory(): StoredHistory[] {
  try {
    return JSON.parse(localStorage.getItem(LS_HISTORY) ?? "[]") as StoredHistory[];
  } catch {
    return [];
  }
}

function BeamMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="1.5" y="1.5" width="17" height="17" rx="2.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M1.5 13h17" stroke="currentColor" strokeWidth="1.3" />
      <path d="M7 13v5.5M13 13v5.5" stroke="var(--lb-load)" strokeWidth="1.6" />
    </svg>
  );
}

function Progress({
  stage,
  detail,
  claims,
}: {
  stage: PipelineStage | null;
  detail: string;
  claims: Claim[];
}) {
  const currentIndex = stage ? STAGES.findIndex((s) => s.key === stage) : -1;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-load-bearing" />
            <p className="text-[0.875rem] font-medium">{detail || "Reading the plan…"}</p>
          </div>
          <ol className="flex flex-col gap-1.5">
            {STAGES.map((item, i) => {
              const done = currentIndex > i;
              const active = currentIndex === i;
              return (
                <li
                  key={item.key}
                  className={`flex items-center gap-2.5 text-[12.5px] ${
                    done ? "text-muted-foreground" : active ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] ${
                      done
                        ? "border-[var(--lb-light)] bg-[var(--lb-fact-soft)] text-[var(--lb-fact)]"
                        : active
                          ? "border-[var(--lb-load)] bg-[var(--lb-load-soft)] text-[var(--lb-load)]"
                          : "border-border text-muted-foreground"
                    }`}
                  >
                    {done ? "✓" : i + 1}
                  </span>
                  <span className="font-medium">{item.label}</span>
                  <span className="text-muted-foreground">— {item.detail}</span>
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>

      {claims.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="lb-hint text-[0.75rem]">Arriving. Sorted once scoring finishes.</p>
          {claims.slice(0, 3).map((claim) => (
            <Card key={claim.id} className="animate-rise gap-3 rounded-[var(--to-radius)] border-border py-4 shadow-[var(--to-shadow)]">
              <CardContent className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant={claim.source === "implied" ? "structural" : "outline"}>
                    {claim.source === "implied" ? "implied" : "stated"}
                  </Badge>
                  <Badge variant="outline">{claim.category}</Badge>
                </div>
                <p className="text-[13.5px] font-medium leading-snug">{claim.claim}</p>
                <Skeleton className="h-3 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
