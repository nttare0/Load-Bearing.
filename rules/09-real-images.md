# 09 — Real Images Only (Unsplash & Pinterest)

> While building, use **real images** from the two approved sources below.
> **Never ship AI-generated images** and never invent image URLs — unless the
> user explicitly asks for generated imagery.

## Approved Sources

| Source | URL | Best for |
|--------|-----|----------|
| **Unsplash** | https://unsplash.com | Hero images, product/photography, backgrounds, avatars, editorial imagery |
| **Pinterest** | https://www.pinterest.com | Moodboards, lifestyle imagery, inspiration for specific niches |

These are **content sources** (image assets), not build tools — using them does
not violate the tool allowlist in [00-core-allowlist.md](00-core-allowlist.md).

## Mandatory Workflow

### 1. Find a real image
- Browse/search the source (or its official API when the project already has a
  key, e.g. Unsplash API) and pick an actual image that fits the design.
- Match subject, tone, colour palette, and orientation to the layout slot
  (hero = landscape, portrait = 3:4, avatar = square).

### 2. Get a real, working URL — never fabricate one
- Copy the **exact** image URL from the source (e.g. `images.unsplash.com/photo-…`,
  `i.pinimg.com/…`). Never guess or construct an ID — a fabricated URL is an
  invented tool (see [05-forbidden-patterns.md](05-forbidden-patterns.md) §1).
- Unsplash: prefer the `images.unsplash.com` URL with sizing params
  (`?w=1600&q=80&auto=format&fit=crop`) for responsive delivery.

### 3. Verify before shipping (every image)
- Request the URL (curl/HEAD) and confirm: HTTP **200**, `image/*` content-type,
  expected dimensions. A broken or placeholder image fails the checklist.
- Record attribution: photographer/source in a `CREDITS.md` or image comment
  where practical (Unsplash licence allows use without attribution — crediting
  is still good practice; for Pinterest, respect the original creator).

### 4. Integrate properly
- Download into the project (`public/images/…` or the framework's asset
  convention) for stability, or hotlink consistently — follow the project's
  existing pattern. Use the framework's image component for optimisation
  (e.g. `next/image`) — verify its props in docs, never guess.
- Every image gets **meaningful alt text** (see [02-modern-web-guidance.md](02-modern-web-guidance.md) accessibility rules).
- Correct sizing: don't ship a 6000px photo into a 400px slot; use source
  resize params or the framework's optimisation.

## When Generated Images ARE Allowed

Only when the user **explicitly asks** for generated imagery (logos, OG share
images, illustrations). Then:
- Say so explicitly in your response and label the asset as generated.
- Everything else in the build still uses real images from the approved sources.

## Forbidden

- ❌ Shipping AI-generated images as site photography (without explicit user request).
- ❌ Fabricating image URLs or guessing photo IDs.
- ❌ Shipping an image URL you never verified (broken link = failed build).
- ❌ Placeholder services (`via.placeholder.com`, `picsum.photos`, grey boxes) in final builds.
- ❌ Using other stock sites (Pexels, Pixabay, Shutterstock…) without user approval — add via [07-how-to-add-a-rule.md](07-how-to-add-a-rule.md).
- ❌ Stripping alt text or shipping a 6000px original into a small slot.

## Report in your response

State image sources and verification, e.g.:
> Images: 4 real photos — 3 Unsplash (verified 200, credits in `CREDITS.md`), 1 Pinterest (`i.pinimg.com`, verified). No generated imagery.
