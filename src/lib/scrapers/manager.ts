import { ChildProcess, spawn } from 'child_process';
import { ScraperRunner } from './runner';
import { ScrapeProgress } from './types';
import path from 'path';

export interface ScrapingStatus extends ScrapeProgress {
    sourceId: number;
    url: string;
    type: 'gallery-dl' | 'yt-dlp';
    startTime: Date;
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

    async startScrape(sourceId: number, type: 'gallery-dl' | 'yt-dlp', url: string, downloadDir: string) {
        if (this.activeScrapes.has(sourceId)) {
            console.warn(`Scrape already in progress for source ${sourceId}`);
            return;
        }

        const runner = new ScraperRunner(downloadDir);
        const startTime = new Date();

        const status: ScrapingStatus = {
            sourceId,
            url,
            type,
            startTime,
            downloadedCount: 0,
            speed: '0B/s',
            totalSize: '0B',
            errorCount: 0,
            isRateLimited: false,
            isFinished: false
        };

        const { promise, child } = runner.run(type, {
            url,
            onProgress: (p) => {
                const current = this.activeScrapes.get(sourceId);
                if (current) {
                    current.status = { ...current.status, ...p };
                }
            }
        });

        this.activeScrapes.set(sourceId, { process: child, status });

        promise.then((result) => {
            console.log(`Scrape finished for source ${sourceId}:`, result.success);
            const current = this.activeScrapes.get(sourceId);
            if (current) {
                current.status.isFinished = true;
                // We keep it in the map for a bit so the UI can see "Finished" 
                // but maybe we should remove it eventually or based on a timer.
                // For now, let's remove it after a delay or when a new one starts.
                setTimeout(() => {
                    this.activeScrapes.delete(sourceId);
                }, 30000); // 30 seconds
            }
        }).catch(err => {
            console.error(`Scrape failed for source ${sourceId}:`, err);
            this.activeScrapes.delete(sourceId);
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
            return true;
        }
        return false;
    }
}

export const scraperManager = ScraperManager.getInstance();
