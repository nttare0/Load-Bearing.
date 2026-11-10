import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
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
  themeColor: "#f7f4ed",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#fffdf8",
              border: "1px solid #e2dcd0",
              color: "#191713",
              fontSize: "13px",
            },
          }}
        />
      </body>
    </html>
  );
}
