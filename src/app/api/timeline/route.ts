import { NextResponse } from 'next/server';
import * as postsRepo from '@/lib/db/repositories/posts';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';

    const posts = await postsRepo.getTimelinePosts(page, limit, search);
    return NextResponse.json(posts);
}
