'use client';

import React from 'react';
import { Image as ImageIcon, Edit2, Check, X } from 'lucide-react';
import type { Source } from '@/types/source';
import styles from '../page.module.css';

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
          <img
            src={source.previewImage}
            alt=""
            className={styles.thumbnail}
          />
        ) : (
          <div className={styles.placeholderThumb}>
            <ImageIcon size={16} />
          </div>
        )}
      </td>
      <td>
        {isEditing ? (
          <div style={{ display: 'flex', gap: '4px' }}>
            <button className={styles.iconButton} onClick={(e) => { e.stopPropagation(); onSaveEdit(); }} title="Save">
              <Check size={16} className="text-green-500" />
            </button>
            <button className={styles.iconButton} onClick={(e) => { e.stopPropagation(); onCancelEditing(); }} title="Cancel">
              <X size={16} className="text-red-500" />
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <input
              className={styles.input}
              style={{ padding: '4px 8px', fontSize: '0.9rem' }}
              value={editForm.name}
              onChange={e => onEditFormChange({ name: e.target.value })}
              placeholder="Name"
            />
            <input
              className={styles.input}
              style={{ padding: '4px 8px', fontSize: '0.8rem' }}
              value={editForm.url}
              onChange={e => onEditFormChange({ url: e.target.value })}
              placeholder="URL"
            />
          </div>
        ) : (
          <>
            <div style={{ fontWeight: 500 }}>{displayTitle}</div>
            <div style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>{source.url}</div>
          </>
        )}
      </td>
      <td>
        <span className={styles.badge} style={{ color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))' }}>
          {source.extractorType}
        </span>
      </td>
      <td>
        {new Date(source.createdAt).toLocaleDateString()}
      </td>
    </tr>
  );
}
