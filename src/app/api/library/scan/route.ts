import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scanHistory } from "@/lib/db/schema";

import { queueScan } from "@/lib/library/scanner";

export async function GET() {
  // Return the latest scan record as-is.
  // Stale "running" records are cleaned up at app startup (instrumentation.ts),
  // not on every poll — the in-memory isScanning flag is not reliable across
  // Next.js server action / API route evaluation contexts.
  const scans = await db
    .select()
    .from(scanHistory)
    .orderBy(desc(scanHistory.startTime))
    .limit(1);
  return NextResponse.json(scans[0] || null);
}

export async function POST() {
  queueScan({ scanType: "full" });
  return NextResponse.json({ started: true });
}
