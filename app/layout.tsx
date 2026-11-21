import type { Metadata, Viewport } from "next";
import { Toaster } from "@/components/ui/sonner";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

/**
 * `metadataBase` is what turns the OG image path into an absolute URL. Without
 * it Next emits a relative `og:image`, which no scraper resolves, so the share
 * card silently does not work. The image itself comes from
 * `app/opengraph-image.tsx` via the file convention, so it is not named here.
 *
 * `title.template` gives every page a unique title with the brand appended once,
 * and `twitter` is set explicitly: `summary_large_image` is required or X crops
 * the card to a thumbnail.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — find the assumptions your plan depends on`,
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    title: SITE_NAME,
    description: "Find the assumptions your plan quietly depends on.",
    type: "website",
    siteName: SITE_NAME,
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: "Find the assumptions your plan quietly depends on.",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9f9f9" },
    { media: "(prefers-color-scheme: dark)", color: "#131316" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        {children}
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
