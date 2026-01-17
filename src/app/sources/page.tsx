'use client';

import React, { useState, useEffect } from 'react';
import { addSource, getSources, scrapeSource, deleteSource, getScrapingStatuses, stopScrapingSource, getSourcesWithHistory, scanLibrary } from '../actions';
import { ScrapingStatus } from '@/lib/scrapers/manager';
import styles from './page.module.css';

export default function SourcesPage() {
  const [sources, setSources] = useState<any[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scrapingStatuses, setScrapingStatuses] = useState<ScrapingStatus[]>([]);

  const pollingIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const lastActiveTimeRef = React.useRef<number>(Date.now());

  const stopPolling = React.useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  const startPolling = React.useCallback(() => {
    if (pollingIntervalRef.current) return;

    console.log('[SourcesPage] Starting status polling...');
    lastActiveTimeRef.current = Date.now();

    pollingIntervalRef.current = setInterval(async () => {
      const statuses = await getScrapingStatuses();
      setScrapingStatuses(statuses);

      const hasActive = statuses.some(s => !s.isFinished);
      if (hasActive) {
        lastActiveTimeRef.current = Date.now();
      } else {
        // If nothing is active, check if we should stop polling
        if (Date.now() - lastActiveTimeRef.current > 30000) {
          console.log('[SourcesPage] No active scrapes for 30s, stopping polling.');
          stopPolling();
        }
      }
    }, 5000);
  }, [stopPolling]);

  useEffect(() => {
    loadSources();

    // Initial check: if there are any active scrapes from a previous session, start polling
    getScrapingStatuses().then(statuses => {
      setScrapingStatuses(statuses);
      if (statuses.some(s => !s.isFinished)) {
        startPolling();
      }
    });

    return () => stopPolling();
  }, [startPolling, stopPolling]);

  async function handleScan() {
    setScanning(true);
    await scanLibrary();
    setScanning(false);
  }

  async function triggerStatusUpdate() {
    const statuses = await getScrapingStatuses();
    setScrapingStatuses(statuses);
    if (statuses.some(s => !s.isFinished)) {
      startPolling();
    }
  }

  async function loadSources() {
    const data = await getSourcesWithHistory();
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
      await triggerStatusUpdate();
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

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  function formatDuration(start: Date | string, end: Date | string): string {
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    const durationMs = endTime - startTime;
    const seconds = Math.floor(durationMs / 1000);

    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }

  return (
    <div className={styles.container}>



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
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={handleScan}
          disabled={scanning}
        >
          {scanning ? 'Scanning...' : 'Scan Library'}
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

              {/* Display last scrape history if available */}
              {source.lastScrape && !status && (
                <div className={styles.historyInfo}>
                  <div className={styles.progressRows}>
                    <div className={styles.progressItem}>
                      <span className={styles.progressLabel}>Last Attempt:</span>
                      <span>
                        {new Date(source.lastScrape.startTime).toLocaleString()}
                        {' '}
                        <span className={`${styles.badge} ${styles[`status-${source.lastScrape.status}`]}`}>
                          {source.lastScrape.status}
                        </span>
                      </span>
                    </div>
                    {source.lastScrape.filesDownloaded > 0 && (
                      <div className={styles.progressItem}>
                        <span className={styles.progressLabel}>Files:</span>
                        <span>{source.lastScrape.filesDownloaded}</span>
                      </div>
                    )}
                    {source.lastScrape.bytesDownloaded > 0 && (
                      <div className={styles.progressItem}>
                        <span className={styles.progressLabel}>Data:</span>
                        <span>{formatBytes(source.lastScrape.bytesDownloaded)}</span>
                      </div>
                    )}
                    {source.lastScrape.endTime && (
                      <div className={styles.progressItem}>
                        <span className={styles.progressLabel}>Duration:</span>
                        <span>{formatDuration(source.lastScrape.startTime, source.lastScrape.endTime)}</span>
                      </div>
                    )}
                    {source.lastScrape.averageSpeed > 0 && (
                      <div className={styles.progressItem}>
                        <span className={styles.progressLabel}>Avg Speed:</span>
                        <span>{formatBytes(source.lastScrape.averageSpeed)}/s</span>
                      </div>
                    )}
                    {source.lastScrape.errorCount > 0 && (
                      <div className={styles.progressItem}>
                        <span className={styles.progressLabel}>Errors:</span>
                        <span className={styles.errorItem}>{source.lastScrape.errorCount}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

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
