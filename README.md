# Load-Bearing

**Find the assumptions your plan quietly depends on.**

In a building, the load-bearing wall is the one holding up everything above it. You can knock out an ordinary
wall and nothing happens; remove a load-bearing one and the structure comes down. Plans work the same way — a
few claims carry most of the weight, and most of them are never written down, so nobody checks them until
something collapses.

Paste a plan, an idea, a design decision, or an argument. Load-Bearing pulls out the claims the whole thing
depends on, ranks them by **how much collapses if each one is wrong**, and shows the cheapest way to test each
one before you spend months building.

---

## What it actually does

| Step | What happens |
| --- | --- |
| **1. Input** | Paste text, upload a PDF/DOCX/Markdown/TXT file, or pull the text of a URL. |
| **2. Extract** | The claims the plan states, each with a verbatim quote. |
| **3. Hidden assumptions** | What must be true that the author never wrote down. Marked `implied`. |
| **4. Pre-mortem** | "It's a year from now and this failed" — each failure mapped back to the claim it is really about. |
| **5. Score** | `impact 1–5 × uncertainty`, on a fixed rubric, with a second independent scoring run that flags disagreement. |
| **6. Evidence** | Claims tagged verifiable get checked against real web sources. A `fact` label requires a URL. |
| **7. Tests** | The cheapest *disproof* for the top 6 claims: cost, time, the number that means proceed, the number that means stop. |
| **8. Export** | Markdown, PDF, JSON, or a share link. Reports are read bottom-up on the dependency map. |

## The five AI passes

Rather than one giant prompt, the pipeline runs focused passes. Single-job passes are easier to check, easier
to fix, and easier to trust.

1. **Extraction** — what claims does the text state? Quote each one.
2. **Hidden assumptions** — what must be true for this to work that nobody said? *(the most valuable pass)*
3. **Pre-mortem** — imagine it failed in a year, list why, map each reason back to a claim.
4. **Scoring** — apply the fixed rubric again, independently, to catch drift.
5. **Test design** — cheapest disproof, top claims only.

Prompts live in [`lib/prompts.ts`](lib/prompts.ts). They are short enough to read in a sitting, on purpose.

## Safeguards

- **No invented evidence.** Search runs only on claims tagged `verifiable`, and every returned URL is checked
  against the URLs the search actually produced. A claim labelled `fact` or `contradicted` with no URL behind
  it is downgraded to `unverified`, and the report says so.
- **Steadier scoring.** A fixed rubric in [`lib/score.ts`](lib/score.ts), results shown in **bands**
  (load-bearing / structural / light) instead of false precision, and two scoring runs that surface
  disagreement instead of averaging it away.
- **Privacy.** Nothing is stored unless you tick **"Keep this analysis"**. There is a delete button next to
  every saved report, and the input box states plainly what is sent to the model.
- **Honest failure.** If web search is unavailable on the key, or a pass fails, the report says which part is
  missing rather than filling the gap.

## The claim schema

One record per claim — this is the whole data model ([`lib/schema.ts`](lib/schema.ts)):

```ts
{
  ref, claim, source,          // source is a quote, or the word "implied"
  category,                    // market | technical | behavioral | financial | external dependency | timing
  status,                      // fact | guess | unverified | contradicted
  impact,                      // 1-5: how much breaks if this is wrong
  confidence,                  // low | medium | high
  dependsOn,                   // refs this claim relies on — the dependency map
  verifiable,                  // could a public source settle it?
  reasoning,                   // why it scored what it scored
  evidence[],                  // sources with URLs, each marked supports/contradicts/inconclusive
  test                         // method, cost, time, confirms, breaks
}
```

Zod validates the model's output against this schema before anything reaches the screen. If the model returns
`impact: "high"` instead of a number, the pass is retried with the validation error attached.

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Visual system | **tiny office**'s design language | IBM Plex (Sans / Serif wordmark / Mono figures), near-white page with white cards, one hairline, one indigo accent, 8px radii, one soft shadow. Tokens transcribed from `tiny-office/src/styles/tokens.css`. |
| UI | **shadcn/ui** (`new-york` style, Tailwind 4, CSS variables) | Card, Badge, Button, Tabs, Accordion, Textarea, Input, Skeleton, Sonner — vendored into `components/ui/`, owned by this repo. |
| Frontend | Next.js 16 (App Router) + React 19 + Tailwind 4 | One deploy to Vercel. |
| Graph | React Flow (`@xyflow/react`) | Interactive dependency map, layered bottom-up by hand. |
| Backend | Next.js route handlers, streaming SSE | `/api/analyze` runs the passes and streams claims as they validate. |
| AI | Claude via `@anthropic-ai/sdk`, structured outputs | `zodOutputFormat` guarantees schema-valid JSON or a retry. |
| Validation | Zod 4 | The gate between the model and the UI. |
| Evidence | Claude web search tool | Real citations, checked against URLs actually returned. |
| Storage | `localStorage` by default, Supabase when configured | No accounts needed to use it; saved reports get share links. |
| Export | `jspdf` (dynamic import) + Markdown/JSON | PDF is generated in the browser, never on the server. |

## Run it

```bash
npm install
cp .env.example .env.local     # optional — see below
npm run dev
```

Open <http://localhost:3000>.

**With no `ANTHROPIC_API_KEY`** the app runs in **demo mode**: the worked example from the build plan (the
$9/month budgeting app) streams through the real pipeline shape, and the UI is fully clickable. Nothing is
faked as if it were your analysis — the report says demo mode in its notes.

**With a key**, your own text is analysed for real.

### Environment

```bash
ANTHROPIC_API_KEY=            # required for live analysis
ANTHROPIC_MODEL=              # optional, defaults to claude-sonnet-4-6

SUPABASE_URL=                 # optional: enables saved reports + share links
SUPABASE_SERVICE_ROLE_KEY=    # server-side only, never exposed to the browser
```

Storage is optional. Run [`supabase/schema.sql`](supabase/schema.sql) once in the Supabase SQL editor to create
the `analyses` table. With RLS enabled and no client policies, only the server can read or write it. If the
Supabase host is unreachable, the app reports `"storage": "local"` from `/api/health` and keeps working on
`localStorage` rather than failing the analysis.

## Look and feel

The interface follows **[tiny office](https://tiny-office-smoky.vercel.app/)** (`github.com/nttare0/tiny-office`),
the same author's other app, so the two read as one family:

- **Type** — IBM Plex throughout: Sans for the interface, **Serif for the wordmark and report titles** (regular
  weight, never large), Mono for figures, keys and refs. The `.woff2` files and their SIL OFL licence are copied
  into `public/fonts/`; nothing is fetched from another host.
- **Colour** — a near-white page (`hsl(0 0% 97.5%)`) carrying pure-white cards, `hsl(240 4.9% 83.9%)` hairlines,
  and a single accent: indigo `hsl(243.4 75.4% 58.6%)`. Load-Bearing adds colour for exactly one reason — the
  three bands (load-bearing / structural / light partition) and the four status labels — each with a soft tint
  for badge fills. Everything else is one of three greys.
- **Shape** — `0.5rem` radii, one 1px border, one shallow shadow (`0 1px 0.125rem hsl(240 3.8% 46.1% / 12%)`),
  and the hover recipe from tiny office's app cards: the border turns the accent and gains a 1px accent ring.
- **Layout** — tiny office's column: `--to-max-w` (67.5rem) with `--to-gutter` insets, shared by the header and
  the body so the wordmark stands on the first letter of the first card. A `3.5rem` nav bar with a hairline under
  it; section headings set the way its drawer headings are (0.75rem, semibold, tracked out, quiet grey).
- **Type scale** — rem/em only, no px sizes, as tiny office's `test/stylesheets.test.ts` enforces across its own
  sheets: 0.6875–0.75rem for labels and figures, 0.8125rem body in cards, 0.9375rem for the plan input and
  summaries, 1.375–1.875rem for the wordmark and page title.
- **Voice** — labels, not paragraphs. The interface explains itself with short headings ("The plan", "Ranked by
  impact × uncertainty", "First sign") rather than sentences of guidance; the legend is the four badges alone.
- **Dark mode** — transcribed from tiny office too (page darker than panels, visible 3:1 edges, lighter accent
  with dark words on it). `.dark` on `<html>`; not yet wired to a toggle.

Tiny office's own token names (`--to-bg`, `--to-surface`, `--to-ink`, `--to-accent`, `--to-radius`,
`--to-shadow`, `--to-font-serif`…) are declared in `app/globals.css` and used directly, so its conventions read
straight across. shadcn's component contract (`--background`, `--card`, `--primary`, `--border`, `--radius`…)
points at those same values, which is why the vendored components work untouched.

## shadcn/ui

Components come from [shadcn/ui](https://ui.shadcn.com/) — the `new-york` style on Tailwind 4 with CSS variables.
They are **vendored source, not a dependency**: `components/ui/*` are the upstream files (fetched from
`shadcn-ui/ui` at `apps/v4/registry/new-york-v4/ui`), with one deliberate change each: `cn` imports from
`@/lib/utils`, and `Badge` gains Load-Bearing variants (`fact`, `guess`, `unverified`, `contradicted`, `load`,
`structural`, `light`).

Add more the normal way:

```bash
npx shadcn@latest add dialog dropdown-menu   # any registry item
```

`components.json` wires the CLI to this project (`css: app/globals.css`, `utils: @/lib/utils`, `ui: @/components/ui`).
The theme lives in `app/globals.css` under the standard `--background / --foreground / --card / --primary /
--muted-foreground / --border / --ring / --radius` contract, which is why upstream components work untouched.
Load-Bearing keeps its own ink-on-paper palette in those slots, plus three band colours for
load-bearing / structural / light partitions.

## Charts

The priority chart is [Bklit UI](https://bklit.com/) — MIT, by [uixmat](https://github.com/uixmat/bklit-ui).
`components/charts/*` is Bklit's own registry output, vendored the same way as shadcn: `bar-chart` plus its
nine registry dependencies (`chart-context`, `chart-tooltip`, `chart-animation`, `chart-utils`, `grid`,
`chart-parent-size`, `patterns`, `gradients`), resolved from its `packages/ui/registry.json` rather than
guessed at. Its licence sits next to the files in `components/charts/LICENSE`.

Nothing in those files was rewritten. The palette they read is the point of the exercise: Bklit's
`--chart-*` contract is mapped onto tokens this page already had, so the bars carry the three bands
(`--chart-1/2/3` → `--lb-load/structural/light`), the grid is the page hairline, and the tooltip is the
popover. Light and dark are both wired in `app/globals.css`.

Install again with the registry, unchanged:

```bash
npx shadcn@latest add @bklit/bar-chart   # after adding "@bklit": "https://ui.bklit.com/r/{name}.json"
```

## A plan, and its runs

A report used to be the end of the road: analyse, read, act, forget. A plan is
the durable thing; a run is one reading of it. So the same plan analysed again
is not a second report — it is a comparison.

**Claims carry a stable key** (`lib/diff.ts`): their statement, normalised so
wording changes ("Founders will pay for a clearer view…" / "founders pay for
clearer view…") land on the same key. When a later run produces a claim with the
same key, it is the same assumption being read again, not a new one — and it
**inherits its test result**. Re-running never throws away work you already did.

**The diff leads with what moved,** and only that:

- *Settled* — a test result arrived since the last run
- *Moved* — same assumption, different band or weight
- *New* / *Gone* — this run added or dropped it
- unchanged claims are counted and hidden behind "Show all", because a diff that
  flags everything is a diff nobody reads

If nothing moved, it says so: **"Nothing moved. All 7 assumptions are exactly as
unproven as they were last run."** That is the most useful sentence the app can
produce, and the least flattering.

Plans live in `lib/plans.ts` (browser storage, like workspaces). The server still
stores single analyses and knows nothing about plan identity — a shared link
shows one run, not a history the reader cannot verify.

## Two providers, one interface

`lib/ai.ts` exposes one `structuredPass` and one `prose` call. Behind them sit
Claude and Gemini, and the app picks:

- **Claude** when `ANTHROPIC_API_KEY` is set — it stays the default, because the
  pipeline's prompts and its web-search pass were written against it.
- **Gemini** when that is the only key — `GEMINI_API_KEY` (or
  `GOOGLE_GENERATIVE_AI_API_KEY` / `GOOGLE_API_KEY`), over Gemini's REST API with
  no extra SDK. Schema-constrained output uses `responseJsonSchema` from
  `z.toJSONSchema`, so the same Zod schemas gate both providers. Temperature is
  held at 0.2 for the extraction and scoring passes: the same plan should read
  the same way twice. The model list starts at `gemini-3.8-flash`; the 2.x line
  is retired for accounts created recently and answers with "no longer
  available to new users" rather than a 404, so it is not offered as a fallback.

`GOOGLE_CLOUD_PROJECT` is **not a credential** — it names the Google Cloud
project a key belongs to. `/api/health` reports it (`provider`, `model`,
`project`) so a key that belongs to the wrong project is a one-request diagnosis
instead of a mystery.

**One honest gap:** Gemini is not given a web-search tool here, so when Gemini is
the provider the evidence pass returns nothing and says so — every claim stays
`unverified` rather than receiving a citation nobody opened. Run on Claude if you
want the web check.

## One workspace, one thread

The page has **no header**. A question in serif, a composer under it, and one
small control in the top-left that opens the workspace panel. Identity is inside
that panel (the wordmark lives there, and as a mark top-right), so the canvas is
never divided by a navigation bar.

The workspace panel is a **drawer**, closed by default: a rail pinned to the left
of every screen is chrome you pay for whether or not you are using it. Click the
toggle (or press Escape to close) and it slides over the canvas. Picking a
workspace closes it again.

The composer keeps its position whether the workspace is empty or full, so
starting work never moves the thing you are typing into. A workspace owns its
plans, the reports they produced and the questions asked about them.

**Two verbs, one box.** A short message that asks something is answered; anything
else is analysed. The verb is a control in the composer — click it to switch a
question into a plan — and never a silent guess.

`POST /api/ask` is deliberately read-only. It is handed a summary of the
workspace's reports and can only answer in prose: it cannot add a claim, change a
score or record a test. Claims only ever come from the five-pass pipeline,
because a claim has to arrive with a quote, a score and a test. An answer is not
evidence, and each one says so underneath, along with what it looked at.

Without `ANTHROPIC_API_KEY`, research answers are composed from the report data
itself — no model, and it says so rather than pretending.

## Testing a claim closes the loop

A report is the start, not the answer. Every claim already carries the cheapest
test that could kill it, with a stated *stop if* condition — so the app treats
that condition as a commitment rather than a suggestion.

When you run the test, record what happened (**Holds / Broken / Unclear**). The
result is written onto the claim itself, which means:

- **It travels.** A shared link shows `tested · broken` and the date. Before this,
  marks lived in one browser's state, so whoever you sent the link to saw an
  untested report.
- **It is summarised, not buried.** *What you learned* sits at the top of the
  report and in every export: how many claims are settled, and — if anything
  broke — the broken claims named, each beside the stop condition you wrote.
- **The verdict is honest about incompleteness.** Nothing tested says so. A clean
  run that still leaves load-bearing claims unchecked says that too, rather than
  congratulating you.
- **The graph agrees.** Untested nodes are dashed; tested nodes carry their result.

The summary is derived from the claims every time (`lib/progress.ts`), never
stored, so the owner's view, the shared link and the Markdown export cannot
disagree.

## Tests

```bash
npm test        # node:test via tsx — 8 tests, no test framework dependency
```

They cover the two rules that would make this app dishonest if they broke: a
claim cannot be called a fact without an evidence URL, and a report cannot hide
what the user found. Plus the band thresholds and the ranking's cleanup of
dangling dependencies.

## Project layout

```
app/
  page.tsx              the shell: rail, thread, composer
  r/[id]/page.tsx       read-only shared report
  api/analyze           the five-pass pipeline, streamed as SSE
  api/ask               read-only research over the workspace's reports
  api/analysis          save / load / delete / record a test outcome
  api/extract           PDF, DOCX, Markdown, text and URL extraction
  api/health            which capabilities are actually configured
lib/
  gemini.ts             Gemini over REST: schema-constrained + prose calls
  workspace.ts          workspaces, threads and their storage
  plans.ts              a plan and its runs, so re-analysis can be compared
  diff.ts               stable claim keys + what moved between two runs
  progress.ts           what the recorded tests actually settled (derived)
  prompts.ts            the five pass prompts + the rubric in prose
  schema.ts             Zod claim schemas + pipeline event types
  score.ts              the rubric in code: priority, bands, reconciliation
  evidence.ts           web search, URL verification, no-invented-citations rules
  pipeline.ts           orchestration, streaming, and failure handling
  extract.ts            dependency-free PDF/DOCX/HTML text extraction
  store.ts              localStorage-first storage, Supabase when available
components/
  WorkspacePanel        the drawer: workspaces, opened from the top-left
  Thread                the conversation, reports set in place
  Composer              paste to analyse, ask to research
  BeamToggle            the one piece of chrome, top-right
  ClaimCard             one claim, its quote, its evidence, its test
  DependencyGraph       React Flow map, layered by dependency depth
  PriorityChart         the ranking, drawn with Bklit's bar chart
  RunDiff               what moved since the previous run of this plan
  ProgressPanel         "what you learned" — coverage, broken claims, verdict
  Report                tabs, counts, exports, pre-mortem
  PlanInput             paste / upload / URL
  charts/               Bklit UI, vendored (see Charts)
tests/rules.test.ts     the honesty rules, as tests
supabase/schema.sql     the one table
```

## What is deliberately not here

- **No accounts.** The plan's v1 has none, and none are needed to get a useful report.
- **No Reddit integration.** The build plan flags Reddit's API terms as unstable, so the equivalent workflow
  is "paste the thread in", which works today and has no rate limit.
- **No saved analyses by default.** You have to ask. That is the privacy safeguard, not an oversight.

## Ideas that would earn their place (v3)

Save analyses and mark assumptions as **tested over time**, so the plan updates as reality comes in. The
`recordOutcome` path in `lib/store.ts` and the Holds / Broken / Unclear buttons on a preserved report are the
first half of that: a confirmed claim becomes a `fact`, a broken one becomes `contradicted`, and the ranking
re-sorts around what you have actually learned.
