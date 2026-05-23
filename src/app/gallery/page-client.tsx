"use client";

import { useState } from "react";
import { deleteMediaItems } from "@/app/actions/gallery";
import BulkActionBar from "@/app/gallery/components/BulkActionBar";
import FilterBar from "@/app/gallery/components/FilterBar";
import GalleryItem from "@/app/gallery/components/GalleryItem";
import styles from "@/app/gallery/page.module.css";
import InfiniteScrollSentinel from "@/components/InfiniteScrollSentinel";
import Lightbox from "@/components/Lightbox";
import MasonryGrid from "@/components/MasonryGrid";
import { useLightbox } from "@/hooks/useLightbox";
import { usePaginatedData } from "@/hooks/usePaginatedData";
import { useSelection } from "@/hooks/useSelection";
import type { UnifiedUserData } from "@/lib/metadata";
import { mergePixivMetadata, mergeTwitterMetadata } from "@/lib/metadata";
import type { GalleryGroup } from "@/types/media";

export default function GalleryPageClient({
  initialItems,
  initialSearch,
  initialSort,
  initialNextCursor,
  pageSize,
  scrollMode,
  loopVideos,
}: {
  initialItems: GalleryGroup[];
  initialSearch: string;
  initialSort: string;
  initialNextCursor: string | null;
  pageSize: number;
  scrollMode: "infinite" | "button";
  loopVideos: boolean;
}) {
  return (
    <GalleryPageContent
      initialItems={initialItems}
      initialSearch={initialSearch}
      initialSort={initialSort}
      initialNextCursor={initialNextCursor}
      pageSize={pageSize}
      scrollMode={scrollMode}
      loopVideos={loopVideos}
    />
  );
}

function GalleryPageContent({
  initialItems,
  initialSearch,
  initialSort,
  initialNextCursor,
  pageSize,
  scrollMode,
  loopVideos,
}: {
  initialItems: GalleryGroup[];
  initialSearch: string;
  initialSort: string;
  initialNextCursor: string | null;
  pageSize: number;
  scrollMode: "infinite" | "button";
  loopVideos: boolean;
}) {
  const [columnCount, setColumnCount] = useState(4);
  const [deleting, setDeleting] = useState(false);

  const {
    items,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    isLoading,
    loadMore,
    refresh,
    hasMore,
  } = usePaginatedData<GalleryGroup>({
    initialItems,
    initialNextCursor,
    initialSearch,
    initialSort,
    fetchPath: "/api/gallery",
    dataKey: "items",
    pageSize,
  });

  const {
    selectionMode,
    setSelectionMode,
    selectedIds,
    toggleGroupSelection,
    selectAll,
    clearSelection,
    selectedCount,
  } = useSelection();

  const {
    selectedIndex,
    mediaIndex,
    open: openLightbox,
    close: closeLightbox,
    next: nextLightbox,
    prev: prevLightbox,
    setSelectedIndex,
  } = useLightbox(items.length, (idx) => items[idx].groupItems.length);

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
      await refresh();
    } catch (err) {
      alert(`Failed to delete items: ${err}`);
    } finally {
      setDeleting(false);
    }
  }

  async function handleDeleteItem(id: number, deleteFile: boolean) {
    setDeleting(true);
    try {
      await deleteMediaItems([id], deleteFile);
      setSelectedIndex(null);
      await refresh();
    } catch (err) {
      alert(`Failed to delete item: ${err}`);
    } finally {
      setDeleting(false);
    }
  }

  const currentGroup = selectedIndex !== null ? items[selectedIndex] : null;
  const currentItemRow = currentGroup
    ? currentGroup.groupItems[mediaIndex]
    : null;

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
        onSelectAll={() =>
          selectAll(
            items.flatMap((group) => group.groupItems.map((i) => i.item.id)),
          )
        }
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        sortBy={sortBy}
        setSortBy={setSortBy}
        columnCount={columnCount}
        setColumnCount={setColumnCount}
        onRefresh={() => refresh()}
      />

      <MasonryGrid
        items={items}
        columnCount={columnCount}
        renderItem={(row: GalleryGroup, index: number) => (
          <GalleryItem
            key={row.item.id}
            row={row}
            isSelected={row.groupItems.some((i) => selectedIds.has(i.item.id))}
            selectionMode={selectionMode}
            onClick={() => {
              if (selectionMode) {
                toggleGroupSelection(
                  row.groupItems.map((i) => i.item.id),
                  row.item.id,
                );
              } else {
                openLightbox(index, 0);
              }
            }}
          />
        )}
      />

      {hasMore && scrollMode === "infinite" && (
        <InfiniteScrollSentinel
          loadMore={loadMore}
          hasMore={hasMore}
          isLoading={isLoading}
        />
      )}

      {hasMore && scrollMode === "button" && (
        <div className={styles.loadMoreContainer}>
          <button
            type="button"
            onClick={() => loadMore()}
            disabled={isLoading}
            className={`${styles.secondaryButton} ${styles.loadMoreButton}`}
          >
            {isLoading ? "Loading..." : "Load More"}
          </button>
        </div>
      )}

      {items.length === 0 && (
        <div className={styles.emptyState}>
          <p>
            No media found. Add sources and scrape them, or click &quot;Scan
            Library&quot; if files exist.
          </p>
        </div>
      )}

      {currentGroup && currentItemRow && (
        <Lightbox
          row={currentItemRow}
          tweet={
            currentItemRow.post?.extractorType === "twitter"
              ? mergeTwitterMetadata(
                  currentItemRow.post,
                  currentItemRow.twitter,
                )
              : undefined
          }
          user={
            currentItemRow.post?.extractorType === "twitter"
              ? (currentItemRow.user as UnifiedUserData)
              : undefined
          }
          pixiv={
            currentItemRow.post?.extractorType === "pixiv"
              ? mergePixivMetadata(currentItemRow.post, currentItemRow.pixiv)
              : undefined
          }
          pixivUser={
            currentItemRow.post?.extractorType === "pixiv"
              ? (currentItemRow.pixivUser as UnifiedUserData)
              : undefined
          }
          onClose={closeLightbox}
          onNext={nextLightbox}
          onPrev={prevLightbox}
          onDelete={handleDeleteItem}
          loopVideos={loopVideos}
        />
      )}
    </div>
  );
}
