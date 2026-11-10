import { z } from "zod";

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

export function geminiKey(): string | null {
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
};

export type GeminiResult = {
  text: string;
  model: string;
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
  const body: Record<string, unknown> = {
    systemInstruction: opts.system ? { parts: [{ text: opts.system }] } : undefined,
    contents: [{ role: "user", parts: [{ text: opts.user }] }],
    generationConfig: {
      maxOutputTokens: opts.maxTokens ?? 4096,
      temperature: opts.temperature ?? 0.4,
      ...(thinking() ? { thinkingConfig: { thinkingLevel: thinking() } } : {}),
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
    for (const fallback of GEMINI_MODELS) {
      if (fallback === model) continue;
      model = fallback;
      response = await post(model, key, body);
      if (!response.error) break;
    }
  }

  if (response.error) throw new Error(response.error.message ?? "Gemini returned an error");

  const candidate = response.candidates?.[0];
  const text = (candidate?.content?.parts ?? []).map((part) => part.text ?? "").join("").trim();

  return {
    text,
    model,
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
): Promise<{ data: T; model: string; inputTokens: number; outputTokens: number; truncated: boolean }> {
  const result = await generate({ ...opts, schema });
  const parsed = schema.safeParse(jsonOf(result.text));
  if (!parsed.success) {
    throw new Error(`Gemini reply did not match the schema: ${parsed.error.message.slice(0, 400)}`);
  }
  return {
    data: parsed.data,
    model: result.model,
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
