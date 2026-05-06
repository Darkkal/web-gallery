import type { Metadata } from 'next';
import { getScrapeTasks, getSources, getScrapeHistory } from '@/app/scrape/actions';
import ScrapePageClient from '@/app/scrape/page-client';

export const metadata: Metadata = { title: "Scrape Tasks" };

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
