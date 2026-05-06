import { getSourcesWithHistory } from '@/app/actions';
import SourcesPageClient from '@/app/sources/page-client';

export default async function SourcesPage() {
    // Initial data fetch on the server
    const sources = await getSourcesWithHistory();
    
    // Cast to simple serializable objects for props
    const initialSources = JSON.parse(JSON.stringify(sources));

    return <SourcesPageClient initialSources={initialSources} />;
}
