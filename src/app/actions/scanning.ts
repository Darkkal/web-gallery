"use server";

import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { scanHistory } from "@/lib/db/schema";
import {
  isScanRunning,
  stopScanning,
  syncLibrary,
} from "@/lib/library/scanner";

export async function scanLibrary() {
  syncLibrary().catch(console.error);
  return { started: true };
}

export async function stopLibraryScan() {
  const stopped = await stopScanning();
  return { requested: stopped };
}

export async function getLatestScan() {
  // Check for stale "running" records (server restart while scan was active)
  if (!isScanRunning()) {
    const scans = await db
      .select()
      .from(scanHistory)
      .orderBy(desc(scanHistory.startTime))
      .limit(1);
    const latest = scans[0];
    if (latest && latest.status === "running") {
      console.log(
        `[getLatestScan] Cleaning up stale scan record #${latest.id}`,
      );
      await db
        .update(scanHistory)
        .set({
          status: "stopped",
          endTime: new Date(),
          lastError: "Scan was interrupted (server restart or crash)",
        })
        .where(eq(scanHistory.id, latest.id));
      // Re-fetch after cleanup
      const updated = await db
        .select()
        .from(scanHistory)
        .orderBy(desc(scanHistory.startTime))
        .limit(1);
      return updated[0] || null;
    }
  }

  const scans = await db
    .select()
    .from(scanHistory)
    .orderBy(desc(scanHistory.startTime))
    .limit(1);
  return scans[0] || null;
}
