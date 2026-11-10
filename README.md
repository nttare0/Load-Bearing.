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

## Project layout

```
app/
  page.tsx              input + streamed results
  r/[id]/page.tsx       read-only shared report
  api/analyze           the five-pass pipeline, streamed as SSE
  api/analysis          save / load / delete / record a test outcome
  api/extract           PDF, DOCX, Markdown, text and URL extraction
  api/health            which capabilities are actually configured
lib/
  prompts.ts            the five pass prompts + the rubric in prose
  schema.ts             Zod claim schemas + pipeline event types
  score.ts              the rubric in code: priority, bands, reconciliation
  evidence.ts           web search, URL verification, no-invented-citations rules
  pipeline.ts           orchestration, streaming, and failure handling
  extract.ts            dependency-free PDF/DOCX/HTML text extraction
  store.ts              localStorage-first storage, Supabase when available
components/
  ClaimCard             one claim, its quote, its evidence, its test
  DependencyGraph       React Flow map, layered by dependency depth
  Report                tabs, counts, exports, pre-mortem
  PlanInput             paste / upload / URL
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
