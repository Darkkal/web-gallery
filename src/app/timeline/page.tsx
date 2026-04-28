import { getTimelinePosts } from '../actions';
import TimelinePageClient from './page-client';

export default async function TimelinePage() {
    // Initial data fetch: 100 posts for now as per current behavior
    const posts = await getTimelinePosts(1, 100);
    
    // Ensure data is serializable
    const initialPosts = JSON.parse(JSON.stringify(posts));

    return <TimelinePageClient initialPosts={initialPosts} />;
}
