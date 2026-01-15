'use client';

import { useState, useEffect } from 'react';
import { getMediaItems, scanLibrary } from '../actions';
import styles from './page.module.css';

export default function GalleryPage() {
    const [items, setItems] = useState<any[]>([]);
    const [scanning, setScanning] = useState(false);
    const [filters, setFilters] = useState({ username: '', minFavorites: 0 });

    useEffect(() => {
        loadItems();
    }, []);

    async function loadItems() {
        const data = await getMediaItems(filters.username || filters.minFavorites ? filters : undefined);
        setItems(data);
    }

    // Debounce filter changes or apply on submit?
    // Let's apply on "Apply" button or blur for simplicity, or effect with delay.
    // For now, let's add a "Filter" button.

    async function handleScan() {
        setScanning(true);
        await scanLibrary();
        await loadItems();
        setScanning(false);
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>Gallery</h1>
                <div className={styles.controls}>
                    <button
                        className={styles.button}
                        onClick={handleScan}
                        disabled={scanning}
                    >
                        {scanning ? 'Scanning...' : 'Scan Library'}
                    </button>
                    <a href="/" className={styles.secondaryButton}>Back to Home</a>
                </div>
            </header>

            <div className={styles.filterBar}>
                <input
                    type="text"
                    placeholder="Filter by Twitter Username"
                    value={filters.username}
                    onChange={e => setFilters({ ...filters, username: e.target.value })}
                    className={styles.input}
                />
                <input
                    type="number"
                    placeholder="Min Favorites"
                    value={filters.minFavorites || ''}
                    onChange={e => setFilters({ ...filters, minFavorites: parseInt(e.target.value) || 0 })}
                    className={styles.input}
                />
                <button onClick={loadItems} className={styles.button}>Apply Filters</button>
            </div>

            <div className={styles.grid}>
                {items.map((row) => {
                    const item = row.item;
                    return (
                        <div key={item.id} className={styles.item}>
                            {item.mediaType === 'video' ? (
                                <>
                                    <video src={item.filePath} className={styles.media} muted loop onMouseOver={e => e.currentTarget.play()} onMouseOut={e => e.currentTarget.pause()} />
                                    <div className={styles.videoBadge}>VIDEO</div>
                                </>
                            ) : (
                                <img src={item.filePath} alt={item.title} className={styles.media} loading="lazy" />
                            )}
                            {row.tweet && (
                                <div style={{ position: 'absolute', bottom: 0, background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '11px', width: '100%', padding: '4px', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>❤️ {row.tweet.favoriteCount}</span>
                                    {row.user && <span>@{row.user.username}</span>}
                                </div>
                            )}
                        </div>
                    )
                })}
                {items.length === 0 && (
                    <div className={styles.emptyState}>
                        <p>No media found. Add sources and scrape them, or click "Scan Library" if files exist.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
