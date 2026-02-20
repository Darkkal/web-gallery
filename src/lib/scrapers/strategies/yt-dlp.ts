import { BaseScraperStrategy } from './base';
import { ChildProcess } from 'child_process';
export class YtDlpStrategy extends BaseScraperStrategy {
    get toolName() { return 'yt-dlp' as const; }

    buildArgs() {
        const args: string[] = [];
        args.push('--', this.options.url);
        args.push('-P', this.basePath);
        args.push('--newline');
        return args;
    }

    parseLine(line: string, child: ChildProcess) {
        this.parseProgressPrefix(line);

        const match = line.match(/\[download\]\s+(\d+\.\d+)%\s+of\s+([\d\.]+\w+)\s+at\s+([\d\.]+\w+\/s)/);
        if (match) {
            const size = match[2];
            const speed = match[3];
            this.currentSpeed = speed;
            this.currentTotalSize = size;

            if (line.includes('[download] Destination:')) {
                this.downloadedCount++;
            }
        }

        if (line.includes('[download] Destination:') || line.includes('[download]')) {
            const parts = line.split('Destination: ');
            if (parts.length > 1) {
                const fPath = parts[1].trim();
                if (!this.processedFilesSet.has(fPath)) {
                    this.processedFilesSet.add(fPath);
                    this.processedFiles.push(fPath);
                }
            } else if (line.includes('has already been downloaded')) {
                const parts2 = line.split('[download] ');
                if (parts2.length > 1) {
                    const subParts = parts2[1].split(' has already been downloaded');
                    if (subParts.length > 0) {
                        const fPath = subParts[0].trim();
                        if (!this.processedFilesSet.has(fPath)) {
                            this.processedFilesSet.add(fPath);
                            this.processedFiles.push(fPath);
                        }
                    }
                }
            }
        }

        this.triggerOnProgress(child);
    }
}
