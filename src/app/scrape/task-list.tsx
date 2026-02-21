'use client';

import { useState } from 'react';
import { runTaskNow, stopTask, deleteScrapeTask, updateScrapeTask } from './actions';
import { Play, Square, Trash2, Pencil, Check, X } from 'lucide-react';
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

interface Source {
    id: number;
    name: string | null;
    url: string;
}

export default function ScrapeTaskList({ initialTasks, sources }: { initialTasks: Task[], sources: Source[] }) {
    const [runningTasks, setRunningTasks] = useState<Set<number>>(new Set());
    const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
    const [savingId, setSavingId] = useState<number | null>(null);
    const [editValues, setEditValues] = useState({
        name: '',
        stopAfterCompleted: '',
        stopAfterSkipped: '',
        stopAfterPosts: '',
        enabled: true,
    });

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

    const handleEditClick = (task: Task) => {
        setEditingTaskId(task.id);
        setEditValues({
            name: task.name || '',
            stopAfterCompleted: task.downloadOptions?.stopAfterCompleted?.toString() || '',
            stopAfterSkipped: task.downloadOptions?.stopAfterSkipped?.toString() || '',
            stopAfterPosts: task.downloadOptions?.stopAfterPosts?.toString() || '',
            enabled: task.enabled ?? true,
        });
    };

    const handleCancelEdit = () => {
        setEditingTaskId(null);
    };

    const handleSaveEdit = async (id: number) => {
        setSavingId(id);
        try {
            await updateScrapeTask(id, {
                name: editValues.name || undefined,
                downloadOptions: {
                    stopAfterCompleted: editValues.stopAfterCompleted ? parseInt(editValues.stopAfterCompleted) : undefined,
                    stopAfterSkipped: editValues.stopAfterSkipped ? parseInt(editValues.stopAfterSkipped) : undefined,
                    stopAfterPosts: editValues.stopAfterPosts ? parseInt(editValues.stopAfterPosts) : undefined,
                },
                enabled: editValues.enabled,
            });
            setEditingTaskId(null);
        } catch (error) {
            console.error('Failed to save task:', error);
            alert('Failed to save task');
        } finally {
            setSavingId(null);
        }
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
                    {initialTasks.map((task) => {
                        const source = sources.find(s => s.id === task.sourceId);
                        const sourceDisplay = source ? (source.name || source.url) : `Source ID: ${task.sourceId}`;

                        return editingTaskId === task.id ? (
                            <tr key={`edit-${task.id}`} className={styles.tableRow}>
                                <td>
                                    <input
                                        value={editValues.name}
                                        onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
                                        placeholder="Task Name"
                                        className={styles.input}
                                        style={{ width: '100%', marginBottom: '4px', padding: '4px 8px' }}
                                    />
                                    <div
                                        style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                        title={source?.url}
                                    >
                                        {sourceDisplay}
                                    </div>
                                </td>
                                <td>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <input
                                            type="number"
                                            min="1"
                                            value={editValues.stopAfterCompleted}
                                            onChange={(e) => setEditValues({ ...editValues, stopAfterCompleted: e.target.value })}
                                            placeholder="Max DL"
                                            className={styles.input}
                                            style={{ fontSize: '0.75rem', padding: '2px 4px', height: 'auto' }}
                                            title="Stop after completed"
                                        />
                                        <input
                                            type="number"
                                            min="1"
                                            value={editValues.stopAfterSkipped}
                                            onChange={(e) => setEditValues({ ...editValues, stopAfterSkipped: e.target.value })}
                                            placeholder="Max Skip"
                                            className={styles.input}
                                            style={{ fontSize: '0.75rem', padding: '2px 4px', height: 'auto' }}
                                            title="Stop after skipped"
                                        />
                                        <input
                                            type="number"
                                            min="1"
                                            value={editValues.stopAfterPosts}
                                            onChange={(e) => setEditValues({ ...editValues, stopAfterPosts: e.target.value })}
                                            placeholder="Max Posts"
                                            className={styles.input}
                                            style={{ fontSize: '0.75rem', padding: '2px 4px', height: 'auto' }}
                                            title="Stop after posts"
                                        />
                                    </div>
                                </td>
                                <td>
                                    {task.lastRunAt ? formatDistanceToNow(new Date(task.lastRunAt), { addSuffix: true }) : 'Never'}
                                </td>
                                <td>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.875rem', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={editValues.enabled}
                                            onChange={(e) => setEditValues({ ...editValues, enabled: e.target.checked })}
                                            style={{ margin: 0 }}
                                        />
                                        Enabled
                                    </label>
                                </td>
                                <td>
                                    <div className={styles.actionGroup}>
                                        <button
                                            onClick={() => handleSaveEdit(task.id)}
                                            disabled={savingId === task.id}
                                            className={styles.iconButton}
                                            style={{ color: 'hsl(142.1 76.2% 36.3%)' }}
                                            title="Save Changes"
                                        >
                                            <Check size={16} />
                                        </button>
                                        <button
                                            onClick={handleCancelEdit}
                                            disabled={savingId === task.id}
                                            className={styles.iconButton}
                                            style={{ color: 'hsl(var(--destructive))' }}
                                            title="Cancel"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            <tr key={task.id} className={styles.tableRow}>
                                <td>
                                    <div style={{ fontWeight: 500 }}>{task.name || `Task #${task.id}`}</div>
                                    <div
                                        style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                        title={source?.url}
                                    >
                                        {sourceDisplay}
                                    </div>
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
                                            onClick={() => handleEditClick(task)}
                                            className={styles.iconButton}
                                            title="Edit Task"
                                        >
                                            <Pencil size={16} />
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
                        );
                    })}
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
