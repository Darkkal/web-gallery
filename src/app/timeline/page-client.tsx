'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { TimelinePost } from '@/types/posts';
import Lightbox from '@/components/Lightbox';
import styles from '@/app/timeline/page.module.css';
import { mergePixivMetadata, mergeTwitterMetadata, mergeGelbooruv02Metadata } from '@/lib/metadata';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useLightbox } from '@/hooks/useLightbox';
import FilterBar from '@/app/timeline/components/FilterBar';
import PostCard from '@/app/timeline/components/PostCard';

export default function TimelinePageClient({
    initialPosts,
    initialNextCursor,
    initialSearch,
    initialSort
}: {
    initialPosts: TimelinePost[],
    initialNextCursor: string | null,
    initialSearch: string,
    initialSort: string
}) {
    const [posts, setPosts] = useState<TimelinePost[]>(initialPosts);
    const [searchQuery, setSearchQuery] = useState(initialSearch);
    const [sortBy, setSortBy] = useState(initialSort);
    const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
    const [isLoading, setIsLoading] = useState(false);

    // Shared Hooks
    const debouncedSearch = useDebouncedValue(searchQuery, 1000);
    const debouncedSort = useDebouncedValue(sortBy, 1000);

    const {
        selectedIndex,
        mediaIndex,
        open: openLightbox,
        close: closeLightbox,
        next: nextLightbox,
        prev: prevLightbox,
    } = useLightbox(posts.length, (idx) => posts[idx].mediaItems.length);

    const loadPosts = useCallback(async (isAppending = false) => {
        setIsLoading(true);
        try {
            const currentCursor = isAppending ? nextCursor : '';
            const res = await fetch(`/api/timeline?search=${encodeURIComponent(searchQuery)}&sortBy=${sortBy}&cursor=${currentCursor}&limit=50`);
            if (res.ok) {
                const data = await res.json();
                if (isAppending) {
                    setPosts(prev => [...prev, ...data.posts]);
                } else {
                    setPosts(data.posts);
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
        loadPosts(false);
    }, [debouncedSearch, debouncedSort, loadPosts]);

    // Prepare Lightbox Data from current selection
    const lightboxProps = useMemo(() => {
        if (selectedIndex === null) return null;
        const post = posts[selectedIndex];
        const media = post.mediaItems[mediaIndex];

        const pixivInput = post.type === 'pixiv' ? {
            id: post.pixivMetadata?.dbId || 0,
            jsonSourceId: post.pixivMetadata?.illustId?.toString() || null,
            title: post.title || null,
            content: post.content || null
        } : null;

        const pixivDetails = post.type === 'pixiv' ? {
            totalBookmarks: post.stats?.likes || 0,
            totalView: post.stats?.views || 0,
            pageCount: null
        } : null;

        const twitterInput = post.type === 'twitter' ? {
            jsonSourceId: null,
            content: post.content || null
        } : null;

        const twitterDetails = post.type === 'twitter' ? {
            favoriteCount: post.stats?.likes || 0,
            retweetCount: post.stats?.retweets || 0,
            bookmarkCount: post.stats?.bookmarks || 0,
            viewCount: post.stats?.views || 0
        } : null;

        return {
            item: {
                id: media.id,
                filePath: media.url,
                mediaType: media.type,
                title: post.title || post.content,
                capturedAt: post.date,
            },
            tweet: post.type === 'twitter' ? mergeTwitterMetadata(twitterInput, twitterDetails) : undefined,
            user: post.type === 'twitter' ? {
                name: post.author?.name,
                nick: post.author?.handle,
                profileImage: post.author?.avatar,
            } : undefined,
            pixiv: post.type === 'pixiv' ? mergePixivMetadata(pixivInput, pixivDetails) : undefined,
            gelbooru: post.type === 'other' && post.author?.name === 'Gelbooru' ? mergeGelbooruv02Metadata({
                id: post.internalDbId || 0,
                jsonSourceId: null,
                url: post.sourceUrl || null
            }, {
                score: post.stats?.likes || 0,
                rating: null,
                tags: post.gelbooruMetadata?.tags
            }) : undefined,
            pixivUser: post.type === 'pixiv' ? {
                name: post.author?.name,
                account: post.author?.handle,
                profileImage: post.author?.avatar,
            } : undefined,
        };
    }, [selectedIndex, mediaIndex, posts]);

    return (
        <div className={styles.container}>
            <FilterBar
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                sortBy={sortBy}
                setSortBy={setSortBy}
            />

            <div className={styles.feed}>
                {posts.map((post, postIdx) => (
                    <PostCard
                        key={post.id}
                        post={post}
                        postIndex={postIdx}
                        onMediaClick={openLightbox}
                    />
                ))}

                {posts.length === 0 && <p className={styles.empty}>No posts found.</p>}
            </div>

            {nextCursor && (
                <div className={styles.loadMoreContainer}>
                    <button
                        onClick={() => loadPosts(true)}
                        disabled={isLoading}
                        className={styles.secondaryButton}
                    >
                        {isLoading ? 'Loading...' : 'Load More'}
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
                />
            )}
        </div>
    );
}
