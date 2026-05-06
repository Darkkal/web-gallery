import type { Metadata } from 'next';
import { getLatestScan } from '@/app/actions/scanning';
import LibraryPageClient from '@/app/library/page-client';

export const metadata: Metadata = { title: "Library" };

export default async function LibraryPage() {
    const latestScan = await getLatestScan();
    
    // Ensure data is serializable
    const initialScanStatus = latestScan ? JSON.parse(JSON.stringify(latestScan)) : null;

    return <LibraryPageClient initialScanStatus={initialScanStatus} />;
}
