'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { getPostTags } from '@/app/actions';
import styles from './Lightbox.module.css';
import { UnifiedPixivData, UnifiedTwitterData, UnifiedUserData, UnifiedGelbooruv02Data } from '@/lib/metadata';

interface LightboxProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    item: any; // Using any for now matching the page usage
    tweet?: UnifiedTwitterData;
    user?: UnifiedUserData;
    pixiv?: UnifiedPixivData;
    pixivUser?: UnifiedUserData;
    gelbooru?: UnifiedGelbooruv02Data;
    onClose: () => void;
    onNext?: () => void;
    onPrev?: () => void;
    onDelete?: (id: number, deleteFile: boolean) => void;
}

export default function Lightbox({ item, tweet, user, pixiv, pixivUser, gelbooru, onClose, onNext, onPrev, onDelete }: LightboxProps) {
    const [showInfo, setShowInfo] = useState(true);
    const [pixivTags, setPixivTags] = useState<{ name: string }[]>([]);
    const videoRef = useRef<HTMLVideoElement>(null);

    // Fetch Pixiv Tags
    useEffect(() => {
        if (pixiv?.id) {
            getPostTags(pixiv.id).then(setPixivTags).catch(console.error);
        } else {
            // eslint-disable-next-line
            setPixivTags([]);
        }
    }, [pixiv?.id]);

    const tags = gelbooru?.tags
        ? gelbooru.tags.map(tag => ({ name: tag, id: 0 }))
        : pixivTags;

    // Handle video playback errors
    useEffect(() => {
        if (item.mediaType === 'video' && videoRef.current) {
            const playVideo = async () => {
                try {
                    await videoRef.current?.play();
                } catch (err: unknown) {
                    if (err instanceof Error && err.name !== 'AbortError') {
                        console.error('Video playback error:', err);
                    }
                }
            };
            playVideo();
        }
    }, [item.id, item.mediaType, item.filePath]);

    async function handleDeleteDB() {
        if (!onDelete) return;
        if (confirm("Delete this record from the database? (File will stay on disk)")) {
            onDelete(item.id, false);
        }
    }

    async function handleDeleteDisk() {
        if (!onDelete) return;
        if (confirm("Permanently delete this file from disk and database?")) {
            onDelete(item.id, true);
        }
    }

    // Keyboard navigation
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
        if (e.key === 'ArrowRight' && onNext) onNext();
        if (e.key === 'ArrowLeft' && onPrev) onPrev();
    }, [onClose, onNext, onPrev]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    if (!item) return null;

    // Format date
    const date = item.capturedAt
        ? new Date(item.capturedAt)
        : (item.createdAt ? new Date(item.createdAt) : null);

    const formattedDate = date ? date.toLocaleString(undefined, {
        dateStyle: 'full',
        timeStyle: 'medium'
    }) : 'Unknown Date';

    return (
        <div className={styles.overlay}>
            {/* Main Image Area */}
            <div className={styles.mainArea} onClick={(e) => {
                // If clicking the background (not the image), close?
                // Or maybe clicking image toggles sidebar?
                // Let's make clicking background close.
                if (e.target === e.currentTarget) onClose();
            }}>
                {onPrev && (
                    <button className={`${styles.navButton} ${styles.prevButton}`} onClick={(e) => { e.stopPropagation(); onPrev(); }}>
                        ‹
                    </button>
                )}

                <div className={styles.mediaWrapper}>
                    {item.mediaType === 'video' ? (
                        <video
                            ref={videoRef}
                            src={item.filePath}
                            className={styles.video}
                            controls
                            onClick={(e) => e.stopPropagation()}
                        />
                    ) : item.mediaType === 'text' ? (
                        <div
                            className={styles.textContent}
                            onClick={(e) => { e.stopPropagation(); setShowInfo(!showInfo); }}
                        >
                            {item.title}
                        </div>
                    ) : (
                        <img
                            src={item.filePath}
                            alt={item.title || 'Gallery Image'}
                            className={styles.image}
                            onClick={(e) => { e.stopPropagation(); setShowInfo(!showInfo); }}
                        />
                    )}
                </div>

                {onNext && (
                    <button className={`${styles.navButton} ${styles.nextButton}`} onClick={(e) => { e.stopPropagation(); onNext(); }}>
                        ›
                    </button>
                )}

                <div className={styles.controls}>
                    {onDelete && (
                        <>
                            <button
                                className={`${styles.iconButton} ${styles.deleteDBButton}`}
                                onClick={(e) => { e.stopPropagation(); handleDeleteDB(); }}
                                title="Delete from DB ONLY"
                            >
                                🗑
                                <span className={styles.buttonBadge}>DB</span>
                            </button>
                            <button
                                className={`${styles.iconButton} ${styles.deleteDiskButton}`}
                                onClick={(e) => { e.stopPropagation(); handleDeleteDisk(); }}
                                title="Delete from Disk & DB"
                            >
                                🗑
                                <span className={styles.buttonBadge}>P</span>
                            </button>
                        </>
                    )}
                    <button
                        className={styles.iconButton}
                        onClick={(e) => { e.stopPropagation(); setShowInfo(!showInfo); }}
                        title="Toggle Info"
                    >
                        ⓘ
                    </button>
                    <button
                        className={styles.iconButton}
                        onClick={(e) => { e.stopPropagation(); onClose(); }}
                        title="Close"
                    >
                        ✕
                    </button>
                </div>
            </div>

            {/* Sidebar */}
            <div className={`${styles.sidebar} ${!showInfo ? styles.sidebarHidden : ''}`}>
                <div className={styles.sidebarHeader}>
                    <h2 className={styles.sidebarTitle}>{tweet ? null : (pixiv?.title || item.title || 'Untitled')}</h2>
                </div>

                {user && (
                    <div className={`${styles.section} ${styles.userCard}`}>
                        {user.profileImage && (
                            <Image src={user.profileImage || ''} alt={user.name || 'User'} width={48} height={48} className={styles.avatar} unoptimized />
                        )}
                        <div className={styles.userInfo}>
                            <span className={styles.userName}>{user.name}</span>
                            <span className={styles.userHandle}>@{user.nick || user.username}</span>
                        </div>
                    </div>
                )}

                {pixivUser && (
                    <div className={`${styles.section} ${styles.userCard}`}>
                        {pixivUser.profileImage && (
                            <Image src={pixivUser.profileImage || ''} alt={pixivUser.name || 'User'} width={48} height={48} className={styles.avatar} unoptimized />
                        )}
                        <div className={styles.userInfo}>
                            <span className={styles.userName}>{pixivUser.name}</span>
                            <span className={styles.userHandle}>@{pixivUser.account}</span>
                        </div>
                    </div>
                )}

                <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>Details</h3>
                    <div className={styles.sectionContent}>
                        <p>{pixiv?.caption || item.description || tweet?.content || 'No description available.'}</p>
                    </div>
                </div>

                <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>Date</h3>
                    <div className={styles.sectionContent}>
                        {formattedDate}
                    </div>
                </div>

                {tweet && (
                    <div className={styles.section}>
                        <h3 className={styles.sectionTitle}>Twitter Stats</h3>
                        <div className={styles.statsGrid}>
                            <div className={styles.statItem}>
                                <span className={styles.statValue}>{tweet.favoriteCount}</span>
                                <span className={styles.statLabel}>Likes</span>
                            </div>
                            <div className={styles.statItem}>
                                <span className={styles.statValue}>{tweet.retweetCount}</span>
                                <span className={styles.statLabel}>Retweets</span>
                            </div>
                            {tweet.viewCount && (
                                <div className={styles.statItem}>
                                    <span className={styles.statValue}>{tweet.viewCount}</span>
                                    <span className={styles.statLabel}>Views</span>
                                </div>
                            )}
                            {tweet.bookmarkCount && (
                                <div className={styles.statItem}>
                                    <span className={styles.statValue}>{tweet.bookmarkCount}</span>
                                    <span className={styles.statLabel}>Bookmarks</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {pixiv && (
                    <div className={styles.section}>
                        <h3 className={styles.sectionTitle}>Pixiv Stats</h3>
                        <div className={styles.statsGrid}>
                            <div className={styles.statItem}>
                                <span className={styles.statValue}>{pixiv.totalBookmarks}</span>
                                <span className={styles.statLabel}>Bookmarks</span>
                            </div>
                            <div className={styles.statItem}>
                                <span className={styles.statValue}>{pixiv.totalView}</span>
                                <span className={styles.statLabel}>Views</span>
                            </div>
                            {(pixiv.pageCount || 0) > 1 && (
                                <div className={styles.statItem}>
                                    <span className={styles.statValue}>{pixiv.pageCount || 0}</span>
                                    <span className={styles.statLabel}>Pages</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Gelbooru Info */}
                {gelbooru && (
                    <div className={styles.section}>
                        <h3 className={styles.sectionTitle}>Gelbooru Info</h3>
                        <div className={styles.statsGrid}>
                            {gelbooru.source && (
                                <div className={styles.statItem} style={{ gridColumn: '1 / -1' }}>
                                    {/* Assuming Link component is available or replace with <a> */}
                                    {/* <Link size={16} /> */}
                                    <a href={gelbooru.source || undefined} target="_blank" rel="noopener noreferrer" className={styles.link}>
                                        Source
                                    </a>
                                </div>
                            )}
                            <div className={styles.statItem}>
                                {/* Assuming Heart component is available or replace with icon */}
                                {/* <Heart size={16} /> */}
                                <span className={styles.statValue}>{gelbooru.score || 0}</span>
                                <span className={styles.statLabel}>Score</span>
                            </div>
                            {gelbooru.rating && (
                                <div className={styles.statItem}>
                                    <span className={styles.badge} style={{ textTransform: 'uppercase' }}>
                                        {gelbooru.rating}
                                    </span>
                                    <span className={styles.statLabel}>Rating</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {tags.length > 0 && (
                    <div className={styles.section}>
                        <h3 className={styles.sectionTitle}>Tags</h3>
                        <div className={styles.tagsContainer} style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {tags.map((tag, i) => (
                                <span key={i} className={styles.tagChip} style={{
                                    background: 'rgba(255,255,255,0.1)',
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    fontSize: '12px',
                                    color: '#ccc'
                                }}>
                                    #{tag.name}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {(item.originalUrl || (tweet && tweet.tweetId && user) || (pixiv && pixiv.pixivId)) && (
                    <div className={styles.section}>
                        <h3 className={styles.sectionTitle}>Source</h3>
                        {item.originalUrl && (
                            <a href={item.originalUrl} target="_blank" rel="noopener noreferrer" className={styles.linkButton} style={{ marginBottom: '10px' }}>
                                Open Original File
                            </a>
                        )}
                        {tweet && tweet.tweetId && user && (
                            <a href={`https://twitter.com/${user.nick || user.username}/status/${tweet.tweetId}`} target="_blank" rel="noopener noreferrer" className={styles.linkButton}>
                                View Tweet
                            </a>
                        )}
                        {pixiv && pixiv.pixivId && (
                            <a href={`https://www.pixiv.net/artworks/${pixiv.pixivId}`} target="_blank" rel="noopener noreferrer" className={styles.linkButton}>
                                View on Pixiv
                            </a>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
