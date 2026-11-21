# 02 — Modern Web Guidance (Google Chrome)

> Source: https://github.com/GoogleChrome/modern-web-guidance-src
> Docs: https://developer.chrome.com/docs/modern-web-guidance
> **This is the always-on layer.** It governs *how* you write CSS/JS —
> regardless of which component library (Astryx/shadcn) you use.

## What It Is

- A set of **skills** that embed web-platform expertise, best practices, and
  browser-compatibility data into coding agents.
- Covers **262 modern web features** across: 🎨 User Experience, 📐 CSS Layout,
  ⚡ Performance, 📝 Forms & UI, ♿ Accessibility, 🤖 Built-in AI.
- Purpose: steer agents **away from legacy patterns** (bloated JS, heavy
  polyfills, outdated APIs from training data) **toward native, high-performance
  platform solutions**.
- Stewarded by the Google Chrome, Microsoft Edge, Mozilla Firefox, and MDN teams.

## Mandatory Workflow

### 1. Install (once per machine/project)
```bash
npx modern-web-guidance@latest install
```
Interactive wizard — installs the skills for your agent.

### 2. Search before you code (every task touching CSS/JS)
```bash
npx modern-web-guidance@latest search "<task>"        # e.g. "animate a dialog modal backdrop"
npx modern-web-guidance@latest retrieve "<guide-id>"  # full guide for one feature
npx modern-web-guidance@latest legacy-scan .          # find legacy patterns to modernize
```
- Search with the **task**, not the library name (e.g. `"tooltip positioning"`, not `"radix tooltip"`).
- Retrieve the guide and follow its implementation pattern + fallback guidance.
- Run `legacy-scan` on existing code before refactoring — fix what it flags.

### 3. Apply the guidance
- **Prefer native platform APIs** over JS libraries/polyfills:
  Popover API, `<dialog>`, Anchor Positioning, View Transitions, container
  queries, `subgrid`, `oklch`, `:user-invalid`, `field-sizing`, `scheduler.yield`,
  scroll-driven animations, etc. — whichever the retrieved guide recommends.
- **Responsible fallbacks:** lightweight, sensible fallbacks — never a heavy
  polyfill or legacy library for a single feature.
- **Performance & accessibility by default:** use platform APIs the browser can
  optimize and that include built-in a11y affordances (keyboard, screen reader,
  focus management). Every input needs a visible label; every image needs alt text.
- **CSS first:** modern layout (Flexbox/Grid/container queries), modern color
  (`oklch`), `text-wrap`, `scrollbar-color`, `@starting-style` for entry
  animations — before reaching for a JS animation library.

## Core Disciplines (quick reference)

| Discipline | Examples |
|------------|----------|
| 🎨 User Experience | View Transitions, entry/exit animations, parallax scroll, `scrollbar-color` |
| 📐 CSS Layout | Container queries, `subgrid`, `oklch`, `text-wrap`, line-height trimming |
| ⚡ Performance | Instant preloading, INP diagnostics, `scheduler.yield` |
| 📝 Forms & UI | Anchor Positioning (tooltips), Popover API, dialogs, `:user-invalid`, auto-sizing fields |
| ♿ Accessibility | Screen-reader + keyboard operability, content navigation/discoverability |
| 🤖 Built-in AI | Native translation, summarization, language detection APIs |

## Forbidden with Modern Web Guidance

- ❌ Writing CSS/JS from memory without searching first.
- ❌ Using a JS library/polyfill for something the platform does natively.
- ❌ Copying legacy patterns (jQuery-style DOM hacks, manual focus traps,
  hand-rolled modals/tooltips) when a guide exists.
- ❌ Ignoring `legacy-scan` findings during a refactor.
- ❌ Skipping accessibility (unlabeled inputs, missing alt, keyboard traps).

## Cite Your Work

State the guide you retrieved, e.g.:
> `retrieve "animate-to-from-top-layer"` → used View Transitions + `@starting-style` for the backdrop animation.
