'use client';

import React, { useState, useEffect, useRef } from 'react';
import { scanLibrary, getLatestScan, stopLibraryScan } from '../actions';
import styles from './page.module.css';

export default function LibraryPage() {
    const [scanning, setScanning] = useState(false);
    const [scanStatus, setScanStatus] = useState<any>(null);

    const scanPollingRef = useRef<NodeJS.Timeout | null>(null);

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
        loadScanStatus();

        // Check if scan running
        getLatestScan().then(latest => {
            if (latest && latest.status === 'running') {
                startScanPolling();
            }
        });

        return () => {
            if (scanPollingRef.current) clearInterval(scanPollingRef.current);
        };
    }, [startScanPolling]);

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
        </div>
    );
}
