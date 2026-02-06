'use client';

import { useState } from 'react';
import { runTaskNow, stopTask, deleteScrapeTask } from './actions';
import { Play, Square, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import styles from './page.module.css';

interface Task {
    id: number;
    name: string | null;
    sourceId: number;
    enabled: boolean | null;
    lastRunAt: Date | null;
    nextRunAt: Date | null;
    downloadOptions: { stopAfterCompleted?: number; stopAfterSkipped?: number; stopAfterPosts?: number } | null;
}

export default function ScrapeTaskList({ initialTasks }: { initialTasks: Task[] }) {
    const [runningTasks, setRunningTasks] = useState<Set<number>>(new Set());

    const handleRun = async (id: number) => {
        setRunningTasks(prev => new Set(prev).add(id));
        try {
            await runTaskNow(id);
        } catch (error) {
            console.error('Failed to run task:', error);
            alert('Failed to run task');
        } finally {
            setTimeout(() => {
                setRunningTasks(prev => {
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                });
            }, 2000);
        }
    };

    const handleStop = async (id: number) => {
        try {
            await stopTask(id);
        } catch (error) {
            console.error('Failed to stop task:', error);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this task?')) return;
        await deleteScrapeTask(id);
    };

    return (
        <div className={styles.listContainer}>
            <table className={styles.table}>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Limits</th>
                        <th>Last Run</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {initialTasks.map((task) => (
                        <tr key={task.id} className={styles.tableRow}>
                            <td>
                                <div style={{ fontWeight: 500 }}>{task.name || `Task #${task.id}`}</div>
                                <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>Source ID: {task.sourceId}</div>
                            </td>
                            <td>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.75rem' }}>
                                    {task.downloadOptions?.stopAfterCompleted && (
                                        <span>Max DL: {task.downloadOptions.stopAfterCompleted}</span>
                                    )}
                                    {task.downloadOptions?.stopAfterSkipped && (
                                        <span>Max Skip: {task.downloadOptions.stopAfterSkipped}</span>
                                    )}
                                    {task.downloadOptions?.stopAfterPosts && (
                                        <span>Max Posts: {task.downloadOptions.stopAfterPosts}</span>
                                    )}
                                    {!task.downloadOptions?.stopAfterCompleted && !task.downloadOptions?.stopAfterSkipped && !task.downloadOptions?.stopAfterPosts && (
                                        <span style={{ color: 'hsl(var(--muted-foreground))' }}>No limits</span>
                                    )}
                                </div>
                            </td>
                            <td>
                                {task.lastRunAt ? formatDistanceToNow(new Date(task.lastRunAt), { addSuffix: true }) : 'Never'}
                            </td>
                            <td>
                                {task.enabled ?
                                    <span className={`${styles.badge} ${styles.badgeEnabled}`}>Enabled</span>
                                    :
                                    <span className={`${styles.badge} ${styles.badgeDisabled}`}>Disabled</span>
                                }
                            </td>
                            <td>
                                <div className={styles.actionGroup}>
                                    <button
                                        onClick={() => handleRun(task.id)}
                                        disabled={runningTasks.has(task.id)}
                                        className={styles.iconButton}
                                        title="Run Task"
                                    >
                                        <Play size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleStop(task.id)}
                                        className={styles.iconButton}
                                        title="Stop Task"
                                    >
                                        <Square size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(task.id)}
                                        className={styles.iconButton}
                                        style={{ color: 'hsl(var(--destructive))' }}
                                        title="Delete Task"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                    {initialTasks.length === 0 && (
                        <tr>
                            <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: 'hsl(var(--muted-foreground))' }}>
                                No tasks found. Create one above.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
