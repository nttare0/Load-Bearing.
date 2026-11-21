import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "What Load-Bearing keeps, where it is kept, and what leaves your browser when you run a plan.",
  alternates: { canonical: "/privacy" },
};

/**
 * Written from the code, not from a template. Each section below corresponds to
 * something this app actually does; where it does not collect a thing, the page
 * says so rather than staying silent, because silence in a privacy policy reads
 * as "we might".
 */
export default function Privacy() {
  return (
    <LegalPage
      title="Privacy"
      updated="21 November 2026"
      summary="Load-Bearing has no accounts and no cookies for tracking. Your chats, plans and reports live in your browser's local storage. The only thing that leaves your browser is the text you submit for analysis, which goes to the model provider — using either the deployment's key or one you paste yourself."
      sections={[
        {
          heading: "What we collect",
          body: [
            "Nothing that identifies you. There is no sign-up, no login, no email field, and no analytics script on this site.",
            "One thing is stored server-side and is not personal: a count of how many runs have been made from this deployment, used to stop one visitor spending the shared model quota. It holds no text from your plan.",
          ],
        },
        {
          heading: "What stays in your browser",
          body: [
            "Your chats, the plans you paste, the reports generated from them, and any folders you make are kept in this browser's local storage under keys beginning with `load-bearing:`. They are not uploaded unless you explicitly choose to keep a report in the cloud, which only happens on a deployment with Supabase configured.",
            "If you paste your own model key in Settings, it is stored the same way — in this browser only — unless you turn off \"remember on this device\", in which case it lives in the tab and is gone when you close it. Keys are never written into a report, a share link, or the server.",
            "Clearing your browser's site data for this domain deletes all of it. There is no copy anywhere else.",
          ],
        },
        {
          heading: "What leaves your browser",
          body: [
            "When you ask for a plan to be checked, the text of that plan is sent to this app's server, which sends it to the model provider configured for the deployment — Google (Gemini) or Anthropic, depending on which key is in use. Their handling of it is governed by their terms, not this page.",
            "If you bring your own key, the request is billed to you and goes to the provider you chose. The key itself is sent with the request and is not stored on the server.",
            "Some claims are checked against public sources. Those lookups send the claim text, not your whole plan.",
          ],
        },
        {
          heading: "Share links",
          body: [
            "A shared report lives at a URL containing a random id. Anyone with that link can read the report. The link is not indexed — `/r/` is excluded in robots.txt — but it is not password-protected either, so treat one as you would an unlisted document.",
          ],
        },
        {
          heading: "Third parties",
          body: [
            "Vercel serves this site. Google or Anthropic answers the analysis, depending on which key is configured. No advertising, tracking, or analytics providers are used.",
          ],
        },
        {
          heading: "Your rights",
          body: [
            "Because the data is in your browser, you can exercise deletion yourself at any time: clearing site data removes everything. If a report was kept server-side on a deployment with storage enabled, contact the operator to have it removed.",
          ],
        },
      ]}
    />
  );
}
