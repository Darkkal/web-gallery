import { ChildProcess, spawn } from 'child_process';
import { ScraperOptions, ScrapeResult } from '@/lib/scrapers/types';
import { ScrapeLimits } from '@/lib/scrapers/runner';
import { parseSizeToBytes, formatBytes } from '@/lib/utils/format';

export abstract class BaseScraperStrategy {
    protected basePath: string;
    protected options: ScraperOptions;
    protected limits?: ScrapeLimits;

    public stdout = '';
    public stderr = '';
    public downloadedCount = 0;
    public currentSpeed = '0B/s';
    public currentTotalSize = '0B';
    public cumulativeBytes = 0;
    public currentFileBytes = 0;
    public errorCount = 0;
    public skippedCount = 0;
    public isRateLimited = false;
    public postsProcessed = 0;
    public intentionalStop = false;

    public processedFilesSet = new Set<string>();
    public processedFiles: string[] = [];

    constructor(basePath: string, options: ScraperOptions, limits?: ScrapeLimits) {
        this.basePath = basePath;
        this.options = options;
        this.limits = limits;
    }

    abstract get toolName(): 'gallery-dl' | 'yt-dlp';
    abstract buildArgs(): string[];
    abstract parseLine(line: string, child: ChildProcess): void;

    protected parseProgressPrefix(line: string) {
        if (line.includes('API rate limit exceeded') || line.includes('rate limit')) {
            this.isRateLimited = true;
        }
        if (line.includes('[download][error]') || line.includes('[error]')) {
            this.errorCount++;
        }
        if (line.includes('[post-complete]')) {
            this.postsProcessed++;
        }
    }

    protected triggerOnProgress(child: ChildProcess) {
        if (this.options.onProgress) {
            const totalSoFar = this.cumulativeBytes + this.currentFileBytes;
            this.options.onProgress({
                downloadedCount: this.downloadedCount,
                speed: this.currentSpeed,
                totalSize: this.formatBytes(totalSoFar),
                errorCount: this.errorCount,
                skippedCount: this.skippedCount,
                postsProcessed: this.postsProcessed,
                isRateLimited: this.isRateLimited,
                isFinished: false
            });

            this.checkLimits(child);
        }
    }

    private stopInitiated = false;

    protected checkLimits(child: ChildProcess) {
        if (this.stopInitiated) return;

        if (this.limits?.stopAfterCompleted && this.downloadedCount >= this.limits.stopAfterCompleted) {
            console.log(`[ScraperStrategy] Reached download limit of ${this.limits.stopAfterCompleted}. Stopping.`);
            this.intentionalStop = true;
            this.stopInitiated = true;
            this.killChild(child);
        }

        if (this.limits?.stopAfterPosts && this.postsProcessed >= this.limits.stopAfterPosts) {
            console.log(`[ScraperStrategy] Reached post limit of ${this.limits.stopAfterPosts}. Waiting for finalization...`);
            this.intentionalStop = true;
            this.stopInitiated = true;

            // Give the scraper a moment to finish the current post's download/file operations
            // before we kill it. This prevents the 0-byte .part file issue.
            setTimeout(() => {
                this.killChild(child);
            }, 2000);
        }
    }

    protected killChild(child: ChildProcess) {
        if (process.platform === 'win32') {
            spawn('taskkill', ['/pid', child.pid!.toString(), '/f', '/t']);
        } else {
            child.kill();
        }
    }

    parseSizeToBytes = parseSizeToBytes;
    formatBytes = formatBytes;

    public getFinalResult(success: boolean, errorMsg?: string): ScrapeResult {
        if (this.options.onProgress) {
            const totalSoFar = this.cumulativeBytes + this.currentFileBytes;
            this.options.onProgress({
                downloadedCount: this.downloadedCount,
                speed: '0B/s',
                totalSize: this.formatBytes(totalSoFar),
                errorCount: this.errorCount,
                skippedCount: this.skippedCount,
                postsProcessed: this.postsProcessed,
                isRateLimited: this.isRateLimited,
                isFinished: true
            });
        }
        return {
            success,
            output: this.stdout,
            error: errorMsg,
            items: this.processedFiles
        };
    }
}
