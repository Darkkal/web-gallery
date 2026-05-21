"use server";

import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { scanHistory } from "@/lib/db/schema";
import { stopScanning, syncLibrary } from "@/lib/library/scanner";

export async function scanLibrary() {
  syncLibrary().catch(console.error);
  return { started: true };
}

export async function stopLibraryScan() {
  const stopped = await stopScanning();
  return { requested: stopped };
}

export async function getLatestScan() {
  const scans = await db
    .select()
    .from(scanHistory)
    .orderBy(desc(scanHistory.startTime))
    .limit(1);
  return scans[0] || null;
}
