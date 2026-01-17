'use client';

import { useState, useEffect } from 'react';
import { getMediaItems, deleteMediaItems } from '../actions';
import Lightbox from '../../components/Lightbox';
import styles from './page.module.css';

export default function TimelinePage() {
    const [items, setItems] = useState<any[]>([]);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

    // Selection state
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        loadItems();
    }, []);

    async function loadItems() {
        const data = await getMediaItems();
        setItems(data);
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

    // Group items by month
    const grouped = items.reduce((acc, row) => {
        const item = row.item;
        const date = item.capturedAt ? new Date(item.capturedAt) : new Date(item.createdAt);
        const key = date.toLocaleString('default', { month: 'long', year: 'numeric' });
        if (!acc[key]) acc[key] = [];
        acc[key].push(row);
        return acc;
    }, {} as Record<string, any[]>);

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>Timeline</h1>
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

            <div className={styles.timeline}>
                {Object.entries(grouped).map(([date, groupItems]) => (
                    <div key={date} className={styles.group}>
                        <h2 className={styles.dateHeader}>{date}</h2>
                        <div className={styles.grid}>
                            {(groupItems as any[]).map((row) => {
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
                                                setSelectedIndex(items.findIndex(i => i.item.id === item.id));
                                            }
                                        }}
                                    >
                                        {selectionMode && (
                                            <div className={styles.checkbox}>
                                                {isSelected ? '✓' : ''}
                                            </div>
                                        )}
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
                                )
                            })}
                        </div>
                    </div>
                ))}
                {items.length === 0 && <p className={styles.empty}>No items found.</p>}
            </div>

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
