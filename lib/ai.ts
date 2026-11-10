import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { geminiKey, geminiModel, geminiProject, GEMINI_MODELS, generate, generateStructured } from "./gemini";

/**
 * Thin wrapper around one structured AI call: ask, validate, retry once
 * if the model colours outside the schema.
 *
 * Two providers, one interface. Claude stays the default when both keys are
 * present — this app's prompts and its web-search pass were written against it
 * — and Gemini does the same work when it is the key that exists.
 */

export type Provider = "anthropic" | "gemini";

export const CLAUDE_MODELS = [
  process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
  "claude-sonnet-4-5",
  "claude-haiku-4-5",
];

/** The model name the current provider will use. */
export function MODEL(): string {
  return provider() === "gemini" ? geminiModel() : CLAUDE_MODELS[0];
}

export function provider(): Provider {
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (geminiKey()) return "gemini";
  return "anthropic";
}

export function hasApiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY ?? geminiKey());
}

/** What the health route reports. Never includes a key. */
export function describeProvider(): {
  ai: "configured" | "demo";
  provider: Provider | null;
  model: string | null;
  project: string | null;
} {
  if (!hasApiKey()) return { ai: "demo", provider: null, model: null, project: null };
  const active = provider();
  return {
    ai: "configured",
    provider: active,
    model: MODEL(),
    project: active === "gemini" ? geminiProject() : null,
  };
}

export function client(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  return new Anthropic({ apiKey, maxRetries: 2 });
}

export type StructuredResult<T> = {
  data: T;
  model: string;
  inputTokens: number;
  outputTokens: number;
  retries: number;
};

/**
 * Run one pass and return schema-valid JSON. Zod is the gate: if the model
 * returns impact "high" instead of a number, the pass is retried with the
 * validation error appended, rather than passed to the UI.
 */
export async function structuredPass<Schema extends z.ZodType>(opts: {
  system: string;
  user: string;
  schema: Schema;
  maxTokens?: number;
  attempts?: number;
}): Promise<StructuredResult<z.infer<Schema>>> {
  if (provider() === "gemini") return geminiPass(opts);

  const attempts = opts.attempts ?? 2;
  const anthropic = client();
  let lastError: unknown = null;
  let prompt = opts.user;
  const models = [...CLAUDE_MODELS];
  let model = models[0];

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const message = await anthropic.messages.parse({
        model,
        max_tokens: opts.maxTokens ?? 4096,
        system: opts.system,
        messages: [{ role: "user", content: prompt }],
        output_config: { format: zodOutputFormat(opts.schema) },
      });

      const parsed = message.parsed_output as z.infer<Schema> | null;
      if (!parsed) throw new Error("model returned no parseable output");

      return {
        data: parsed,
        model,
        inputTokens: message.usage?.input_tokens ?? 0,
        outputTokens: message.usage?.output_tokens ?? 0,
        retries: attempt,
      };
    } catch (error) {
      lastError = error;
      const messageText = error instanceof Error ? error.message : String(error);

      // Unknown model on this account: step down the aliases once each.
      if (/model/i.test(messageText) && /not[_ ]found|unknown|invalid/i.test(messageText)) {
        const next = models[models.indexOf(model) + 1];
        if (next) {
          model = next;
          attempt -= 1;
          continue;
        }
      }

      // Otherwise give the model its own mistake back and ask again.
      prompt = `${opts.user}\n\n---\nYour previous reply did not match the required JSON schema. The validator said:\n${messageText}\n\nReturn only the JSON object, with every field present and every enum value spelled exactly as defined.`;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/**
 * The same pass on Gemini. Temperature is held low because these passes are
 * extraction and scoring, where variety is the enemy: the same plan should read
 * the same way twice.
 */
async function geminiPass<Schema extends z.ZodType>(opts: {
  system: string;
  user: string;
  schema: Schema;
  maxTokens?: number;
  attempts?: number;
}): Promise<StructuredResult<z.infer<Schema>>> {
  const attempts = opts.attempts ?? 2;
  let lastError: unknown = null;
  let prompt = opts.user;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const result = await generateStructured(opts.schema, {
        system: opts.system,
        user: prompt,
        maxTokens: opts.maxTokens ?? 4096,
        temperature: 0.2,
      });
      if (result.truncated) {
        throw new Error("the reply was cut off at the token limit");
      }
      return {
        data: result.data as z.infer<Schema>,
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        retries: attempt,
      };
    } catch (error) {
      lastError = error;
      const messageText = error instanceof Error ? error.message : String(error);
      prompt = `${opts.user}\n\n---\nYour previous reply did not match the required JSON schema. The validator said:\n${messageText}\n\nReturn only the JSON object, with every field present and every enum value spelled exactly as defined.`;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/** One prose call, provider-agnostic. Used by the research route. */
export async function prose(opts: {
  system: string;
  turns: { role: "user" | "assistant"; content: string }[];
  maxTokens?: number;
}): Promise<{ text: string; model: string }> {
  if (provider() === "gemini") {
    // Gemini has no separate assistant turns here: the transcript is folded into
    // one user message, which is what the model actually needs to answer.
    const transcript = opts.turns
      .map((turn) => `${turn.role === "user" ? "Q" : "A"}: ${turn.content}`)
      .join("\n\n");
    const result = await generate({
      system: opts.system,
      user: transcript,
      maxTokens: opts.maxTokens ?? 1024,
      temperature: 0.3,
    });
    return { text: result.text, model: result.model };
  }

  const response = await client().messages.create({
    model: MODEL(),
    max_tokens: opts.maxTokens ?? 1024,
    system: opts.system,
    messages: opts.turns,
  });
  const text = response.content
    .flatMap((block) => (block.type === "text" ? [block.text] : []))
    .join("\n")
    .trim();
  return { text, model: MODEL() };
}

export { GEMINI_MODELS, generate };
