# rules/ — Modular LLM Rules

This folder holds the detailed rules referenced by [`AGENTS.md`](../AGENTS.md).
Each file covers one concern so rules can be added **step by step** without
rewriting the whole guideline.

## Index

| # | File | Covers |
|---|------|--------|
| 00 | [00-core-allowlist.md](00-core-allowlist.md) | The allowlist: exact sources, installs, discovery commands |
| 01 | [01-astryx.md](01-astryx.md) | Astryx — Meta design system (components, themes, CLI) |
| 02 | [02-modern-web-guidance.md](02-modern-web-guidance.md) | Modern Web Guidance — modern platform APIs, CSS, a11y, perf |
| 03 | [03-shadcn.md](03-shadcn.md) | shadcn/ui — composable components you own |
| 04 | [04-decision-tree.md](04-decision-tree.md) | Which tool wins for which task |
| 05 | [05-forbidden-patterns.md](05-forbidden-patterns.md) | Banned patterns with before/after examples |
| 06 | [06-workflow-checklist.md](06-workflow-checklist.md) | Before / during / after workflow + self-check |
| 07 | [07-how-to-add-a-rule.md](07-how-to-add-a-rule.md) | Template + steps for adding the next rule |
| 08 | [08-site-essentials.md](08-site-essentials.md) | Site essentials: favicon, privacy, terms, sitemap, share preview |
| 09 | [09-real-images.md](09-real-images.md) | Real images only — Unsplash & Pinterest, never AI-generated |
| 10 | [10-prebuild-plugins.md](10-prebuild-plugins.md) | Pre-build plugins: Ponytail + Agent Skills — install gate before any build session |
| 11 | [11-security-checklist.md](11-security-checklist.md) | Security gate: 32 checks (headers, races, RLS, SSRF, XSS, CSRF, IDOR, CORS…) before shipping |
| 12 | [12-launch-checklist.md](12-launch-checklist.md) | Launch gate: 20 website essentials (404, meta titles, CTAs, loading/error states, cookie banner, analytics…) |

## How agents should read them

1. Read [`AGENTS.md`](../AGENTS.md) first — it is the entry point.
2. Read `00-core-allowlist.md` for the exact commands.
3. Read the tool file(s) relevant to the task (`01`, `02`, `03`).
4. Follow `04-decision-tree.md` when two tools could apply.
5. Check `05-forbidden-patterns.md` before writing code.
6. Run `06-workflow-checklist.md` before finishing.

## How to add a rule (step by step)

See [07-how-to-add-a-rule.md](07-how-to-add-a-rule.md). In short:

1. Copy the template from `07-how-to-add-a-rule.md`.
2. Save it as the next numbered file (e.g. `08-your-rule.md`).
3. Add one row to the table above and one line to `AGENTS.md` §6.
4. Mirror it in `.cursor/rules/` if you use Cursor.
5. Bump the version in `AGENTS.md`.

> **Rule of thumb:** one file = one concern. Keep files short, strict, and
> command-first. Every rule must name its source of truth and its discovery
> command — a rule without a way to verify it will be ignored.
