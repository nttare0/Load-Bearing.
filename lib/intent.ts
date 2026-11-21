/**
 * Which thing did the person just ask for?
 *
 * The composer used to guess with a regex: under 400 characters ending in a
 * question mark, or starting with what/why/how. That is wrong in both
 * directions, and wrong in a way the person cannot see — type "should we hire a
 * third rider?" and get a report instead of an answer; paste a short plan in the
 * imperative and get a chat reply instead of an analysis.
 *
 * So the routing decision moves to the model, prompted with the shapes the
 * workspace already knows: a plan is a statement of intent about the world
 * ("we will…", a number, a date, a market), and a question is a request for
 * something known or already in the workspace. The classifier returns a label and
 * nothing else.
 *
 * The regex survives as `guessIntent`, used in exactly two places: as the
 * fallback when there is no key (demo mode) or the classifier call fails, and in
 * tests. It is a safety net, not the router.
 */

export type Intent = "plan" | "question";

/** One line, so the classifier cannot wander off into an explanation. */
export const INTENT_PROMPT = `You label a single message sent to a plan-analysis tool. Answer with exactly one word.

- "plan" — the message states an intention, a decision, a strategy, or a course of action. It asserts things about the world that could be wrong: a number, a date, a market, a cost, a customer, a capability.
- "question" — the message asks for information. It wants an answer, not an appraisal: about a report already in the workspace, about a concept, or about what to do next.

A message that asks a question about a plan it also describes is a "question".
Do not explain. Output only plan or question.`;

/** Trim to the shape the classifier needs; the whole plan is wasteful and slow. */
export function intentSample(text: string, limit = 600): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= limit ? clean : `${clean.slice(0, limit)}…`;
}

/**
 * The fallback, kept deliberately simple.
 *
 * Long messages are plans: a question that takes 600 characters to ask is,
 * in practice, a plan with a question mark at the end. Short ones are read for
 * interrogative shape.
 */
export function guessIntent(text: string): Intent {
  const trimmed = text.trim();
  if (trimmed.length >= 400) return "plan";
  if (/\?\s*$/.test(trimmed)) return "question";
  if (/^(what|why|how|which|should|is|are|can|could|do|does|who|when|where)\b/i.test(trimmed)) {
    return "question";
  }
  return "plan";
}

/** Parse whatever the model said into a label, defaulting rather than throwing. */
export function readIntent(answer: string, fallback: Intent): Intent {
  const word = answer.trim().toLowerCase().replace(/[^a-z]/g, "");
  if (word.startsWith("question")) return "question";
  if (word.startsWith("plan")) return "plan";
  return fallback;
}

/** What the composer shows. Both actions go through the same box. */
export const INTENT_LABEL: Record<Intent, string> = {
  plan: "Analysing a plan",
  question: "Answering from your workspace",
};
