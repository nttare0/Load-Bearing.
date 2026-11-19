import { DEMO_PLAN_TEXT } from "@/lib/demo";

/**
 * Worked examples, as data.
 *
 * These lived inside PlanInput.tsx, a component that was imported nowhere, so
 * the empty state offered a blank box and a twelve-word tagline. They are here
 * now because the first screen needs them and a component is the wrong place for
 * content: one click fills the composer, which is the cheapest possible way to
 * answer "what kind of thing do I paste?".
 *
 * Three shapes on purpose — a product, a price change, an argument — because the
 * tool is not only for startups, and showing that beats saying it.
 */
export const EXAMPLES: { label: string; hint: string; text: string }[] = [
  {
    label: "A product",
    hint: "A subscription app for freelancers",
    text: DEMO_PLAN_TEXT,
  },
  {
    label: "A price change",
    hint: "Per-seat pricing that becomes per-workspace",
    text: `We're moving our project-management tool from $12 per seat to $29 per workspace, unlimited seats.

Most of our customers have between 2 and 4 seats, so for them this is roughly a 40% price drop. The ones on 8+ seats get a much bigger bill, but those are only about 12% of accounts.

We think the smaller accounts will upgrade immediately, and the big ones will grumble but stay because migrating a workspace is painful. Support will handle the complaints in a week or two. If this works, revenue per account should roughly double.`,
  },
  {
    label: "An argument",
    hint: "Convert empty offices into housing",
    text: `Remote work has permanently reduced demand for downtown office space, and cities should convert it to housing.

Three years of occupancy data show downtown office vacancy above 18% in most large US cities, and tenants are renewing for less space than before. Companies have already invested in remote tooling and their employees do not want to return five days a week. Landlords will accept conversion because an empty building costs money.

Conversion is expensive but the buildings are structurally suitable, and cities can speed it up by loosening zoning. The main thing we would need is a tax incentive, which pays for itself through the new residents.`,
  },
];
