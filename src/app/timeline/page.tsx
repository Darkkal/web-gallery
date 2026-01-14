'use client';

import { useState, useEffect } from 'react';
import { getMediaItems } from '../actions';
import styles from './page.module.css';

export default function TimelinePage() {
    const [items, setItems] = useState<any[]>([]);

    useEffect(() => {
        loadItems();
    }, []);

    async function loadItems() {
        const data = await getMediaItems();
        setItems(data);
    }

    // Group items by month
    const grouped = items.reduce((acc, item) => {
        const date = item.capturedAt ? new Date(item.capturedAt) : new Date(item.createdAt);
        const key = date.toLocaleString('default', { month: 'long', year: 'numeric' });
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
    }, {} as Record<string, any[]>);

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>Timeline</h1>
                <a href="/" className={styles.secondaryButton}>Back to Home</a>
            </header>

            <div className={styles.timeline}>
                {Object.entries(grouped).map(([date, groupItems]) => (
                    <div key={date} className={styles.group}>
                        <h2 className={styles.dateHeader}>{date}</h2>
                        <div className={styles.grid}>
                            {(groupItems as any[]).map((item) => (
                                <div key={item.id} className={styles.item}>
                                    {item.mediaType === 'video' ? (
                                        <video src={item.filePath} className={styles.media} controls />
                                    ) : (
                                        <img src={item.filePath} alt={item.title} className={styles.media} loading="lazy" />
                                    )}
                                    <div className={styles.info}>
                                        <p className={styles.itemDate}>
                                            {new Date(item.capturedAt || item.createdAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
                {items.length === 0 && <p className={styles.empty}>No items found.</p>}
            </div>
        </div>
    );
}
