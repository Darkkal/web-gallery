'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { addSource, deleteSource, updateSource, getSourcesWithHistory } from '../actions';
import styles from './page.module.css';
import {
  LayoutGrid,
  List as ListIcon,
  Search,
  Trash2,
  Plus,
  Image as ImageIcon,
  Edit2,
  Check,
  X
} from 'lucide-react';

type Source = {
  id: number;
  url: string;
  name?: string;
  extractorType?: string;
  createdAt: string | Date;
  previewImage?: string;
};

export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [sortBy, setSortBy] = useState<'created' | 'name'>('created');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Edit State
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{ url: string; name: string }>({ url: '', name: '' });

  async function loadSources() {
    const data = await getSourcesWithHistory();
    return data as unknown as Source[];
  }

  useEffect(() => {
    let mounted = true;
    loadSources().then((data) => {
      if (mounted) setSources(data);
    });
    return () => { mounted = false; };
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newUrl) return;

    setLoading(true);
    await addSource(newUrl, newName); // Pass optional name
    setNewUrl('');
    setNewName('');
    const data = await loadSources();
    setSources(data);
    setLoading(false);
  }

  async function handleDeleteSelected() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} sources?`)) return;

    const ids = Array.from(selectedIds);
    for (const id of ids) {
      await deleteSource(id);
    }

    setSelectedIds(new Set());
    const data = await loadSources();
    setSources(data);
  }

  // Edit Handlers
  function startEditing(source: Source) {
    // Only allow editing in table view for now as requested
    setEditingId(source.id);
    setEditForm({ url: source.url, name: source.name || '' });
  }

  function cancelEditing() {
    setEditingId(null);
    setEditForm({ url: '', name: '' });
  }

  async function saveEdit(id: number) {
    // Optimistic update
    setSources(prev => prev.map(s => s.id === id ? { ...s, url: editForm.url, name: editForm.name } : s));

    await updateSource(id, { url: editForm.url, name: editForm.name });
    setEditingId(null);
    const data = await loadSources(); // Refresh to confirm
    setSources(data);
  }

  function toggleSelection(id: number) {
    if (editingId === id) return; // Don't select if editing
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  }

  function selectAll(filteredIds: number[]) {
    if (selectedIds.size === filteredIds.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredIds));
    }
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
        // Created desc
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return result;
  }, [sources, search, sortBy]);

  return (
    <div className={styles.container}>
      {/* Add Source Form */}
      <form onSubmit={handleAdd} className={styles.addForm}>
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

      {/* Controls */}
      <div className={styles.controlsBar}>
        <div className={styles.leftControls}>
          <div className={styles.searchWrapper}>
            <Search className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search sources..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className={styles.select}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'created' | 'name')}
          >
            <option value="created">Recently Added</option>
            <option value="name">Name (A-Z)</option>
          </select>
        </div>

        <div className={styles.rightControls}>
          {selectedIds.size > 0 && (
            <button
              className={styles.deleteButton}
              onClick={handleDeleteSelected}
            >
              <Trash2 size={18} />
              Delete ({selectedIds.size})
            </button>
          )}

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className={`${styles.actionButton} ${viewMode === 'card' ? styles.active : ''}`}
              onClick={() => setViewMode('card')}
              title="Grid View"
            >
              <LayoutGrid size={20} />
            </button>
            <button
              className={`${styles.actionButton} ${viewMode === 'table' ? styles.active : ''}`}
              onClick={() => setViewMode('table')}
              title="List View"
            >
              <ListIcon size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* List Area */}
      {viewMode === 'card' ? (
        <div className={styles.grid}>
          {filteredAndSortedSources.map(source => {
            const isSelected = selectedIds.has(source.id);
            const displayTitle = source.name || source.url.replace(/^https?:\/\//, '');

            return (
              <div
                key={source.id}
                className={`${styles.card} ${isSelected ? styles.selected : ''}`}
                onClick={() => toggleSelection(source.id)}
              >
                <div
                  className={styles.cardBg}
                  style={{
                    backgroundImage: source.previewImage ? `url(${source.previewImage})` : 'none',
                    backgroundColor: source.previewImage ? 'transparent' : 'hsl(var(--muted))'
                  }}
                />
                {!source.previewImage && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--muted-foreground))' }}>
                    <ImageIcon size={48} opacity={0.2} />
                  </div>
                )}

                <div className={styles.cardOverlay}>
                  <div className={styles.cardContent}>
                    <div className={styles.cardTitle} title={source.url}>{displayTitle}</div>
                    <div className={styles.cardMeta}>
                      <span className={styles.badge}>{source.extractorType}</span>
                    </div>
                  </div>
                </div>

                <div className={styles.checkboxOverlay}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    readOnly
                    className={styles.checkbox}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={filteredAndSortedSources.length > 0 && selectedIds.size === filteredAndSortedSources.length}
                    onChange={() => selectAll(filteredAndSortedSources.map(s => s.id))}
                  />
                </th>
                <th style={{ width: '60px' }}>Preview</th>
                <th style={{ width: '60px' }}></th>
                <th>Name / URL</th>
                <th>Type</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedSources.map(source => {
                const isSelected = selectedIds.has(source.id);
                const displayTitle = source.name || source.url;
                const isEditing = editingId === source.id;

                return (
                  <tr
                    key={source.id}
                    className={`${styles.tableRow} ${isSelected ? styles.selected : ''}`}
                    onClick={(e) => {
                      // Don't select if clicking specific specific controls
                      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'BUTTON') return;
                      if (!isEditing) toggleSelection(source.id);
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
                          <button className={styles.iconButton} onClick={() => saveEdit(source.id)} title="Save">
                            <Check size={16} className="text-green-500" />
                          </button>
                          <button className={styles.iconButton} onClick={cancelEditing} title="Cancel">
                            <X size={16} className="text-red-500" />
                          </button>
                        </div>
                      ) : (
                        <button
                          className={styles.iconButton}
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditing(source);
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
                            onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="Name"
                          />
                          <input
                            className={styles.input}
                            style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                            value={editForm.url}
                            onChange={e => setEditForm(prev => ({ ...prev, url: e.target.value }))}
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
              })}
            </tbody>
          </table>
        </div>
      )}

      {filteredAndSortedSources.length === 0 && (
        <div style={{ padding: '4rem', textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>
          No sources found.
        </div>
      )}
    </div>
  );
}
