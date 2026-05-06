'use client';

import React from 'react';
import Image from 'next/image';
import styles from '../page.module.css';
import { GalleryGroup } from '@/types/gallery';

interface GalleryItemProps {
    row: GalleryGroup;
    isSelected: boolean;
    selectionMode: boolean;
    onClick: () => void;
}

export default function GalleryItem({
    row,
    isSelected,
    selectionMode,
    onClick
}: GalleryItemProps) {
    const item = row.item;
    const count = row.groupCount || 1;

    return (
        <div
            className={`${styles.item} ${isSelected ? styles.selectedItem : ''}`}
            onClick={onClick}
        >
            {selectionMode && (
                <div className={styles.checkbox}>
                    {isSelected ? '✓' : ''}
                </div>
            )}

            {count > 1 && (
                <div className={styles.countBadge} title={`${count} items`}>
                    <span>❐</span> {count}
                </div>
            )}

            {item.mediaType === 'video' ? (
                <>
                    <video
                        src={item.filePath}
                        className={styles.media}
                        muted
                        loop
                        onMouseOver={async e => {
                            try {
                                await (e.currentTarget as HTMLVideoElement).play();
                            } catch (err: unknown) {
                                if (err instanceof Error && err.name !== 'AbortError') console.error(err);
                            }
                        }}
                        onMouseOut={e => (e.currentTarget as HTMLVideoElement).pause()}
                    />
                    <div className={styles.videoBadge}>VIDEO</div>
                </>
            ) : (
                <Image
                    src={item.filePath}
                    alt={row.post?.title || 'Media thumbnail'}
                    className={styles.media}
                    width={400}
                    height={400}
                    style={{ width: '100%', height: 'auto' }}
                    unoptimized
                    loading="lazy"
                />
            )}
            {row.twitter && (
                <div className={styles.twitterOverlay}>
                    <span>❤️ {row.twitter.favoriteCount}</span>
                    {row.user && <span>@{row.user.username}</span>}
                </div>
            )}
        </div>
    );
}
