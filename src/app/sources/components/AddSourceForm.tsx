'use client';

import React from 'react';
import { Plus } from 'lucide-react';
import styles from '../page.module.css';

interface AddSourceFormProps {
  newUrl: string;
  setNewUrl: (url: string) => void;
  newName: string;
  setNewName: (name: string) => void;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export default function AddSourceForm({
  newUrl,
  setNewUrl,
  newName,
  setNewName,
  loading,
  onSubmit
}: AddSourceFormProps) {
  return (
    <form onSubmit={onSubmit} className={styles.addForm}>
      <h3>Add Source</h3>
      <div style={{ display: 'flex', gap: '0.5rem', flex: 1 }}>
        <input
          type="url"
          className={styles.input}
          placeholder=" https://..."
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          required
          style={{ flex: 2 }}
        />
        <input
          type="text"
          className={styles.input}
          placeholder="Name (Optional)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          style={{ flex: 1 }}
        />
      </div>
      <button type="submit" className={styles.button} disabled={loading}>
        <Plus size={18} />
        {loading ? 'Adding...' : 'Add'}
      </button>
    </form>
  );
}
