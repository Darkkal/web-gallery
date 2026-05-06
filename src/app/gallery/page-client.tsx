'use client';

import { useState, useEffect, useCallback } from 'react';
import { deleteMediaItems } from '@/app/actions';
import Lightbox from '@/components/Lightbox';
import MasonryGrid from '@/components/MasonryGrid';
import styles from '@/app/gallery/page.module.css';
import { mergePixivMetadata, mergeTwitterMetadata, mergeGelbooruv02Metadata } from '@/lib/metadata';
import { GalleryGroup } from '@/types/gallery';
import { useSelection } from '@/hooks/useSelection';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useLightbox } from '@/hooks/useLightbox';
import FilterBar from '@/app/gallery/components/FilterBar';
import BulkActionBar from '@/app/gallery/components/BulkActionBar';
import GalleryItem from '@/app/gallery/components/GalleryItem';

export default function GalleryPageClient({ 
    initialItems, 
    initialSearch, 
    initialSort,
    initialNextCursor
}: { 
    initialItems: GalleryGroup[],
    initialSearch: string,
    initialSort: string,
    initialNextCursor: string | null
}) {
    const [items, setItems] = useState<GalleryGroup[]>(initialItems);
    const [searchQuery, setSearchQuery] = useState(initialSearch);
    const [sortBy, setSortBy] = useState(initialSort);
    const [columnCount, setColumnCount] = useState(4);
    const [deleting, setDeleting] = useState(false);
    const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
    const [isLoading, setIsLoading] = useState(false);

    // Shared Hooks
    const debouncedSearch = useDebouncedValue(searchQuery, 1000);
    const debouncedSort = useDebouncedValue(sortBy, 1000);
    
    const { 
        selectionMode, 
        setSelectionMode, 
        selectedIds, 
        toggleGroupSelection, 
        selectAll, 
        clearSelection,
        selectedCount 
    } = useSelection();

    const {
        selectedIndex,
        mediaIndex,
        open: openLightbox,
        close: closeLightbox,
        next: nextLightbox,
        prev: prevLightbox,
        setSelectedIndex,
        setMediaIndex
    } = useLightbox(items.length, (idx) => items[idx].groupItems.length);

    const loadItems = useCallback(async (isAppending = false) => {
        setIsLoading(true);
        try {
            const currentCursor = isAppending ? nextCursor : '';
            const res = await fetch(`/api/gallery?search=${encodeURIComponent(searchQuery)}&sortBy=${sortBy}&cursor=${currentCursor}&limit=50`);
            if (res.ok) {
                const data = await res.json();
                if (isAppending) {
                    setItems(prev => [...prev, ...data.items]);
                } else {
                    setItems(data.items);
                }
                setNextCursor(data.nextCursor);
            }
        } finally {
            setIsLoading(false);
        }
    }, [searchQuery, sortBy, nextCursor]);

    // Handle search/sort changes via debounced values
    useEffect(() => {
        setNextCursor(null);
        loadItems(false);
    }, [debouncedSearch, debouncedSort]);

    async function handleBulkDelete(deleteFiles: boolean) {
        if (selectedCount === 0) return;

        const message = deleteFiles
            ? `Permanently delete ${selectedCount} files from disk and database?`
            : `Delete ${selectedCount} records from the database? (Files stay on disk)`;

        if (!confirm(message)) return;

        setDeleting(true);
        try {
            await deleteMediaItems(Array.from(selectedIds), deleteFiles);
            clearSelection();
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
            {selectionMode && (
                <BulkActionBar 
                    selectedCount={selectedCount} 
                    onBulkDelete={handleBulkDelete} 
                    deleting={deleting} 
                />
            )}

            <FilterBar 
                selectionMode={selectionMode}
                setSelectionMode={(mode) => {
                    setSelectionMode(mode);
                    if (!mode) clearSelection();
                }}
                onSelectAll={() => selectAll(items.flatMap(group => group.groupItems.map(i => i.item.id)))}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                sortBy={sortBy}
                setSortBy={setSortBy}
                columnCount={columnCount}
                setColumnCount={setColumnCount}
                onRefresh={() => loadItems(false)}
            />

            <MasonryGrid
                items={items}
                columnCount={columnCount}
                renderItem={(row: GalleryGroup, index: number) => (
                    <GalleryItem 
                        key={row.item.id}
                        row={row}
                        isSelected={row.groupItems.some(i => selectedIds.has(i.item.id))}
                        selectionMode={selectionMode}
                        onClick={() => {
                            if (selectionMode) {
                                toggleGroupSelection(row.groupItems.map(i => i.item.id), row.item.id);
                            } else {
                                openLightbox(index, 0);
                            }
                        }}
                    />
                )}
            />

            {nextCursor && (
                <div className={styles.loadMoreContainer}>
                    <button 
                        onClick={() => loadItems(true)} 
                        disabled={isLoading}
                        className={`${styles.secondaryButton} ${styles.loadMoreButton}`}
                    >
                        {isLoading ? 'Loading...' : 'Load More'}
                    </button>
                </div>
            )}

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
                        onClose={closeLightbox}
                        onNext={nextLightbox}
                        onPrev={prevLightbox}
                        onDelete={handleDeleteItem}
                    />
                )
            }
        </div >
    );
}
