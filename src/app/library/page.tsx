'use client';

import React, { useState, useEffect, useRef } from 'react';
import { scanLibrary, getLatestScan, stopLibraryScan } from '../actions';
import { purgeDatabases, purgeAvatars, purgeDownloads } from '../actions/debug';
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
                <p className={styles.dangerNote} style={{ marginTop: '1rem' }}>
                    Database Purge stops all activities and wipes the DB. <br />
                    Purge Avatars deletes 'public/avatars'. <br />
                    Purge Downloads deletes 'public/downloads'.
                </p>
            </div>

            {/* Repair Section */}
            <RepairSection />
        </div>
    );
}

import { startTwitterRepair, stopRepair, pauseRepair, resumeRepair, getRepairStatus, getRepairHistory } from '@/actions/repair';

function RepairSection() {
    const [status, setStatus] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Polling for Repair Status
    useEffect(() => {
        let interval: NodeJS.Timeout;

        async function fetchInfo() {
            const s = await getRepairStatus();
            const h = await getRepairHistory();
            setStatus(s);
            setHistory(h);
        }

        fetchInfo();
        interval = setInterval(fetchInfo, 2000); // 2 second poll

        return () => clearInterval(interval);
    }, []);

    const isActive = status && status.status === 'running';
    const isPaused = status && status.status === 'paused';

    const handleStart = async () => {
        setLoading(true);
        await startTwitterRepair();
        setLoading(false);
    };

    const handleStop = async () => {
        if (!confirm('Stop repair process?')) return;
        setLoading(true);
        await stopRepair();
        setLoading(false);
    };

    const handlePauseResume = async () => {
        setLoading(true);
        if (isPaused) await resumeRepair();
        else await pauseRepair();
        setLoading(false);
    };

    return (
        <div className={styles.scanSection} style={{ marginTop: '2rem', borderTop: '1px solid #334155', paddingTop: '2rem' }}>
            <div className={styles.scanHeader}>
                <div>
                    <h2>Twitter Data Repair</h2>
                    <p className={styles.scanDescription}>
                        Scan twitter directories for missing metadata/media and re-download them.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    {isActive || isPaused ? (
                        <>
                            <button
                                type="button"
                                className={styles.secondaryButton}
                                onClick={handlePauseResume}
                                disabled={loading}
                            >
                                {isPaused ? 'Resume' : 'Pause'}
                            </button>
                            <button
                                type="button"
                                className={styles.stopButton}
                                onClick={handleStop}
                                disabled={loading}
                            >
                                Stop
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            className={styles.secondaryButton}
                            onClick={handleStart}
                            disabled={loading}
                        >
                            Start Repair
                        </button>
                    )}
                </div>
            </div>

            {/* Current Status */}
            {status && status.status !== 'idle' && (
                <div className={styles.scanStats} style={{ marginTop: '1rem', background: '#1e293b', padding: '1rem', borderRadius: '8px' }}>
                    <div className={styles.statsRow} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                        <div>
                            <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.8rem' }}>Status</span>
                            <span style={{ fontWeight: 600, color: isPaused ? '#facc15' : isActive ? '#4ade80' : '#cbd5e1' }}>
                                {status.status.toUpperCase()}
                            </span>
                        </div>
                        <div>
                            <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.8rem' }}>Checked</span>
                            <span style={{ fontWeight: 600 }}>{status.filesChecked}</span>
                        </div>
                        <div>
                            <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.8rem' }}>Repaired</span>
                            <span style={{ fontWeight: 600, color: '#4ade80' }}>{status.filesRepaired}</span>
                        </div>
                        <div>
                            <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.8rem' }}>Errors</span>
                            <span style={{ fontWeight: 600, color: '#f87171' }}>{status.errors}</span>
                        </div>
                    </div>
                    <div style={{ marginTop: '0.5rem', color: '#64748b', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {status.currentPath}
                    </div>
                </div>
            )}

            {/* History Table */}
            <div style={{ marginTop: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', color: '#94a3b8', marginBottom: '0.5rem' }}>Run History</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid #334155', textAlign: 'left' }}>
                            <th style={{ padding: '8px' }}>Date</th>
                            <th style={{ padding: '8px' }}>Status</th>
                            <th style={{ padding: '8px' }}>Repaired</th>
                            <th style={{ padding: '8px' }}>Duration</th>
                        </tr>
                    </thead>
                    <tbody>
                        {history.map((run) => (
                            <tr key={run.id} style={{ borderBottom: '1px solid #1e293b' }}>
                                <td style={{ padding: '8px', color: '#cbd5e1' }}>
                                    {new Date(run.startTime).toLocaleString()}
                                </td>
                                <td style={{ padding: '8px' }}>
                                    <span style={{
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        fontSize: '0.8rem',
                                        background: run.status === 'completed' ? '#064e3b' : run.status === 'failed' ? '#450a0a' : '#1e293b',
                                        color: run.status === 'completed' ? '#4ade80' : run.status === 'failed' ? '#f87171' : '#cbd5e1'
                                    }}>
                                        {run.status}
                                    </span>
                                </td>
                                <td style={{ padding: '8px', color: '#cbd5e1' }}>
                                    {run.filesRepaired}
                                </td>
                                <td style={{ padding: '8px', color: '#64748b' }}>
                                    {run.endTime ?
                                        formatDuration(run.startTime, run.endTime) :
                                        run.status === 'running' ? 'Running...' : '-'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
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
