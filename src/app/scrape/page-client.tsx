'use client';

import { useState } from 'react';
import ScrapeTaskForm from './task-form';
import ScrapeTaskList from './task-list';
import ScrapeHistoryTable from './history-table';
import styles from './page.module.css';

export default function ScrapePageClient({ tasks, sources, history }: {
    tasks: { id: number; name: string | null; sourceId: number; enabled: boolean | null; lastRunAt: Date | null; nextRunAt: Date | null; downloadOptions: { stopAfterCompleted?: number; stopAfterSkipped?: number; stopAfterPosts?: number } | null }[],
    sources: { id: number; name: string | null; url: string }[],
    history: { id: number; startTime: Date; endTime: Date | null; status: 'running' | 'completed' | 'stopped' | 'failed'; filesDownloaded: number | null; skippedCount: number | null; postsProcessed: number | null; bytesDownloaded: number | null; errorCount: number | null }[]
}) {

    const [activeTab, setActiveTab] = useState<'tasks' | 'history'>('tasks');

    return (
        <div className={styles.container}>
            <section className={styles.addTaskSection}>
                <h2 className={styles.sectionTitle}>Create New Task</h2>
                <ScrapeTaskForm sources={sources} />
            </section>

            <section className={styles.tabsContainer}>
                <div className={styles.tabsList}>
                    <button
                        onClick={() => setActiveTab('tasks')}
                        className={`${styles.tabTrigger} ${activeTab === 'tasks' ? styles.active : ''}`}
                    >
                        Tasks
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`${styles.tabTrigger} ${activeTab === 'history' ? styles.active : ''}`}
                    >
                        History
                    </button>
                </div>

                {activeTab === 'tasks' && (
                    <ScrapeTaskList initialTasks={tasks} sources={sources} />
                )}
                {activeTab === 'history' && (
                    <ScrapeHistoryTable initialHistory={history} />
                )}
            </section>
        </div>
    );
}
