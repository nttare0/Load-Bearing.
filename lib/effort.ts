/**
 * Hold-to-think, mapped onto something the model actually receives.
 *
 * The composer's prompt box climbs Quick → Think → Think deeply while the send
 * button is held. Those names are the UI's; Gemini's are low/medium/high. This
 * is the only place that knows both, so a typo in either cannot silently turn
 * "Think deeply" into the default.
 */

export const EFFORTS = ["quick", "think", "deep"] as const;
export type Effort = (typeof EFFORTS)[number];

export function isEffort(value: unknown): value is Effort {
  return typeof value === "string" && (EFFORTS as readonly string[]).includes(value);
}

/**
 * The thinking level for an effort, or `undefined` when the request carried no
 * recognised effort — in which case the environment default applies, which is
 * the behaviour every other caller already relied on.
 */
export function thinkingFor(effort: unknown): "low" | "medium" | "high" | undefined {
  if (!isEffort(effort)) return undefined;
  if (effort === "deep") return "high";
  if (effort === "think") return "medium";
  return "low";
}
