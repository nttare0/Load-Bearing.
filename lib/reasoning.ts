/**
 * The reasoning panel's vocabulary, kept out of the component so the collapsed
 * summary can be tested without rendering anything.
 */

export type ReasonKind = "think" | "found" | "check" | "warn";

/** One step, as it arrives over the stream. */
export type ReasonStep = {
  pass: string;
  kind: ReasonKind;
  text: string;
  /** How long this step took, marked by the server when the next one began. */
  ms?: number;
};

/**
 * The collapsed line.
 *
 * When the panel folds, what is left has to be worth reading on its own: not
 * "12 steps" but the shape of the work — what was found, what was checked, what
 * went wrong. This is the sentence under the disclosure triangle, and it is the
 * only thing most people will ever read of the reasoning.
 */
export function summaryOf(steps: ReasonStep[], opts: { running?: boolean } = {}): string {
  if (steps.length === 0) return opts.running ? "Thinking…" : "Nothing was thought yet.";

  const found = steps.filter((s) => s.kind === "found").length;
  const checked = steps.filter((s) => s.kind === "check").length;
  const warned = steps.filter((s) => s.kind === "warn").length;
  const total = steps.reduce((sum, s) => sum + (s.ms ?? 0), 0);

  const parts: string[] = [];
  // While it runs, the count is a progress report; once it stops, it is a shape.
  if (found > 0) parts.push(`${found} finding${found === 1 ? "" : "s"}`);
  if (checked > 0) parts.push(`${checked} check${checked === 1 ? "" : "s"}`);
  if (warned > 0) parts.push(`${warned} problem${warned === 1 ? "" : "s"}`);
  if (parts.length === 0) parts.push(`${steps.length} step${steps.length === 1 ? "" : "s"}`);
  if (total > 0 && !opts.running) parts.push(`${Math.round(total / 100) / 10}s`);

  return parts.join(" · ");
}

/** The pass a step belongs to, said the way a person would say it. */
export const PASS_LABEL: Record<string, string> = {
  extract: "reading the plan",
  hidden: "what it doesn't say",
  premortem: "how it fails",
  score: "scoring",
  evidence: "sources",
  tests: "cheapest tests",
};

/**
 * Whether the panel should still be open.
 *
 * It opens while the model is thinking and closes when the answer arrives —
 * that is the whole behaviour being asked for: a panel that streams its thinking,
 * collapses into a summary, then reveals the final answer. `null` means nobody
 * has touched it, so the default applies.
 */
export function shouldBeOpen(override: boolean | null, running: boolean): boolean {
  return override ?? running;
}
