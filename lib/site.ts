/**
 * Where this deployment actually lives.
 *
 * Needed because `metadataBase` and `sitemap.ts` must emit absolute URLs, and a
 * wrong host in an `og:image` is a broken share card. The order is deliberate:
 * an explicit env var wins, then Vercel's own production domain, then localhost
 * so development never produces a card pointing at the real site.
 *
 * `VERCEL_PROJECT_PRODUCTION_URL` is Vercel's documented variable for the stable
 * production domain (as opposed to `VERCEL_URL`, which is the per-deployment
 * preview host). It has no protocol, so one is added.
 */
export const SITE_URL = (() => {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.startsWith("http") ? explicit : `https://${explicit}`;

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production) return `https://${production}`;

  const preview = process.env.VERCEL_URL?.trim();
  if (preview) return `https://${preview}`;

  return "http://localhost:3000";
})();

/** The site's name, used as the metadata title suffix. */
export const SITE_NAME = "Load-Bearing";

/** One sentence, used as the fallback description everywhere. */
export const SITE_DESCRIPTION =
  "Paste a plan, idea, or argument. Load-Bearing pulls out the claims the whole thing rests on, ranks them by how much collapses if they are wrong, and shows the cheapest way to test each one.";
