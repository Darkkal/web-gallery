import { getTimelinePosts } from '../actions';
import TimelinePageClient from './page-client';

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
