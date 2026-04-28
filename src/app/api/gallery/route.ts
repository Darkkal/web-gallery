import { NextResponse } from 'next/server';
import * as mediaRepo from '@/lib/db/repositories/media';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sortBy') || 'created-desc';

    const filters = (search || sortBy !== 'created-desc') ? { search, sortBy } : undefined;
    const items = await mediaRepo.getMediaItems(filters);
    
    return NextResponse.json(items);
}
