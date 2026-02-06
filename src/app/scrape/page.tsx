import { getScrapeTasks, getSources, getScrapeHistory } from './actions';
import ScrapePageClient from './page-client';

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
