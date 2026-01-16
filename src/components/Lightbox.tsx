'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from './Lightbox.module.css';

interface LightboxProps {
    item: any; // Using any for now matching the page usage
    tweet?: any;
    user?: any;
    onClose: () => void;
    onNext?: () => void;
    onPrev?: () => void;
}

export default function Lightbox({ item, tweet, user, onClose, onNext, onPrev }: LightboxProps) {
    const [showInfo, setShowInfo] = useState(true);

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
                            src={item.filePath}
                            className={styles.video}
                            controls
                            autoPlay
                            onClick={(e) => e.stopPropagation()}
                        />
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
                    <h2 className={styles.sidebarTitle}>{item.title || 'Untitled'}</h2>
                </div>

                {user && (
                    <div className={`${styles.section} ${styles.userCard}`}>
                        {user.profileImage && (
                            <img src={user.profileImage} alt={user.name} className={styles.avatar} />
                        )}
                        <div className={styles.userInfo}>
                            <span className={styles.userName}>{user.name}</span>
                            <span className={styles.userHandle}>@{user.nick || user.username}</span>
                        </div>
                    </div>
                )}

                <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>Details</h3>
                    <div className={styles.sectionContent}>
                        <p>{item.description || tweet?.content || 'No description available.'}</p>
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

                {(item.originalUrl || (tweet && tweet.tweetId && user)) && (
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
                    </div>
                )}
            </div>
        </div>
    );
}
