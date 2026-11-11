/**
 * The quote check.
 *
 * Every claim is supposed to carry a quote from the plan. That promise was only
 * ever asked for in the prompt, which means a paraphrase wearing quotation marks
 * was indistinguishable from a real quote — on the one field whose whole job is
 * proving a claim came from the text.
 *
 * This module makes it an invariant. A `source` either appears in the plan, or it
 * is relabelled `paraphrase`, and the user can see which.
 */

export const IMPLIED = "implied";
export const PARAPHRASE = "paraphrase";

/**
 * Normalise for comparison: case, curly quotes, collapsed whitespace, and
 * trailing punctuation. Deliberately forgiving about typography and strict
 * about words — a quote that drops a sentence is still a quote; one that swaps
 * "will" for "may" is not.
 */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019\u201c\u201d]/g, "'")
    .replace(/["']/g, "")
    .replace(/[—–]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[.,;:!?]+$/g, "")
    .trim();
}

/** True when `quote` appears in `plan`, allowing for an ellipsis in the middle. */
export function isVerbatim(quote: string, plan: string): boolean {
  const q = normalise(quote);
  if (q.length < 4) return false;
  const p = normalise(plan);
  if (p.includes(q)) return true;

  // A quote may join two separated phrases with an ellipsis; every piece must
  // then appear, in order. Anything looser would let a paraphrase through.
  const pieces = q
    .split(/\s*(?:\.\.\.|…)\s*/)
    .map((piece) => piece.trim())
    .filter((piece) => piece.length >= 4);
  if (pieces.length < 2) return false;

  let cursor = 0;
  for (const piece of pieces) {
    const at = p.indexOf(piece, cursor);
    if (at === -1) return false;
    cursor = at + piece.length;
  }
  return true;
}

export type QuoteVerdict = {
  /** What to show as the claim's source. */
  source: string;
  status: "verbatim" | "implied" | "paraphrase";
};

/**
 * Decide what a claim's `source` really is.
 *
 * A model that says "implied" is believed: nothing was quoted, so there is
 * nothing to check. Anything else has to survive the plan.
 */
export function judgeSource(source: string, plan: string): QuoteVerdict {
  if (!source || source.trim().toLowerCase() === IMPLIED) {
    return { source: IMPLIED, status: "implied" };
  }
  if (isVerbatim(source, plan)) return { source, status: "verbatim" };
  return { source, status: "paraphrase" };
}
