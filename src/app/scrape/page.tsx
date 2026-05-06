import { getScrapeTasks, getSources, getScrapeHistory } from '@/app/scrape/actions';
import ScrapePageClient from '@/app/scrape/page-client';

export default async function ScrapePage() {
    const tasks = await getScrapeTasks();
    const sources = await getSources();
    const history = await getScrapeHistory();

    return (
        <ScrapePageClient
            tasks={tasks}
            sources={sources}
            history={history}
        />
    );
}
