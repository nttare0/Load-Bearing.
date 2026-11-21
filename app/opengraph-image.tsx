import { ImageResponse } from "next/og";
import { SITE_DESCRIPTION } from "@/lib/site";

/**
 * The share card, drawn with the framework's own OG support rather than a
 * binary in `public/`. It is the same slab-and-pillars mark as the icon, in the
 * app's own serif-on-paper palette, so a link to Load-Bearing looks like the
 * thing it links to.
 */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Load-Bearing — find the assumptions your plan depends on";

export default async function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f9f9f9",
          color: "#131316",
          padding: 72,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* The mark, drawn at card size. */}
          <svg width="56" height="56" viewBox="0 0 100 100">
            <rect width="100" height="100" rx="22" fill="#131316" />
            <rect x="18" y="20" width="64" height="14" rx="4" fill="#f9f9f9" />
            <rect x="24" y="40" width="18" height="42" rx="4" fill="#f9f9f9" />
            <rect x="58" y="40" width="18" height="42" rx="4" fill="#f9f9f9" />
          </svg>
          <div style={{ fontSize: 30, letterSpacing: -0.5 }}>Load-Bearing</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: 68,
              lineHeight: 1.1,
              letterSpacing: -2,
              maxWidth: 940,
            }}
          >
            Find the assumptions your plan quietly depends on.
          </div>
          <div style={{ fontSize: 28, lineHeight: 1.45, color: "#5c5c66", maxWidth: 900 }}>
            {SITE_DESCRIPTION}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 24, color: "#5c5c66" }}>
          <div style={{ width: 40, height: 1, background: "#c9c9d1" }} />
          Ranked by what breaks if they are wrong
        </div>
      </div>
    ),
    size
  );
}
