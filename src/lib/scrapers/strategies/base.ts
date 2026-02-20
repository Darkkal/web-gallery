import { ChildProcess, spawn } from 'child_process';
import { ScraperOptions, ScrapeResult } from '../types';
import { ScrapeLimits } from '../runner';

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

    protected checkLimits(child: ChildProcess) {
        if (this.limits?.stopAfterCompleted && this.downloadedCount >= this.limits.stopAfterCompleted) {
            console.log(`[ScraperStrategy] Reached download limit of ${this.limits.stopAfterCompleted}. Stopping.`);
            this.killChild(child);
        }

        if (this.limits?.stopAfterPosts && this.postsProcessed >= this.limits.stopAfterPosts) {
            console.log(`[ScraperStrategy] Reached post limit of ${this.limits.stopAfterPosts}. Stopping.`);
            this.killChild(child);
        }
    }

    protected killChild(child: ChildProcess) {
        if (process.platform === 'win32') {
            spawn('taskkill', ['/pid', child.pid!.toString(), '/f', '/t']);
        } else {
            child.kill();
        }
    }

    protected parseSizeStringToBytes(sizeStr: string): number {
        if (!sizeStr) return 0;
        const match = sizeStr.trim().match(/^([\d.]+)\s*([A-Za-z]*)$/);
        if (!match) return 0;

        const value = parseFloat(match[1]);
        const unit = match[2].toLowerCase();

        if (!unit) return Math.floor(value);

        const multipliers: { [key: string]: number } = {
            'b': 1, 'k': 1024, 'kb': 1024, 'kib': 1024, 'm': 1024 * 1024,
            'mb': 1024 * 1024, 'mib': 1024 * 1024, 'g': 1024 * 1024 * 1024,
            'gb': 1024 * 1024 * 1024, 'gib': 1024 * 1024 * 1024,
            't': 1024 * 1024 * 1024 * 1024, 'tb': 1024 * 1024 * 1024 * 1024,
            'tib': 1024 * 1024 * 1024 * 1024,
        };

        return Math.floor(value * (multipliers[unit] || 0));
    }

    protected formatBytes(bytes: number): string {
        if (bytes === 0) return '0B';
        if (bytes < 1024) return bytes + 'B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + sizes[i];
    }

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
