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
      <div className={styles.formInputRow}>
        <input
          type="url"
          placeholder=" https://..."
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          required
          className={`${styles.input} ${styles.inputWide}`}
        />
        <input
          type="text"
          placeholder="Name (Optional)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className={styles.input}
        />
      </div>
      <button type="submit" className={styles.button} disabled={loading}>
        <Plus size={18} />
        {loading ? 'Adding...' : 'Add'}
      </button>
    </form>
  );
}
