import { NextResponse } from 'next/server';
import * as mediaRepo from '@/lib/db/repositories/media';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sortBy') || 'created-desc';
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const cursor = searchParams.get('cursor') || undefined;

    const filters = { search, sortBy, limit, cursor };
    const result = await mediaRepo.getMediaItems(filters);
    
    return NextResponse.json(result);
}
