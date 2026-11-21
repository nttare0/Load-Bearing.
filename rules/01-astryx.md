# 01 — Astryx (Meta Design System)

> Source: https://github.com/meta/astryx · Docs: https://astryx.atmeta.com
> **Astryx is the primary design system.** 150+ accessible components, themes,
> templates, and a CLI — one cohesive system for humans and agents alike.

## What Astryx Is

- Open-source design system from Meta (grew inside Meta over 8 years; powers 13,000+ apps).
- **React 19+** + StyleX (invisible to consumers — no build plugin needed for the default setup).
- Ships components, foundations (typography/color/layout/a11y), patterns (table pages, detail layouts, form wizards…), 7 themes, dark mode, and ready-to-ship templates.
- Packages: `@astryxdesign/core` (components), `@astryxdesign/cli` (docs/templates/themes/codemods), `@astryxdesign/build` (StyleX source builds), `@astryxdesign/theme-*` (themes).
- Currently in **Beta** — expect API evolution; always check the installed version's docs.

## Mandatory Workflow

### 1. Install (once per project)
```bash
npm install @astryxdesign/core @astryxdesign/theme-neutral @stylexjs/stylex
npm install -D @astryxdesign/cli
```
- Pick **one** theme package (`theme-neutral` by default). Never install multiple themes unless the user asks.
- For reliable CLI access, add to `package.json`:
  ```json
  { "scripts": { "astryx": "node node_modules/@astryxdesign/cli/clients/cli/bin/astryx.mjs" } }
  ```
  then run `npm run astryx -- component --list`.

### 2. Discover before you write (every task)
```bash
npx @astryxdesign/cli search <what-you-need>     # component? hook? doc? template? theme?
npx @astryxdesign/cli component <Name>           # exact props + usage + examples
npx @astryxdesign/cli docs <topic>               # tokens, theme, layout, migration…
npx @astryxdesign/cli template --list            # page templates
npx @astryxdesign/cli <command> --help           # arguments/options for any command
npx @astryxdesign/cli manifest --json            # every command/option/response type
```
- **Never** run bare `astryx` through npx before install — it resolves to an unrelated npm package. Use the scoped `@astryxdesign/cli` or the project's installed version.
- Optional global install for the whole machine: `npm i -g @astryxdesign/cli` (in a project, the project's version still wins).

### 3. Build with what the CLI returns
- Import components from `@astryxdesign/core` exactly as documented.
- Use the documented prop names, composition patterns, and token names. **Never guess a prop.**
- Customize via **theme tokens** (CSS custom properties) or `className` overrides — never by forking/wrapping component source.
- For page layouts, prefer a ready-made **template** over composing from scratch.
- To go deeper than the public API, use **swizzle** (ejects full component source into your project) — never re-implement a component by hand.

## Astryx Principles (from the repo)

- **Guidance over enforcement** — components give capability; design opinions live in docs/examples.
- **Strong, documented conventions** — same naming/prop/composition rules across all 150+ components. Learn a few, predict the rest.
- **One system for humans and AI** — if the CLI/docs don't show it, it doesn't exist for you either.

## Forbidden with Astryx

- ❌ Guessing props, tokens, or component names from memory.
- ❌ Writing a custom `Button`/`Dialog`/`Table`/etc. instead of using Astryx.
- ❌ Adding a second UI library (including shadcn) on the same screen.
- ❌ Forking component source to restyle it — use theme tokens / `className` / swizzle.
- ❌ Installing `@astryxdesign/lab` (internal, not on npm) or `@astryxdesign/vega`/`charts` `@canary` without explicit user approval.
- ❌ Running `astryx` unscoped via npx.

## Cite Your Work

State the CLI command you ran and what it returned, e.g.:
> `npx @astryxdesign/cli component Button` → props: `variant`, `size`, `onClick`… — used `variant="primary"`.
