import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { EvidenceItemSchema, type EvidenceItem } from "./schema";
import { client, MODEL } from "./ai";

/**
 * Web evidence. This pass is deliberately separate from the scoring passes:
 * search only runs on claims already tagged "verifiable", so the model can
 * never go looking for support and come back with a citation it invented.
 */

const EvidenceBatchSchema = z.object({
  results: z.array(EvidenceItemSchema),
});

/** Claims we will actually pay to search for. Keeps cost bounded. */
export const MAX_SEARCHED_CLAIMS = 6;

export function claimsWorthSearching<T extends { ref: string; verifiable: boolean }>(
  claims: T[]
): T[] {
  return claims.filter((c) => c.verifiable).slice(0, MAX_SEARCHED_CLAIMS);
}

export type EvidenceRun = {
  evidence: EvidenceItem[];
  notes: string[];
};

/**
 * One web-search-enabled call over the checkable claims. If the tool is
 * unavailable on the account (no web search access, or the model refuses),
 * we return no evidence plus a plain-language note instead of making
 * something up.
 */
export async function gatherEvidence(
  claims: { ref: string; claim: string }[]
): Promise<EvidenceRun> {
  if (!claims.length) return { evidence: [], notes: [] };

  const anthropic = client();
  const list = claims.map((c) => `- ${c.ref}: ${c.claim}`).join("\n");

  const prompt = `You are checking claims against public sources for a tool called Load-Bearing.

Claims to check:
${list}

Search the web for each claim. Only report a source if you actually opened it in search results and it is about THIS claim. Prefer primary sources: a pricing page, terms of service, a regulator, an official changelog.

For every claim ref, report zero to two sources. It is completely acceptable to report no source for a claim — a missing source becomes "unverified" and that is a useful answer.

Rules:
- Never invent a URL or a title. If you did not see it in a search result, it does not exist.
- "snippet" must be a short paraphrase of what the page actually said (under 40 words).
- "supports" = backs the claim. "contradicts" = the page says otherwise. "inconclusive" = related but does not settle it.
- Include every claim ref you were given that has at least one source. Do not add claims that were not in the list.`;

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 3000,
      system:
        "You verify claims with real web sources. You never fabricate a URL, a statistic, or a study. Reporting that a claim could not be verified is a successful outcome.",
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 8 }],
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    const raw = extractJson(text);
    if (!raw) {
      return { evidence: [], notes: ["Web check ran but returned no usable citations."] };
    }

    // A second, cheap call forces the prose + search results into the schema.
    const parsed = await anthropic.messages.parse({
      model: MODEL,
      max_tokens: 2000,
      system: "You convert research notes into strict JSON. You never add a source that is not in the notes.",
      messages: [
        {
          role: "user",
          content: `Convert these research notes into the required JSON. Drop any source whose URL is not literally present in the notes.\n\nClaims:\n${list}\n\nNotes:\n${text}`,
        },
      ],
      output_config: { format: zodOutputFormat(EvidenceBatchSchema) },
    });

    const results = parsed.parsed_output?.results ?? [];
    const seen = new Set<string>();
    const evidence = results.filter((item) => {
      const key = `${item.ref}:${item.url}`;
      if (seen.has(key)) return false;
      seen.add(key);
      const refs = new Set(claims.map((c) => c.ref));
      if (!refs.has(item.ref)) return false;
      const knownUrls = new Set(
        Array.from(text.matchAll(/https?:\/\/[^\s)\]"'<>]+/g)).map((m) => stripPunctuation(m[0]))
      );
      return knownUrls.has(item.url) || text.includes(item.url);
    });

    const notes: string[] = [];
    if (evidence.length === 0) {
      notes.push("Web check ran; no claim could be tied to a source, so all stay unverified.");
    }
    if (evidence.some((e) => e.supports === "contradicts")) {
      notes.push("At least one source contradicts a claim — read those before building.");
    }
    return { evidence, notes };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const friendly = /web_search|tool|permission|not available|unsupported/i.test(message)
      ? "Web search is not available on this API key, so no claims were checked online. Every verifiable claim stays unverified until you check it."
      : `Web check failed (${message.slice(0, 120)}). Claims stay unverified.`;
    return { evidence: [], notes: [friendly] };
  }
}

function stripPunctuation(url: string): string {
  return url.replace(/[.,;:]+$/, "");
}

/** Pull the first JSON object out of a model's prose. */
export function extractJson(text: string): unknown | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** Evidence grouped by claim ref, used when merging into claims. */
export function byRef(evidence: EvidenceItem[]): Map<string, EvidenceItem[]> {
  const map = new Map<string, EvidenceItem[]>();
  for (const item of evidence) {
    const list = map.get(item.ref) ?? [];
    list.push(item);
    map.set(item.ref, list);
  }
  return map;
}
