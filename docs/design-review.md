# A design review of Load-Bearing

*Written after building, so every claim here can be checked against a diff.*

The brief was to argue that the interface is designed wrong, then fix what the
argument proved. Three of the six failures below were things I had built myself
in earlier rounds, which is the useful kind of finding — the interface drifted
toward looking like a good agent product instead of behaving like this one.

---

## What was wrong

### 1. The core object was invisible

`Report` had five tabs: *Ranked list · Dependency map · Pre-mortem · Simulate ·
Report text*. The ranked list of assumptions — the entire output of the product —
sat behind one tab, as a **peer** of four others. A newcomer had five equal
choices and no way to know which one was the answer.

Worse, **the answer in one sentence existed nowhere.** The top claim's reasoning
was inside its card, below three badges and an impact meter. Nothing said *"this
plan is standing on X, and here is the 200,000 RWF test."* That sentence *is* the
product.

### 2. The first run lied about what it would do

The empty state said *"What would you like to test?"* over a bare box. Nothing
said what kind of text was expected, what came back, or how long it took.

`components/PlanInput.tsx` contained three worked examples and a file/URL
picker and was **imported by nothing** — dead code since the shell rebuild. So
the only on-ramp was inventing a plan yourself on the strength of a twelve-word
tagline.

### 3. Demo mode was silent about being demo

With no key, every run returns the same authored example. The interface said so
in 9px grey text in a footer strip, using the word "demo" — while the report it
produced looked exactly like a real analysis of the plan you pasted. Paste a
Kigali meal-prep plan, get a report about freelancer banking, with the disclosure
smaller than the badges.

### 4. The reading order of a claim was inverted

Header: `#rank · status · category · score · impact meter · priority ·
impact × confidence · audit`. Then dependencies, then reasoning, then evidence,
then a **collapsed** test.

Eight pieces of metadata before the finding, and the only actionable part —
the test — behind a click at the bottom. Someone who wanted to know what to *do*
had to read past a dashboard to find an instruction.

### 5. Nothing in the main column had a ceiling

The composer rendered after the entire thread: `Thread → Report → verdict →
checksum → notes → six claim cards → composer`. About four screens of scrolling
to reach the box you type in, on a page whose whole loop is *paste, read, react*.

### 6. Two of five tabs were decoration

*Simulate* calls MiroFish, gated behind `MIROFISH_BASE_URL` and
`MIROFISH_RESEARCH=1` — never set, so the tab could only ever say "not enabled".
*Report text* duplicated the Markdown download already in the header.

---

## What changed

| Failure | Change | Where |
|---|---|---|
| Answer invisible | **Short answer banner** above every tab: the top claim in one derived sentence, its band, its cheapest test, and a link to the claim. | `lib/verdict.ts`, `components/VerdictBanner.tsx` |
| Five peer tabs | **Ranked list un-tabbed** — it is the page. Graph, pre-mortem and report text fold into one *Other views* disclosure. Default tab no longer exists. | `components/Report.tsx` |
| First run opaque | Empty state says what to paste and what comes back, and offers **three one-click example plans** (a product, a price change, an argument). | `lib/examples.ts`, `ThreadWorkspace.tsx`, `Composer.tsx` |
| Demo silent | **Demo notice at sentence size**, above the composer and above the thread: every run returns the same worked example, not your plan. | `ThreadWorkspace.tsx` |
| Claim order inverted | Finding first; **test open by default**; scoring detail (`band · impact × confidence · audit · category`) collapsed into one muted footer line. | `components/ClaimCard.tsx` |
| Composer unreachable | **Sticky composer** at the bottom of the column. | `ThreadWorkspace.tsx` |
| Dead surfaces | *Simulate* only renders when `/api/health` reports `skills.mirofish`. PlanInput's examples deleted from it and moved to `lib/examples.ts`. | `api/health`, `Report.tsx` |

### Two bugs the new tests caught

1. **The headline depended on array order.** With two claims at equal priority,
   `verdictOf` returned whichever came first — so reordering the array changed
   the product's headline sentence. Now ties break on ref.
2. **The empty-report headline was too soft.** *"This run produced no claims, so
   it has nothing to tell you"* reads as neutral. It now says it is a failure of
   the run, not a clean bill of health.

Both are in `tests/verdict.test.ts`, alongside: the headline names the
highest-priority claim; it quotes the claim's own words; a claim with no test
says "no test yet" rather than inventing one; an untouched report is marked as
such.

---

## What is still wrong

Honest backlog, ordered by how much it costs the user.

1. **The report is still one long scroll.** Six claims is six cards; there is no
   way to see them side by side, and no way to work through them in order. A
   "next untested" control — one button that jumps to the highest-priority
   untested claim — would turn this from a document into a checklist.
2. **Nothing persists across devices.** Workspaces, folders and reports are
   localStorage only. `/api/health` reports `storage: local`, the connectors card
   admits it, and that is the whole honesty mechanism. Supabase sync is the
   single biggest missing feature.
3. **No mobile layout.** The rail hides below `md` with no way to open it, so on
   a phone there are no files and no workspace switching at all.
4. **`RecordOutcome` has no loop.** You can mark a claim holds or breaks, and
   nothing downstream changes: reruns don't know what you learned, and the
   priority score ignores outcomes.
5. **Search is local and dumb.** It matches substrings across the current
   workspace's name and file titles. It does not search report contents, and
   there is no command palette.
6. **The graph is inert.** `DependencyGraph` renders and scrolls to a claim on
   click; it cannot be rearranged, filtered, or used to spot a cluster.
7. **No keyboard path.** Everything is a mouse target. No `⌘K`, no `j/k`
   between claims, no shortcut to the composer.
8. **`PlanInput` is still dead code.** Its examples moved out; the component
   itself still has the only file/URL import path in the codebase, which the
   composer's paperclip does not fully replace. Either wire it or delete it.
9. **Demo mode has no timings.** The `passes` array is absent from the demo
   `done` event, so the trace never renders without a key.
10. **PDF is print-CSS.** Adequate, not good.
