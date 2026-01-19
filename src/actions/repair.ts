'use server';

import { twitterRepairManager } from '@/lib/repairs/twitter-repair';
import { db } from '@/lib/db';
import { repairRuns } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function startTwitterRepair() {
    twitterRepairManager.start();
    revalidatePath('/library');
}

export async function stopRepair() {
    await twitterRepairManager.stop();
    revalidatePath('/library');
}

export async function pauseRepair() {
    twitterRepairManager.pause();
    revalidatePath('/library');
}

export async function resumeRepair() {
    twitterRepairManager.resume();
    revalidatePath('/library');
}

export async function getRepairStatus() {
    return twitterRepairManager.getStatus();
}

export async function getRepairHistory() {
    const history = await db.select()
        .from(repairRuns)
        .orderBy(desc(repairRuns.startTime))
        .limit(10); // Show last 10
    return history;
}
