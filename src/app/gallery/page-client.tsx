"use client";

import { useEffect, useState } from "react";
import { deleteMediaItems, refetchPostData } from "@/app/actions/gallery";
import BulkActionBar from "@/app/gallery/components/BulkActionBar";
import FilterBar from "@/app/gallery/components/FilterBar";
import GalleryItem from "@/app/gallery/components/GalleryItem";
import styles from "@/app/gallery/page.module.css";
import AddToPlaylistModal from "@/components/AddToPlaylistModal";
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
  infiniteScrollBuffer,
  loopVideos,
  autoplayVideos,
  muteAutoplayVideos,
  playlistId,
}: {
  initialItems: GalleryGroup[];
  initialSearch: string;
  initialSort: string;
  initialNextCursor: string | null;
  pageSize: number;
  scrollMode: "infinite" | "button";
  infiniteScrollBuffer: number;
  loopVideos: boolean;
  autoplayVideos: boolean;
  muteAutoplayVideos: boolean;
  playlistId?: number;
}) {
  return (
    <GalleryPageContent
      initialItems={initialItems}
      initialSearch={initialSearch}
      initialSort={initialSort}
      initialNextCursor={initialNextCursor}
      pageSize={pageSize}
      scrollMode={scrollMode}
      infiniteScrollBuffer={infiniteScrollBuffer}
      loopVideos={loopVideos}
      autoplayVideos={autoplayVideos}
      muteAutoplayVideos={muteAutoplayVideos}
      playlistId={playlistId}
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
  infiniteScrollBuffer,
  loopVideos,
  autoplayVideos,
  muteAutoplayVideos,
  playlistId,
}: {
  initialItems: GalleryGroup[];
  initialSearch: string;
  initialSort: string;
  initialNextCursor: string | null;
  pageSize: number;
  scrollMode: "infinite" | "button";
  infiniteScrollBuffer: number;
  loopVideos: boolean;
  autoplayVideos: boolean;
  muteAutoplayVideos: boolean;
  playlistId?: number;
}) {
  const [columnCount, setColumnCount] = useState(4);
  const [deleting, setDeleting] = useState(false);
  const [refetching, setRefetching] = useState(false);
  const [isAddToPlaylistOpen, setIsAddToPlaylistOpen] = useState(false);

  const [suppressSearch, setSuppressSearch] = useState(false);

  const {
    items,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    isLoading,
    isSearching,
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
    playlistId,
    suppressSearch,
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
    isPageLoading,
  } = useLightbox(items.length, (idx) => items[idx].groupItems.length, {
    onLoadMore: loadMore,
    hasMore,
    isLoading,
    preloadBuffer: 3,
  });

  // Keep background feed scroll in sync with lightbox active item
  useEffect(() => {
    if (selectedIndex !== null) {
      const element = document.getElementById(`gallery-item-${selectedIndex}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [selectedIndex]);

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

  async function handleBulkRefetch() {
    if (selectedCount === 0) return;

    // Find the unique post IDs of selected media items
    const selectedPostIds = new Set<number>();
    for (const group of items) {
      for (const gi of group.groupItems) {
        if (selectedIds.has(gi.item.id) && gi.post?.id) {
          selectedPostIds.add(gi.post.id);
        }
      }
    }

    const postIds = Array.from(selectedPostIds);
    if (postIds.length === 0) {
      alert("No posts with remote URLs are selected.");
      return;
    }

    setRefetching(true);
    try {
      const res = await refetchPostData(postIds);
      alert(
        `Refetch complete: ${res.successCount} succeeded, ${res.deletedCount} remote sources were deleted/unavailable.`,
      );
      clearSelection();
      await refresh();
    } catch (err) {
      alert(`Failed to refetch post data: ${err}`);
    } finally {
      setRefetching(false);
    }
  }

  async function handleRefetchSingle(postId: number) {
    await refetchPostData([postId]);
    await refresh();
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
          onAddToPlaylist={() => setIsAddToPlaylistOpen(true)}
          onBulkRefetch={handleBulkRefetch}
          deleting={deleting}
          refetching={refetching}
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
        onSuppressSearch={setSuppressSearch}
        isSearching={isSearching}
      />

      <MasonryGrid
        items={items}
        columnCount={columnCount}
        renderItem={(row: GalleryGroup, index: number) => (
          <GalleryItem
            key={row.item.id}
            row={row}
            id={`gallery-item-${index}`}
            isSelected={row.groupItems.some((i) => selectedIds.has(i.item.id))}
            selectionMode={selectionMode}
            autoplayVideos={autoplayVideos}
            muteAutoplayVideos={muteAutoplayVideos}
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
          rootMargin={`${infiniteScrollBuffer}px`}
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
          groupItems={currentGroup.groupItems}
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
          onRefetch={handleRefetchSingle}
          loopVideos={loopVideos}
          isPageLoading={isPageLoading}
        />
      )}

      <AddToPlaylistModal
        isOpen={isAddToPlaylistOpen}
        onClose={() => {
          setIsAddToPlaylistOpen(false);
          clearSelection();
        }}
        mediaItemIds={Array.from(selectedIds)}
      />
    </div>
  );
}
