import type { Metadata } from "next";
import { fetchSettingsAction } from "@/app/actions/settings";
import { getCategories } from "@/app/actions/tags";
import SettingsPageClient from "@/app/settings/page-client";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const [settings, categories] = await Promise.all([
    fetchSettingsAction(),
    getCategories(),
  ]);

  // Ensure data is fully serializable
  const initialSettings = JSON.parse(JSON.stringify(settings));
  const initialCategories = JSON.parse(JSON.stringify(categories));

  return (
    <SettingsPageClient
      initialSettings={initialSettings}
      initialCategories={initialCategories}
    />
  );
}
