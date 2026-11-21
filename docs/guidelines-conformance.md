# Conformance with the build guidelines

This project follows https://github.com/nttare0/my-llm-guideline. `AGENTS.md` and
`rules/` are copied in, so the rules travel with the repo. This file records what
was audited, what changed, and the handful of places where the repo does not — and
cannot — meet a rule.

## Tooling

**Decision (rule 04): the project is a shadcn/ui project.** `components.json` and
`components/ui/` were already present and in use (`button`, `card`, `badge`,
`accordion`, `tabs`, `input`, `textarea`, `skeleton`, `sonner`). Astryx is *not*
introduced: rule 04 is explicit that a project already on shadcn stays on shadcn,
and it forbids two component systems on one screen.

**Platform layer: Modern Web Guidance** (`modern-web-guidance@1.0.1`). Guide
`icons` was retrieved and used for the mark — see below.

New dependencies: **none for UI**. Everything shadcn-side was already installed.

## What was added

| Essential | Where |
| --- | --- |
| Favicon set | `app/icon.svg` (themed for `prefers-color-scheme`), `app/favicon.ico` (16/32/48, RGBA PNG payloads), `app/apple-icon.png` (180×180) |
| Privacy policy | `/privacy` — `app/privacy/page.tsx` via `components/LegalPage.tsx` |
| Terms | `/terms` — same shell |
| Sitemap | `app/sitemap.ts` → `/sitemap.xml`; `app/robots.ts` → `/robots.txt` |
| Share preview | `app/opengraph-image.tsx` (1200×630, `ImageResponse`), `metadataBase`, per-page titles and descriptions, `twitter:card: summary_large_image` |

All five use framework-native file conventions. No SEO library, no sitemap
generator, no icon package.

The mark is the same drawing in all three places — a slab resting on two
pillars. `app/icon.svg` is the vector source; the rasteriser that produced the PNG
and ICO writes the identical geometry, so the files cannot drift.

## Fixed along the way

- **`/settings` rendered `Settings — Load-Bearing — Load-Bearing`.** The page's own
  title already carried the brand, and the new layout template appended it again.
  Caught by checking `<title>` per route, which rule 12 #02 requires.
- **No security headers at all.** `next.config.ts` now sends CSP,
  `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy`, `Upgrade-Insecure-Requests`, and sets
  `poweredByHeader: false`.
- **No rate limit on the expensive route.** `/api/analyze` runs five model passes
  per request; `lib/ratelimit.ts` now gives 12 runs/hour on the shared key and 60
  on a visitor's own key (they pay for their own quota), with `Retry-After`.
  Demo mode is exempt — no model call to protect.
- **`/api/check` and `/api/selftest` had no cache directive.** Both are now
  `force-dynamic`; `/api/check` carries a token.
- **The key field's error was not wired to the input.** It now sets
  `aria-invalid` and `aria-describedby`, with `role="alert"` on the message
  (rule 12 #13).
- **No legal links anywhere.** `components/SiteFooter.tsx` links both pages and
  carries the Rare UI credit.
- **Below 768px the sidebar was `hidden`, with no replacement.** There was no way
  to start a chat, reach the list, or open Settings on a phone.
  `components/MobileBar.tsx` is a bottom bar with 44px targets, honouring
  `env(safe-area-inset-bottom)`; the sticky composer now sits above it.

## Deliberate deviations, stated

### CSP keeps `script-src 'unsafe-inline'`

Next's App Router inlines the RSC payload as script bodies, so a policy without
it breaks every page. Closing it properly needs a per-request nonce from
middleware, which forces the page out of static rendering. For this app that
trade is wrong: there is no session to steal, and model output is never rendered
as markup — reports render from a Zod-validated object. The CSP still blocks
every external script origin, which is what it is here to do. Revisit if this ever
gains accounts.

### The rate limit is per-instance

`lib/ratelimit.ts` holds counters in memory. On serverless each instance has its
own, so this throttles a hammered instance rather than enforcing a global budget.
A global limit needs shared state (Supabase), which is not enabled for this
deployment. The docstring says so.

### Rule 11's database checks do not apply yet

There are 32 checks; several concern tables, RLS, storage buckets and account
flows. This deployment has no database and no accounts — Supabase support exists
in the code but is not configured. Those checks are **not** claimed as passing;
they are not applicable until storage is switched on.

### The legal pages are placeholders

Rule 08 forbids inventing legal text and requires flagging placeholder content.
Both pages carry a visible banner saying they are written by engineers, not
lawyers, have not been reviewed, and need the operator's real name, address and
contact details. The prose describes what the code actually does — no accounts, no
tracking cookies, local storage, and what is sent to the model provider — rather
than pretending to be a contract.

### Contact details are not filled in

Rule 12 #19 asks for real contact information. I do not have it, Rule 12 forbids
inventing it, and the pages say where to put it.

## Verified

```
typecheck        clean
npm test         93/93   (6 new for the rate limiter)
next build       ✓ compiled
/                200     /privacy 200   /terms 200   /settings 200
/icon.svg        200 image/svg+xml
/apple-icon.png  200 image/png
/favicon.ico     200 image/x-icon
/opengraph-image 200 image/png (1200×630)
/sitemap.xml     200 (3 public routes)
/robots.txt      200 (disallows /api/, /r/, /settings)
/.git/config     404
X-Powered-By     absent
headers          CSP, HSTS, nosniff, DENY, Referrer-Policy, Permissions-Policy
titles           unique per route
npm audit        0 vulnerabilities
```

Images: this app ships no photographs. The only image assets are the vector mark
and its raster siblings, drawn from geometry — rule 09 governs photography, and
there is none to source from Unsplash or Pinterest.

## Not done, and why

- **Analytics (rule 12 #18)** — needs a provider choice and a consent decision.
  Not installable silently.
- **Cookie banner (rule 12 #17)** — no non-essential cookies are set, so there is
  nothing to consent to yet. It becomes required the moment analytics is added.
- **Thank-you page (rule 12 #14)** — there is no conversion flow to terminate.
- **`legacy-scan`** — not run. The CSS here is Tailwind v4 with custom properties,
  and the honest check is a browser, which this environment does not have.
