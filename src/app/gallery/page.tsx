'use client';

import { useState, useEffect } from 'react';
import { getMediaItems, scanLibrary } from '../actions';
import styles from './page.module.css';

export default function GalleryPage() {
    const [items, setItems] = useState<any[]>([]);
    const [scanning, setScanning] = useState(false);

    useEffect(() => {
        loadItems();
    }, []);

    async function loadItems() {
        const data = await getMediaItems();
        setItems(data);
    }

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

            <div className={styles.grid}>
                {items.map((item) => (
                    <div key={item.id} className={styles.item}>
                        {item.mediaType === 'video' ? (
                            <>
                                <video src={item.filePath} className={styles.media} muted loop onMouseOver={e => e.currentTarget.play()} onMouseOut={e => e.currentTarget.pause()} />
                                <div className={styles.videoBadge}>VIDEO</div>
                            </>
                        ) : (
                            <img src={item.filePath} alt={item.title} className={styles.media} loading="lazy" />
                        )}
                    </div>
                ))}
                {items.length === 0 && (
                    <div className={styles.emptyState}>
                        <p>No media found. Add sources and scrape them, or click "Scan Library" if files exist.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
