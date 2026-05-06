'use client';

import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import styles from './page.module.css';
import { getActiveScrapeStatuses } from './actions';

interface HistoryItem {
    id: number;
    startTime: Date;
    endTime: Date | null;
    status: 'running' | 'completed' | 'stopped' | 'failed';
    filesDownloaded: number | null;
    skippedCount: number | null;
    postsProcessed: number | null;
    bytesDownloaded: number | null;
    errorCount: number | null;
}

export default function ScrapeHistoryTable({ initialHistory }: { initialHistory: HistoryItem[] }) {
    const [historyItems, setHistoryItems] = useState<HistoryItem[]>(initialHistory);

    useEffect(() => {
        setHistoryItems(initialHistory);
    }, [initialHistory]);

    useEffect(() => {
        const hasRunning = historyItems.some(i => i.status === 'running');
        if (!hasRunning) return;

        const interval = setInterval(async () => {
            try {
                const active = await getActiveScrapeStatuses();

                setHistoryItems(prev => prev.map(item => {
                    const activeStatus = active.find(a => a.historyId === item.id);
                    if (activeStatus) {
                        return {
                            ...item,
                            filesDownloaded: activeStatus.downloadedCount,
                            skippedCount: activeStatus.skippedCount,
                            postsProcessed: activeStatus.postsProcessed,
                            errorCount: activeStatus.errorCount,
                            // Convert string size to bytes approximation if needed, 
                            // but ScrapeProgress has totalSize string. 
                            // Wait, activeStatus has 'totalSize' string, item has 'bytesDownloaded' number.
                            // We need access to parseSizeToBytes logic or similar if we want to update bytes.
                            // For UI display, formatBytes expects number.
                            // Let's assume we can't update bytes accurately from string easily without parser,
                            // or we just skip updating bytes live for now, OR we parse it.
                            // However, the actions.ts import of manage doesn't expose parseSizeToBytes.
                            // Let's accept that live bytes might lag or simpler: ignore bytes updating or parse rough.
                            // Let's just update counts which are most important.
                        };
                    }
                    // If item says running but not in active list, it might have finished just now.
                    // The revalidatePath in actions should handle refreshing the page eventually,
                    // or we rely on the next refresh.
                    return item;
                }));
            } catch (err) {
                console.error("Failed to poll status:", err);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [historyItems]);

    // Helper for bytes formatting
    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className={styles.listContainer}>
            <table className={styles.table}>
                <thead>
                    <tr>
                        <th>Time</th>
                        <th>Duration</th>
                        <th>Status</th>
                        <th className={styles.thRight}>Downloaded</th>
                        <th className={styles.thRight}>Posts</th>
                        <th className={styles.thRight}>Skipped</th>
                        <th className={styles.thRight}>Size</th>
                        <th className={styles.thRight}>Errors</th>
                    </tr>
                </thead>
                <tbody>
                    {historyItems.map((item) => (
                        <tr key={item.id} className={styles.tableRow}>
                            <td>
                                {formatDistanceToNow(new Date(item.startTime), { addSuffix: true })}
                            </td>
                            <td>
                                {item.endTime ? (
                                    <span>{Math.round((new Date(item.endTime).getTime() - new Date(item.startTime).getTime()) / 1000)}s</span>
                                ) : (
                                    <span className={styles.runningPulse}>Running...</span>
                                )}
                            </td>
                            <td>
                                <span className={styles.badge} data-status={item.status}>
                                    {item.status}
                                </span>
                            </td>
                            <td className={styles.tdRight}>{item.filesDownloaded}</td>
                            <td className={styles.tdRight}>{item.postsProcessed ?? 0}</td>
                            <td className={styles.tdRight}>{item.skippedCount ?? 0}</td>
                            <td className={styles.tdRight}>{formatBytes(item.bytesDownloaded || 0)}</td>
                            <td className={`${styles.tdRight} ${item.errorCount ? styles.errorText : ''}`}>{item.errorCount}</td>
                        </tr>
                    ))}
                    {historyItems.length === 0 && (
                        <tr>
                            <td colSpan={8} className={styles.emptyCell}>
                                No history available.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
