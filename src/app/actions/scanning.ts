'use server';

import { db } from '@/lib/db';
import { scanHistory } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { syncLibrary, stopScanning } from '@/lib/library/scanner';

export async function scanLibrary() {
    syncLibrary().catch(console.error);
    return { started: true };
}

export async function stopLibraryScan() {
    stopScanning();
    return { requested: true };
}

export async function getLatestScan() {
    const scans = await db.select().from(scanHistory).orderBy(desc(scanHistory.startTime)).limit(1);
    return scans[0] || null;
}
