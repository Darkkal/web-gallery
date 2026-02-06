'use client';

import { useState } from 'react';
import { createScrapeTask } from './actions';
import styles from './page.module.css';
import { Plus } from 'lucide-react';

interface Source {
    id: number;
    name: string | null;
    url: string;
}

export default function ScrapeTaskForm({ sources }: { sources: Source[] }) {
    const [name, setName] = useState('');
    const [sourceId, setSourceId] = useState<string>('');
    const [stopAfterCompleted, setStopAfterCompleted] = useState('');
    const [stopAfterSkipped, setStopAfterSkipped] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!sourceId) return;

        setLoading(true);
        try {
            await createScrapeTask({
                sourceId: parseInt(sourceId),
                name: name || undefined,
                downloadOptions: {
                    stopAfterCompleted: stopAfterCompleted ? parseInt(stopAfterCompleted) : undefined,
                    stopAfterSkipped: stopAfterSkipped ? parseInt(stopAfterSkipped) : undefined,
                },
                scheduleInterval: undefined,
                enabled: true
            });
            setName('');
            setSourceId('');
            setStopAfterCompleted('');
            setStopAfterSkipped('');
        } catch (error) {
            console.error('Failed to create task:', error);
            alert('Failed to create task');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className={styles.formGrid}>
            <div className={styles.formGroup}>
                <label htmlFor="source" className={styles.label}>Source</label>
                <select
                    id="source"
                    value={sourceId}
                    onChange={(e) => setSourceId(e.target.value)}
                    className={styles.select}
                >
                    <option value="" disabled>Select a source</option>
                    {sources.map((source) => (
                        <option key={source.id} value={source.id.toString()}>
                            {source.name || source.url}
                        </option>
                    ))}
                </select>
            </div>

            <div className={styles.formGroup}>
                <label htmlFor="name" className={styles.label}>Task Name (Optional)</label>
                <input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Daily Twitter Scrape"
                    className={styles.input}
                />
            </div>

            <div className={styles.formGroup}>
                <label htmlFor="stopAfterCompleted" className={styles.label}>Stop after # downloads</label>
                <input
                    id="stopAfterCompleted"
                    type="number"
                    min="1"
                    value={stopAfterCompleted}
                    onChange={(e) => setStopAfterCompleted(e.target.value)}
                    placeholder="Unlimited"
                    className={styles.input}
                />
            </div>

            <div className={styles.formGroup}>
                <label htmlFor="stopAfterSkipped" className={styles.label}>Stop after # skips</label>
                <input
                    id="stopAfterSkipped"
                    type="number"
                    min="1"
                    value={stopAfterSkipped}
                    onChange={(e) => setStopAfterSkipped(e.target.value)}
                    placeholder="Unlimited"
                    className={styles.input}
                />
            </div>

            <div className={styles.formGroup} style={{ justifyContent: 'flex-end', display: 'flex' }}>
                <button
                    type="submit"
                    disabled={loading || !sourceId}
                    className={styles.button}
                    style={{ width: '100%', marginTop: 'auto' }}
                >
                    <Plus size={16} style={{ marginRight: '0.5rem' }} />
                    {loading ? 'Creating...' : 'Create Task'}
                </button>
            </div>
        </form>
    );
}
