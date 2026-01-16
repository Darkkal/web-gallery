'use client';

import { useState, useEffect } from 'react';
import { addSource, getSources, scrapeSource, deleteSource, getScrapingStatuses, stopScrapingSource } from '../actions';
import { ScrapingStatus } from '@/lib/scrapers/manager';
import styles from './page.module.css';

export default function SourcesPage() {
  const [sources, setSources] = useState<any[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [scrapingStatuses, setScrapingStatuses] = useState<ScrapingStatus[]>([]);

  useEffect(() => {
    loadSources();
    const interval = setInterval(async () => {
      const statuses = await getScrapingStatuses();
      setScrapingStatuses(statuses);
    }, 2000);
    return () => clearInterval(interval);
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
    try {
      await scrapeSource(id);
      await loadSources();
    } catch (err) {
      console.error(err);
      alert('Failed to scrape: ' + err);
    }
  }

  async function handleStop(id: number) {
    try {
      await stopScrapingSource(id);
      await loadSources();
    } catch (err) {
      console.error(err);
      alert('Failed to stop scrape: ' + err);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Are you sure?')) return;
    try {
      await deleteSource(id);
      await loadSources();
    } catch (err) {
      console.error(err);
      alert('Failed to delete source: ' + err);
    }
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
        {sources.map((source) => {
          const status = scrapingStatuses.find(s => s.sourceId === source.id);
          const isScraping = !!status && !status.isFinished;

          return (
            <div key={source.id} className={styles.sourceItem} style={{ flexDirection: 'column', alignItems: 'stretch', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className={styles.sourceInfo}>
                  <h3>{source.name || source.url}</h3>
                  <div className={styles.meta}>
                    <span className={styles.badge}>{source.type}</span>
                    <span>Last Scraped: {source.lastScrapedAt ? new Date(source.lastScrapedAt).toLocaleString() : 'Never'}</span>
                  </div>
                </div>
                <div className={styles.actions}>
                  {isScraping ? (
                    <button
                      className={styles.stopButton}
                      onClick={() => handleStop(source.id)}
                    >
                      Stop
                    </button>
                  ) : (
                    <button
                      className={styles.button}
                      onClick={() => handleScrape(source.id)}
                    >
                      Scrape Now
                    </button>
                  )}
                  <button
                    className={styles.secondaryButton}
                    onClick={() => handleDelete(source.id)}
                    disabled={isScraping}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {status && (
                <div className={styles.progressInfo}>
                  <div className={styles.progressRows}>
                    <div className={styles.progressItem}>
                      <span className={styles.progressLabel}>Status:</span>
                      <span>
                        {status.isFinished ? 'Finished' : 'Scraping...'}
                        {status.isRateLimited && <span className={styles.rateLimit}>Rate Limited</span>}
                      </span>
                    </div>
                    <div className={styles.progressItem}>
                      <span className={styles.progressLabel}>Downloaded:</span>
                      <span>{status.downloadedCount} posts/files</span>
                    </div>
                    <div className={styles.progressItem}>
                      <span className={styles.progressLabel}>Speed:</span>
                      <span>{status.speed}</span>
                    </div>
                    <div className={styles.progressItem}>
                      <span className={styles.progressLabel}>Total Size:</span>
                      <span>{status.totalSize}</span>
                    </div>
                    {status.errorCount > 0 && (
                      <div className={styles.progressItem}>
                        <span className={styles.progressLabel}>Errors:</span>
                        <span className={styles.errorItem}>{status.errorCount}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {sources.length === 0 && (
          <p style={{ textAlign: 'center', color: '#64748b' }}>No sources added yet.</p>
        )}
      </div>
    </div>
  );
}
