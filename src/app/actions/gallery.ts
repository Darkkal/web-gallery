'use server';

import { revalidatePath } from 'next/cache';
import * as mediaRepo from '@/lib/db/repositories/media';

export async function getMediaItems(filters?: { search?: string; sortBy?: string; limit?: number; cursor?: string; }) {
    return mediaRepo.getMediaItems(filters);
}

export async function deleteMediaItems(ids: number[], deleteFiles: boolean) {
    const result = await mediaRepo.deleteMediaItems(ids, deleteFiles);
    revalidatePath('/gallery');
    revalidatePath('/timeline');
    revalidatePath('/');
    return result;
}
