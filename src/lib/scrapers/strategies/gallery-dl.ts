import { BaseScraperStrategy } from './base';
import { ChildProcess } from 'child_process';
import path from 'path';

export class GalleryDlStrategy extends BaseScraperStrategy {
    get toolName() { return 'gallery-dl' as const; }

    buildArgs() {
        const args: string[] = [];
        args.push('--config-ignore');
        args.push('--config', path.join(process.cwd(), 'gallery-dl.conf'));

        if (this.options.mode === 'quick') {
            args.push('-A', '15');
        }

        args.push('--', this.options.url);
        args.push('--destination', this.basePath);

        if (this.limits?.stopAfterSkipped) {
            args.push('-T', this.limits.stopAfterSkipped.toString());
        }
        return args;
    }

    parseLine(line: string, child: ChildProcess) {
        this.parseProgressPrefix(line);

        if (line.startsWith('[progress]')) {
            const parts = line.replace('[progress]', '').split('|').map(p => p.trim());
            if (parts.length >= 3) {
                this.currentFileBytes = this.parseSizeStringToBytes(parts[0]);
                this.currentSpeed = parts[1];
                this.currentTotalSize = parts[2];
            }
        } else if (line.startsWith('[start]')) {
            // Ignore start lines
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

        this.triggerOnProgress(child);
    }
}
