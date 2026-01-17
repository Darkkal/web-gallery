'use client';

import { useState, useEffect } from 'react';
import { getMediaItems, scanLibrary, deleteMediaItems } from '../actions';
import Link from 'next/link';
import Lightbox from '../../components/Lightbox';
import MasonryGrid from '../../components/MasonryGrid';
import styles from './page.module.css';

export default function GalleryPage() {
    const [items, setItems] = useState<any[]>([]);
    const [scanning, setScanning] = useState(false);
    const [filters, setFilters] = useState({ username: '', minFavorites: 0 });
    const [sortBy, setSortBy] = useState('date-newest');
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [columnCount, setColumnCount] = useState(4);

    // Selection state
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        loadItems();
    }, []);

    useEffect(() => {
        loadItems();
    }, [sortBy]);

    async function loadItems() {
        const data = await getMediaItems(filters.username || filters.minFavorites || sortBy !== 'date-newest' ? { ...filters, sortBy } : undefined);
        setItems(data);
    }

    async function handleScan() {
        setScanning(true);
        await scanLibrary();
        await loadItems();
        setScanning(false);
    }

    function toggleSelection(id: number) {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    }

    function selectAll() {
        const allIds = items.map(row => row.item.id);
        setSelectedIds(new Set(allIds));
    }

    async function handleBulkDelete(deleteFiles: boolean) {
        if (selectedIds.size === 0) return;

        const message = deleteFiles
            ? `Permanently delete ${selectedIds.size} files from disk and database?`
            : `Delete ${selectedIds.size} records from the database? (Files stay on disk)`;

        if (!confirm(message)) return;

        setDeleting(true);
        try {
            await deleteMediaItems(Array.from(selectedIds), deleteFiles);
            setSelectedIds(new Set());
            setSelectionMode(false);
            await loadItems();
        } catch (err) {
            alert("Failed to delete items: " + err);
        } finally {
            setDeleting(false);
        }
    }

    async function handleDeleteItem(id: number, deleteFile: boolean) {
        setDeleting(true);
        try {
            await deleteMediaItems([id], deleteFile);
            setSelectedIndex(null);
            await loadItems();
        } catch (err) {
            alert("Failed to delete item: " + err);
        } finally {
            setDeleting(false);
        }
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>Gallery</h1>
                <div className={styles.controls}>
                    <button
                        className={selectionMode ? styles.activeButton : styles.secondaryButton}
                        onClick={() => {
                            setSelectionMode(!selectionMode);
                            if (selectionMode) setSelectedIds(new Set());
                        }}
                    >
                        {selectionMode ? 'Cancel Selection' : 'Select Items'}
                    </button>
                    {selectionMode && (
                        <button
                            className={styles.secondaryButton}
                            onClick={selectAll}
                        >
                            Select All ({items.length})
                        </button>
                    )}
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

            {selectionMode && selectedIds.size > 0 && (
                <div className={styles.bulkActionBar}>
                    <span>{selectedIds.size} items selected</span>
                    <div className={styles.bulkActionButtons}>
                        <button
                            className={styles.secondaryDeleteButton}
                            onClick={() => handleBulkDelete(false)}
                            disabled={deleting}
                        >
                            {deleting ? '...' : 'Delete from DB'}
                        </button>
                        <button
                            className={styles.deleteButton}
                            onClick={() => handleBulkDelete(true)}
                            disabled={deleting}
                        >
                            {deleting ? 'Deleting...' : 'Delete from Disk & DB'}
                        </button>
                    </div>
                </div>
            )}

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
                <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value)}
                    className={styles.input}
                >
                    <option value="date-newest">Date: Newest First</option>
                    <option value="date-oldest">Date: Oldest First</option>
                    <option value="favorites-most">Favorites: Most First</option>
                    <option value="favorites-least">Favorites: Least First</option>
                    <option value="filename-asc">Filename: A-Z</option>
                    <option value="filename-desc">Filename: Z-A</option>
                </select>
                <button onClick={loadItems} className={styles.button}>Apply Filters</button>
                <div className={styles.separator} />
                <div className={styles.sliderContainer}>
                    <label htmlFor="columns" className={styles.label}>Columns: {columnCount}</label>
                    <input
                        id="columns"
                        type="range"
                        min="1"
                        max="10"
                        value={columnCount}
                        onChange={e => setColumnCount(parseInt(e.target.value))}
                        className={styles.slider}
                    />
                </div>
            </div>

            <MasonryGrid
                items={items}
                columnCount={columnCount}
                renderItem={(row: any, index: number) => {
                    const item = row.item;
                    const isSelected = selectedIds.has(item.id);
                    return (
                        <div
                            key={item.id}
                            className={`${styles.item} ${isSelected ? styles.selectedItem : ''}`}
                            onClick={() => {
                                if (selectionMode) {
                                    toggleSelection(item.id);
                                } else {
                                    setSelectedIndex(index);
                                }
                            }}
                        >
                            {selectionMode && (
                                <div className={styles.checkbox}>
                                    {isSelected ? '✓' : ''}
                                </div>
                            )}
                            {item.mediaType === 'video' ? (
                                <>
                                    <video
                                        src={item.filePath}
                                        className={styles.media}
                                        muted
                                        loop
                                        onMouseOver={async e => {
                                            try {
                                                await e.currentTarget.play();
                                            } catch (err: any) {
                                                if (err.name !== 'AbortError') console.error(err);
                                            }
                                        }}
                                        onMouseOut={e => e.currentTarget.pause()}
                                    />
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
                }}
            />
            {items.length === 0 && (
                <div className={styles.emptyState}>
                    <p>No media found. Add sources and scrape them, or click "Scan Library" if files exist.</p>
                </div>
            )}

            {
                selectedIndex !== null && items[selectedIndex] && (
                    <Lightbox
                        item={items[selectedIndex].item}
                        tweet={items[selectedIndex].tweet}
                        user={items[selectedIndex].user}
                        pixiv={items[selectedIndex].pixiv}
                        pixivUser={items[selectedIndex].pixivUser}
                        onClose={() => setSelectedIndex(null)}
                        onNext={selectedIndex < items.length - 1 ? () => setSelectedIndex(selectedIndex + 1) : undefined}
                        onPrev={selectedIndex > 0 ? () => setSelectedIndex(selectedIndex - 1) : undefined}
                        onDelete={handleDeleteItem}
                    />
                )
            }
        </div >
    );
}
