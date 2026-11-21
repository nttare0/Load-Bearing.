import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * `/r/<id>` is a shared report: unguessable, not secret-signed, and only meant
 * for whoever was given the link. A crawler that indexed one would publish
 * somebody's plan, so those are disallowed by prefix. The API is disallowed
 * because there is nothing there to read and every hit costs a model call.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/r/", "/settings"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
