import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

/**
 * Thin wrapper around one structured AI call: ask, validate, retry once
 * if the model colours outside the schema.
 */

export const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
export const FALLBACK_MODELS = ["claude-sonnet-4-5", "claude-haiku-4-5"];

export function hasApiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
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
  const attempts = opts.attempts ?? 2;
  const anthropic = client();
  let lastError: unknown = null;
  let prompt = opts.user;
  let model = MODEL;

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

      // Unknown model on this account: fall through to the next alias once.
      if (/model/i.test(messageText) && /not[_ ]found|unknown|invalid/i.test(messageText)) {
        const next = FALLBACK_MODELS.shift();
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
