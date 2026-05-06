'use client';

import React from 'react';
import styles from '@/app/gallery/page.module.css';

interface BulkActionBarProps {
    selectedCount: number;
    onBulkDelete: (deleteFiles: boolean) => void;
    deleting: boolean;
}

export default function BulkActionBar({
    selectedCount,
    onBulkDelete,
    deleting
}: BulkActionBarProps) {
    if (selectedCount === 0) return null;

    return (
        <div className={styles.bulkActionBar}>
            <span>{selectedCount} items selected</span>
            <div className={styles.bulkActionButtons}>
                <button
                    className={styles.secondaryDeleteButton}
                    onClick={() => onBulkDelete(false)}
                    disabled={deleting}
                >
                    {deleting ? '...' : 'Delete from DB'}
                </button>
                <button
                    className={styles.deleteButton}
                    onClick={() => onBulkDelete(true)}
                    disabled={deleting}
                >
                    {deleting ? 'Deleting...' : 'Delete from Disk & DB'}
                </button>
            </div>
        </div>
    );
}
