"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PanelLeft } from "lucide-react";
import { toast } from "sonner";
import { Composer } from "@/components/Composer";
import { assignKeys } from "@/lib/diff";
import { planForRun, previousRun, readPlans, recordRun, writePlans, type Plan } from "@/lib/plans";
import { ThreadWorkspace } from "@/components/ThreadWorkspace";
import { WorkspacePanel } from "@/components/WorkspacePanel";
import { Button } from "@/components/ui/button";
import { BeamToggle } from "@/components/BeamToggle";
import type { Analysis } from "@/lib/schema";
import {
  createWorkspace,
  nameFromPlan,
  newId,
  readCurrentId,
  readWorkspaces,
  writeCurrentId,
  writeWorkspaces,
  type Message,
  type Workspace,
} from "@/lib/workspace";

const LS_ANALYSES = "load-bearing:analyses";

/** The reports a workspace has produced, in the order they were produced. */
function reportsOf(workspace: Workspace, analyses: Record<string, Analysis>): Analysis[] {
  return workspace.messages
    .map((m) => (m.analysisId ? analyses[m.analysisId] : undefined))
    .filter((a): a is Analysis => Boolean(a));
}
const LS_PANEL = "load-bearing:panel-open";

/**
 * The application shell: workspaces on the left, one thread in the middle.
 *
 * What used to be a single report page is now the first turn of a thread. The
 * plan you paste, the report it produced, and the questions you asked about it
 * all stay in one place, per workspace — so "the work" is a thing you return to
 * rather than a result you navigate away from.
 */
export default function Home() {
  // Seeded optimistically so the rail always has a workspace in it. The values
  // are replaced from storage in the effect below; ids are stable enough for
  // that to be a no-op when hydration agrees.
  const [workspaces, setWorkspaces] = useState<Workspace[]>(() => [createWorkspace("First workspace")]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [analyses, setAnalyses] = useState<Record<string, Analysis>>({});
  const [plans, setPlans] = useState<Plan[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [keep, setKeep] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"demo" | "live" | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // ---- load once, from the browser ----
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_ANALYSES);
      if (stored) setAnalyses(JSON.parse(stored) as Record<string, Analysis>);
      setPanelOpen(localStorage.getItem(LS_PANEL) === "1");
      setPlans(readPlans());
    } catch {
      // A corrupt cache is not worth a dialog.
    }

    let list = readWorkspaces();
    if (list.length === 0) {
      const first = createWorkspace("First workspace");
      list = [first];
      writeWorkspaces(list);
      writeCurrentId(first.id);
    }
    setWorkspaces(list);
    const saved = readCurrentId();
    setCurrentId(saved && list.some((w) => w.id === saved) ? saved : list[0].id);
    setHydrated(true);

    fetch("/api/health")
      .then((r) => r.json())
      .then((data: { ai?: "configured" | "demo" }) => setMode(data.ai === "configured" ? "live" : "demo"))
      .catch(() => setMode(null));
  }, []);

  // Fall back to the first workspace so the first frame is the real canvas
  // rather than "Loading", which then swaps out under the user.
  const current = useMemo(
    () => workspaces.find((w) => w.id === currentId) ?? workspaces[0] ?? null,
    [workspaces, currentId]
  );

  const persist = useCallback((next: Workspace[]) => {
    setWorkspaces(next);
    writeWorkspaces(next);
  }, []);

  const update = useCallback(
    (id: string, change: (workspace: Workspace) => Workspace) => {
      setWorkspaces((prev) => {
        const next = prev.map((w) => (w.id === id ? { ...change(w), updatedAt: new Date().toISOString() } : w));
        writeWorkspaces(next);
        return next;
      });
    },
    []
  );

  const saveAnalyses = useCallback((next: Record<string, Analysis>) => {
    setAnalyses(next);
    try {
      // Keep the ten most recent reports; anything older is still in Supabase
      // if the user kept it.
      const entries = Object.entries(next).sort(
        (a, b) => Date.parse(b[1].createdAt) - Date.parse(a[1].createdAt)
      );
      localStorage.setItem(LS_ANALYSES, JSON.stringify(Object.fromEntries(entries.slice(0, 10))));
    } catch {
      // Quota: the thread still works for this session.
    }
  }, []);

  const append = useCallback(
    (message: Message) => {
      if (!currentId) return;
      update(currentId, (w) => ({ ...w, messages: [...w.messages, message] }));
    },
    [currentId, update]
  );

  useEffect(() => {
    if (!hydrated) return;
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [hydrated, current?.messages.length, busy]);

  // ---- analyse a plan: the pipeline, streamed into a report turn ----
  const analyze = useCallback(
    async (text: string, keep: boolean, options?: { planId?: string; quiet?: boolean }) => {
      if (!current) return;
      setBusy(true);
      // A re-run is the same plan again, so it does not repeat the plan text in
      // the thread: the report it produces carries the diff instead.
      if (!options?.quiet) {
        append({ id: newId(), role: "user", text, at: new Date().toISOString() });
      }

      try {
        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, persist: keep }),
        });

        if (!response.ok || !response.body) {
          const data = (await response.json().catch(() => ({}))) as { error?: string };
          append({
            id: newId(),
            role: "assistant",
            kind: "error",
            text: data.error ?? `The analysis failed (${response.status}).`,
            at: new Date().toISOString(),
          });
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let done: Analysis | null = null;

        while (true) {
          const { value, done: finished } = await reader.read();
          if (finished) break;
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split("\n\n");
          buffer = frames.pop() ?? "";
          for (const frame of frames) {
            const line = frame.split("\n").find((l) => l.startsWith("data: "));
            if (!line) continue;
            try {
              const event = JSON.parse(line.slice(6)) as
                | { type: "done"; analysis: Analysis }
                | { type: "error"; message: string };
              if (event.type === "done") done = event.analysis;
              if (event.type === "error") {
                append({ id: newId(), role: "assistant", kind: "error", text: event.message, at: new Date().toISOString() });
              }
            } catch {
              // A partial frame: the next read completes it.
            }
          }
        }

        if (done) {
          // Give the claims stable keys, and inherit any test result from the
          // previous run of the same plan. Re-running must never throw away
          // work the user already did.
          const plan = options?.planId
            ? plans.find((p) => p.id === options.planId)
            : plans.find((p) => p.text.trim() === text.trim());
          const lastRunId = plan?.runs[plan.runs.length - 1]?.analysisId;
          const prior = lastRunId ? analyses[lastRunId] : undefined;

          const analysis: Analysis = {
            ...done,
            planId: plan?.id,
            run: (plan?.runs.length ?? 0) + 1,
            claims: assignKeys(done.claims, prior),
          };

          const recorded = recordRun(plans, analysis, text);
          setPlans(recorded.plans);
          writePlans(recorded.plans);

          saveAnalyses({ ...analyses, [analysis.id]: analysis });
          update(current.id, (w) => ({
            ...w,
            name: w.name === "First workspace" || w.name === "Untitled workspace" ? nameFromPlan(text) : w.name,
            plans: [
              ...w.plans.filter((p) => p.id !== analysis.id),
              { id: analysis.id, text, at: analysis.createdAt, title: analysis.title },
            ],
            messages: [
              ...w.messages,
              {
                id: newId(),
                role: "assistant",
                kind: "report",
                text: analysis.title,
                analysisId: analysis.id,
                at: new Date().toISOString(),
              },
            ],
          }));
        }
      } catch {
        append({
          id: newId(),
          role: "assistant",
          kind: "error",
          text: "The connection dropped mid-analysis. Nothing was saved.",
          at: new Date().toISOString(),
        });
      } finally {
        setBusy(false);
      }
    },
    [analyses, append, current, plans, saveAnalyses, update]
  );

  // ---- ask about the work: read-only, answered from the workspace ----
  const ask = useCallback(
    async (question: string) => {
      if (!current) return;
      setBusy(true);
      append({ id: newId(), role: "user", text: question, at: new Date().toISOString() });

      // Everything this workspace has produced goes in as context, so the
      // answer can be checked against the report rather than trusted.
      const reports = reportsOf(current, analyses);

      try {
        const response = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question,
            history: current.messages
              .filter((m) => m.kind === "answer" || m.role === "user")
              .slice(-8)
              .map((m) => ({ role: m.role, content: m.text })),
            context: reports.length
              ? {
                  title: reports[reports.length - 1].title,
                  summary: reports[reports.length - 1].summary,
                  claims: reports.flatMap((a) =>
                    a.claims.map((c) => ({
                      ref: c.ref,
                      claim: c.claim,
                      status: c.status,
                      impact: c.impact,
                      confidence: c.confidence,
                      priority: c.priority,
                      category: c.category,
                      source: c.source,
                      reasoning: c.reasoning,
                      outcome: c.outcome?.result,
                      testStop: c.test?.breaks,
                    }))
                  ),
                  notes: reports.flatMap((a) => a.notes),
                }
              : undefined,
          }),
        });

        const data = (await response.json()) as { answer?: string; error?: string; mode?: string };
        const tested = reports.reduce((n, a) => n + a.claims.filter((c) => c.outcome).length, 0);
        const claims = reports.reduce((n, a) => n + a.claims.length, 0);

        append({
          id: newId(),
          role: "assistant",
          kind: data.answer ? "answer" : "error",
          text: data.answer ?? data.error ?? "Research failed.",
          at: new Date().toISOString(),
          lookedAt: reports.length ? { analyses: reports.length, claims, tested } : undefined,
        });
      } catch {
        append({
          id: newId(),
          role: "assistant",
          kind: "error",
          text: "Could not reach the server. Your reports are untouched.",
          at: new Date().toISOString(),
        });
      } finally {
        setBusy(false);
      }
    },
    [analyses, append, current]
  );

  /** Run a plan again from its latest text, without re-pasting it. */
  const rerun = useCallback(
    (planId: string) => {
      const plan = plans.find((p) => p.id === planId);
      if (!plan || busy) return;
      void analyze(plan.text, true, { planId: plan.id, quiet: true });
    },
    [analyze, busy, plans]
  );

  const recordOutcome = useCallback(
    async (analysisId: string, ref: string, outcome: "confirmed" | "broken" | "inconclusive") => {
      const analysis = analyses[analysisId];
      if (!analysis) return;

      const stamp = new Date().toISOString();
      const next: Analysis = {
        ...analysis,
        updatedAt: stamp,
        claims: analysis.claims.map((c) =>
          c.ref === ref
            ? {
                ...c,
                status: outcome === "confirmed" ? "fact" : outcome === "broken" ? "contradicted" : c.status,
                outcome: { result: outcome, at: stamp },
              }
            : c
        ),
      };
      saveAnalyses({ ...analyses, [next.id]: next });

      // Storage is the only thing that makes the result visible to whoever
      // holds the shared link, so try it and say plainly if it did not land.
      try {
        const response = await fetch("/api/analysis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "outcome", id: analysis.id, ref, outcome }),
        });
        const data = (await response.json()) as { analysis?: Analysis };
        if (data.analysis) saveAnalyses({ ...analyses, [next.id]: next, [data.analysis.id]: data.analysis });
        else toast.message("Kept here. Storage did not take it, so the shared link will not show it.");
      } catch {
        toast.message("Kept here. Storage is unreachable, so the shared link will not show it.");
      }
    },
    [analyses, saveAnalyses]
  );

  const deleteReport = useCallback(
    (analysisId: string) => {
      const next = { ...analyses };
      delete next[analysisId];
      saveAnalyses(next);
      if (currentId) {
        update(currentId, (w) => ({
          ...w,
          messages: w.messages.filter((m) => m.analysisId !== analysisId),
          plans: w.plans.filter((p) => p.id !== analysisId),
        }));
      }
      // Ask storage to drop it too; a 404 just means it was never stored.
      void fetch(`/api/analysis?id=${encodeURIComponent(analysisId)}`, { method: "DELETE" }).catch(() => undefined);
      toast.success("Report removed from this workspace.");
    },
    [analyses, currentId, saveAnalyses, update]
  );

  const select = useCallback((id: string) => {
    setCurrentId(id);
    writeCurrentId(id);
    // The panel is a drawer: picking a workspace closes it.
    setPanelOpen(false);
  }, []);

  const create = useCallback(() => {
    const workspace = createWorkspace();
    persist([...workspaces, workspace]);
    select(workspace.id);
  }, [persist, select, workspaces]);

  const remove = useCallback(
    (id: string) => {
      const next = workspaces.filter((w) => w.id !== id);
      const list = next.length ? next : [createWorkspace("First workspace")];
      persist(list);
      if (id === currentId) select(list[0].id);
    },
    [currentId, persist, select, workspaces]
  );

  const prevOf = useCallback(
    (analysisId: string) => previousRun(planForRun(plans, analysisId), analyses, analysisId),
    [analyses, plans]
  );

  const planOf = useCallback(
    (analysisId: string) => planForRun(plans, analysisId)?.id,
    [plans]
  );

  const togglePanel = useCallback(() => {
    setPanelOpen((prev) => {
      try {
        localStorage.setItem(LS_PANEL, prev ? "0" : "1");
      } catch {
        // Not worth reporting.
      }
      return !prev;
    });
  }, []);

  // Escape closes the panel, as it would a drawer anywhere else.
  useEffect(() => {
    if (!panelOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPanelOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panelOpen]);

  return (
    <div className="relative flex min-h-dvh flex-col">
      <WorkspacePanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        workspaces={workspaces}
        currentId={currentId}
        analyses={analyses}
        onSelect={select}
        onCreate={create}
        onDelete={remove}
      />

      {/* No header bar: the reference keeps the canvas clean and puts the one
          control it needs in the top-left corner. */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-30 flex items-center justify-between px-[0.75rem] py-[0.625rem]">
        <Button
          variant="ghost"
          size="icon"
          className="pointer-events-auto size-8 text-ink-3 hover:text-foreground"
          onClick={togglePanel}
          aria-label={panelOpen ? "Close workspaces" : "Open workspaces"}
          aria-expanded={panelOpen}
        >
          <PanelLeft className="size-4" />
        </Button>
        <BeamToggle />
      </div>

      <main className="mx-auto flex w-full max-w-[46rem] flex-1 flex-col px-[1rem] pt-[3.75rem] pb-[1.5rem]">
        <ThreadWorkspace
          workspace={current}
          analyses={analyses}
          prevOf={prevOf}
          planOf={planOf}
          onOutcome={recordOutcome}
          onDeleteReport={deleteReport}
          onRerun={rerun}
          busy={busy}
          composer={
            <Composer
              onAnalyze={analyze}
              onAsk={ask}
              busy={busy}
              aiMode={mode}
              workspaceName={current?.name ?? "Workspace"}
              keep={keep}
              onKeepChange={setKeep}
              recent={current ? reportsOf(current, analyses).map((a) => ({ id: a.id, title: a.title })) : []}
            />
          }
        />
        <div ref={endRef} />
      </main>
    </div>
  );
}

function BeamMark() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className="size-[1em] shrink-0">
      <path d="M3 17 10 3l7 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M6.2 11h7.6M10 3v14" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
