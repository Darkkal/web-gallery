import type { Metadata } from "next";
import { fetchSettingsAction } from "@/app/actions/settings";
import SettingsPageClient from "@/app/settings/page-client";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const settings = await fetchSettingsAction();

  // Ensure settings is fully serializable
  const initialSettings = JSON.parse(JSON.stringify(settings));

  return <SettingsPageClient initialSettings={initialSettings} />;
}
