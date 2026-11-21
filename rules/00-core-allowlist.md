# 00 — Core Allowlist

> **Only the tools in this file may be used to build.** Everything else is
> forbidden unless added via [07-how-to-add-a-rule.md](07-how-to-add-a-rule.md).

## The Allowlist

| # | Tool | Repo / Site | Docs | Install | Discover (run before coding) |
|---|------|-------------|------|---------|------------------------------|
| 1 | **Astryx** | https://github.com/meta/astryx | https://astryx.atmeta.com | `npm i @astryxdesign/core @astryxdesign/theme-neutral @stylexjs/stylex` + `npm i -D @astryxdesign/cli` | `npx @astryxdesign/cli search <q>` · `component <Name>` · `docs <topic>` · `template --list` |
| 2 | **Modern Web Guidance** | https://github.com/GoogleChrome/modern-web-guidance-src | https://developer.chrome.com/docs/modern-web-guidance | `npx modern-web-guidance@latest install` | `npx modern-web-guidance@latest search "<task>"` · `retrieve "<guide-id>"` · `legacy-scan .` |
| 3 | **shadcn/ui** | https://ui.shadcn.com (source: https://github.com/shadcn-ui/ui) | https://ui.shadcn.com/docs | `npx shadcn@latest init` (once) | `npx shadcn@latest search <q>` · `npx shadcn@latest add <component>` |

## Stack Assumptions (from the allowlist itself)

- **Astryx:** React **19+** (`react` + `react-dom` are peer deps of `@astryxdesign/core`). Styles are authored with StyleX but invisible to consumers — override via `className` (Tailwind / CSS modules / plain CSS). Themes are CSS custom-property overrides (`@astryxdesign/theme-*`: neutral, butter, chocolate, matcha, stone, gothic, y2k).
- **shadcn/ui:** Tailwind CSS + CSS variables for theming + `components.json` config. Components are **code you own** in your repo (not a black-box dependency) — add via CLI, then read/edit the installed source.
- **Modern Web Guidance:** 262 modern web features (CSS & Layout, Forms & UI, Performance, Accessibility, Built-in AI, UX). Stewarded by Chrome, Edge, Firefox & MDN teams. Designed to steer agents away from legacy patterns toward native platform APIs.

## What "Only These Tools" Means in Practice

**Allowed:**
- The three tools above, their CLIs, their docs, and their official packages/themes/registries.
- The project's existing framework/runtime (e.g. Next.js, Vite, React, Node) and its already-installed dependencies.
- Standard language/platform features (TypeScript, native CSS, native Web APIs) — **as guided by Modern Web Guidance**.

**Forbidden:**
- Any other component/UI library, CSS framework, icon library, animation library, form library, or utility that duplicates what the allowlist provides.
- Any hand-written component that duplicates an Astryx/shadcn component.
- Any invented API, prop, token, CLI flag, or package name.
- Any polyfill/heavy library where a native platform API exists (per Modern Web Guidance).

## Version & Freshness

- Always use the **latest** allowlisted version unless the project pins one.
- Re-run discovery commands when in doubt — docs and CLIs are the source of truth, not your training data.
- If a discovery command fails, report the exact error. Do not fall back to memory.

## Adding to This Allowlist

A new tool may only be added by:

1. Creating a rule file from the template in [07-how-to-add-a-rule.md](07-how-to-add-a-rule.md).
2. Adding a row to the table above with repo, docs, install, and discovery commands.
3. Updating [`AGENTS.md`](../AGENTS.md) §0 and §6.
4. Getting explicit user approval. **Agents must never add tools on their own.**
