'use client';

import React, { useState, useEffect, useRef } from 'react';
import { addSource, getSources, scrapeSource, deleteSource, getScrapingStatuses, stopScrapingSource, getSourcesWithHistory, scanLibrary, getLatestScan, stopLibraryScan } from '../actions';
import { ScrapingStatus } from '@/lib/scrapers/manager';
import styles from './page.module.css';

export default function SourcesPage() {
  const [sources, setSources] = useState<any[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scrapingStatuses, setScrapingStatuses] = useState<ScrapingStatus[]>([]);
  const [scanStatus, setScanStatus] = useState<any>(null); // Last scan record

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastActiveTimeRef = useRef<number>(Date.now());

  const scanPollingRef = useRef<NodeJS.Timeout | null>(null);

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
        if (Date.now() - lastActiveTimeRef.current > 30000) {
          console.log('[SourcesPage] No active scrapes for 30s, stopping polling.');
          stopPolling();
        }
      }
    }, 5000);
  }, [stopPolling]);

  // Scan Polling
  const startScanPolling = React.useCallback(() => {
    if (scanPollingRef.current) return;

    // Poll every 2 seconds roughly
    scanPollingRef.current = setInterval(async () => {
      const latest = await getLatestScan();
      setScanStatus(latest);
      if (latest && latest.status === 'running') {
        setScanning(true);
      } else {
        setScanning(false);
        if (scanPollingRef.current) {
          clearInterval(scanPollingRef.current);
          scanPollingRef.current = null;
        }
      }
    }, 2000);
  }, []);

  useEffect(() => {
    loadSources();
    loadScanStatus();

    // Initial checks
    getScrapingStatuses().then(statuses => {
      setScrapingStatuses(statuses);
      if (statuses.some(s => !s.isFinished)) {
        startPolling();
      }
    });

    // Check if scan running
    getLatestScan().then(latest => {
      if (latest && latest.status === 'running') {
        startScanPolling();
      }
    });

    return () => {
      stopPolling();
      if (scanPollingRef.current) clearInterval(scanPollingRef.current);
    };
  }, [startPolling, stopPolling, startScanPolling]);

  async function loadScanStatus() {
    const latest = await getLatestScan();
    setScanStatus(latest);
  }

  async function handleScan() {
    setScanning(true);
    await scanLibrary();
    // Start polling immediately
    startScanPolling();
  }

  async function handleStopScan() {
    if (!confirm("Stop the scan? It will finish the current batch.")) return;
    await stopLibraryScan();
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

      {/* Scan Control Area */}
      <div className={styles.scanSection} style={{ marginBottom: '2rem', padding: '1rem', background: '#1e293b', borderRadius: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0 }}>Library Scan</h2>
            <p style={{ margin: '0.5rem 0 0', color: '#94a3b8', fontSize: '0.9rem' }}>
              Scan local directory for new files.
            </p>
          </div>
          <div>
            {scanning ? (
              <button
                type="button"
                className={styles.stopButton} // Reusing stop button style
                onClick={handleStopScan}
              >
                Stop Scan
              </button>
            ) : (
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={handleScan}
                disabled={scanning}
              >
                {scanning ? 'Scanning...' : 'Scan Library'}
              </button>
            )}
          </div>
        </div>

        {scanStatus && (
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #334155' }}>
            <div style={{ display: 'flex', gap: '2rem', fontSize: '0.9rem', color: '#e2e8f0' }}>
              <div>
                <span style={{ color: '#94a3b8' }}>Status: </span>
                <span className={`${styles.badge} ${styles[`status-${scanStatus.status}`] || ''}`}>
                  {scanStatus.status}
                </span>
              </div>
              {scanStatus.status === 'running' && (
                <div>
                  <span style={{ color: '#94a3b8' }}>Processed: </span>
                  {scanStatus.filesProcessed} items
                </div>
              )}
              {scanStatus.status !== 'running' && (
                <>
                  <div>
                    <span style={{ color: '#94a3b8' }}>Last Run: </span>
                    {new Date(scanStatus.startTime).toLocaleString()}
                  </div>
                  {scanStatus.endTime && (
                    <div>
                      <span style={{ color: '#94a3b8' }}>Duration: </span>
                      {formatDuration(scanStatus.startTime, scanStatus.endTime)}
                    </div>
                  )}
                  <div>
                    <span style={{ color: '#94a3b8' }}>Results: </span>
                    <span style={{ color: '#4ade80' }}>+{scanStatus.filesAdded}</span>
                    {' / '}
                    <span style={{ color: '#60a5fa' }}>~{scanStatus.filesUpdated}</span>
                    {' / '}
                    <span style={{ color: '#f87171' }}>-{scanStatus.filesDeleted}</span>
                  </div>
                </>
              )}
              {scanStatus.errors > 0 && (
                <div>
                  <span style={{ color: '#f87171' }}>{scanStatus.errors} errors</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div style={{ borderBottom: '1px solid #334155', marginBottom: '2rem' }}></div>

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
