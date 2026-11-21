# 06 — Workflow Checklist

> Run this checklist for **every** task that writes code. Copy it into your
> response and tick each box.

## Before (discover)

- [ ] Verified both pre-build plugins are installed per [10-prebuild-plugins.md](10-prebuild-plugins.md): Ponytail · Agent Skills (if missing, give install commands and wait).
- [ ] Read [`AGENTS.md`](../AGENTS.md) + relevant `rules/*.md`.
- [ ] Identified the project state: Astryx project / shadcn project / new project.
- [ ] Ran **Modern Web Guidance** `search` (+ `retrieve` if needed) for the platform concern.
- [ ] Ran **Astryx CLI** `search` + `component`/`docs`/`template` **or** **shadcn** `search` + docs page for the UI concern.
- [ ] Picked **one** component system per [04-decision-tree.md](04-decision-tree.md).

## During (build)

- [ ] Used only allowlisted components/props/tokens exactly as documented.
- [ ] Used native platform APIs per MWG guides (no new libraries/polyfills).
- [ ] Themed via tokens/CSS vars — did not fork component source.
- [ ] Did not mix Astryx + shadcn on the same screen.
- [ ] Accessibility: labels, alt text, keyboard operability, focus management.
- [ ] No invented component, prop, CLI command, package, or file path.
- [ ] No signatures, attributions, or trailers in code, comments, or commit messages.

## After (verify & report)

- [ ] Ran `legacy-scan` (or equivalent check) if refactoring existing code.
- [ ] Ran the agent-skills `review` (`/review`) + `test` (`/test`) workflow where applicable.
- [ ] Passed the 32-check security gate per [11-security-checklist.md](11-security-checklist.md) (headers, .git 404, RLS, server-side prices, rate limits, redirects, no prod maps, XSS, SQLi, CSRF, IDOR, CORS, sessions, supply chain, secrets history, admin/cron auth…).
- [ ] Passed the 20-point launch gate per [12-launch-checklist.md](12-launch-checklist.md) (custom 404, unique meta titles/descriptions, hero CTA, breakpoints, sticky mobile CTA, loading/error states, thank-you page, cookie banner, analytics, real contact info, compressed images…).
- [ ] Searched the diff: every new import is allowlisted or pre-existing.
- [ ] Typecheck / lint / build passes (project's own commands).
- [ ] Response states: tools used + discovery commands + citations.
- [ ] Response includes the one-line **Decision Log** (see [04](04-decision-tree.md)).
- [ ] If blocked: showed empty search results and asked the user — did not invent.
- [ ] Commit message is clean: no `Co-Authored-By`, AI labels, or bot tags.
- [ ] All five site essentials present per [08-site-essentials.md](08-site-essentials.md): favicon · privacy · terms · sitemap · share preview.
- [ ] All images are real (Unsplash/Pinterest per [09-real-images.md](09-real-images.md)), URLs verified (HTTP 200, correct dimensions), alt text present — no AI-generated images.

## Quick Commands Reference

```bash
# Astryx
npx @astryxdesign/cli search <q>
npx @astryxdesign/cli component <Name>
npx @astryxdesign/cli docs <topic>
npx @astryxdesign/cli template --list

# Modern Web Guidance
npx modern-web-guidance@latest search "<task>"
npx modern-web-guidance@latest retrieve "<guide-id>"
npx modern-web-guidance@latest legacy-scan .

# shadcn/ui
npx shadcn@latest search <q>
npx shadcn@latest add <component>
```

## Response Template

```markdown
**Tools used:** Astryx `Button` · Modern Web Guidance `popover` guide
**Discovery:** `astryx component Button` · `retrieve "popover"` (citations…)
**Decision:** Astryx (project uses Astryx) + MWG Anchor Positioning for the tooltip
**New deps:** none (or: `@astryxdesign/core` — allowlisted)
**Checklist:** all boxes ticked · build passes
```
