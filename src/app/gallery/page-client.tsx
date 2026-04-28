'use client';

import { useState, useEffect, useCallback } from 'react';
import { deleteMediaItems } from '../actions';
import Lightbox from '../../components/Lightbox';
import MasonryGrid from '../../components/MasonryGrid';
import styles from './page.module.css';
import Image from 'next/image';
import { CheckSquare, Square } from 'lucide-react';
import { mergePixivMetadata, mergeTwitterMetadata, mergeGelbooruv02Metadata } from '@/lib/metadata';

interface MediaItem {
    id: number;
    filePath: string;
    mediaType: 'image' | 'video' | 'audio' | 'text';
    capturedAt: Date | null;
    createdAt: Date;
    postId: number | null;
}

interface Post {
    id: number;
    extractorType: string;
    jsonSourceId: string | null;
    internalSourceId: number | null;
    userId: string | null;
    date: string | null;
    title: string | null;
    content: string | null;
    url: string | null;
    metadataPath: string | null;
    createdAt: Date;
}

interface GalleryRow {
    item: MediaItem;
    post?: Post;
    twitter?: any;
    pixiv?: any;
    gelbooru?: any;
    user?: any;
    pixivUser?: any;
    source?: any;
}

interface GalleryGroup extends GalleryRow {
    groupItems: GalleryRow[];
    groupCount: number;
}

export default function GalleryPageClient({ 
    initialItems, 
    initialSearch, 
    initialSort 
}: { 
    initialItems: GalleryGroup[],
    initialSearch: string,
    initialSort: string
}) {
    const [items, setItems] = useState<GalleryGroup[]>(initialItems);

    const [searchQuery, setSearchQuery] = useState(initialSearch);
    const [sortBy, setSortBy] = useState(initialSort);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [mediaIndex, setMediaIndex] = useState(0); 
    const [columnCount, setColumnCount] = useState(4);

    // Selection state
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [deleting, setDeleting] = useState(false);

    const loadItems = useCallback(async () => {
        const res = await fetch(`/api/gallery?search=${encodeURIComponent(searchQuery)}&sortBy=${sortBy}`);
        if (res.ok) {
            const data = await res.json();
            setItems(data as GalleryGroup[]);
        }
    }, [searchQuery, sortBy]);

    // Initial load handled by props, but we need to react to changes
    useEffect(() => {
        const timer = setTimeout(() => {
            // Only fetch if something changed from initial state OR it's a subsequent change
            loadItems();
        }, 1000);

        return () => clearTimeout(timer);
    }, [searchQuery, sortBy, loadItems]);


    function toggleSelection(group: GalleryGroup) {
        const groupIds = group.groupItems.map((i) => i.item.id);
        const newSelected = new Set(selectedIds);

        const isPrimarySelected = newSelected.has(group.item.id);

        if (isPrimarySelected) {
            groupIds.forEach((id: number) => newSelected.delete(id));
        } else {
            groupIds.forEach((id: number) => newSelected.add(id));
        }
        setSelectedIds(newSelected);
    }

    function selectAll() {
        const allIds = items.flatMap(group => group.groupItems.map((i) => i.item.id));
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

    const currentGroup = selectedIndex !== null ? items[selectedIndex] : null;
    const currentItemRow = currentGroup ? currentGroup.groupItems[mediaIndex] : null;

    return (
        <div className={styles.container}>
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
                <button
                    className={selectionMode ? styles.activeButton : styles.secondaryButton}
                    onClick={() => {
                        setSelectionMode(!selectionMode);
                        if (!selectionMode) setSelectedIds(new Set());
                    }}
                    title={selectionMode ? 'Cancel Selection' : 'Select Items'}
                    style={{ padding: '0.4rem', lineHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                    {selectionMode ? <CheckSquare size={20} /> : <Square size={20} />}
                </button>

                {selectionMode && (
                    <button
                        className={styles.secondaryButton}
                        onClick={selectAll}
                        title="Select All"
                    >
                        Select All
                    </button>
                )}

                <div className={styles.separator} />

                <input
                    type="text"
                    placeholder="Search (e.g. source:pixiv, min_favs:100, tag)..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && loadItems()}
                    className={styles.input}
                    style={{ flex: 2 }}
                />
                <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value)}
                    className={styles.input}
                >
                    <option value="created-desc">Imported: Newest First</option>
                    <option value="created-asc">Oldest First</option>
                    <option value="captured-desc">Content Date: Newest First</option>
                    <option value="captured-asc">Content Date: Oldest First</option>
                </select>
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
                renderItem={(row: GalleryGroup, index: number) => {
                    const item = row.item;
                    const isSelected = selectedIds.has(item.id);
                    const count = row.groupCount || 1;

                    return (
                        <div
                            key={item.id}
                            className={`${styles.item} ${isSelected ? styles.selectedItem : ''}`}
                            onClick={() => {
                                if (selectionMode) {
                                    toggleSelection(row);
                                } else {
                                    setSelectedIndex(index);
                                    setMediaIndex(0);
                                }
                            }}
                        >
                            {selectionMode && (
                                <div className={styles.checkbox}>
                                    {isSelected ? '✓' : ''}
                                </div>
                            )}

                            {count > 1 && (
                                <div className={styles.countBadge} title={`${count} items`}>
                                    <span>❐</span> {count}
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
                                                await (e.currentTarget as HTMLVideoElement).play();
                                            } catch (err: unknown) {
                                                if (err instanceof Error && err.name !== 'AbortError') console.error(err);
                                            }
                                        }}
                                        onMouseOut={e => (e.currentTarget as HTMLVideoElement).pause()}
                                    />
                                    <div className={styles.videoBadge}>VIDEO</div>
                                </>
                            ) : (
                                <Image
                                    src={item.filePath}
                                    alt={row.post?.title || 'Media thumbnail'}
                                    className={styles.media}
                                    width={400}
                                    height={400}
                                    style={{ width: '100%', height: 'auto' }}
                                    unoptimized
                                    loading="lazy"
                                />
                            )}
                            {row.twitter && (
                                <div style={{ position: 'absolute', bottom: 0, background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '11px', width: '100%', padding: '4px', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>❤️ {row.twitter.favoriteCount}</span>
                                    {row.user && <span>@{row.user.username}</span>}
                                </div>
                            )}
                        </div>
                    )
                }}
            />

            {items.length === 0 && (
                <div className={styles.emptyState}>
                    <p>No media found. Add sources and scrape them, or click &quot;Scan Library&quot; if files exist.</p>
                </div>
            )}

            {
                currentGroup && currentItemRow && (
                    <Lightbox
                        item={currentItemRow.item}
                        tweet={currentItemRow.post?.extractorType === 'twitter' ? mergeTwitterMetadata(currentItemRow.post, currentItemRow.twitter) : undefined}
                        user={currentItemRow.post?.extractorType === 'twitter' ? currentItemRow.user : undefined}
                        pixiv={currentItemRow.post?.extractorType === 'pixiv' ? mergePixivMetadata(currentItemRow.post, currentItemRow.pixiv) : undefined}
                        gelbooru={currentItemRow.post?.extractorType === 'gelbooruv02' ? mergeGelbooruv02Metadata(currentItemRow.post, currentItemRow.gelbooru) : undefined}
                        pixivUser={currentItemRow.post?.extractorType === 'pixiv' ? currentItemRow.pixivUser : undefined}
                        onClose={() => setSelectedIndex(null)}
                        onNext={() => {
                            if (mediaIndex < currentGroup.groupItems.length - 1) {
                                setMediaIndex(mediaIndex + 1);
                            } else if (selectedIndex! < items.length - 1) {
                                setSelectedIndex(selectedIndex! + 1);
                                setMediaIndex(0);
                            }
                        }}
                        onPrev={() => {
                            if (mediaIndex > 0) {
                                setMediaIndex(mediaIndex - 1);
                            } else if (selectedIndex! > 0) {
                                const prevGroup = items[selectedIndex! - 1];
                                setSelectedIndex(selectedIndex! - 1);
                                setMediaIndex(prevGroup.groupItems.length - 1);
                            }
                        }}
                        onDelete={handleDeleteItem}
                    />
                )
            }
        </div >
    );
}
