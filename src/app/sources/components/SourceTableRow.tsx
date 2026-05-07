'use client';

import React from 'react';
import Image from 'next/image';
import { Image as ImageIcon, Edit2, Check, X } from 'lucide-react';
import type { Source } from '@/types/source';
import styles from '@/app/sources/page.module.css';

interface SourceTableRowProps {
    source: Source;
    isSelected: boolean;
    isEditing: boolean;
    editForm: { url: string; name: string };
    onEditFormChange: (updates: Partial<{ url: string; name: string }>) => void;
    onToggleSelection: () => void;
    onStartEditing: () => void;
    onCancelEditing: () => void;
    onSaveEdit: () => void;
}

export default function SourceTableRow({
    source,
    isSelected,
    isEditing,
    editForm,
    onEditFormChange,
    onToggleSelection,
    onStartEditing,
    onCancelEditing,
    onSaveEdit
}: SourceTableRowProps) {
    const displayTitle = source.name || source.url;

    return (
        <tr
            className={`${styles.tableRow} ${isSelected ? styles.selected : ''}`}
            onClick={(e) => {
                // Don't select if clicking specific specific controls
                if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'BUTTON' || (e.target as HTMLElement).closest('button')) return;
                if (!isEditing) onToggleSelection();
            }}
        >
            <td>
                <input
                    type="checkbox"
                    checked={isSelected}
                    readOnly
                    className={styles.checkbox}
                    disabled={isEditing}
                />
            </td>
            <td>
                {source.previewImage ? (
                    <Image
                        src={source.previewImage}
                        alt=""
                        className={styles.thumbnail}
                        width={50}
                        height={50}
                    />
                ) : (
                    <div className={styles.placeholderThumb}>
                        <ImageIcon size={16} />
                    </div>
                )}
            </td>
            <td>
                {isEditing ? (
                    <div className={styles.editActions}>
                        <button className={styles.iconButton} onClick={(e) => { e.stopPropagation(); onSaveEdit(); }} title="Save">
                            <Check size={16} className={styles.iconSuccess} />
                        </button>
                        <button className={styles.iconButton} onClick={(e) => { e.stopPropagation(); onCancelEditing(); }} title="Cancel">
                            <X size={16} className={styles.iconDanger} />
                        </button>
                    </div>
                ) : (
                    <button
                        className={styles.iconButton}
                        onClick={(e) => {
                            e.stopPropagation();
                            onStartEditing();
                        }}
                        title="Edit"
                    >
                        <Edit2 size={16} />
                    </button>
                )}
            </td>
            <td>
                {isEditing ? (
                    <div className={styles.editFields}>
                        <input
                            className={`${styles.input} ${styles.editInput}`}
                            value={editForm.name}
                            onChange={e => onEditFormChange({ name: e.target.value })}
                            placeholder="Name"
                        />
                        <input
                            className={`${styles.input} ${styles.editInputSmall}`}
                            value={editForm.url}
                            onChange={e => onEditFormChange({ url: e.target.value })}
                            placeholder="URL"
                        />
                    </div>
                ) : (
                    <>
                        <div className={styles.sourceTitle}>{displayTitle}</div>
                        <div className={styles.sourceUrl}>{source.url}</div>
                    </>
                )}
            </td>
            <td>
                <span className={`${styles.badge} ${styles.tableBadge}`}>
                    {source.extractorType}
                </span>
            </td>
            <td>
                {new Date(source.createdAt).toLocaleDateString()}
            </td>
        </tr>
    );
}
