import type { Metadata } from "next";
import { getStatistics } from "@/lib/db/repositories/statistics";
import { getAppSettings } from "@/lib/settings";
import StatisticsPageClient from "./page-client";

export const metadata: Metadata = { title: "Statistics" };

export default async function StatisticsPage() {
  const stats = await getStatistics();
  const settings = await getAppSettings();

  // Cast to serializable structures for client boundary
  const initialStats = JSON.parse(JSON.stringify(stats));
  const appSettings = JSON.parse(JSON.stringify(settings));

  return (
    <StatisticsPageClient
      initialStats={initialStats}
      appSettings={appSettings}
    />
  );
}
