'use client';

import { useState, useEffect } from 'react';
import { addSource, getSources, scrapeSource, deleteSource } from '../actions';
import styles from './page.module.css';

// Using client component for simplicity with server actions interactions
// In a fuller app, we might use a server component for the list and client for interactions.

export default function SourcesPage() {
  const [sources, setSources] = useState<any[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [scrapingId, setScrapingId] = useState<number | null>(null);

  useEffect(() => {
    loadSources();
  }, []);

  async function loadSources() {
    const data = await getSources();
    setSources(data);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newUrl) return;
    
    setLoading(true);
    await addSource(newUrl);
    setNewUrl('');
    await loadSources();
    setLoading(false);
  }

  async function handleScrape(id: number) {
    setScrapingId(id);
    try {
      await scrapeSource(id);
      await loadSources();
    } catch (err) {
      console.error(err);
      alert('Failed to scrape: ' + err);
    }
    setScrapingId(null);
  }

  async function handleDelete(id: number) {
    if (!confirm('Are you sure?')) return;
    await deleteSource(id);
    await loadSources();
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Sources</h1>
        <a href="/" className={styles.secondaryButton}>Back to Home</a>
      </header>

      <form onSubmit={handleAdd} className={styles.addForm}>
        <input
          type="url"
          className={styles.input}
          placeholder="Enter URL (Instagram, Twitter, YouTube, etc.)"
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          required
        />
        <button type="submit" className={styles.button} disabled={loading}>
          {loading ? 'Adding...' : 'Add Source'}
        </button>
      </form>

      <div className={styles.list}>
        {sources.map((source) => (
          <div key={source.id} className={styles.sourceItem}>
            <div className={styles.sourceInfo}>
              <h3>{source.name || source.url}</h3>
              <div className={styles.meta}>
                <span className={styles.badge}>{source.type}</span>
                <span>Last Scraped: {source.lastScrapedAt ? new Date(source.lastScrapedAt).toLocaleString() : 'Never'}</span>
              </div>
            </div>
            <div className={styles.actions}>
              <button 
                className={styles.button}
                onClick={() => handleScrape(source.id)}
                disabled={scrapingId === source.id}
              >
                {scrapingId === source.id ? 'Scraping...' : 'Scrape Now'}
              </button>
              <button 
                className={styles.secondaryButton}
                onClick={() => handleDelete(source.id)}
                disabled={scrapingId === source.id}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {sources.length === 0 && (
          <p style={{ textAlign: 'center', color: '#64748b' }}>No sources added yet.</p>
        )}
      </div>
    </div>
  );
}
