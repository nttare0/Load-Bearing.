"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowUpRight, Database, History, Loader2 } from "lucide-react";
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
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <BeamMark />
            <span className="text-[15px] font-semibold tracking-tight">Load-Bearing</span>
          </div>
          <a
            href="#how"
            className="flex items-center gap-1 text-[12px] text-ink-faint transition-colors hover:text-ink"
          >
            How it works <ArrowUpRight className="h-3 w-3" />
          </a>
        </div>

        <div className="flex flex-col gap-3">
          <h1 className="max-w-2xl text-[28px] leading-[1.15] font-semibold tracking-tight sm:text-[36px]">
            Find the assumptions your plan quietly depends on.
          </h1>
          <p className="max-w-2xl text-[14.5px] leading-relaxed text-ink-soft">
            In a building, the load-bearing wall is the one holding up everything above it. Plans work the same way:
            a few claims carry most of the weight, and most of them are never written down. Paste a plan and this
            ranks those claims by how much collapses if they are wrong — then gives you the cheapest way to check.
          </p>
          <StatusLegend />
        </div>
      </header>

      <PlanInput onSubmit={run} busy={busy} />

      {history.length > 0 && !started && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-[13px]">
              <History className="h-3.5 w-3.5 text-ink-faint" /> Recent on this device
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {history.map((item) => (
              <button
                key={item.id}
                onClick={() => void loadHistory(item.id)}
                className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-ink/5 cursor-pointer"
              >
                <span className="truncate text-[13px] text-ink">{item.title}</span>
                <span className="shrink-0 text-[11px] text-ink-faint">
                  {item.claims} claims · {new Date(item.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </span>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      <div ref={resultsRef} />

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-[#b4451f]/30 bg-[#fbe8e0] px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#96391b]" />
          <div className="flex flex-col gap-1">
            <p className="text-[13px] font-medium text-[#7f2f14]">That run did not finish</p>
            <p className="text-[12.5px] leading-relaxed text-[#8f4a2c]">{error}</p>
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
          <section id="how" className="grid gap-3 sm:grid-cols-3">
            {[
              {
                title: "It quotes, it does not paraphrase",
                body: "Every claim carries either a verbatim line from your plan or the word “implied”. You can see exactly what you actually said.",
              },
              {
                title: "Ranked by what collapses",
                body: "Impact × uncertainty, on a fixed rubric. Two scoring runs, and disagreement is shown rather than smoothed over.",
              },
              {
                title: "Tested before it is built",
                body: "Each top claim gets the cheapest disproof, with the number that means proceed and the number that means stop.",
              },
            ].map((item) => (
              <Card key={item.title} className="bg-paper-raised/60">
                <CardHeader>
                  <CardTitle className="text-[13.5px]">{item.title}</CardTitle>
                  <CardDescription className="text-[12.5px]">{item.body}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </section>
        )
      )}

      <footer className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-rule pt-4 text-[11px] text-ink-faint">
        <span className="flex items-center gap-1.5">
          <Database className="h-3 w-3" />
          {storage === "supabase"
            ? "Storage connected — analyses you keep are saved, and you can delete them."
            : "Storage is local to your browser until a database is connected."}
        </span>
        <span>No accounts. No tracking. A fact label needs a URL.</span>
      </footer>
    </main>
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
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <rect x="2" y="2" width="18" height="18" rx="3" stroke="#191713" strokeWidth="1.4" />
      <path d="M2 14.5h18" stroke="#191713" strokeWidth="1.4" />
      <path d="M8 14.5V20M14 14.5V20" stroke="#b4451f" strokeWidth="1.6" />
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
        <CardContent className="flex flex-col gap-3 p-5">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-[#b4451f]" />
            <p className="text-[13px] font-medium">{detail || "Reading the plan…"}</p>
          </div>
          <ol className="flex flex-col gap-1.5">
            {STAGES.map((item, i) => {
              const done = currentIndex > i;
              const active = currentIndex === i;
              return (
                <li
                  key={item.key}
                  className={`flex items-center gap-2.5 text-[12.5px] ${
                    done ? "text-ink-faint" : active ? "text-ink" : "text-ink-faint/60"
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] ${
                      done
                        ? "border-[#4a6b57] bg-[#eaf0e9] text-[#33503f]"
                        : active
                          ? "border-[#b4451f] bg-[#fbe8e0] text-[#96391b]"
                          : "border-rule text-ink-faint"
                    }`}
                  >
                    {done ? "✓" : i + 1}
                  </span>
                  <span className="font-medium">{item.label}</span>
                  <span className="text-ink-faint">— {item.detail}</span>
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>

      {claims.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="px-1 text-[11px] text-ink-faint">
            Claims are arriving. Sorted once scoring finishes.
          </p>
          {claims.slice(0, 3).map((claim) => (
            <Card key={claim.id} className="animate-rise">
              <CardContent className="flex flex-col gap-2 p-4">
                <div className="flex items-center gap-2">
                  <Badge tone={claim.source === "implied" ? "structural" : "outline"}>
                    {claim.source === "implied" ? "implied" : "stated"}
                  </Badge>
                  <Badge tone="outline">{claim.category}</Badge>
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
