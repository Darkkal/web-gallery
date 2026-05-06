'use server';

import { revalidatePath } from 'next/cache';
import * as sourcesRepo from '@/lib/db/repositories/sources';

export async function addSource(url: string, name?: string) {
    await sourcesRepo.addSource(url, name);
    revalidatePath('/sources');
}

export async function updateSource(id: number, updates: { url?: string; name?: string }) {
    await sourcesRepo.updateSource(id, updates);
    revalidatePath('/sources');
}

export async function getSourcesWithHistory() {
    return sourcesRepo.getSourcesWithHistory();
}

export async function deleteSource(id: number) {
    await sourcesRepo.deleteSource(id);
    revalidatePath('/sources');
    return { success: true };
}
