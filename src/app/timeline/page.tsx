'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { getTimelinePosts, TimelinePost } from '../actions';
import Lightbox from '../../components/Lightbox';
import styles from './page.module.css';
import { mergePixivMetadata, mergeTwitterMetadata, mergeGelbooruv02Metadata } from '@/lib/metadata';

export default function TimelinePage() {
    const [posts, setPosts] = useState<TimelinePost[]>([]);
    const [selectedIndex, setSelectedIndex] = useState<{ postIndex: number, mediaIndex: number } | null>(null);

    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        async function loadPosts() {
            const data = await getTimelinePosts(1, 100, searchQuery); // Fetch 100 posts for now
            setPosts(data);
        }

        const timer = setTimeout(() => {
            loadPosts();
        }, 1000);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const openLightbox = (postIndex: number, mediaIndex: number, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedIndex({ postIndex, mediaIndex });
    };

    const closeLightbox = () => setSelectedIndex(null);

    // Prepare Lightbox Data from current selection
    const getLightboxProps = () => {
        if (!selectedIndex) return null;
        const post = posts[selectedIndex.postIndex];
        const media = post.mediaItems[selectedIndex.mediaIndex];

        // Helper call adaptation
        const pixivInput = post.type === 'pixiv' ? {
            id: post.pixivMetadata?.dbId || 0,
            jsonSourceId: post.pixivMetadata?.illustId?.toString() || null,
            title: post.content || null,
            content: post.content || null // TimelinePost doesn't separate title/caption well, checking content
        } : null;

        const pixivDetails = post.type === 'pixiv' ? {
            totalBookmarks: post.stats?.likes || 0,
            totalView: post.stats?.views || 0,
            pageCount: null
        } : null;

        const twitterInput = post.type === 'twitter' ? {
            jsonSourceId: null, // TimelinePost doesn't define tweetId explicitly in top level, maybe in ID string? skipping for now or assume internal logic
            content: post.content || null
        } : null;

        const twitterDetails = post.type === 'twitter' ? {
            favoriteCount: post.stats?.likes || 0,
            retweetCount: post.stats?.retweets || 0,
            bookmarkCount: post.stats?.bookmarks || 0,
            viewCount: post.stats?.views || 0
        } : null;

        // Note: TimelinePost structure is slightly different from DB row structure used in helper.
        // We are adapting it here to use the consistent helper output format.

        return {
            item: {
                id: media.id,
                filePath: media.url,
                mediaType: media.type,
                title: post.content, // Fallback
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
                jsonSourceId: null, // TimelinePost gelbooru metadata doesn't have ID? It has md5.
                url: post.sourceUrl || null
            }, {
                score: post.stats?.likes || 0,
                rating: null, // TimelinePost doesn't carry rating currently
                tags: post.gelbooruMetadata?.tags
            }) : undefined,
            pixivUser: post.type === 'pixiv' ? {
                name: post.author?.name,
                account: post.author?.handle,
                profileImage: post.author?.avatar,
            } : undefined,
        };
    };

    const lightboxProps = getLightboxProps();

    return (
        <div className={styles.container}>

            <div className={styles.filterBar} style={{ marginBottom: '1rem' }}>
                <input
                    type="text"
                    placeholder="Search timeline (e.g. source:twitter)..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className={styles.input} // Re-using gallery styles if imported or just basic style
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                />
            </div>

            <div className={styles.feed}>
                {posts.map((post, postIdx) => (
                    <article key={post.id} className={styles.postCard}>
                        {/* Header: Avatar, Name, Date */}
                        <div className={styles.postHeader}>
                            {post.author?.avatar ? (
                                <Image src={post.author.avatar} alt={post.author.name || 'User'} width={40} height={40} className={styles.avatar} unoptimized />
                            ) : (
                                <div className={styles.avatarPlaceholder} />
                            )}
                            <div className={styles.postMeta}>
                                <div className={styles.authorRow}>
                                    <span className={styles.authorName}>{post.author?.name || 'Unknown'}</span>
                                    {post.author?.handle && <span className={styles.authorHandle}>@{post.author.handle}</span>}
                                </div>
                                <div className={styles.dateRow}>
                                    <span className={styles.date}>
                                        {new Date(post.date).toLocaleString()}
                                    </span>
                                    {post.type !== 'other' && (
                                        <span className={`${styles.badge} ${styles[post.type]}`}>
                                            {post.type}
                                        </span>
                                    )}
                                </div>
                            </div>
                            {post.sourceUrl && (
                                <a href={post.sourceUrl} target="_blank" rel="noopener noreferrer" className={styles.sourceLink}>
                                    ↗
                                </a>
                            )}
                        </div>

                        {/* Content: Text */}
                        {post.content && (
                            <div
                                className={styles.postContent}
                                onClick={(e) => {
                                    // Find text media item index
                                    const textMediaIndex = post.mediaItems.findIndex(m => m.type === 'text');
                                    if (textMediaIndex !== -1) {
                                        openLightbox(postIdx, textMediaIndex, e);
                                    }
                                }}
                                style={{ cursor: post.mediaItems.some(m => m.type === 'text') ? 'pointer' : 'default' }}
                            >
                                {post.content}
                            </div>
                        )}

                        {/* Media Grid */}
                        {post.mediaItems.filter(m => m.type !== 'text').length > 0 && (
                            <div className={`${styles.mediaGrid} ${styles[`grid-${Math.min(post.mediaItems.filter(m => m.type !== 'text').length, 4)}`]}`}>
                                {post.mediaItems.map((media, originalIndex) => {
                                    if (media.type === 'text') return null;
                                    return (
                                        <div
                                            key={media.id}
                                            className={styles.mediaItem}
                                            onClick={(e) => openLightbox(postIdx, originalIndex, e)}
                                        >
                                            {media.type === 'video' ? (
                                                <video src={media.url} controls className={styles.media} />
                                            ) : (
                                                <img src={media.url} alt="" className={styles.media} loading="lazy" />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Stats Footer (Optional) */}
                        {post.stats && (
                            <div className={styles.postFooter}>
                                {post.stats.likes !== undefined && <span>♥ {post.stats.likes}</span>}
                                {post.stats.retweets !== undefined && <span>RP {post.stats.retweets}</span>}
                                {/* Add more stats as needed */}
                            </div>
                        )}
                    </article>
                ))}

                {posts.length === 0 && <p className={styles.empty}>No posts found.</p>}
            </div>

            {selectedIndex && lightboxProps && (
                <Lightbox
                    {...lightboxProps}
                    onClose={closeLightbox}
                    onNext={() => {
                        // Logic to go to next media in post, or next post?
                        // Standard behavior: Next media in post. If at end of post, next post.
                        const post = posts[selectedIndex.postIndex];
                        if (selectedIndex.mediaIndex < post.mediaItems.length - 1) {
                            setSelectedIndex({ ...selectedIndex, mediaIndex: selectedIndex.mediaIndex + 1 });
                        } else if (selectedIndex.postIndex < posts.length - 1) {
                            setSelectedIndex({ postIndex: selectedIndex.postIndex + 1, mediaIndex: 0 });
                        }
                    }}
                    onPrev={() => {
                        if (selectedIndex.mediaIndex > 0) {
                            setSelectedIndex({ ...selectedIndex, mediaIndex: selectedIndex.mediaIndex - 1 });
                        } else if (selectedIndex.postIndex > 0) {
                            const prevPost = posts[selectedIndex.postIndex - 1];
                            setSelectedIndex({ postIndex: selectedIndex.postIndex - 1, mediaIndex: prevPost.mediaItems.length - 1 });
                        }
                    }}
                    // Delete not implemented for Timeline View yet
                    onDelete={undefined}
                />
            )}
        </div>
    );
}
