import { getMediaItems } from '@/app/actions';
import GalleryPageClient from '@/app/gallery/page-client';

export default async function GalleryPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const params = await searchParams;
    const search = (params.search as string) || '';
    const sortBy = (params.sortBy as string) || 'created-desc';

    // Initial data fetch on the server
    const filters = { search, sortBy, limit: 50 };
    const { items, nextCursor } = await getMediaItems(filters);
    
    // Ensure data is serializable
    const initialItems = JSON.parse(JSON.stringify(items));

    return (
        <GalleryPageClient 
            initialItems={initialItems} 
            initialSearch={search} 
            initialSort={sortBy} 
            initialNextCursor={nextCursor}
        />
    );
}
