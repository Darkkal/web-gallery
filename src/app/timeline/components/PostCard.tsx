'use client';

import React from 'react';
import Image from 'next/image';
import type { TimelinePost } from '@/lib/db/repositories/posts';
import styles from '@/app/timeline/page.module.css';

import FormattedContent from '@/components/FormattedContent';

interface PostCardProps {
    post: TimelinePost;
    postIndex: number;
    onMediaClick: (postIndex: number, mediaIndex: number, e: React.MouseEvent) => void;
}

export default function PostCard({
    post,
    postIndex,
    onMediaClick
}: PostCardProps) {
    return (
        <article className={styles.postCard}>
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
                        // Don't trigger media click if we're clicking a link in the HTML
                        if ((e.target as HTMLElement).tagName === 'A') return;
                        
                        const textMediaIndex = post.mediaItems.findIndex(m => m.type === 'text');
                        if (textMediaIndex !== -1) {
                            onMediaClick(postIndex, textMediaIndex, e);
                        }
                    }}
                    style={{ cursor: post.mediaItems.some(m => m.type === 'text') ? 'pointer' : 'default' }}
                >
                    <FormattedContent content={post.content} />
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
                                onClick={(e) => onMediaClick(postIndex, originalIndex, e)}
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

            {/* Stats Footer */}
            {post.stats && (
                <div className={styles.postFooter}>
                    {post.stats.likes !== undefined && <span>♥ {post.stats.likes}</span>}
                    {post.stats.retweets !== undefined && <span>RP {post.stats.retweets}</span>}
                </div>
            )}
        </article>
    );
}
