"use client";

import { useEffect, useMemo, useState } from "react";
import FilterBar from "@/app/timeline/components/FilterBar";
import PostCard from "@/app/timeline/components/PostCard";
import styles from "@/app/timeline/page.module.css";
import InfiniteScrollSentinel from "@/components/InfiniteScrollSentinel";
import Lightbox from "@/components/Lightbox";
import { useLightbox } from "@/hooks/useLightbox";
import { usePaginatedData } from "@/hooks/usePaginatedData";
import type { GalleryRow, PlatformDetails, PlatformUser } from "@/types/media";
import type { TimelinePost } from "@/types/posts";

export default function TimelinePageClient({
  initialPosts,
  initialNextCursor,
  initialSearch,
  initialSort,
  pageSize,
  scrollMode,
  infiniteScrollBuffer,
  loopVideos,
  autoplayVideos,
  muteAutoplayVideos,
  condensePostText,
  condensePostLines,
  autoHideControls,
  autoHideDelay,
  lightboxFitMode,
  lightboxZoomMin,
  lightboxZoomMax,
  lightboxZoomStep,
}: {
  initialPosts: TimelinePost[];
  initialNextCursor: string | null;
  initialSearch: string;
  initialSort: string;
  pageSize: number;
  scrollMode: "infinite" | "button";
  infiniteScrollBuffer: number;
  loopVideos: boolean;
  autoplayVideos: boolean;
  muteAutoplayVideos: boolean;
  condensePostText: boolean;
  condensePostLines: number;
  autoHideControls?: boolean;
  autoHideDelay?: number;
  lightboxFitMode?: "fitBoth" | "fitWidth" | "fitHeight";
  lightboxZoomMin?: number;
  lightboxZoomMax?: number;
  lightboxZoomStep?: number;
}) {
  return (
    <TimelinePageContent
      initialPosts={initialPosts}
      initialNextCursor={initialNextCursor}
      initialSearch={initialSearch}
      initialSort={initialSort}
      pageSize={pageSize}
      scrollMode={scrollMode}
      infiniteScrollBuffer={infiniteScrollBuffer}
      loopVideos={loopVideos}
      autoplayVideos={autoplayVideos}
      muteAutoplayVideos={muteAutoplayVideos}
      condensePostText={condensePostText}
      condensePostLines={condensePostLines}
      autoHideControls={autoHideControls}
      autoHideDelay={autoHideDelay}
      lightboxFitMode={lightboxFitMode}
      lightboxZoomMin={lightboxZoomMin}
      lightboxZoomMax={lightboxZoomMax}
      lightboxZoomStep={lightboxZoomStep}
    />
  );
}

function TimelinePageContent({
  initialPosts,
  initialNextCursor,
  initialSearch,
  initialSort,
  pageSize,
  scrollMode,
  infiniteScrollBuffer,
  loopVideos,
  autoplayVideos,
  muteAutoplayVideos,
  condensePostText,
  condensePostLines,
  autoHideControls,
  autoHideDelay,
  lightboxFitMode,
  lightboxZoomMin,
  lightboxZoomMax,
  lightboxZoomStep,
}: {
  initialPosts: TimelinePost[];
  initialNextCursor: string | null;
  initialSearch: string;
  initialSort: string;
  pageSize: number;
  scrollMode: "infinite" | "button";
  infiniteScrollBuffer: number;
  loopVideos: boolean;
  autoplayVideos: boolean;
  muteAutoplayVideos: boolean;
  condensePostText: boolean;
  condensePostLines: number;
  autoHideControls?: boolean;
  autoHideDelay?: number;
  lightboxFitMode?: "fitBoth" | "fitWidth" | "fitHeight";
  lightboxZoomMin?: number;
  lightboxZoomMax?: number;
  lightboxZoomStep?: number;
}) {
  const [suppressSearch, setSuppressSearch] = useState(false);

  const {
    items: posts,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    isLoading,
    isSearching,
    loadMore,
    hasMore,
  } = usePaginatedData<TimelinePost>({
    initialItems: initialPosts,
    initialNextCursor,
    initialSearch,
    initialSort,
    fetchPath: "/api/timeline",
    dataKey: "posts",
    pageSize,
    suppressSearch,
  });

  const {
    selectedIndex,
    mediaIndex,
    open: openLightbox,
    close: closeLightbox,
    next: nextLightbox,
    prev: prevLightbox,
    isPageLoading,
  } = useLightbox(posts.length, (idx) => posts[idx].mediaItems.length, {
    onLoadMore: loadMore,
    hasMore,
    isLoading,
    preloadBuffer: 3,
  });

  // Keep background feed scroll in sync with lightbox active item
  useEffect(() => {
    if (selectedIndex !== null) {
      const element = document.getElementById(`timeline-post-${selectedIndex}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [selectedIndex]);

  // Prepare Lightbox Data from current selection
  const lightboxProps = useMemo(() => {
    if (selectedIndex === null) return null;
    const post = posts[selectedIndex];
    const media = post.mediaItems[mediaIndex];

    let platformDetails: PlatformDetails | null = null;
    let platformUser: PlatformUser | null = null;

    if (post.author) {
      platformUser = {
        extractorType: post.type,
        id: null,
        name: post.author.name || null,
        username: post.author.handle || null,
        profileImage: post.author.avatar || null,
        data: {},
      };
    }

    if (post.type === "twitter") {
      platformDetails = {
        extractorType: "twitter",
        data: {
          favoriteCount: post.stats?.likes || 0,
          retweetCount: post.stats?.retweets || 0,
          bookmarkCount: post.stats?.bookmarks || 0,
          viewCount: post.stats?.views || 0,
        },
      };
    } else if (post.type === "pixiv") {
      platformDetails = {
        extractorType: "pixiv",
        data: {
          totalBookmarks: post.stats?.likes || 0,
          totalView: post.stats?.views || 0,
          pageCount: null,
          title: post.title || null,
          caption: post.content || null,
        },
      };
    } else if (post.type === "other" && post.author?.name === "Gelbooru") {
      platformDetails = {
        extractorType: "gelbooruv02",
        data: {
          score: post.stats?.likes || 0,
          rating: null,
          source: post.sourceUrl || null,
          tags: post.gelbooruMetadata?.tags || [],
        },
      };
    }

    return {
      row: {
        item: {
          id: media.id,
          filePath: media.url,
          mediaType: media.type,
          capturedAt: post.date ? new Date(post.date) : null,
          createdAt: post.date ? new Date(post.date) : new Date(),
          postId: post.internalDbId || null,
        },
        post: {
          id: post.internalDbId || 0,
          title: post.title || post.content || null,
          extractorType: post.type,
          jsonSourceId: post.sourceUrl || null, // approximation
          internalSourceId: post.internalDbId || null,
          userId: post.author?.handle || null,
          date: post.date
            ? typeof post.date === "string"
              ? post.date
              : (post.date as Date).toISOString()
            : null,
          content: post.content || null,
          url: post.sourceUrl || null,
          metadataPath: null,
          createdAt: post.date ? new Date(post.date) : new Date(),
        },
        platformDetails,
        platformUser,
      } as GalleryRow,
    };
  }, [selectedIndex, mediaIndex, posts]);

  return (
    <div className={styles.container}>
      <FilterBar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        sortBy={sortBy}
        setSortBy={setSortBy}
        onSuppressSearch={setSuppressSearch}
        isSearching={isSearching}
      />

      <div className={styles.feed}>
        {posts.map((post, postIdx) => (
          <PostCard
            key={post.id}
            post={post}
            postIndex={postIdx}
            id={`timeline-post-${postIdx}`}
            onMediaClick={openLightbox}
            loopVideos={loopVideos}
            autoplayVideos={autoplayVideos}
            muteAutoplayVideos={muteAutoplayVideos}
            condensePostText={condensePostText}
            condensePostLines={condensePostLines}
          />
        ))}

        {posts.length === 0 && <p className={styles.empty}>No posts found.</p>}
      </div>

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
            className={styles.secondaryButton}
          >
            {isLoading ? "Loading..." : "Load More"}
          </button>
        </div>
      )}

      {selectedIndex !== null && lightboxProps && (
        <Lightbox
          {...lightboxProps}
          onClose={closeLightbox}
          onNext={nextLightbox}
          onPrev={prevLightbox}
          onDelete={undefined}
          loopVideos={loopVideos}
          isPageLoading={isPageLoading}
          autoHideControls={autoHideControls}
          autoHideDelay={autoHideDelay}
          fitMode={lightboxFitMode}
          zoomMin={lightboxZoomMin}
          zoomMax={lightboxZoomMax}
          zoomStep={lightboxZoomStep}
        />
      )}
    </div>
  );
}
