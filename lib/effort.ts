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

/**
 * The three levels said in the two ways a person needs them: what it is called,
 * and what it costs. "Think deeply" on its own is a mood; "high · slower" is a
 * trade. Both are shown together wherever the level is picked.
 */
export const THINKING: Record<Effort, { label: string; hint: string; cost: string; detail: string }> = {
  quick: {
    label: "Quick",
    hint: "low",
    cost: "fastest",
    detail: "Low thinking. Cheapest and quickest — best when the plan is short and plain.",
  },
  think: {
    label: "Think",
    hint: "medium",
    cost: "balanced",
    detail: "Medium thinking. Slower, and picks up more of what the plan does not say.",
  },
  deep: {
    label: "Deep",
    hint: "high",
    cost: "slower",
    detail: "High thinking. Slowest and most expensive — for plans where being wrong is expensive.",
  },
};

export const DEFAULT_EFFORT: Effort = "quick";
