import type { Analysis, Claim } from "./schema";
import { priorityOf } from "./score";

/**
 * The worked example from the build plan, used when no API key is configured.
 * It is authored content, not model output, and is labelled as such in the UI.
 */

const PLAN = `Freelancers struggle to budget irregular income, so they will pay for an app that fixes it.

I'm building a $9/month budgeting app for freelancers. You connect your bank account, it predicts next month's income from your invoice history, and it tells you what you can safely spend this week.

Freelancers talk about this problem constantly in the communities I'm in, so I think this is a $9/month product with low churn. I'll launch it with a Product Hunt post and a few Reddit threads.`;

type Seed = {
  ref: string;
  claim: string;
  source: string;
  category: Claim["category"];
  status: Claim["status"];
  impact: number;
  confidence: Claim["confidence"];
  dependsOn: string[];
  verifiable: boolean;
  reasoning: string;
  test: Claim["test"];
};

const SEEDS: Seed[] = [
  {
    ref: "C1",
    claim:
      "Freelancers will connect a bank account to an app they just discovered, run by someone they have never heard of.",
    source: "implied",
    category: "behavioral",
    status: "guess",
    impact: 5,
    confidence: "low",
    dependsOn: ["C2"],
    verifiable: false,
    reasoning:
      "The plan says users connect their bank; it never says why a stranger would be trusted with read access to their finances. Without this the product has no data and no product.",
    test: {
      method:
        "Show 20 freelancers the real Plaid connect screen inside a prototype and ask them to finish linking. Count how many reach the end. Recruit from two r/freelance threads and three people in your network.",
      cost: "$0, 3 hours",
      time: "1 week",
      confirms: "At least 8 of 20 complete the link without being paid.",
      breaks: "Fewer than 4 of 20 finish, or most ask for a demo account instead.",
    },
  },
  {
    ref: "C2",
    claim: "The pain of irregular income is strong enough that freelancers pay $9/month for it, rather than track it in a spreadsheet.",
    source: "Freelancers struggle to budget irregular income, so they will pay for an app that fixes it.",
    category: "market",
    status: "guess",
    impact: 5,
    confidence: "low",
    dependsOn: [],
    verifiable: false,
    reasoning:
      "The plan asserts willingness to pay from the existence of the problem. Feeling a problem and paying to fix it are different claims, and the free spreadsheet alternative is strong.",
    test: {
      method:
        "One-page landing page with the real price and a $9 pre-order button. Send it to 200 freelancers from two communities. Money is the only signal that counts.",
      cost: "$0-20, 4 hours",
      time: "1 week",
      confirms: "5 or more pre-orders at $9, or 3 people who ask to pay early.",
      breaks: "Zero pre-orders and fewer than 10 email sign-ups from 200 visitors.",
    },
  },
  {
    ref: "C3",
    claim:
      "A bank-data provider will stay available at a price where a $9/month subscription is still profitable.",
    source: "implied",
    category: "external dependency",
    status: "unverified",
    impact: 5,
    confidence: "low",
    dependsOn: [],
    verifiable: true,
    reasoning:
      "Bank connectivity is the whole product and it is entirely someone else's business decision. Per-item pricing, minimums and free tiers in this market move often.",
    test: {
      method:
        "Read the current pricing and terms pages of two bank-data providers (e.g. Plaid, Teller) and price out 1,000 connected users at $9/month revenue.",
      cost: "$0, 2 hours",
      time: "Same day",
      confirms: "Modelled cost per user is under $1.50/month with no annual minimum you cannot meet.",
      breaks: "Minimum contracts, per-refresh fees, or a cost per user above $3 at 1,000 users.",
    },
  },
  {
    ref: "C4",
    claim: "Churn stays low after the first month, once the initial curiosity wears off.",
    source: "I think this is a $9/month product with low churn.",
    category: "financial",
    status: "guess",
    impact: 4,
    confidence: "low",
    dependsOn: ["C1", "C2"],
    verifiable: false,
    reasoning:
      "Budgeting is seasonal and low-frequency: the value shows up once a month, which is exactly when people cancel subscriptions they forgot about.",
    test: {
      method:
        "Run a 30-day concierge version with 10 paying users where you send the weekly number by email yourself. Measure how many open it in week four.",
      cost: "$0, 2 hours/week",
      time: "4 weeks",
      confirms: "7 of 10 still open the weekly email in week four.",
      breaks: "Fewer than 4 of 10 open it by week three.",
    },
  },
  {
    ref: "C5",
    claim: "A single Product Hunt post plus a few Reddit threads is enough distribution to reach the first 1,000 users.",
    source: "I'll launch it with a Product Hunt post and a few Reddit threads.",
    category: "market",
    status: "guess",
    impact: 3,
    confidence: "low",
    dependsOn: ["C2"],
    verifiable: false,
    reasoning:
      "Launch spikes decay within days and many subreddits treat self-promotion as spam. The plan names channels but has no repeatable one.",
    test: {
      method:
        "Post one genuinely useful breakdown of freelancer income data in two relevant subreddits with no product link, and read the rules first. Count replies that ask how you made it.",
      cost: "$0, 2 hours",
      time: "3 days",
      confirms: "20+ comments and at least 5 people asking for the tool.",
      breaks: "Post removed, or under 5 comments across both threads.",
    },
  },
  {
    ref: "C6",
    claim: "A predicted next-month income figure is accurate enough that people trust the safe-to-spend number it produces.",
    source: "implied",
    category: "technical",
    status: "guess",
    impact: 4,
    confidence: "medium",
    dependsOn: ["C1"],
    verifiable: false,
    reasoning:
      "The product's value is a number being right. A forecast that is off by 30% in the first month teaches users to ignore it permanently.",
    test: {
      method:
        "Backtest the forecast on 6 months of your own invoices, then on two freelancers' histories. Compare predicted vs actual income per month.",
      cost: "$0, 4 hours",
      time: "2 days",
      confirms: "Median error under 15% across 18 monthly forecasts.",
      breaks: "Median error over 30%, or error worst in the months income drops.",
    },
  },
  {
    ref: "C7",
    claim: "Payment processing and support costs leave real margin at $9/month.",
    source: "implied",
    category: "financial",
    status: "guess",
    impact: 3,
    confidence: "medium",
    dependsOn: ["C2", "C3"],
    verifiable: true,
    reasoning:
      "A $9 subscription pays roughly $8.40 after card fees, before bank data, hosting and any human support. Support-heavy users can cost more than they pay.",
    test: {
      method:
        "Write the unit economics on one page: card fees, bank-data cost, hosting, and 15 minutes of support per user per month at your own hourly rate.",
      cost: "$0, 1 hour",
      time: "Same day",
      confirms: "Contribution margin above 60% at 1,000 users.",
      breaks: "Support plus data costs above $4/user, or margin under 30%.",
    },
  },
];

export function demoAnalysis(): Analysis {
  const claims: Claim[] = SEEDS.map((seed, i) => ({
    ...seed,
    id: `${seed.ref.toLowerCase()}-demo`,
    rank: i + 1,
    priority: priorityOf(seed.impact, seed.confidence),
    evidence: [],
  }))
    .sort((a, b) => b.priority - a.priority)
    .map((c, i) => ({ ...c, rank: i + 1 }));

  return {
    id: "demo-budgeting-app",
    title: "A $9/month budgeting app for freelancers",
    summary:
      "A solo freelancer wants to launch a $9/month app that predicts irregular income from invoice history and tells freelancers what they can safely spend. The plan rests on trust, willingness to pay, and a bank-data provider's pricing all holding at once.",
    createdAt: new Date().toISOString(),
    input: PLAN,
    claims,
    failureModes: [
      {
        scenario:
          "Sign-ups looked healthy, but most people stopped at the bank-linking screen and never saw the product work. The ones who did link drifted away after the second month because the forecast was wrong twice.",
        claimRef: "C1",
        likelihood: "high",
        earlyWarning: "Connect-screen drop-off above 70% in your first 20 trials.",
      },
      {
        scenario:
          "The bank-data provider introduced a minimum monthly commitment that only makes sense above 500 users, so the app was pulled before it reached that scale.",
        claimRef: "C3",
        likelihood: "medium",
        earlyWarning: "A pricing page change, or a sales email mentioning an annual minimum.",
      },
      {
        scenario:
          "Launch week produced 400 sign-ups and 12 payments. Three weeks later the subreddits had moved on and there was no channel left, so growth stopped at $108/month.",
        claimRef: "C5",
        likelihood: "high",
        earlyWarning: "Day-7 traffic falling below 5% of launch-day traffic.",
      },
    ],
    notes: [
      "Demo mode: no ANTHROPIC_API_KEY configured, so this is the worked example from the build plan rather than an analysis of your text.",
    ],
  };
}

export const DEMO_PLAN_TEXT = PLAN;
