import { z } from "zod";
import { visitorCredential } from "./visitor";

/**
 * Gemini, over its REST API.
 *
 * Called directly instead of through an SDK: the two things this app needs are
 * a schema-constrained JSON reply and a prose reply, and both are one POST. The
 * project id is not a credential — it names which Google Cloud project the key
 * belongs to, and is reported so a misconfigured key is diagnosable instead of
 * just failing.
 */

/**
 * Newest stable Flash first, then steadily older ones. The 2.x line is retired
 * for accounts created recently — it answers with "no longer available to new
 * users" rather than a 404 — so it is deliberately not in this list.
 */
export const GEMINI_MODELS = ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite"];

/**
 * The key this call runs on: the visitor's, when this request brought one, and
 * the deployment's otherwise. Order matters — a visitor who pasted their own key
 * must never spend the operator's budget, and the operator's key must never be
 * used for a request that asked not to.
 */
export function geminiKey(): string | null {
  const visitor = visitorCredential();
  if (visitor?.provider === "gemini") return visitor.key;
  return (
    process.env.GEMINI_API_KEY ??
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ??
    process.env.GOOGLE_API_KEY ??
    null
  );
}

export function geminiProject(): string | null {
  return (
    process.env.GOOGLE_CLOUD_PROJECT ??
    process.env.GOOGLE_CLOUD_PROJECT_ID ??
    process.env.GCLOUD_PROJECT ??
    null
  );
}

export function geminiModel(): string {
  return process.env.GEMINI_MODEL ?? GEMINI_MODELS[0];
}

/**
 * How much the model is allowed to think before it answers.
 *
 * These passes are extraction and scoring against a fixed schema, not open
 * reasoning. Gemini 3.8 thinks at `medium` by default, and thinking tokens are
 * billed and counted against the output budget — so the default here is `low`.
 * Five passes at medium is five times the latency for answers that a schema was
 * always going to constrain anyway. Override with GEMINI_THINKING=medium.
 */
/**
 * The model a call was asked for, and the model that actually answered.
 *
 * The fallback chain below is right: a busy model should not fail a report. But
 * it was silent, and silence turns a degraded report into a normal one. When
 * gemini-3.8-flash is out of quota and gemini-3.5-flash-lite answers instead,
 * the user is reading a weaker model's work while the UI names the stronger
 * one. So the swap is recorded here and surfaces in `notes`.
 */
let lastSubstitution: { asked: string; answered: string; reason: string } | null = null;

/** The most recent substitution, or null if the last call used the model asked for. */
export function takeModelSubstitution(): { asked: string; answered: string; reason: string } | null {
  const value = lastSubstitution;
  lastSubstitution = null;
  return value;
}

/** Why a model was passed over, with the provider's own words when it gave any. */
function reasonFor(error: { message?: string } | undefined): string {
  const message = error?.message ?? "";
  if (/quota|rate limit|resource.?exhausted|429/i.test(message)) {
    const retry = message.match(/retry in ([^.]+)\./i);
    return retry ? `out of quota, retry in ${retry[1].trim()}` : "out of quota";
  }
  if (/high demand|overloaded|503/i.test(message)) return "temporarily overloaded";
  if (/not found|not supported|does not exist|no longer available/i.test(message)) {
    return "not available to this key";
  }
  return "refused the request";
}

/**
 * The plain-language sentence that goes in the report's notes.
 *
 * The parenthetical is dropped when there is no reason to give: "not
 * gemini-3.8-flash ()." is the kind of half-finished sentence that makes a
 * reader distrust the whole note.
 */
export function substitutionNote(swap: { asked: string; answered: string; reason: string }): string {
  const why = swap.reason.trim();
  const because = why ? ` (${why})` : "";
  return `Answers came from ${swap.answered}, not ${swap.asked}${because}. The report is real, but it is a lighter model's reading of the plan.`;
}

export function geminiThinking(): string {
  return process.env.GEMINI_THINKING ?? "low";
}

type Part = { text?: string };
type Candidate = { content?: { parts?: Part[] }; finishReason?: string };
type GeminiResponse = {
  candidates?: Candidate[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  error?: { message?: string; status?: string };
};

export type GeminiCall = {
  system?: string;
  user: string;
  maxTokens?: number;
  /** Ask for JSON constrained to this schema. */
  schema?: z.ZodType;
  /** 0 for the extraction passes, where the same plan should read the same way. */
  temperature?: number;
  /** Override how hard the model thinks. Gemini only; the composer's hold-to-
   *  think sends this, so "Think deeply" actually buys more reasoning. */
  thinkingLevel?: string | null;
};

export type GeminiResult = {
  text: string;
  model: string;
  /** Set when the model that answered is not the model that was asked for. */
  substitution?: { asked: string; answered: string; reason: string };
  inputTokens: number;
  outputTokens: number;
  /** True when the reply was truncated, so callers can say so rather than
   *  treating half a JSON object as a schema violation. */
  truncated: boolean;
};

export async function generate(opts: GeminiCall): Promise<GeminiResult> {
  const key = geminiKey();
  if (!key) throw new Error("GEMINI_API_KEY is not set");

  let model = geminiModel();
  const asked = model;
  let why: string | null = null;
  const body: Record<string, unknown> = {
    systemInstruction: opts.system ? { parts: [{ text: opts.system }] } : undefined,
    contents: [{ role: "user", parts: [{ text: opts.user }] }],
    generationConfig: {
      maxOutputTokens: opts.maxTokens ?? 4096,
      temperature: opts.temperature ?? 0.4,
      ...(level(opts) ? { thinkingConfig: { thinkingLevel: level(opts) } } : {}),
      ...(opts.schema
        ? {
            responseMimeType: "application/json",
            responseJsonSchema: z.toJSONSchema(opts.schema, { io: "output" }),
          }
        : {}),
    },
  };

  let response = await post(model, key, body);

  // If this key or model rejects the thinking parameter, say nothing about it
  // and ask again without it rather than failing the whole pass over a hint.
  if (response.error && /thinking/i.test(response.error.message ?? "")) {
    response = await post(model, key, withoutThinking(body));
  }

  // A thinking model can spend the entire output budget on its private
  // reasoning and return nothing at all. That is a budget problem, not a
  // schema problem, so raise the budget once rather than reporting failure.
  if (isEmptyTruncation(response) && (opts.maxTokens ?? 4096) < 16384) {
    const retryBody = {
      ...body,
      generationConfig: {
        ...(body.generationConfig as Record<string, unknown>),
        maxOutputTokens: 16384,
      },
    };
    response = await post(model, key, retryBody);
  }

  // An overloaded model is worth one more second, not a failed analysis:
  // "high demand" spikes clear on their own most of the time.
  if (response.error && TRANSIENT.test(response.error.message ?? "")) {
    await sleep(700);
    response = await post(model, key, body);
  }

  // Then walk the list once. Two different failures land here: a model this
  // key cannot see is a configuration mistake, and a model that is busy or out
  // of quota is a capacity problem. Both are better answered by the next model
  // than by handing the user an error after a five-pass pipeline.
  if (response.error && SHOULD_FALL_THROUGH.test(response.error.message ?? "")) {
    why = reasonFor(response.error);
    for (const fallback of GEMINI_MODELS) {
      if (fallback === model) continue;
      model = fallback;
      response = await post(model, key, body);
      if (!response.error) break;
    }
  }

  if (response.error) throw new Error(response.error.message ?? "Gemini returned an error");

  // Remember the swap so a caller can say so out loud. Only the first reason
  // matters: it is the model that was asked for that failed.
  if (model !== asked) lastSubstitution = { asked, answered: model, reason: why ?? "refused the request" };

  const candidate = response.candidates?.[0];
  const text = (candidate?.content?.parts ?? []).map((part) => part.text ?? "").join("").trim();

  return {
    text,
    model,
    ...(model !== asked ? { substitution: { asked, answered: model, reason: why ?? "refused the request" } } : {}),
    inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
    truncated: candidate?.finishReason === "MAX_TOKENS",
  };
}

const TRANSIENT = /high demand|overloaded|temporarily|try again|503/i;

const SHOULD_FALL_THROUGH =
  /not found|not supported|does not exist|no longer available|high demand|overloaded|resource.?exhausted|quota|rate limit|503/i;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function thinking(): string | null {
  return geminiThinking() || null;
}

/** The caller's level wins over the env default; an empty string turns thinking
 *  off entirely, for the cheap passes. */
function level(opts: GeminiCall): string | null {
  if (opts.thinkingLevel !== undefined) return opts.thinkingLevel || null;
  return thinking();
}

function withoutThinking(body: Record<string, unknown>): Record<string, unknown> {
  const config = { ...(body.generationConfig as Record<string, unknown>) };
  delete config.thinkingConfig;
  return { ...body, generationConfig: config };
}

function isEmptyTruncation(response: GeminiResponse): boolean {
  const candidate = response.candidates?.[0];
  if (!candidate || candidate.finishReason !== "MAX_TOKENS") return false;
  return !(candidate.content?.parts ?? []).some((part) => (part.text ?? "").trim().length > 0);
}

async function post(model: string, key: string, body: unknown): Promise<GeminiResponse> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });

  const payload = (await res.json().catch(() => ({}))) as GeminiResponse;
  if (!res.ok && !payload.error) {
    return { error: { message: `Gemini returned HTTP ${res.status}` } };
  }
  return payload;
}

/** Run a schema-constrained call and parse it. Throws with the parse error so
 *  the caller can hand it back to the model for one more attempt. */
export async function generateStructured<T>(
  schema: z.ZodType<T>,
  opts: Omit<GeminiCall, "schema">
): Promise<{
  data: T;
  model: string;
  substitution?: { asked: string; answered: string; reason: string };
  inputTokens: number;
  outputTokens: number;
  truncated: boolean;
}> {
  const result = await generate({ ...opts, schema });
  const parsed = schema.safeParse(jsonOf(result.text));
  if (!parsed.success) {
    throw new Error(`Gemini reply did not match the schema: ${parsed.error.message.slice(0, 400)}`);
  }
  return {
    data: parsed.data,
    model: result.model,
    ...(result.substitution ? { substitution: result.substitution } : {}),
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    truncated: result.truncated,
  };
}

/** Models sometimes wrap JSON in a fence even when asked not to. */
function jsonOf(text: string): unknown {
  const trimmed = text.trim();
  const unfenced = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "")
    : trimmed;
  try {
    return JSON.parse(unfenced);
  } catch {
    const start = unfenced.indexOf("{");
    const end = unfenced.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(unfenced.slice(start, end + 1));
    throw new Error("Gemini returned no parseable JSON");
  }
}
