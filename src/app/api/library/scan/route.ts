import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { scanHistory } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';

import { syncLibrary } from '@/lib/library/scanner';

export async function GET() {
    const scans = await db.select().from(scanHistory).orderBy(desc(scanHistory.startTime)).limit(1);
    const latest = scans[0] || null;
    return NextResponse.json(latest);
}

export async function POST() {
    syncLibrary().catch(console.error);
    return NextResponse.json({ started: true });
}
