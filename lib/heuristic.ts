import type { Category, Claim, Confidence } from "./schema";
import { priorityOf } from "./score";

/**
 * The no-model extractor.
 *
 * Pass 1 was the only fatal call in the pipeline: one failed request and the
 * whole run died, even though the cheapest and most reliable part of this tool
 * — find the sentences that carry weight, quote them, band them — needs no
 * model at all.
 *
 * So this exists to answer a narrower question honestly: what can be said about
 * this text without asking anything? It finds the sentences that assert
 * something about the future, money, or a third party, quotes them verbatim
 * (they come from the text, so the quote check is trivially satisfied), and
 * bands them with the same rubric the model uses.
 *
 * What it deliberately does not do: invent impact scores it cannot justify, or
 * find the hidden assumptions, which is the part that genuinely needs reading
 * for meaning. A report from here says so at the top.
 */

/** Signals that a sentence asserts something the author must be right about. */
const SIGNALS: { pattern: RegExp; weight: number; category: Category; why: string }[] = [
  { pattern: /\b(will|going to|expect|expects|predict|believe|assume|plan to|intend)\b/i, weight: 1, category: "timing", why: "a claim about what will happen" },
  { pattern: /\b(should|could|can|may|might)\b/i, weight: 0.5, category: "technical", why: "a possibility stated as available" },
  { pattern: /\b\d[\d,.]*\s*(%|r?wf|\$|usd|eur|k\b|m\b|per|a month|a year|days?|weeks?|months?|hours?)/i, weight: 1.5, category: "financial", why: "a number the plan depends on" },
  { pattern: /\b(revenue|margin|price|pricing|cost|costs|cheaper|expensive|budget|profit|subscribers?|users?|customers?|churn)\b/i, weight: 1.2, category: "financial", why: "an economic assumption" },
  { pattern: /\b(market|demand|competitors?|competition|audience|community|segment)\b/i, weight: 1, category: "market", why: "an assumption about the market" },
  { pattern: /\b(would pay|willing|prefer|habit|trust|switch|adopt|sign up|subscribe|retain|churn)\b/i, weight: 1.2, category: "behavioral", why: "an assumption about what people do" },
  { pattern: /\b(permit|licen[cs]e|regulat|legal|law|compliance|tax|zoning|health code)\b/i, weight: 1.5, category: "external dependency", why: "a dependency on someone else's rules" },
  { pattern: /\b(api|platform|supplier|vendor|partner|integration|dependency|provider)\b/i, weight: 1, category: "external dependency", why: "a dependency on a third party" },
];

const SECONDS_PERSON = /\b(we|i|our|my|us)\b/i;

/** Split into sentences without pretending to be a parser. */
export function sentences(text: string): string[] {
  return text
    .replace(/\r\n/g, "\n")
    .split(/(?<=[.!?])\s+|\n{2,}/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length >= 20);
}

type Scored = {
  sentence: string;
  score: number;
  hits: { weight: number; category: Category; why: string }[];
};

function scoreSentence(sentence: string): Scored {
  const hits: Scored["hits"] = [];
  for (const signal of SIGNALS) {
    if (signal.pattern.test(sentence)) {
      hits.push({ weight: signal.weight, category: signal.category, why: signal.why });
    }
  }
  if (!SECONDS_PERSON.test(sentence)) hits.push({ weight: -0.5, category: "market", why: "" });
  const score = hits.reduce((total, hit) => total + hit.weight, 0);
  return { sentence, score, hits: hits.filter((h) => h.why) };
}

/**
 * Pull claims out of a plan with no model involved.
 *
 * Ordering is by how much the sentence asserts, so the first claims are the
 * ones worth reading. Nothing here is scored on impact beyond what the words
 * justify: every claim is `confidence: low` because there is no evidence in a
 * plan by definition, and impact is banded from the signal that fired.
 */
export function heuristicClaims(planText: string, limit = 8): Claim[] {
  const scored = sentences(planText)
    .map(scoreSentence)
    .filter((s) => s.score >= 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map((item, index) => {
    const ref = `C${index + 1}`;
    // 3 is the honest centre: something would have to be redesigned if this is
    // wrong, but nothing here is strong enough to claim the plan collapses.
    const impact = item.score >= 3 ? 4 : item.score >= 2 ? 3 : 2;
    const category = item.hits.sort((a, b) => b.weight - a.weight)[0]?.category ?? "market";
    const confidence: Confidence = "low";

    return {
      id: `${ref.toLowerCase()}-h${index}`,
      ref,
      claim: toClaimSentence(item.sentence),
      source: item.sentence,
      sourceStatus: "verbatim" as const,
      category,
      status: "unverified" as const,
      impact,
      confidence,
      dependsOn: [],
      // A heuristic cannot tell whether the web could settle something, so it
      // does not ask for a search it cannot justify.
      verifiable: false,
      reasoning: `Read directly from the plan: ${item.hits
        .slice(0, 2)
        .map((hit) => hit.why)
        .join("; ")}. Not scored by a model.`,
      rank: 0,
      priority: priorityOf(impact, confidence),
      evidence: [],
      test: null,
      heuristic: true,
    };
  });
}

/** A plan's sentence turned into something a reader can argue with. */
function toClaimSentence(sentence: string): string {
  const trimmed = sentence.replace(/^[-*•\d.)\s]+/, "").trim();
  const firstPerson = /^(we|i)\s+(will|are|plan|expect|believe|assume|think)/i;
  if (firstPerson.test(trimmed)) return `${trimmed.replace(/^(we|i)\b/i, "The plan")}`;
  return trimmed.length > 200 ? `${trimmed.slice(0, 197)}…` : trimmed;
}

/** A title for a plan, from its first real line. */
export function heuristicTitle(planText: string): string {
  const line = planText.trim().split("\n")[0]?.trim() ?? "";
  if (line.length >= 12) return line.length > 80 ? `${line.slice(0, 77)}…` : line;
  const first = sentences(planText)[0] ?? "Untitled plan";
  return first.length > 80 ? `${first.slice(0, 77)}…` : first;
}
