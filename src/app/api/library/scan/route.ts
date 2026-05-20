import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scanHistory } from "@/lib/db/schema";

import { isScanRunning, syncLibrary } from "@/lib/library/scanner";

async function getLatestScanWithCleanup() {
  // Check for stale "running" records (server restart while scan was active)
  if (!isScanRunning()) {
    const scans = await db
      .select()
      .from(scanHistory)
      .orderBy(desc(scanHistory.startTime))
      .limit(1);
    const latest = scans[0];
    if (latest && latest.status === "running") {
      console.log(`[API] Cleaning up stale scan record #${latest.id}`);
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

export async function GET() {
  const latest = await getLatestScanWithCleanup();
  return NextResponse.json(latest);
}

export async function POST() {
  syncLibrary().catch(console.error);
  return NextResponse.json({ started: true });
}
