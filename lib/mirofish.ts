/**
 * MiroFish: a swarm-simulation engine, used here as a research instrument.
 *
 * https://github.com/666ghj/MiroFish — upload seed material, it builds a
 * knowledge graph, generates agents with personas, runs a multi-round social
 * simulation, and writes a report.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS IS, AND WHAT IT IS NOT
 * ---------------------------------------------------------------------------
 * A MiroFish report is a simulation of what agents might do. It is not a
 * source. It cannot support a `fact`, it cannot contradict a claim, and it can
 * never enter a claim's `evidence` array — every item there carries a URL and a
 * real page behind it, and this has neither.
 *
 * So this module produces the one thing the rest of the app already knows how
 * to hold honestly: a prediction with reasoning attached, surfaced under its own
 * heading and its own status. If you are reading this because you are about to
 * reuse it to "verify" something — don't. `score.ts` will downgrade it anyway,
 * and it would be right to.
 *
 * ---------------------------------------------------------------------------
 * USE ONLY — the boundary, enforced in code
 * ---------------------------------------------------------------------------
 * MiroFish is enabled only when BOTH hold:
 *   1. MIROFISH_BASE_URL is set (there is no hosted endpoint; it is self-hosted)
 *   2. MIROFISH_RESEARCH === "1" (an explicit second switch)
 *
 * It runs on exactly one route: /api/research/mirofish, which answers one
 * question about one existing plan. It is never called from the five-pass
 * pipeline, never given the whole plan text, and never allowed to write claims.
 */

export const MIROFISH_REPO = "https://github.com/666ghj/MiroFish";

/** How it is described wherever it is shown. One string, so it cannot drift. */
export const MIROFISH_LABEL = "MiroFish simulation — predictive, not a source";

/** What a run costs the user, stated before they start one. */
export const MIROFISH_COST_WARNING =
  "A MiroFish run spends a lot of tokens on its own LLM: it generates personas, then simulates many agents over many rounds. Keep it under 40 rounds. Nothing here is evidence.";

export type MiroFishConfig = { baseUrl: string; key: string | null };

export function mirofishConfig(): MiroFishConfig | null {
  const baseUrl = (process.env.MIROFISH_BASE_URL ?? "").trim().replace(/\/+$/, "");
  if (!baseUrl) return null;
  if (process.env.MIROFISH_RESEARCH !== "1") return null;
  // MiroFish itself does not authenticate; the key is for a proxy in front of it.
  const key = process.env.MIROFISH_API_KEY?.trim() || null;
  return { baseUrl, key };
}

export function mirofishEnabled(): boolean {
  return mirofishConfig() !== null;
}

type Envelope = { success?: boolean; data?: unknown; error?: string };

async function call<T>(
  config: MiroFishConfig,
  path: string,
  init: { method?: string; json?: unknown; form?: FormData; timeoutMs?: number } = {}
): Promise<T> {
  const url = `${config.baseUrl}${path}`;
  const headers: Record<string, string> = {};
  if (config.key) headers["x-api-key"] = config.key;
  if (init.json !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(url, {
    method: init.method ?? (init.json !== undefined || init.form ? "POST" : "GET"),
    headers,
    body: init.form ?? (init.json !== undefined ? JSON.stringify(init.json) : undefined),
    signal: AbortSignal.timeout(init.timeoutMs ?? 30_000),
  });

  const text = await response.text();
  let payload: Envelope;
  try {
    payload = JSON.parse(text) as Envelope;
  } catch {
    throw new Error(`${path} did not return JSON (HTTP ${response.status})`);
  }
  if (!response.ok || payload.success === false) {
    throw new Error(short(payload.error ?? `HTTP ${response.status} from ${path}`));
  }
  return payload.data as T;
}

function short(message: string): string {
  return message.replace(/\s+/g, " ").slice(0, 240);
}

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------

export type Question = { question: string; planText: string; claims: { ref: string; claim: string }[] };

export type Prediction = {
  /** The claim this bears on, or null when it bears on the plan as a whole. */
  ref: string | null;
  /** What the simulation suggests will happen. One paragraph. */
  prediction: string;
  /** Which way it leans — never stronger than this, because it is a guess. */
  direction: "supports" | "undercuts" | "unclear";
  /** The reasoning the report gives, kept short. */
  basis: string;
};

export type SimulationResult = {
  ok: boolean;
  predictions: Prediction[];
  /** Where the full report lives on the MiroFish instance, when it exists. */
  reportUrl: string | null;
  simulationId: string | null;
  rounds: number | null;
  stages: { stage: string; at: string }[];
  warnings: string[];
  error?: string;
  ms: number;
};

const MAX_ROUNDS = 40;
const PREPARE_TIMEOUT_MS = 12 * 60_000;
const RUN_TIMEOUT_MS = 15 * 60_000;
const REPORT_TIMEOUT_MS = 10 * 60_000;
const POLL_MS = 4000;

/**
 * Run one simulation and turn its report into predictions.
 *
 * Deliberately narrow: the seed is the user's question plus the claims it bears
 * on, NOT the whole plan. A simulation seeded with everything produces a report
 * about everything, which is exactly the kind of unfalsifiable output this
 * app exists to avoid.
 */
export async function simulate(
  input: Question,
  onStage: (stage: string, detail?: string) => void = () => {}
): Promise<SimulationResult> {
  const config = mirofishConfig();
  if (!config) throw new Error("MiroFish is not enabled");

  const started = Date.now();
  const stages: { stage: string; at: string }[] = [];
  const warnings: string[] = [];
  const stage = (name: string, detail?: string) => {
    stages.push({ stage: name, at: new Date().toISOString() });
    onStage(name, detail);
  };

  const seed = [
    `Question: ${input.question}`,
    "",
    "The claims this question bears on:",
    ...input.claims.map((c) => `- ${c.ref}: ${c.claim}`),
    "",
    "Context:",
    input.planText.slice(0, 4000),
    "",
    "Simulate how the people described in the context would actually behave, and what follows from that for the claims above.",
  ].join("\n");

  try {
    // 1. Ontology: upload the seed, learn the entity types. This is the only
    //    call that creates a project on the instance.
    stage("seed");
    const form = new FormData();
    form.append("files", new Blob([seed], { type: "text/markdown" }), "seed.md");
    form.append("simulation_requirement", input.question.slice(0, 500));
    form.append("project_name", `Load-Bearing: ${input.question.slice(0, 60)}`);
    const ontology = await call<{ project_id: string }>(config, "/api/graph/ontology/generate", {
      form,
      timeoutMs: 120_000,
    });
    const projectId = ontology.project_id;
    if (!projectId) throw new Error("MiroFish did not return a project id");

    // 2. Graph: entities and relationships, which is what the agents are built
    //    from. Zep-backed, so this is the slow, expensive step.
    stage("graph");
    const build = await call<{ task_id: string }>(config, "/api/graph/build", {
      json: { project_id: projectId, graph_name: "load-bearing" },
    });
    await waitForTask(config, build.task_id, "graph");

    // 3. Simulation: created, then prepared (personas), then run.
    stage("simulation");
    const simulation = await call<{ simulation_id: string }>(config, "/api/simulation/create", {
      json: { project_id: projectId },
    });
    const simulationId = simulation.simulation_id;
    if (!simulationId) throw new Error("MiroFish did not return a simulation id");

    stage("personas");
    const prepare = await call<{ task_id?: string; status?: string }>(config, "/api/simulation/prepare", {
      json: { simulation_id: simulationId, use_llm_for_profiles: true, force_regenerate: false },
    });
    if (prepare.task_id) await waitForTask(config, prepare.task_id, "prepare", PREPARE_TIMEOUT_MS);

    stage("rounds");
    await call(config, "/api/simulation/start", {
      json: { simulation_id: simulationId, platform: "parallel", max_rounds: MAX_ROUNDS },
    });
    const rounds = await waitForRounds(config, simulationId);
    if (rounds === null) warnings.push(`The simulation did not report a finish within ${RUN_TIMEOUT_MS / 60000} minutes.`);

    // 4. Report.
    stage("report");
    const report = await call<{ task_id?: string }>(config, "/api/report/generate", {
      json: { simulation_id: simulationId },
    });
    if (report.task_id) await waitForTask(config, report.task_id, "report", REPORT_TIMEOUT_MS);

    const generated = await fetchReport(config, simulationId);
    if (!generated) {
      return {
        ok: false,
        predictions: [],
        reportUrl: `${config.baseUrl}`,
        simulationId,
        rounds,
        stages,
        warnings,
        error: "The simulation finished but no report came back.",
        ms: Date.now() - started,
      };
    }

    return {
      ok: true,
      // Parsed without a model: the report is prose, and a second model pass
      // summarising a simulation is a summary of a guess.
      predictions: parseReport(generated, input.claims),
      reportUrl: `${config.baseUrl}`,
      simulationId,
      rounds,
      stages,
      warnings,
      ms: Date.now() - started,
    };
  } catch (error) {
    return {
      ok: false,
      predictions: [],
      reportUrl: config.baseUrl,
      simulationId: null,
      rounds: null,
      stages,
      warnings,
      error: short(error instanceof Error ? error.message : String(error)),
      ms: Date.now() - started,
    };
  }
}

async function waitForTask(
  config: MiroFishConfig,
  taskId: string,
  label: string,
  timeoutMs = PREPARE_TIMEOUT_MS
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const task = await call<{ status?: string; error?: string }>(config, `/api/graph/task/${taskId}`);
    if (task.status === "completed" || task.status === "success") return;
    if (task.status === "failed") throw new Error(`${label} failed: ${short(task.error ?? "no reason given")}`);
    await sleep(POLL_MS);
  }
  throw new Error(`${label} did not finish within ${Math.round(timeoutMs / 60000)} minutes`);
}

async function waitForRounds(config: MiroFishConfig, simulationId: string): Promise<number | null> {
  const deadline = Date.now() + RUN_TIMEOUT_MS;
  let last: number | null = null;
  while (Date.now() < deadline) {
    const status = await call<{ runner_status?: string; current_round?: number }>(
      config,
      `/api/simulation/${encodeURIComponent(simulationId)}/run-status`
    );
    if (typeof status.current_round === "number") last = status.current_round;
    if (status.runner_status === "completed" || status.runner_status === "stopped") return last;
    await sleep(POLL_MS * 2);
  }
  return null;
}

async function fetchReport(config: MiroFishConfig, simulationId: string): Promise<string | null> {
  const report = await call<{ report_id?: string }>(
    config,
    `/api/report/by-simulation/${encodeURIComponent(simulationId)}`
  );
  const reportId = report.report_id;
  if (!reportId) return null;

  const full = await call<{ content?: string; sections?: { content?: string }[] }>(
    config,
    `/api/report/${encodeURIComponent(reportId)}`
  );
  if (full.content) return full.content;
  if (Array.isArray(full.sections)) {
    return full.sections.map((section) => section.content ?? "").join("\n\n").trim() || null;
  }
  return null;
}

/**
 * Pull per-claim predictions out of the report text.
 *
 * A section that names a ref becomes that claim's prediction; everything else
 * is attached to the plan as a whole. No model is asked to interpret this — a
 * model summarising a simulation produces a third layer of invention.
 */
export function parseReport(report: string, claims: { ref: string; claim: string }[]): Prediction[] {
  const paragraphs = report
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 60);

  const predictions: Prediction[] = [];
  for (const claim of claims) {
    const matcher = new RegExp(`\\b${escapeRegex(claim.ref)}\\b`);
    const hits = paragraphs.filter((p) => matcher.test(p));
    if (hits.length === 0) continue;
    const text = hits.sort((a, b) => b.length - a.length)[0];
    predictions.push({
      ref: claim.ref,
      prediction: clip(text, 600),
      direction: directionOf(text),
      basis: `Simulation paragraph naming ${claim.ref}.`,
    });
  }

  if (predictions.length === 0) {
    const longest = [...paragraphs].sort((a, b) => b.length - a.length)[0];
    if (longest) {
      predictions.push({
        ref: null,
        prediction: clip(longest, 800),
        direction: directionOf(longest),
        basis: "The simulation's own summary of the outcome.",
      });
    }
  }

  return predictions.slice(0, claims.length || 1);
}

function directionOf(text: string): Prediction["direction"] {
  const t = text.toLowerCase();
  const undercuts = /\b(unlikely|fail|fails|failing|risk|won't|will not|cannot|barrier|obstacle|erode|decline)\b/;
  const supports = /\b(likely|succeed|succeeds|grow|growth|adopt|adoption|willing|demand|feasible)\b/;
  const down = undercuts.test(t);
  const up = supports.test(t);
  if (down && up) return "unclear";
  if (down) return "undercuts";
  if (up) return "supports";
  return "unclear";
}

function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
