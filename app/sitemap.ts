import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * Every public route, and nothing else.
 *
 * The API routes and `/r/[id]` are excluded on purpose: `/r/<id>` is a shared
 * report, which is private to whoever holds the link, and listing ids in a
 * sitemap would publish them. `/settings` is excluded too — it is a
 * device-local page with nothing to index.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    {
      url: SITE_URL,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
