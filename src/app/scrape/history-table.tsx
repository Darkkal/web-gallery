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
                        <th style={{ textAlign: 'right' }}>Downloaded</th>
                        <th style={{ textAlign: 'right' }}>Posts</th>
                        <th style={{ textAlign: 'right' }}>Skipped</th>
                        <th style={{ textAlign: 'right' }}>Size</th>
                        <th style={{ textAlign: 'right' }}>Errors</th>
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
                                    <span style={{ animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite', opacity: 0.7 }}>Running...</span>
                                )}
                            </td>
                            <td>
                                <span className={styles.badge} style={{
                                    backgroundColor:
                                        item.status === 'completed' ? 'rgba(34, 197, 94, 0.1)' :
                                            item.status === 'failed' ? 'rgba(239, 68, 68, 0.1)' :
                                                item.status === 'running' ? 'rgba(59, 130, 246, 0.1)' : 'hsl(var(--muted))',
                                    color:
                                        item.status === 'completed' ? 'rgb(34, 197, 94)' :
                                            item.status === 'failed' ? 'rgb(239, 68, 68)' :
                                                item.status === 'running' ? 'rgb(59, 130, 246)' : 'hsl(var(--muted-foreground))',
                                    border: '1px solid currentColor',
                                    borderColor: 'currentColor',
                                    opacity: 0.9
                                }}>
                                    {item.status}
                                </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>{item.filesDownloaded}</td>
                            <td style={{ textAlign: 'right' }}>{item.postsProcessed ?? 0}</td>
                            <td style={{ textAlign: 'right' }}>{item.skippedCount ?? 0}</td>
                            <td style={{ textAlign: 'right' }}>{formatBytes(item.bytesDownloaded || 0)}</td>
                            <td style={{ textAlign: 'right', color: item.errorCount ? 'hsl(var(--destructive))' : 'inherit' }}>{item.errorCount}</td>
                        </tr>
                    ))}
                    {historyItems.length === 0 && (
                        <tr>
                            <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: 'hsl(var(--muted-foreground))' }}>
                                No history available.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
