import type { NextConfig } from "next";

/**
 * Security headers, sent on every response.
 *
 * Two of the choices below are worth explaining, because a copy-pasted CSP is
 * either useless or breaks the app:
 *
 * **`script-src` keeps `'unsafe-inline'`.** Next's App Router inlines the RSC
 * payload as `<script>` bodies, so a policy without it breaks every page. Closing
 * that gap properly needs a per-request nonce from middleware, which forces the
 * page out of static rendering. It is the right trade for an authenticated app
 * and the wrong one for this: there is no user session to steal, no HTML is
 * rendered from model output (reports are rendered from a Zod-validated object,
 * never as markup), and the CSP is here to stop *injected* script, which it still
 * does for every external source.
 *
 * **`frame-ancestors 'none'` and `X-Frame-Options: DENY`** both ship: the first is
 * the modern check, the second is what older browsers read.
 *
 * `media-src` is local-only because the mark is served from this origin, not
 * fetched. `connect-src` allows only this origin — every model call is
 * server-side, so the browser never needs to reach a provider directly.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "media-src 'self'",
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    // Nothing here needs a device capability, so every one is switched off.
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  // Tells the browser to upgrade any subresource it finds over http.
  { key: "Upgrade-Insecure-Requests", value: "1" },
];

const nextConfig: NextConfig = {
  // Hides the framework and its version from every response.
  poweredByHeader: false,
  experimental: {
    // React Flow ships ESM that the server bundler does not need to parse.
    optimizePackageImports: ["@xyflow/react", "lucide-react"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
