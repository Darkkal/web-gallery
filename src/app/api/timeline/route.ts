import { NextResponse } from 'next/server';
import * as postsRepo from '@/lib/db/repositories/posts';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const search = searchParams.get('search') || '';
    const cursor = searchParams.get('cursor') || undefined;
    const sortBy = searchParams.get('sortBy') || 'created-desc';

    const filters = { search, sortBy, limit, cursor };
    const result = await postsRepo.getTimelinePosts(filters);
    
    return NextResponse.json(result);
}
