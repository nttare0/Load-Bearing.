# 04 — Decision Tree: Which Tool Wins?

> Astryx and shadcn/ui both provide UI components. **This file decides which
> one to use** so the agent never mixes them randomly. Modern Web Guidance
> always applies on top.

## Step 0 — Always (every task)

1. Search **Modern Web Guidance** for the platform concern (CSS, animation,
   forms UX, overlay behaviour, performance, a11y) — see [02](02-modern-web-guidance.md).
2. Check the **project state**: does it already use Astryx or shadcn?
   - `package.json` has `@astryxdesign/core` → **Astryx project**.
   - `components.json` exists + `components/ui/` exists → **shadcn project**.
   - Neither → **new project** (see Step 2).

## Step 1 — Pick ONE component system

| Situation | Use | Why |
|-----------|-----|-----|
| Project already uses Astryx | **Astryx** | Consistency; never introduce a second system mid-project |
| Project already uses shadcn | **shadcn/ui** | Consistency; components are already owned code |
| New project, no preference stated | **Astryx** (default) | Primary design system; 150+ components + templates + themes |
| User explicitly says "shadcn" | **shadcn/ui** | Explicit user instruction wins |
| User explicitly says "Astryx" | **Astryx** | Explicit user instruction wins |
| Astryx has no equivalent (verified via CLI `search`) | **shadcn/ui** for that piece only | Gap-filling; still one system per screen where possible |
| Task is an AI Element (chat, prompt, reasoning, tool UI) | **shadcn/ui AI Elements** | Allowlisted source for AI UI |

**Hard rule:** one screen = one component system. If you must use both
(e.g. gap-filling), state why in your response and get user approval first.

## Step 2 — New project setup

1. Confirm the component system with the user if unclear (Astryx default).
2. Install per [01](01-astryx.md) or [03](03-shadcn.md) — never both.
3. Run Modern Web Guidance `install` once.
4. Declare your choice in the first response:
   > "Component system: Astryx (`@astryxdesign/core` + `theme-neutral`). Platform layer: Modern Web Guidance."

## Step 3 — Task routing examples

| Task | Component | Platform layer |
|------|-----------|----------------|
| Button, Dialog, Table, Form, Toast | Astryx **or** shadcn (per Step 1) | MWG: Popover/dialog/a11y guidance |
| Tooltip, popover, dropdown | Astryx **or** shadcn | MWG: Anchor Positioning + Popover API |
| Page layout (dashboard, settings, detail) | Astryx **template** (preferred) or shadcn blocks | MWG: CSS layout (Grid/container queries) |
| Animation / transition | — (no library) | MWG: View Transitions, `@starting-style`, scroll-driven animations |
| Form validation UX | Astryx/shadcn form components | MWG: `:user-invalid`, native validation |
| Chat / AI prompt UI | shadcn **AI Elements** | MWG: a11y + performance |
| Theming / dark mode | Astryx theme tokens **or** shadcn CSS vars | MWG: `oklch`, forced-colors |
| Performance fix | — | MWG: preloading, INP, `scheduler.yield` |

## Step 4 — If neither system covers it

1. Run both discovery CLIs and show the queries + empty results.
2. Stop and ask the user (see [AGENTS.md](../AGENTS.md) §5).
3. Never invent a component or install a new library.

## Decision Log (required in your response)

Always include one line, e.g.:
> Decision: Astryx `Table` (project uses Astryx) + MWG `content-visibility` guide for rendering performance.
