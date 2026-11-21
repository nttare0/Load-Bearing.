# 12 — Launch Checklist (20 Website Essentials)

> The complete pre-launch gate for every website. 7 items are already
> enforced by existing rules (marked ✅ covered — verify there, no duplicate
> definition lives here); the other 13 are defined below.
> UI for all of these comes from Astryx/shadcn; platform behaviour per
> [02-modern-web-guidance.md](02-modern-web-guidance.md).

## The 20-point gate

| # | Essential | Status |
|---|-----------|--------|
| 01 | Custom 404 page | this rule |
| 02 | Meta title for every page | this rule |
| 03 | Meta description for every page | this rule |
| 04 | CTA above the fold | this rule |
| 05 | Complete favicon set | ✅ [08-site-essentials.md](08-site-essentials.md) |
| 06 | robots.txt | ✅ [08-site-essentials.md](08-site-essentials.md) |
| 07 | sitemap.xml | ✅ [08-site-essentials.md](08-site-essentials.md) |
| 08 | Open Graph image | ✅ [08-site-essentials.md](08-site-essentials.md) |
| 09 | Alt text for every image | ✅ [02-modern-web-guidance.md](02-modern-web-guidance.md) + [09-real-images.md](09-real-images.md) |
| 10 | Mobile breakpoints | this rule |
| 11 | Sticky mobile CTA | this rule |
| 12 | Loading states | this rule |
| 13 | Form error states | this rule |
| 14 | Thank-you page | this rule |
| 15 | Privacy policy page | ✅ [08-site-essentials.md](08-site-essentials.md) |
| 16 | Terms & conditions | ✅ [08-site-essentials.md](08-site-essentials.md) |
| 17 | Cookie banner | this rule |
| 18 | Analytics setup | this rule |
| 19 | Real contact information | this rule |
| 20 | Compressed images | this rule |

## 01 — Custom 404 page

- Branded `not-found` page (framework convention, e.g. Next.js `app/not-found.tsx`) — never the default blank 404.
- Includes: what happened, a primary CTA (back home), and useful links/search.
- Matches the site's layout (header/footer) and works on mobile.

## 02 — Meta title for every page

- Every page exports a unique `title` (metadata template + per-page override). No two pages share a title; no "Untitled" or framework defaults.
- ~50–60 characters, most important words first, brand suffix via template.
- Verify: page source shows a distinct title per route.

## 03 — Meta description for every page

- Every public page exports a unique `description` (~150–160 chars), written for humans, matching page intent.
- Never empty, never duplicated across pages; pages missing one fall back to a meaningful site-level default only where truly generic.

## 04 — CTA above the fold

- Every landing/marketing page shows its primary CTA **without scrolling** (hero section).
- CTA is an Astryx/shadcn button with a concrete action verb ("Start free", "Book a demo") — never "Click here", never a dead link.
- Secondary CTA (learn more) allowed; primary action obvious on mobile too.

## 10 — Mobile breakpoints

- Layout verified at ~360px, 768px, 1024px, 1440px (and 320px if supported): no horizontal overflow, no clipped text, no squashed nav.
- Touch targets ≥ 44×44px; hover-only interactions have touch alternatives.
- Use responsive units + container queries per [02-modern-web-guidance.md](02-modern-web-guidance.md); verify breakpoint syntax in framework/Tailwind docs — never invent class names.

## 11 — Sticky mobile CTA

- Key conversion pages (pricing, signup, checkout) keep the primary CTA reachable on mobile: sticky bottom bar or persistent header CTA.
- Must not obscure content or the footer legal links ([08](08-site-essentials.md)); respects safe-area insets; keyboard/AT accessible; dismissible when it overlays content.

## 12 — Loading states

- Every async surface (route transitions, fetches, submits, uploads) has a visible loading state: skeletons, spinners, or progress — Astryx/shadcn components, never a frozen UI.
- Use framework primitives where available (e.g. `loading.tsx`, Suspense); buttons disable + show pending state during submits to prevent double submissions.

## 13 — Form error states

- Every field: inline error message on invalid input, `aria-invalid` + `aria-describedby` wired, errors announced to screen readers.
- Server-side failures render a dismissible error summary with focus management; user input is preserved on error.
- Styling per the framework's form primitives ([03-shadcn.md](03-shadcn.md) form integration / Astryx form components); validation UX per MWG (`:user-invalid`).

## 14 — Thank-you page

- Each conversion flow (signup, purchase, form submit) ends on a dedicated `/thank-you`-style page: confirmation of what happened, what happens next, and a next-step CTA.
- Marked `noindex`; fires the analytics conversion event ([18](#18--analytics-setup)); reachable only after a real conversion.

## 17 — Cookie banner

- Required whenever non-essential cookies/storage are used (analytics, ads, embeddings).
- Accept **and** reject options of equal prominence; consent stored and honoured — analytics scripts load only after consent where required (GDPR/ePrivacy).
- Regions/wording are legal decisions: build the mechanism, but flag the banner text + policy links for user review (same stance as [08](08-site-essentials.md) legal pages).

## 18 — Analytics setup

- Analytics installed and **verified in production** (provider chosen by the user; use the platform-native option when unspecified, e.g. Vercel Analytics — verify setup in its docs, never invent config).
- Track pageviews + key conversion events (signup, submit, purchase → thank-you page).
- No PII in events; loads consent-aware per [17](#17--cookie-banner); script respects [11-security-checklist.md](11-security-checklist.md) (no uncontrolled third-party CDNs, SRI where supported).

## 19 — Real contact information

- Footer/contact page carries real, working contact details: real support email and/or contact channel, linked (e.g. `mailto:`), plus required legal/company info where applicable.
- Never ship placeholder contact data (`info@example.com`, fake phone numbers, fabricated addresses) — if the user hasn't provided details, use clearly-marked placeholders and ask before launch. Never invent contact info.

## 20 — Compressed images

- All images optimised: framework image component (e.g. `next/image`) or source-side sizing ([09-real-images.md](09-real-images.md) Unsplash params), modern formats (WebP/AVIF), explicit dimensions (no layout shift), lazy-loading below the fold.
- No multi-MB originals shipped to the client; verify network payload of image-heavy pages stays reasonable.

## Forbidden

- ❌ Launching with any of the 20 missing or broken.
- ❌ Duplicate meta titles/descriptions across pages.
- ❌ Frozen UI on async actions; forms losing input on error.
- ❌ Fake analytics consent (loading trackers before consent where required).
- ❌ Inventing contact details or analytics config.
- ❌ Shipping multi-MB unoptimised images.

## Report at launch

> Launch gate (20): 404 ✅ · titles ✅ (14 unique) · descriptions ✅ · hero CTA ✅ · favicon set ✅ [08] · robots ✅ [08] · sitemap ✅ [08] · OG image ✅ [08] · alt text ✅ [02/09] · breakpoints ✅ (360→1440) · sticky CTA ✅ · loading ✅ · form errors ✅ · thank-you ✅ · privacy ✅ [08] · terms ✅ [08] · cookie banner ✅ (text pending your review) · analytics ✅ verified in prod · contact ✅ (you provided) · images ✅ (WebP, ≤200KB).
