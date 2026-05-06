'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { scanLibrary, stopLibraryScan } from '@/app/actions';
import { purgeDatabases, purgeAvatars, purgeDownloads } from '@/app/actions/debug';
import styles from '@/app/library/page.module.css';

export default function LibraryPageClient({ initialScanStatus }: { initialScanStatus: any }) {
    const [scanning, setScanning] = useState(initialScanStatus?.status === 'running');
    const [scanStatus, setScanStatus] = useState<any>(initialScanStatus);

    const scanPollingRef = useRef<NodeJS.Timeout | null>(null);

    const fetchScanStatus = useCallback(async () => {
        const res = await fetch('/api/library/scan');
        if (res.ok) {
            return await res.json();
        }
        return null;
    }, []);

    const startScanPolling = useCallback(() => {
        if (scanPollingRef.current) return;

        // Poll every 2 seconds roughly
        scanPollingRef.current = setInterval(async () => {
            const latest = await fetchScanStatus();
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
    }, [fetchScanStatus]);

    useEffect(() => {
        if (initialScanStatus?.status === 'running') {
            startScanPolling();
        }

        return () => {
            if (scanPollingRef.current) clearInterval(scanPollingRef.current);
        };
    }, [initialScanStatus, startScanPolling]);

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
            <h1 className={styles.title}>Library Management</h1>

            {/* Scan Control Area */}
            <div className={styles.scanSection}>
                <div className={styles.scanHeader}>
                    <div>
                        <h2>Library Scan</h2>
                        <p className={styles.scanDescription}>
                            Scan local directory to detect and import new files.
                        </p>
                    </div>
                    <div>
                        {scanning ? (
                            <button
                                type="button"
                                className={styles.stopButton}
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
                    <div className={styles.scanStats}>
                        <div className={styles.statsRow}>
                            <div>
                                <span className={styles.mutedLabel}>Status: </span>
                                <span className={`${styles.badge} ${styles[`status-${scanStatus.status}`] || ''}`}>
                                    {scanStatus.status}
                                </span>
                            </div>
                            {scanStatus.status === 'running' && (
                                <div>
                                    <span className={styles.mutedLabel}>Processed: </span>
                                    {scanStatus.filesProcessed} items
                                </div>
                            )}
                            {scanStatus.status !== 'running' && (
                                <>
                                    <div>
                                        <span className={styles.mutedLabel}>Last Run: </span>
                                        {new Date(scanStatus.startTime).toLocaleString()}
                                    </div>
                                    {scanStatus.endTime && (
                                        <div>
                                            <span className={styles.mutedLabel}>Duration: </span>
                                            {formatDuration(scanStatus.startTime, scanStatus.endTime)}
                                        </div>
                                    )}
                                    <div>
                                        <span className={styles.mutedLabel}>Results: </span>
                                        <span className={styles.resultAdded}>+{scanStatus.filesAdded}</span>
                                        {' / '}
                                        <span className={styles.resultUpdated}>~{scanStatus.filesUpdated}</span>
                                        {' / '}
                                        <span className={styles.resultDeleted}>-{scanStatus.filesDeleted}</span>
                                    </div>
                                </>
                            )}
                            {scanStatus.errors > 0 && (
                                <div>
                                    <span className={styles.resultDeleted}>{scanStatus.errors} errors</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Danger Zone */}
            <div className={`${styles.scanSection} ${styles.dangerZone}`}>
                <div className={styles.scanHeader}>
                    <div>
                        <h2 className={styles.dangerTitle}>Danger Zone</h2>
                        <p className={styles.scanDescription}>
                            Destructive actions that cannot be undone.
                        </p>
                    </div>
                </div>
                <div className={styles.dangerActions}>
                    <button
                        type="button"
                        className={styles.dangerButton}
                        onClick={async () => {
                            if (confirm('ARE YOU SURE? This will delete ALL data, including the database and gallery-dl archives. This cannot be undone.')) {
                                const btn = document.activeElement as HTMLButtonElement;
                                if (btn) {
                                    btn.disabled = true;
                                    btn.innerText = 'Purging...';
                                }
                                await purgeDatabases();
                                window.location.href = '/';
                            }
                        }}
                    >
                        Purge All Databases
                    </button>
                    <button
                        type="button"
                        className={styles.dangerButton}
                        onClick={async () => {
                            if (confirm('Delete all cached avatars? They will be re-downloaded as needed.')) {
                                const btn = document.activeElement as HTMLButtonElement;
                                if (btn) {
                                    btn.disabled = true;
                                    btn.innerText = 'Purging...';
                                }
                                await purgeAvatars();
                                window.location.reload();
                            }
                        }}
                    >
                        Purge Avatars
                    </button>
                    <button
                        type="button"
                        className={styles.dangerButton}
                        onClick={async () => {
                            if (confirm('Delete ALL downloaded files? This cannot be undone.')) {
                                const btn = document.activeElement as HTMLButtonElement;
                                if (btn) {
                                    btn.disabled = true;
                                    btn.innerText = 'Purging...';
                                }
                                await purgeDownloads();
                                window.location.reload();
                            }
                        }}
                    >
                        Purge Downloads
                    </button>
                </div>
                <p className={styles.dangerNote}>
                    Database Purge stops all activities and wipes the DB. <br />
                    Purge Avatars deletes 'public/avatars'. <br />
                    Purge Downloads deletes 'public/downloads'.
                </p>
            </div>
        </div>
    );
}
