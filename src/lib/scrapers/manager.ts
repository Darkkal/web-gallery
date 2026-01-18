import { ChildProcess, spawn } from 'child_process';
import { ScraperRunner } from './runner';
import { ScrapeProgress } from './types';
import path from 'path';
import { db } from '@/lib/db';
import { sources, mediaItems, twitterUsers, twitterTweets, collectionItems, scrapeHistory, pixivUsers, pixivIllusts, tags, pixivIllustTags, scanHistory, gallerydlExtractorTypes, scraperDownloadLogs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { syncLibrary } from '@/lib/library/scanner';

export interface ScrapingStatus extends ScrapeProgress {
    sourceId: number;
    url: string;
    type: 'gallery-dl' | 'yt-dlp';
    startTime: Date;
    historyId?: number;
}

class ScraperManager {
    private static instance: ScraperManager;
    private activeScrapes: Map<number, {
        process: ChildProcess;
        status: ScrapingStatus;
    }> = new Map();

    private constructor() { }

    public static getInstance(): ScraperManager {
        if (!ScraperManager.instance) {
            ScraperManager.instance = new ScraperManager();
        }
        return ScraperManager.instance;
    }

    async startScrape(sourceId: number, type: 'gallery-dl' | 'yt-dlp', url: string, downloadDir: string, options: { mode?: 'full' | 'quick' } = {}) {
        console.log(`[ScraperManager] STARTING scrape for source ID: ${sourceId} (${type}) - URL: ${url}`);
        if (this.activeScrapes.has(sourceId)) {
            console.warn(`[ScraperManager] Scrape already in progress for source ${sourceId}`);
            return;
        }

        const runner = new ScraperRunner(downloadDir);
        const startTime = new Date();

        // Create history record at the start
        const historyResult = db.insert(scrapeHistory).values({
            sourceId,
            startTime,
            status: 'running',
            filesDownloaded: 0,
            bytesDownloaded: 0,
            errorCount: 0,
            averageSpeed: 0,
        }).returning({ id: scrapeHistory.id }).get();

        const historyId = historyResult.id;
        console.log(`[ScraperManager] Created history record ${historyId} for source ${sourceId}`);

        const status: ScrapingStatus = {
            sourceId,
            url,
            type,
            startTime,
            historyId,
            downloadedCount: 0,
            speed: '0B/s',
            totalSize: '0B',
            errorCount: 0,
            isRateLimited: false,
            isFinished: false
        };

        const { promise, child } = runner.run(type, {
            url,
            mode: options.mode,
            onProgress: (p) => {
                const current = this.activeScrapes.get(sourceId);
                if (current) {
                    current.status = { ...current.status, ...p };
                }
            }
        });

        this.activeScrapes.set(sourceId, { process: child, status });

        promise.then((result) => {
            let logMsg = result.error || result.output || '';
            if (logMsg.length > 200) {
                logMsg = logMsg.substring(0, 200) + '...';
            }
            console.log(`[ScraperManager] FINISHED scrape for source ID: ${sourceId} - Result: ${result.success ? 'Success' : 'Failed'} ${logMsg}`);

            // Log downloaded files for source linking
            if (result.items && result.items.length > 0) {
                try {
                    console.log(`[ScraperManager] Logging ${result.items.length} files for source ${sourceId}...`);
                    const values = result.items.map(path => ({
                        sourceId,
                        filePath: path,
                    }));

                    // Batch insert might be too big if thousands, but safe for now or chunk it
                    // SQLite limit is usually variable limits, safe to chunk
                    const chunkSize = 100;
                    for (let i = 0; i < values.length; i += chunkSize) {
                        const batch = values.slice(i, i + chunkSize);
                        db.insert(scraperDownloadLogs).values(batch).onConflictDoNothing().run();
                    }
                } catch (err: any) {
                    console.error("[ScraperManager] Failed to save download logs:", err.message);
                }
            }

            const current = this.activeScrapes.get(sourceId);
            if (current) {
                current.status.isFinished = true;

                // Update history record with final metrics
                const endTime = new Date();
                const durationSeconds = (endTime.getTime() - startTime.getTime()) / 1000;
                const bytesDownloaded = this.parseSizeToBytes(current.status.totalSize);
                const averageSpeed = durationSeconds > 0 ? Math.floor(bytesDownloaded / durationSeconds) : 0;

                db.update(scrapeHistory)
                    .set({
                        endTime,
                        status: result.success ? 'completed' : 'failed',
                        filesDownloaded: current.status.downloadedCount,
                        bytesDownloaded,
                        errorCount: current.status.errorCount,
                        averageSpeed,
                        lastError: result.error || (result.success ? null : result.output), // Store error or output if failed
                    })
                    .where(eq(scrapeHistory.id, historyId))
                    .run();

                console.log(`[ScraperManager] Updated history record ${historyId} with final metrics`);

                // Trigger library scan automatically
                console.log(`[ScraperManager] Triggering library scan...`);
                syncLibrary().catch(err => console.error("[ScraperManager] Auto-scan failed:", err));

                // Keep it in the map for a bit so the UI can see "Finished"
                setTimeout(() => {
                    this.activeScrapes.delete(sourceId);
                }, 30000); // 30 seconds
            }
        }).catch(err => {
            console.error(`[ScraperManager] ERROR for source ID: ${sourceId}:`, err);

            // Update history record as failed
            db.update(scrapeHistory)
                .set({
                    endTime: new Date(),
                    status: 'failed',
                    lastError: err instanceof Error ? err.message : String(err),
                })
                .where(eq(scrapeHistory.id, historyId))
                .run();

            this.activeScrapes.delete(sourceId);

            // Should we scan on error? Probably yes, to pick up whatever was downloaded before error.
            console.log(`[ScraperManager] Triggering library scan (after error)...`);
            syncLibrary().catch(err => console.error("[ScraperManager] Auto-scan failed:", err));
        });
    }

    getStatus(sourceId: number): ScrapingStatus | undefined {
        return this.activeScrapes.get(sourceId)?.status;
    }

    getAllStatuses(): ScrapingStatus[] {
        return Array.from(this.activeScrapes.values()).map(s => s.status);
    }

    stopScrape(sourceId: number) {
        const active = this.activeScrapes.get(sourceId);
        if (active) {
            const pid = active.process.pid;
            console.log(`[ScraperManager] STOPPING scrape for source ID: ${sourceId} (PID: ${pid})`);

            // Update history record before stopping
            if (active.status.historyId) {
                const endTime = new Date();
                const durationSeconds = (endTime.getTime() - active.status.startTime.getTime()) / 1000;
                const bytesDownloaded = this.parseSizeToBytes(active.status.totalSize);
                const averageSpeed = durationSeconds > 0 ? Math.floor(bytesDownloaded / durationSeconds) : 0;

                db.update(scrapeHistory)
                    .set({
                        endTime,
                        status: 'stopped',
                        filesDownloaded: active.status.downloadedCount,
                        bytesDownloaded,
                        errorCount: active.status.errorCount,
                        averageSpeed,
                    })
                    .where(eq(scrapeHistory.id, active.status.historyId))
                    .run();

                console.log(`[ScraperManager] Updated history record ${active.status.historyId} with stopped status`);
            }

            if (pid) {
                if (process.platform === 'win32') {
                    // On Windows, spawn with shell: true creates a process tree.
                    // We need taskkill to kill the entire tree (/t) and force it (/f).
                    spawn('taskkill', ['/pid', pid.toString(), '/f', '/t']);
                } else {
                    active.process.kill();
                }
            }
            this.activeScrapes.delete(sourceId);

            // Trigger library scan automatically
            console.log(`[ScraperManager] Triggering library scan (after stop)...`);
            syncLibrary().catch(err => console.error("[ScraperManager] Auto-scan failed:", err));

            return true;
        }
        console.log(`[ScraperManager] STOP requested for source ID: ${sourceId} but no active scrape found.`);
        return false;
    }

    // Helper method to parse size strings like "120MiB" to bytes
    private parseSizeToBytes(sizeStr: string): number {
        if (!sizeStr) return 0;
        const match = sizeStr.trim().match(/^([\d.]+)\s*([A-Za-z]*)$/);
        if (!match) return 0;

        const value = parseFloat(match[1]);
        const unit = match[2].toLowerCase();

        if (!unit) return Math.floor(value);

        const multipliers: { [key: string]: number } = {
            'b': 1,
            'k': 1024,
            'kb': 1024,
            'kib': 1024,
            'm': 1024 * 1024,
            'mb': 1024 * 1024,
            'mib': 1024 * 1024,
            'g': 1024 * 1024 * 1024,
            'gb': 1024 * 1024 * 1024,
            'gib': 1024 * 1024 * 1024,
            't': 1024 * 1024 * 1024 * 1024,
            'tb': 1024 * 1024 * 1024 * 1024,
            'tib': 1024 * 1024 * 1024 * 1024,
        };

        return Math.floor(value * (multipliers[unit] || 0));
    }
}

export const scraperManager = ScraperManager.getInstance();
