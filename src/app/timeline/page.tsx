'use client';

import { useState, useEffect } from 'react';
import { getTimelinePosts, TimelinePost } from '../actions';
import Lightbox from '../../components/Lightbox';
import styles from './page.module.css';

export default function TimelinePage() {
    const [posts, setPosts] = useState<TimelinePost[]>([]);
    const [selectedIndex, setSelectedIndex] = useState<{ postIndex: number, mediaIndex: number } | null>(null);

    useEffect(() => {
        loadPosts();
    }, []);

    async function loadPosts() {
        const data = await getTimelinePosts(1, 100); // Fetch 100 posts for now
        setPosts(data);
    }

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

        // Adapt Post data to Lightbox expectations (backward compatibility format)
        // We construct "fake" objects that resemble the DB schema enough for Lightbox
        return {
            item: {
                id: media.id,
                filePath: media.url,
                mediaType: media.type,
                title: post.content, // Fallback
                capturedAt: post.date,
            },
            tweet: post.type === 'twitter' ? {
                content: post.content,
                favoriteCount: post.stats?.likes,
                retweetCount: post.stats?.retweets,
                bookmarkCount: post.stats?.bookmarks,
                viewCount: post.stats?.views,
            } : undefined,
            user: post.type === 'twitter' ? {
                name: post.author?.name,
                nick: post.author?.handle,
                profileImage: post.author?.avatar,
            } : undefined,
            pixiv: post.type === 'pixiv' ? {
                id: post.pixivMetadata?.dbId,
                pixivId: post.pixivMetadata?.illustId,
                title: post.content,
                totalBookmarks: post.stats?.likes,
                totalView: post.stats?.views,
            } : undefined,
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



            <div className={styles.feed}>
                {posts.map((post, postIdx) => (
                    <article key={post.id} className={styles.postCard}>
                        {/* Header: Avatar, Name, Date */}
                        <div className={styles.postHeader}>
                            {post.author?.avatar ? (
                                <img src={post.author.avatar} alt={post.author.name} className={styles.avatar} />
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
