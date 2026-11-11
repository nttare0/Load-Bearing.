# Borrowed from rakazo

No code was merged from [chrisware/rakazo](https://github.com/chrisware/rakazo). It is a
Docker + Postgres + sandbox-supervisor agent monorepo; this is a Next.js app on Vercel.
The trees cannot be merged, and the ideas had to be reimplemented in this app's own language
rather than ported.

This file records what was taken, from where, and what was deliberately not.

## Taken

### 1. Tool-activity disclosure → `components/PassTrace.tsx`

`apps/web/src/components/ToolActivityDisclosure.tsx` treats a run as a **sequence of steps with
durations**, not a spinner: `Working… · 3 tools` while live, `Done · 3 tools · 1.2s` after, with the
steps behind a disclosure. `LIVE_TOOL_STEP_WINDOW` keeps a long run from pushing the chat down.

Here, the pipeline's passes are now timed (`lib/pipeline.ts`) and carried on the turn
(`Message.passes`). The report row reads `12 claims · run 1 · 17s`, the trace is a small bar whose
segments are **width-proportional to time spent**, and the slowest pass is the one drawn darkest.
Deliberately quieter than the original: no shimmer, no motion.

### 2. Live progress in the thread → `ThreadWorkspace`

While a run is in flight the thread shows the running pass in plain language
(`looking for what nobody wrote down`) instead of a bare spinner. Rakazo does this with its live
step list; ours is one line, because six passes do not need a log.

### 3. Message-level metadata → already had it

`MessageHoverMetadata.tsx` reveals a rail of actions on hover, and keeps it **in-flow on touch**
(`[@media(hover:none)]:static`). This app's turns already carry timestamps and looked-at counts; the
one useful detail was the duration, which is now on the row. No hover rail was added — the actions
here (delete, re-run) already sit in the report header where they are discoverable on touch.

## Read but not taken

- **`AskCard.tsx`** — an inline approval/secret prompt inside a thread, with an answered state
  (`Answered: …`, `Allowed once`, `Denied`). Interesting for a future "confirm before spending"
  step, but this app has nothing to approve: a run costs a model call and nothing else.
- **`ai/primitives.tsx`** — `Shimmer`, a pixel-grid loader, pop-in success; hand-ported from
  beautifului.dev. These are motion for production apps. This one is flat, white and still by
  design; adding a travelling light across a label would fight the style the user specified.
- **`ArtifactFileCard.tsx`** — artifact preview with PDF/HTML viewers in a dialog. Load-Bearing
  already exports Markdown/PDF/JSON; a previewer would be a second renderer for the same document.
- **`apps/web/src/components/teach/*`** — record-and-teach skill capture. Powerful, and far outside
  what this app does.

## Not taken, for a different reason

Rakazo is an agent with terminal, browser, file and computer access. None of that belongs next to a
tool that stores users' unpublished plans. That is a security posture, not a feature gap.
