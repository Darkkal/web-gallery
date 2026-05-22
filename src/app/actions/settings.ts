"use server";

import { revalidatePath } from "next/cache";
import {
  cleanupOldScrapeLogs,
  getSettings,
  saveSettings,
} from "@/lib/settings";
import type { SystemSettings } from "@/types/settings";

export async function fetchSettingsAction(): Promise<SystemSettings> {
  return await getSettings();
}

export async function saveSettingsAction(
  settings: SystemSettings,
): Promise<{ success: boolean; error?: string }> {
  try {
    await saveSettings(settings);

    // Trigger log cleanup immediately if log retention days changed or saved
    await cleanupOldScrapeLogs();

    // Revalidate affected pages to refresh limits/settings
    revalidatePath("/gallery");
    revalidatePath("/timeline");
    revalidatePath("/settings");

    return { success: true };
  } catch (error) {
    console.error("[SettingsAction] Failed to save settings:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
