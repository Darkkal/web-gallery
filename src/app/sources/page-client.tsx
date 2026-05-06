'use client';

import React, { useState, useMemo } from 'react';
import { addSource, deleteSource, updateSource } from '../actions';
import styles from './page.module.css';
import { useSelection } from '@/hooks/useSelection';
import type { Source } from '@/types/source';
import AddSourceForm from './components/AddSourceForm';
import ControlsBar from './components/ControlsBar';
import SourceCard from './components/SourceCard';
import SourceTableRow from './components/SourceTableRow';

export default function SourcesPageClient({ initialSources }: { initialSources: Source[] }) {
  const [sources, setSources] = useState<Source[]>(initialSources);
  const [newUrl, setNewUrl] = useState('');
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [sortBy, setSortBy] = useState<'created' | 'name'>('created');
  const [search, setSearch] = useState('');

  // Edit State
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{ url: string; name: string }>({ url: '', name: '' });

  const {
    selectedIds,
    toggleSelection,
    selectAll,
    selectedCount
  } = useSelection();

  async function loadSources() {
    const res = await fetch('/api/sources');
    const data = await res.json();
    return data as Source[];
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newUrl) return;

    setLoading(true);
    await addSource(newUrl, newName);
    setNewUrl('');
    setNewName('');
    const data = await loadSources();
    setSources(data);
    setLoading(false);
  }

  async function handleDeleteSelected() {
    if (selectedCount === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedCount} sources?`)) return;

    const ids = Array.from(selectedIds);
    for (const id of ids) {
      await deleteSource(id);
    }

    const data = await loadSources();
    setSources(data);
  }

  // Edit Handlers
  function startEditing(source: Source) {
    setEditingId(source.id);
    setEditForm({ url: source.url, name: source.name || '' });
  }

  function cancelEditing() {
    setEditingId(null);
    setEditForm({ url: '', name: '' });
  }

  async function saveEdit(id: number) {
    setSources(prev => prev.map(s => s.id === id ? { ...s, url: editForm.url, name: editForm.name } : s));
    await updateSource(id, { url: editForm.url, name: editForm.name });
    setEditingId(null);
    const data = await loadSources();
    setSources(data);
  }

  const filteredAndSortedSources = useMemo(() => {
    let result = [...sources];

    if (search) {
      const lower = search.toLowerCase();
      result = result.filter(s =>
        (s.name || '').toLowerCase().includes(lower) ||
        s.url.toLowerCase().includes(lower) ||
        (s.extractorType || '').toLowerCase().includes(lower)
      );
    }

    result.sort((a, b) => {
      if (sortBy === 'name') {
        return (a.name || a.url).localeCompare(b.name || b.url);
      } else {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return result;
  }, [sources, search, sortBy]);

  return (
    <div className={styles.container}>
      <AddSourceForm
        newUrl={newUrl}
        setNewUrl={setNewUrl}
        newName={newName}
        setNewName={setNewName}
        loading={loading}
        onSubmit={handleAdd}
      />

      <ControlsBar
        search={search}
        setSearch={setSearch}
        sortBy={sortBy}
        setSortBy={setSortBy}
        selectedCount={selectedCount}
        onDeleteSelected={handleDeleteSelected}
        viewMode={viewMode}
        setViewMode={setViewMode}
      />

      {viewMode === 'card' ? (
        <div className={styles.grid}>
          {filteredAndSortedSources.map(source => (
            <SourceCard
              key={source.id}
              source={source}
              isSelected={selectedIds.has(source.id)}
              onToggleSelection={() => toggleSelection(source.id)}
            />
          ))}
        </div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.thCheck}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={filteredAndSortedSources.length > 0 && selectedCount === filteredAndSortedSources.length}
                    onChange={() => selectAll(filteredAndSortedSources.map(s => s.id))}
                  />
                </th>
                <th className={styles.thThumb}>Preview</th>
                <th className={styles.thActions}></th>
                <th>Name / URL</th>
                <th>Type</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedSources.map(source => (
                <SourceTableRow
                  key={source.id}
                  source={source}
                  isSelected={selectedIds.has(source.id)}
                  isEditing={editingId === source.id}
                  editForm={editForm}
                  onEditFormChange={(updates) => setEditForm(prev => ({ ...prev, ...updates }))}
                  onToggleSelection={() => toggleSelection(source.id)}
                  onStartEditing={() => startEditing(source)}
                  onCancelEditing={cancelEditing}
                  onSaveEdit={() => saveEdit(source.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filteredAndSortedSources.length === 0 && (
        <div className={styles.emptyState}>
          No sources found.
        </div>
      )}
    </div>
  );
}
