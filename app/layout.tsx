import type { Metadata, Viewport } from "next";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Load-Bearing — find the assumptions your plan depends on",
  description:
    "Paste a plan, idea, or argument. Load-Bearing pulls out the claims the whole thing rests on, ranks them by how much collapses if they are wrong, and shows the cheapest way to test each one.",
  openGraph: {
    title: "Load-Bearing",
    description: "Find the assumptions your plan quietly depends on.",
    type: "website",
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
