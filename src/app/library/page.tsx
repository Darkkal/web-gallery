import { getLatestScan } from '../actions';
import LibraryPageClient from './page-client';

export default async function LibraryPage() {
    const latestScan = await getLatestScan();
    
    // Ensure data is serializable
    const initialScanStatus = latestScan ? JSON.parse(JSON.stringify(latestScan)) : null;

    return <LibraryPageClient initialScanStatus={initialScanStatus} />;
}
