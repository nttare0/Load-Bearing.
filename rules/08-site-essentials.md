# 08 — Site Essentials (Required in Every Build)

> Every website/app build **must** ship with the five launch essentials below.
> They are part of the Definition of Done — a build missing any of them is
> incomplete and fails the checklist in [06-workflow-checklist.md](06-workflow-checklist.md).

## How to build them (allowlist only)

- Use the **project framework's native mechanisms** (e.g. Next.js App Router
  metadata/file conventions: `app/favicon.ico` / `app/icon.svg`, `app/robots.ts`,
  `app/sitemap.ts`, `opengraph-image.tsx`, `generateMetadata`). Verify the exact
  convention in the framework docs before writing — never invent one.
- Use **Astryx or shadcn** components for the privacy/terms page UI — never hand-rolled.
- Run **Modern Web Guidance** `search` / `retrieve` for platform concerns
  (image formats, SVG favicon, metadata best practices).
- **No extra libraries for these.** No `next-seo`, `react-helmet`, sitemap
  generator packages, etc. Native platform + framework features only.

## Definition of Done — all five, every build

| # | Essential | Where | Verify before finishing |
|---|-----------|-------|-------------------------|
| 1 | **Favicon** | `/favicon.ico` + SVG icon + apple-touch icon | `<link rel="icon">` in page source; files served |
| 2 | **Privacy policy** | `/privacy` page, linked in the footer | Page renders; footer link works |
| 3 | **Terms & conditions** | `/terms` page, linked in the footer | Page renders; footer link works |
| 4 | **Sitemap** | `/sitemap.xml` + `robots.txt` referencing it | `curl /sitemap.xml` lists every public route |
| 5 | **Share preview** | Open Graph + Twitter metadata on every public page | All OG/twitter tags present; validated |

## 1. Favicon

- Include at minimum: `favicon.ico` (fallback), an SVG icon for modern browsers,
  and an apple-touch icon (180×180).
- Use the framework's metadata-file convention where available
  (e.g. `app/icon.svg`, `app/apple-icon.png`) — do not hand-write `<link>` tags
  when the convention exists.
- Optional but good: theme-aware icon via SVG `prefers-color-scheme` media query.

## 2. Privacy policy

- Route: `/privacy`. Linked in the site footer (and app menu where relevant).
- Generate sensible placeholder sections: what data is collected, why, third
  parties, cookies, retention, user rights, contact.
- ⚠️ **Legal text is not yours to invent.** Mark the page as placeholder content
  and tell the user it must be reviewed/replaced (by them or legal counsel)
  before launch. Never fabricate company names, jurisdictions, or addresses.

## 3. Terms & conditions

- Route: `/terms`. Linked in the site footer.
- Same rules as privacy: placeholder sections (acceptable use, IP, liability,
  termination, governing law, contact) — flagged for user review.

## 4. Sitemap

- Generate `sitemap.xml` from the **actual route list** (e.g. `app/sitemap.ts`).
  All public routes, correct canonical URLs, `lastModified` where known.
- Also ship `robots.txt` (e.g. `app/robots.ts`) referencing the sitemap URL.
- Exclude private/auth/API routes. Regenerate whenever routes change.
- Verify: request `/sitemap.xml` and confirm every public page is listed.

## 5. Share preview (Open Graph)

- Every public page exports metadata: `title`, `description`,
  `og:title`, `og:description`, `og:image` (1200×630), `og:url`, `og:type`,
  and `twitter:card` (`summary_large_image`) + `twitter:title/description/image`.
- Root page sets sensible defaults; each page overrides with its own
  title/description/image (per-page metadata, not just root).
- Ship a real share image — or generate one via the framework's native OG image
  support (e.g. `opengraph-image.tsx` with `ImageResponse`). Never a broken link.
- Verify the tags render in the page source and validate with a share debugger
  before finishing.

## Forbidden

- ❌ Shipping a build missing any of the five essentials.
- ❌ Installing a library for SEO/metadata (`next-seo`, `react-helmet`…).
- ❌ Hand-rolled `<meta>`/`<link>` soup when the framework has metadata conventions.
- ❌ Fabricating legal text or presenting placeholder legal content as final.
- ❌ Placeholder `og:image` pointing at a nonexistent URL.
- ❌ Hand-writing sitemap entries that don't match real routes.

## Report in your response

State each essential's status, e.g.:
> Site essentials: favicon ✅ (`app/icon.svg` + `favicon.ico`) · privacy ✅ `/privacy` (placeholder — needs your review) · terms ✅ `/terms` (placeholder) · sitemap ✅ `/sitemap.xml` (12 routes) · share preview ✅ `og:image` 1200×630 per page.
