"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TopBar } from "@/components/TopBar";

import { resourceFromAnalysis } from "@/lib/resources";

import { toast } from "sonner";
import { Composer } from "@/components/Composer";
import { assignKeys } from "@/lib/diff";
import type { ReasonStep } from "@/lib/reasoning";
import { planForRun, previousRun, readPlans, recordRun, writePlans, type Plan } from "@/lib/plans";
import { ThreadWorkspace } from "@/components/ThreadWorkspace";
import { NavRail } from "@/components/NavRail";
import { Panel } from "@/components/rail/panels";
import { WorkspaceRail } from "@/components/rail/WorkspaceRail";
import { DEFAULT_EFFORT, type Effort } from "@/lib/effort";
import {
  EMPTY_SETTINGS,
  llmHeaders,
  readSettings,
  writeSettings,
  type LlmSettings,
} from "@/lib/byok";
import { BeamToggle } from "@/components/BeamToggle";
import { bandLabel } from "@/lib/score";
import type { Analysis } from "@/lib/schema";
import {
  createWorkspace,
  nameFromPlan,
  NEW_CHAT_TITLE,
  newChatTarget,
  titleOf,
  newId,
  readCurrentId,
  readWorkspaces,
  writeCurrentId,
  writeWorkspaces,
  type Message,
  type Workspace,
} from "@/lib/workspace";

const LS_ANALYSES = "load-bearing:analyses";

/** The pipeline's stage ids, said in the words a reader would use. */
const STAGE_LABEL: Record<string, string> = {
  extract: "reading the plan",
  premortem: "looking for what nobody wrote down",
  score: "scoring on impact × uncertainty",
  evidence: "checking what can be checked",
  tests: "designing the cheapest tests",
};

/** The reports a workspace has produced, in the order they were produced. */
function reportsOf(workspace: Workspace, analyses: Record<string, Analysis>): Analysis[] {
  return workspace.messages
    .map((m) => (m.analysisId ? analyses[m.analysisId] : undefined))
    .filter((a): a is Analysis => Boolean(a));
}
const LS_PANEL = "load-bearing:panel-open";
const LS_RAIL = "load-bearing:rail-open";
const LS_THINKING = "load-bearing:thinking";

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
  const [workspaces, setWorkspaces] = useState<Workspace[]>(() => [createWorkspace()]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [analyses, setAnalyses] = useState<Record<string, Analysis>>({});
  const [plans, setPlans] = useState<Plan[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [keep, setKeep] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"demo" | "live" | null>(null);
  // What the server is actually wired to, for the connectors card. Named from
  // the health response, never guessed: an absent provider reads as absent.
  const [tools, setTools] = useState<{ model: string | null; storage: string | null }>({
    model: null,
    storage: null,
  });
  /** The simulation skill, as reported by the server. Off unless it says otherwise. */
  const [mirofish, setMirofish] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  /**
   * Two panels, independent of each other:
   *
   *   left  — the chat list
   *   right — files and activity, then connectors, with settings over them
   *
   * They used to be one `face` value shared by both sides, which meant opening
   * files closed the chat list and vice versa — a menu pretending to be a
   * layout. There is only one panel left, so there is only one state to keep.
   */
  const [leftOpen, setLeftOpen] = useState(true);
  const [thinking, setThinking] = useState<Effort>(DEFAULT_EFFORT);
  /** The visitor's own model key, if they brought one. */
  const [llm, setLlm] = useState<LlmSettings>(EMPTY_SETTINGS);

  const [stage, setStage] = useState<string | null>(null);
  /**
   * The steps arriving from the run in progress.
   *
   * This is the only place the reasoning exists while it is happening. When the
   * run finishes the steps move onto the message, so a report reread tomorrow
   * still has its thinking behind it, and the live copy is cleared so two runs
   * cannot show each other's steps.
   */
  const [reasoning, setReasoning] = useState<ReasonStep[]>([]);
  /**
   * The same steps, readable synchronously.
   *
   * The run's last act is to append the report message inside a state updater,
   * and by then `reasoning` in this closure is the value from the render that
   * started the run — empty. The message would then be saved with no thinking
   * behind it, which is exactly the thing the panel is for. The ref is written
   * alongside the state so the message gets the steps that actually arrived.
   */
  const reasoningRef = useRef<ReasonStep[]>([]);
  /** A plan the page puts in the composer — from an example chip. */
  const [draftPlan, setDraftPlan] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  // ---- load once, from the browser ----
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_ANALYSES);
      if (stored) setAnalyses(JSON.parse(stored) as Record<string, Analysis>);
      setPanelOpen(localStorage.getItem(LS_PANEL) === "1");
      setLeftOpen(localStorage.getItem(LS_RAIL) !== "0");
      setLlm(readSettings());
      const savedThinking = localStorage.getItem(LS_THINKING);
      if (savedThinking === "quick" || savedThinking === "think" || savedThinking === "deep") {
        setThinking(savedThinking);
      }
      setPlans(readPlans());
    } catch {
      // A corrupt cache is not worth a dialog.
    }

    let list = readWorkspaces();
    if (list.length === 0) {
      const first = createWorkspace();
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
      .then((data: {
        ai?: "configured" | "demo";
        provider?: string;
        storage?: string;
        skills?: { mirofish?: boolean };
      }) => {
        setMode(data.ai === "configured" ? "live" : "demo");
        setTools({ model: data.provider ?? null, storage: data.storage ?? null });
        setMirofish(data.skills?.mirofish === true);
      })
      .catch(() => setMode(null));
  }, []);

  // Fall back to the first workspace so the first frame is the real canvas
  // rather than "Loading", which then swaps out under the user.
  const current = useMemo(
    () => workspaces.find((w) => w.id === currentId) ?? workspaces[0] ?? null,
    [workspaces, currentId]
  );

  const saveLlm = useCallback((next: LlmSettings) => {
    setLlm(next);
    writeSettings(next);
    // The card and the health line both read `tools`, so re-ask with the new
    // credential rather than leaving the old model name on screen.
    fetch("/api/settings", { headers: llmHeaders(next) })
      .then((r) => r.json())
      .then((data: { provider?: string | null; ai?: string }) => {
        setTools((prev) => ({ ...prev, model: data.provider ?? prev.model }));
        if (data.ai) setMode(data.ai === "configured" ? "live" : "demo");
      })
      .catch(() => undefined);
  }, []);

  /** Every model call carries the visitor's key when there is one. */
  const modelHeaders = useMemo(() => llmHeaders(llm), [llm]);

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
    async (
      text: string,
      keep: boolean,
      options?: { planId?: string; quiet?: boolean; effort?: string }
    ) => {
      if (!current) return;
      setBusy(true);
      // A re-run is the same plan again, so it does not repeat the plan text in
      // the thread: the report it produces carries the diff instead.
      if (!options?.quiet) {
        append({ id: newId(), role: "user", text, at: new Date().toISOString() });
      }
      reasoningRef.current = [];
      setReasoning([]);

      try {
        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...modelHeaders },
          body: JSON.stringify({ text, persist: keep, ...(options?.effort ? { effort: options.effort } : {}) }),
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
        let donePasses: { stage: string; ms: number }[] | undefined;

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
                | { type: "done"; analysis: Analysis; passes?: { stage: string; ms: number }[] }
                | { type: "stage"; stage: string; detail?: string }
                | { type: "reason"; pass: string; kind: ReasonStep["kind"]; text: string; ms?: number }
                | { type: "error"; message: string };
              if (event.type === "reason") {
                const next = [
                  ...reasoningRef.current,
                  { pass: event.pass, kind: event.kind, text: event.text, ms: event.ms },
                ];
                reasoningRef.current = next;
                setReasoning(next);
              }
              // The running pass goes into the composer strip, so the wait is
              // legible without a separate progress panel.
              if (event.type === "stage") setStage(STAGE_LABEL[event.stage] ?? event.stage);
              if (event.type === "done") {
                done = event.analysis;
                if (event.passes?.length) donePasses = event.passes;
              }
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
            // Only an unnamed chat takes the plan's words. A chat somebody
            // renamed keeps its name — that is the difference between naming and
            // titling, and the second must not overwrite the first.
            name: w.name === NEW_CHAT_TITLE ? nameFromPlan(text) : w.name,
            plans: [
              ...w.plans.filter((p) => p.id !== analysis.id),
              { id: analysis.id, text, at: analysis.createdAt, title: analysis.title },
            ],
            // Every report becomes a thing on the shelf, so it can be filed.
            resources: [
              ...w.resources.filter((r) => r.analysisId !== analysis.id),
              resourceFromAnalysis(analysis),
            ],
            messages: [
              ...w.messages,
              {
                id: newId(),
                role: "assistant",
                kind: "report",
                text: analysis.title,
                analysisId: analysis.id,
                reasoning: reasoningRef.current,
                at: new Date().toISOString(),
                ...(donePasses?.length ? { passes: donePasses } : {}),
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
        setStage(null);
      }
    },
    [analyses, append, current, plans, saveAnalyses, update]
  );

  // ---- ask about the work: read-only, answered from the workspace ----
  const ask = useCallback(
    async (question: string, effort?: string) => {
      if (!current) return;
      setBusy(true);
      append({ id: newId(), role: "user", text: question, at: new Date().toISOString() });

      // Everything this workspace has produced goes in as context, so the
      // answer can be checked against the report rather than trusted.
      const reports = reportsOf(current, analyses);

      try {
        const response = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...modelHeaders },
          body: JSON.stringify({
            question,
            ...(effort ? { effort } : {}),
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
        setStage(null);
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

  /**
   * One chat, one workspace.
   *
   * A new chat is not a new view of the same data — it is a new workspace with
   * its own messages, plans, reports and folders. That is what makes "each chat
   * has its own workspace" true rather than a label: there is no shared shelf
   * for evidence to land on, so two chats about two plans cannot cross.
   */
  const create = useCallback(() => {
    /*
     * Pressing New chat twice does not make two chats.
     *
     * A blank chat is not a thing you can have two of — there is nothing in
     * either to tell them apart, and a list of "New chat, New chat, New chat" is
     * exactly the filing cabinet this interface is getting away from. So if the
     * chat on screen is still blank, New chat brings you back to it. The moment
     * anything lands in it, pressing New chat makes a genuinely new one.
     */
    const { workspace, reused } = newChatTarget(workspaces);
    if (reused) {
      setCurrentId(workspace.id);
      writeCurrentId(workspace.id);
      setDraftPlan("");
      setLeftOpen(true);
      return;
    }

    persist([...workspaces, workspace]);
    setCurrentId(workspace.id);
    writeCurrentId(workspace.id);
    setDraftPlan("");
    // A new chat is a new thread, and the list it lands in has to be visible for
    // that to be legible: showing where it went is the whole feedback.
    setLeftOpen(true);
  }, [persist, workspaces]);

  const remove = useCallback(
    (id: string) => {
      const next = workspaces.filter((w) => w.id !== id);
      const list = next.length ? next : [createWorkspace()];
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

  // The shelf — folders, filed reports, moving things between them — lived in
  // the right column's Files card, and the column is gone. The data model stays
  // (a workspace still carries `folders` and `resources`, and still exports with
  // them); only the code that drove that card goes, rather than sitting here
  // unused.

  const rename = useCallback(
    (name: string) => {
      if (!currentId) return;
      update(currentId, (w) => ({ ...w, name }));
    },
    [currentId, update]
  );

  const chooseThinking = useCallback((effort: Effort) => {
    setThinking(effort);
    try {
      localStorage.setItem(LS_THINKING, effort);
    } catch {
      // A preference that cannot be saved is still a preference for this tab.
    }
  }, []);

  /**
   * Show or hide the one panel there is.
   *
   * There used to be two, and this function used to mean "fold both". With the
   * right column gone it means the left one, which is now the only layout
   * decision on the page: the chat list is either there or it is not.
   */
  const toggleChats = useCallback(() => {
    setLeftOpen((prev) => {
      try {
        localStorage.setItem(LS_RAIL, prev ? "0" : "1");
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

  // The latest report is what the rail describes. It is the same object the
  // thread renders, so the two can never disagree.
  const latest = current ? reportsOf(current, analyses).at(-1) : undefined;
  const threaded = Boolean(current && current.messages.length > 0);

  // What the top bar says: `New chat` while it is one, the chat's name after.
  const currentTitle = current ? titleOf(current) : NEW_CHAT_TITLE;

  const composer = (
    <Composer
      onAnalyze={(text, keep, effort) => void analyze(text, keep, { effort })}
      onAsk={(question) => void ask(question, thinking)}
      busy={busy}
      aiMode={mode}
      workspaceName={currentTitle}
      keep={keep}
      onKeepChange={setKeep}
      recent={current ? reportsOf(current, analyses).map((a) => ({ id: a.id, title: a.title })) : []}
      stage={stage}
      draft={draftPlan}
      thinking={thinking}
      onThinking={chooseThinking}
    />
  );

  return (
    <div className="relative flex min-h-dvh">
      {/* ---- the sidebar, on the left edge -------------------------------- */}
      <NavRail
        chatsOpen={leftOpen}
        onNewChat={create}
        onChats={toggleChats}
        onSettings={() => {
          // A page, not a panel: the whole point of moving it out of the rail.
          window.location.href = "/settings";
        }}
      />

      {/* ---- left panel: the chat list ------------------------------------ */}
      <div
        className={`hidden shrink-0 overflow-hidden border-r transition-[width,opacity,border-color] duration-200 ease-out md:flex ${
          leftOpen
            ? "w-[15rem] border-[var(--to-border)] opacity-100"
            : "pointer-events-none w-0 border-transparent opacity-0"
        }`}
      >
        <Panel label="Chats" className="w-[15rem]">
          <WorkspaceRail
            workspaces={workspaces.map((w) => ({
              workspace: w,
              title: titleOf(w),
              reports: reportsOf(w, analyses).length,
              messages: w.messages.length,
            }))}
            currentId={currentId}
            onSelect={select}
            onCreate={create}
            onDelete={remove}
          />
        </Panel>
      </div>

      {/* ---- the thread --------------------------------------------------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        {threaded ? (
          <TopBar
            name={currentTitle}
            workspaces={workspaces.map((w) => ({
              id: w.id,
              name: w.name,
              reports: reportsOf(w, analyses).length,
            }))}
            currentId={currentId}
            chatsOpen={leftOpen}
            onToggleChats={toggleChats}
            onRename={rename}
            onSelect={select}
            onDelete={remove}
            onCreate={create}
          />
        ) : (
          /* A new workspace keeps the bare canvas: the question and the box. */
          <div className="pointer-events-none fixed inset-x-0 top-0 z-30 flex items-center justify-end gap-[0.375rem] px-[0.75rem] py-[0.625rem]">
            <span className="pointer-events-auto">
              <BeamToggle />
            </span>
          </div>
        )}

        <main
          className={`mx-auto flex w-full max-w-[46rem] flex-1 flex-col px-[1rem] ${
            threaded ? "pt-[1.25rem]" : "pt-[3.75rem]"
          } pb-[1.5rem]`}
        >
          <ThreadWorkspace
            workspace={current}
            analyses={analyses}
            prevOf={prevOf}
            planOf={planOf}
            onOutcome={recordOutcome}
            onDeleteReport={deleteReport}
            onRerun={rerun}
            busy={busy}
            stage={stage}
            reasoning={reasoning}
            composer={composer}
            mirofish={mirofish}
            demo={mode === "demo"}
            onExample={(text) => setDraftPlan(text)}
          />
          <div ref={endRef} />
        </main>
      </div>

      {/* Rare UI's licence asks for a visible credit wherever its components
          ship. It lived in the right column; the column is gone, so the credit
          moves to the one place that is always on screen. */}
      <p className="pointer-events-none fixed bottom-[0.25rem] right-[0.5rem] z-10 text-[0.625rem] leading-[1.4] text-ink-3">
        Components from{" "}
        <a
          href="https://www.rareui.com"
          target="_blank"
          rel="noreferrer noopener"
          className="pointer-events-auto underline underline-offset-2 hover:text-foreground"
        >
          Rare UI
        </a>
      </p>
    </div>
  );
}
