# AGENTS.md — LLM Build Rules (Allowlist Only)

> **This file is the single entry point for every coding agent.**
> Read it first, then follow the modular rules in [`rules/`](rules/README.md).
> If any rule below conflicts with your default habits, **these rules win**.

---

## 0. The One Rule That Matters

**Build ONLY with the three allowlisted tools below. Never invent your own tools.**

| # | Tool | Source of truth | What it is for |
|---|------|-----------------|----------------|
| 1 | **Astryx** | https://github.com/meta/astryx · Docs: https://astryx.atmeta.com | Meta design system — 150+ accessible React components, themes, templates, CLI |
| 2 | **Modern Web Guidance** | https://github.com/GoogleChrome/modern-web-guidance-src · Docs: https://developer.chrome.com/docs/modern-web-guidance | Google Chrome skills for modern platform APIs, CSS, performance & accessibility |
| 3 | **shadcn/ui** | https://ui.shadcn.com · Docs: https://ui.shadcn.com/docs | Composable, accessible components you own — code distribution, not a black-box library |

**Nothing else is allowed.** No other UI library, component, hook, CLI, or "helpful" package — unless the user explicitly adds it via [`rules/07-how-to-add-a-rule.md`](rules/07-how-to-add-a-rule.md).

---

## 1. Hard Constraints (Non-Negotiable)

1. **NO INVENTED TOOLS.** Never fabricate a component, prop, hook, token, CLI command, npm package, file path, or API. If it is not in the allowlist docs/CLI output, it does not exist.
2. **NO HAND-ROLLED REPLACEMENTS.** Never write your own `Button`, `Dialog`, `Modal`, `Toast`, `Tooltip`, `Tabs`, `Table`, `Form`, `Input`, `Select`, etc. from scratch. Use Astryx or shadcn.
3. **NO NEW LIBRARIES.** Never `npm install` anything outside the allowlist (plus the project's existing framework/runtime deps). No MUI, Chakra, Ant Design, Bootstrap, Radix-by-hand, Headless UI, Mantine, etc.
4. **VERIFY BEFORE YOU WRITE.** For every UI/platform decision, run the tool's discovery command first (see §3). Code written from memory is forbidden.
5. **ONE COMPONENT SYSTEM PER SCREEN.** Never mix Astryx and shadcn components on the same page/screen. Pick one per project (see [`rules/04-decision-tree.md`](rules/04-decision-tree.md)). Mixing requires explicit user approval.
6. **MODERN PLATFORM FIRST.** Before writing any CSS/JS for layout, animation, forms, overlays, or performance, check Modern Web Guidance. Prefer native platform APIs over JS libraries/polyfills.
7. **STOP INSTEAD OF GUESSING.** If the allowlisted tools cannot do it, **stop and ask the user**. Do not invent a workaround, a custom component, or a new dependency.
8. **NO SIGNATURES OR TRAILERS.** Never append signatures, attributions, or trailers (such as `Co-Authored-By:`, AI labels, or bot tags) to code, comments, commit messages, PR descriptions, or any generated output. Write everything as if directly by a human developer — clean code, clean commit messages, clean descriptions only.
9. **SITE ESSENTIALS REQUIRED.** Every website/app build must ship with the five essentials: **favicon, privacy policy, terms & conditions, sitemap, share preview (OG metadata)**. See [`rules/08-site-essentials.md`](rules/08-site-essentials.md).
10. **REAL IMAGES ONLY.** Use real images from **Unsplash** (https://unsplash.com) and **Pinterest** (https://www.pinterest.com) — never AI-generated images and never fabricated image URLs, unless the user explicitly asks for generated imagery. See [`rules/09-real-images.md`](rules/09-real-images.md).
11. **PLUGINS BEFORE BUILD.** Before any build / vibe-coding session, verify **Ponytail** (https://github.com/DietrichGebert/ponytail) and **Agent Skills** (https://github.com/addyosmani/agent-skills) are installed. If missing, give install commands and wait — never start silently. See [`rules/10-prebuild-plugins.md`](rules/10-prebuild-plugins.md).
12. **SECURITY GATE REQUIRED.** Before shipping, pass all 32 security checks in [`rules/11-security-checklist.md`](rules/11-security-checklist.md): security headers, race conditions, `.git` exposure, account pre-hijacking, storage RLS, subdomain takeover, server-side prices, SSRF, credential stuffing, path traversal, open database, reset poisoning, no polyfill.io, no prod source maps, SMS pumping, clickjacking, prompt injection, open redirects, JWT secrets, user enumeration — plus XSS, SQL injection, CSRF, IDOR/broken access control, mass assignment, CORS, session management, dependency supply chain, secrets in git history, verbose errors/debug routes, unauthenticated admin/cron/webhook endpoints, and DoS on expensive endpoints.
13. **LAUNCH CHECKLIST REQUIRED.** Before launch, pass all 20 website essentials in [`rules/12-launch-checklist.md`](rules/12-launch-checklist.md): custom 404, unique meta title & description per page, CTA above the fold, mobile breakpoints, sticky mobile CTA, loading states, form error states, thank-you page, cookie banner, analytics setup, real contact info, compressed images — plus the favicon set, robots.txt, sitemap, OG image, privacy, terms, and alt text already enforced by rules 02/08/09.

---

## 2. What Each Tool Owns

| Concern | Owner | Rule file |
|---------|-------|-----------|
| Design system, components, themes, page templates | **Astryx** (primary) or **shadcn/ui** (when project already uses it / user asks) | [`rules/01-astryx.md`](rules/01-astryx.md) · [`rules/03-shadcn.md`](rules/03-shadcn.md) |
| CSS layout, modern APIs, animations, forms UX, a11y, performance, fallbacks | **Modern Web Guidance** (always-on layer) | [`rules/02-modern-web-guidance.md`](rules/02-modern-web-guidance.md) |
| Which tool to pick for a given task | **Decision tree** | [`rules/04-decision-tree.md`](rules/04-decision-tree.md) |
| Banned patterns & anti-examples | **Forbidden list** | [`rules/05-forbidden-patterns.md`](rules/05-forbidden-patterns.md) |
| Step-by-step workflow & self-check | **Checklist** | [`rules/06-workflow-checklist.md`](rules/06-workflow-checklist.md) |
| Favicon, privacy, terms, sitemap, share preview | **Site essentials** | [`rules/08-site-essentials.md`](rules/08-site-essentials.md) |
| Real imagery for hero/product/background/avatar slots | **Real images** — Unsplash + Pinterest | [`rules/09-real-images.md`](rules/09-real-images.md) |
| Session gate: Ponytail + Agent Skills installed pre-build | **Pre-build plugins** | [`rules/10-prebuild-plugins.md`](rules/10-prebuild-plugins.md) |
| Security: headers, RLS, SSRF, redirects, 32-check ship gate | **Security checklist** | [`rules/11-security-checklist.md`](rules/11-security-checklist.md) |
| Launch gate: 20 website essentials (404, meta, CTA, cookie banner…) | **Launch checklist** | [`rules/12-launch-checklist.md`](rules/12-launch-checklist.md) |

---

## 3. Mandatory Discovery Commands (Run Before Writing Code)

### Astryx — CLI is the source of truth
```bash
npx @astryxdesign/cli --help
npx @astryxdesign/cli search <what-you-need>        # find component/hook/doc/template/theme
npx @astryxdesign/cli component <Name>              # exact props, usage, examples
npx @astryxdesign/cli docs <topic>                  # tokens, theme, layout, migration…
npx @astryxdesign/cli template --list               # ready-to-ship page templates
```
> Never run bare `astryx` via npx before install — it resolves to an unrelated package. Use the scoped `@astryxdesign/cli` or the project's installed version. Full rules: [`rules/01-astryx.md`](rules/01-astryx.md).

### Modern Web Guidance — search before you code
```bash
npx modern-web-guidance@latest search "<task, e.g. animate a dialog backdrop>"
npx modern-web-guidance@latest retrieve "<guide-id>"
npx modern-web-guidance@latest legacy-scan .        # find legacy patterns to modernize
```
> Install once with `npx modern-web-guidance@latest install`. Full rules: [`rules/02-modern-web-guidance.md`](rules/02-modern-web-guidance.md).

### shadcn/ui — CLI + registry only
```bash
npx shadcn@latest init                              # once per project (creates components.json)
npx shadcn@latest add <component>                   # e.g. npx shadcn@latest add button dialog
npx shadcn@latest search <query>                    # discover components/blocks in the registry
```
> Never hand-write a shadcn component from memory. Always add via CLI and read the installed source. Full rules: [`rules/03-shadcn.md`](rules/03-shadcn.md).

---

## 4. Required Output Behaviour

Every response that writes code **must**:

1. State which allowlisted tool(s) you used and why (one line per tool).
2. Cite the discovery output you based the code on (CLI command + result, or docs URL).
3. List any new dependency you installed — it must be from the allowlist or the project's existing deps. If you installed anything else, you violated these rules.
4. Run the project's self-check in [`rules/06-workflow-checklist.md`](rules/06-workflow-checklist.md) before finishing.
5. Keep every artifact clean — no signatures, attributions, or trailers (such as `Co-Authored-By:`, AI labels, or bot tags) in code, comments, commit messages, or PR descriptions. Write as if directly by a human developer. See [`rules/05-forbidden-patterns.md`](rules/05-forbidden-patterns.md) §7.

**Example of a compliant opening line:**
> Using Astryx `Button` (via `astryx component Button`) + Modern Web Guidance `popover` guide (via `retrieve`) for the overlay behaviour.

---

## 5. If Blocked

If no allowlisted tool covers the request:

1. Say exactly what you searched (commands + queries).
2. Say exactly what was missing.
3. Ask the user: *add a new tool via `rules/07-how-to-add-a-rule.md`, or change the request?*
4. **Do not** invent a component, install a new library, or write a hand-rolled replacement "just this once".

---

## 6. Rule Files Index

| File | Purpose |
|------|---------|
| [`rules/00-core-allowlist.md`](rules/00-core-allowlist.md) | The allowlist, versions, install & discovery commands |
| [`rules/01-astryx.md`](rules/01-astryx.md) | Astryx usage rules |
| [`rules/02-modern-web-guidance.md`](rules/02-modern-web-guidance.md) | Modern Web Guidance usage rules |
| [`rules/03-shadcn.md`](rules/03-shadcn.md) | shadcn/ui usage rules |
| [`rules/04-decision-tree.md`](rules/04-decision-tree.md) | Which tool wins for which task |
| [`rules/05-forbidden-patterns.md`](rules/05-forbidden-patterns.md) | Banned patterns with before/after |
| [`rules/06-workflow-checklist.md`](rules/06-workflow-checklist.md) | Before / during / after checklist |
| [`rules/07-how-to-add-a-rule.md`](rules/07-how-to-add-a-rule.md) | How to add the next rule, step by step |
| [`rules/08-site-essentials.md`](rules/08-site-essentials.md) | Required site essentials: favicon, privacy, terms, sitemap, share preview |
| [`rules/09-real-images.md`](rules/09-real-images.md) | Real images only — Unsplash & Pinterest, never AI-generated |
| [`rules/10-prebuild-plugins.md`](rules/10-prebuild-plugins.md) | Pre-build plugins: Ponytail + Agent Skills install gate |
| [`rules/11-security-checklist.md`](rules/11-security-checklist.md) | Security checklist: 32 checks required before shipping |
| [`rules/12-launch-checklist.md`](rules/12-launch-checklist.md) | Launch checklist: 20 website essentials required before launch |

**Compatibility shims** (same rules, other agent formats): [`CLAUDE.md`](CLAUDE.md) · [`.github/copilot-instructions.md`](.github/copilot-instructions.md) · [`.cursor/rules/`](.cursor/rules/)

---

*Version: 1.7 — 2026-11-17 · Allowlist: Astryx, Modern Web Guidance, shadcn/ui only · Images: Unsplash, Pinterest (real photos only) · Plugins: Ponytail, Agent Skills · Gates: security (32) + launch (20).*
