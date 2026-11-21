# 03 — shadcn/ui

> Site: https://ui.shadcn.com · Docs: https://ui.shadcn.com/docs
> **shadcn/ui is a code distribution platform, not a black-box library.**
> You add components into your repo via CLI and own the code.

## What shadcn/ui Is

- Composable, accessible components with thoughtful defaults.
- **You own the code** — components are copied into your project, so you can
  customize/extend them. This is the opposite of installing a closed library.
- Built on Tailwind CSS + CSS variables (theming) + Radix/Base UI primitives.
- Works with React/Next.js (and other frameworks). Includes: Components
  (Button, Dialog, Table, Form, …), AI Elements, Blocks, Registry, CLI, Skills.
- Machine-readable docs: https://ui.shadcn.com/llms.txt — read it when in doubt.

## Mandatory Workflow

### 1. Initialize (once per project)
```bash
npx shadcn@latest init
```
Creates `components.json`, sets up Tailwind + CSS variables + path aliases.
**Never** hand-create `components.json` or guess its schema — read the docs:
https://ui.shadcn.com/docs/components-json

### 2. Discover before you write (every task)
```bash
npx shadcn@latest search <query>     # find components/blocks in the registry
npx shadcn@latest add <component>    # e.g. npx shadcn@latest add button dialog
```
- Check the component docs page first: `https://ui.shadcn.com/docs/components/<name>`
  (props, variants, examples, accessibility notes).
- Check the registry directory for community blocks: https://ui.shadcn.com/docs/registry/registry-index

### 3. Build with the installed source
- Import from the path in `components.json` (e.g. `@/components/ui/button`).
- Use the installed component's actual props/variants — read the file after `add`.
- Theme via CSS variables (see https://ui.shadcn.com/docs/theming) and Tailwind
  classes. Dark mode via https://ui.shadcn.com/docs/dark-mode.
- Forms: use the documented form integration (React Hook Form / TanStack Form /
  Formisch) — never hand-roll form state + validation from scratch.

## When shadcn/ui Wins (see decision tree)

- The project **already has** `components.json` + Tailwind + shadcn components.
- The user **explicitly asks** for shadcn/ui.
- Astryx has **no equivalent** for the requested UI (verify via Astryx CLI first).
- The task is an **AI Element** (chat, prompt input, reasoning, tool calls…) —
  shadcn's AI Elements are the allowlisted source.

## Forbidden with shadcn/ui

- ❌ Hand-writing a shadcn component from memory (always `add` via CLI).
- ❌ Guessing props/variants — read the installed source + docs page.
- ❌ Installing shadcn components into an Astryx project (or vice versa) on the
  same screen without explicit user approval.
- ❌ Adding a second UI library "to fill a gap" — check Astryx + shadcn first.
- ❌ Editing `components.json` by guesswork — use `init` / docs.
- ❌ Copying component code from a blog/Stack Overflow instead of the registry.

## Cite Your Work

State the CLI command you ran, e.g.:
> `npx shadcn@latest add dialog` → installed `components/ui/dialog.tsx` — used `Dialog`, `DialogContent`, `DialogTrigger` as documented.
