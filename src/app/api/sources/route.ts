import { NextResponse } from 'next/server';
import * as sourcesRepo from '@/lib/db/repositories/sources';

export async function GET() {
    const sources = await sourcesRepo.getSourcesWithHistory();
    return NextResponse.json(sources);
}
