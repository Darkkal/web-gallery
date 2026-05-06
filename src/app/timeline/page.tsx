import type { Metadata } from 'next';
import { getTimelinePosts } from '@/app/actions/timeline';
import TimelinePageClient from '@/app/timeline/page-client';

export const metadata: Metadata = { title: "Timeline" };

export default async function TimelinePage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const params = await searchParams;
    const search = (params.search as string) || '';
    const sortBy = (params.sortBy as string) || 'created-desc';

    // Initial data fetch
    const { posts, nextCursor } = await getTimelinePosts({ search, sortBy, limit: 50 });
    
    // Ensure data is serializable
    const initialPosts = JSON.parse(JSON.stringify(posts));

    return (
        <TimelinePageClient 
            initialPosts={initialPosts} 
            initialNextCursor={nextCursor}
            initialSearch={search}
            initialSort={sortBy}
        />
    );
}
