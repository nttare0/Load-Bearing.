import { SettingsScreen } from "@/components/SettingsScreen";

export const metadata = {
  title: "Settings — Load-Bearing",
  description: "Your model key, the thinking level, and what this deployment is wired to.",
};

/**
 * Settings is a page, not an overlay.
 *
 * The screen itself is a client component (`SettingsScreen`) because every value
 * on it lives in this browser; this file only names the route and its title, so
 * the URL can be shared, bookmarked and reached from the browser's own controls.
 */
export default function Settings() {
  return <SettingsScreen />;
}
