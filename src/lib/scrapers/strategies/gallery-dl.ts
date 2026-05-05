import { BaseScraperStrategy } from './base';
import { ChildProcess } from 'child_process';
import path from 'path';
import { ScraperOptions } from '../types';
import { ScrapeLimits } from '../runner';

export class GalleryDlStrategy extends BaseScraperStrategy {
    get toolName() { return 'gallery-dl' as const; }

    constructor(
        basePath: string,
        options: ScraperOptions,
        limits?: ScrapeLimits,
    ) {
        super(basePath, options, limits);
    }

    buildArgs() {
        const args: string[] = [];
        args.push('--config-ignore');
        const configPath = path.join(process.cwd(), 'data', 'scrapers', 'gallery-dl', 'gallery-dl.conf');
        args.push('--config', configPath);
        args.push('-v'); // Verbose output

        if (this.options.mode === 'quick') {
            args.push('-A', '15');
        }

        if (this.limits?.stopAfterSkipped) {
            args.push('-T', this.limits.stopAfterSkipped.toString());
        }

        // Native post limiting
        if (this.limits?.stopAfterPosts) {
            args.push('--post-range', `1-${this.limits.stopAfterPosts}`);
        }

        // Note: [post-complete] signaling is now handled by the 'post-counter' 
        // postprocessor in gallery-dl.conf for better reliability.

        // Log file overrides
        if (this.options.logPath) {
            args.push('-o', `output.logfile.path=${this.options.logPath}`);
            args.push('-o', 'output.logfile.level=debug');
        }

        args.push('--destination', this.basePath);
        args.push('--', this.options.url);

        return args;
    }

    parseLine(line: string, child: ChildProcess) {
        // Essential progress parsing
        this.parseProgressPrefix(line);

        if (line.startsWith('[progress]')) {
            const parts = line.replace('[progress]', '').split('|').map(p => p.trim());
            if (parts.length >= 2) {
                this.currentFileBytes = this.parseSizeStringToBytes(parts[0]);
                this.currentSpeed = parts[1];
                if (parts.length >= 4) {
                    this.currentTotalSize = parts[2];
                } else {
                    this.currentTotalSize = '0B';
                }
            }
        } else if (line.startsWith('[start]')) {
            return;
        } else if (line.startsWith('[success]')) {
            this.downloadedCount++;
            this.cumulativeBytes += this.parseSizeStringToBytes(this.currentTotalSize);
            this.currentFileBytes = 0;

            const parts = line.split('[success] ');
            if (parts.length > 1) {
                let fPath = parts[1].trim();
                if (!path.isAbsolute(fPath)) {
                    fPath = path.resolve(process.cwd(), fPath);
                }
                if (!this.processedFilesSet.has(fPath)) {
                    this.processedFilesSet.add(fPath);
                    this.processedFiles.push(fPath);
                }
            }
        } else if (line.startsWith('[skip]')) {
            this.skippedCount++;
            const parts = line.split('[skip] ');
            if (parts.length > 1) {
                let fPath = parts[1].trim();
                if (!path.isAbsolute(fPath)) {
                    fPath = path.resolve(process.cwd(), fPath);
                }
                if (!this.processedFilesSet.has(fPath)) {
                    this.processedFilesSet.add(fPath);
                    this.processedFiles.push(fPath);
                }
            }
        } else if (line.includes('public/downloads/') || line.includes('public\\downloads\\')) {
            // Fallback detection for files that don't have [success] prefix but are in output
            if (!line.endsWith('.json') && !line.includes('[debug]') && !line.includes('[info]') && !line.includes('[warning]') && !line.includes('[start]') && !line.includes('[success]') && !line.includes('[skip]')) {
                const possiblePath = line.trim();
                let absPath = possiblePath;
                if (!path.isAbsolute(absPath)) {
                    absPath = path.resolve(process.cwd(), possiblePath);
                }

                if (!this.processedFilesSet.has(absPath)) {
                    this.processedFilesSet.add(absPath);
                    this.processedFiles.push(absPath);
                }

                if (this.currentSpeed === '0B/s') {
                    this.downloadedCount++;
                }
            }
        }

        // Check if we need to trigger progress update (including post completion check)
        this.triggerOnProgress(child);
    }
}