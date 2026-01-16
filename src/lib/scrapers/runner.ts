import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { ScraperOptions, ScrapeResult } from './types';

export class ScraperRunner {
    private basePath: string;

    constructor(basePath: string) {
        this.basePath = basePath;
        // ensure base path exists
        if (!fs.existsSync(basePath)) {
            fs.mkdirSync(basePath, { recursive: true });
        }
        this.ensureConfig();
    }

    private ensureConfig() {
        const configPath = path.join(process.cwd(), 'gallery-dl.conf');
        if (!fs.existsSync(configPath)) {
            const configContent = JSON.stringify({
                "output": {
                    "logfile": {
                        "path": "./gallery-dl.log",
                        "level": "debug"
                    },
                    "mode": {
                        "start": "[start] {0}\n",
                        "success": "[success] {0}\n",
                        "skip": "[skip] {0}\n",
                        "progress": "[progress] {0} | {1} | {2} | {3}\n",
                        "progress-total": "[progress] {0} | {1} | {2} | {3}\n"
                    }
                },
                "extractor": {
                    "base-directory": "./public/downloads",
                    "archive": "./gallery-dl-archive.sqlite3",
                    "filename": "{tweet_id|id|filename}.{extension}",
                    "postprocessors": [{
                        "name": "metadata",
                        "event": "post",
                        "filename": "{tweet_id|id|filename}.json"
                    }],
                    "sleep": "2.0-4.0",
                    "cookies": ["firefox"],
                    "directory": ["{category}"]
                },
                "downloader": {
                    "rate-limit": "5M",
                    "retries": 3,
                    "progress": 0
                }
            }, null, 4);
            fs.writeFileSync(configPath, configContent);
        }
    }

    run(tool: 'gallery-dl' | 'yt-dlp', options: ScraperOptions): {
        promise: Promise<ScrapeResult>,
        child: import('child_process').ChildProcess
    } {
        let childProcess: import('child_process').ChildProcess;
        const promise = new Promise<ScrapeResult>((resolve) => {
            const args: string[] = [];

            if (tool === 'gallery-dl') {
                args.push('--config-ignore');
                args.push('--config', path.join(process.cwd(), 'gallery-dl.conf'));
                args.push(options.url);
                args.push('--destination', this.basePath);
            } else {
                args.push(options.url);
                args.push('-P', this.basePath);
                // yt-dlp shows progress by default for files.
                args.push('--newline'); // Easier to parse line by line
            }

            console.log(`Starting ${tool} with args:`, args);

            const child = spawn(tool, args, { shell: true, cwd: process.cwd() });
            childProcess = child;

            let stdout = '';
            let stderr = '';
            let downloadedCount = 0;
            let currentSpeed = '0B/s';
            let currentTotalSize = '0B';
            let errorCount = 0;
            let isRateLimited = false;

            const parseProgress = (line: string) => {
                if (line.includes('API rate limit exceeded') || line.includes('rate limit')) {
                    isRateLimited = true;
                }
                if (line.includes('[download][error]') || line.includes('[error]')) {
                    errorCount++;
                }

                if (tool === 'yt-dlp') {
                    const match = line.match(/\[download\]\s+(\d+\.\d+)%\s+of\s+([\d\.]+\w+)\s+at\s+([\d\.]+\w+\/s)/);
                    if (match) {
                        const [_, percent, size, speed] = match;
                        currentSpeed = speed;
                        currentTotalSize = size;

                        if (line.includes('[download] Destination:')) {
                            downloadedCount++;
                        }
                    }
                } else if (tool === 'gallery-dl') {
                    if (line.startsWith('[progress]')) {
                        // Custom format: [progress] {0} | {1} | {2} | {3}
                        // {0}: bytes, {1}: speed, {2}: total, {3}: percent
                        const parts = line.replace('[progress]', '').split('|').map(p => p.trim());
                        if (parts.length >= 3) {
                            currentSpeed = parts[1];
                            currentTotalSize = parts[2];
                        }
                    } else if (line.startsWith('[success]')) {
                        downloadedCount++;
                    } else if (line.includes('public/downloads/') || line.includes('public\\downloads\\')) {
                        if (!line.endsWith('.json') && !line.includes('[debug]') && !line.includes('[info]') && !line.includes('[warning]')) {
                            if (currentSpeed === '0B/s') {
                                downloadedCount++;
                            }
                        }
                    }
                }

                if (options.onProgress) {
                    options.onProgress({
                        downloadedCount,
                        speed: currentSpeed,
                        totalSize: currentTotalSize,
                        errorCount,
                        isRateLimited,
                        isFinished: false
                    });
                }
            };

            child.stdout?.on('data', (data: Buffer) => {
                const text = data.toString();
                text.split('\n').forEach((line: string) => {
                    if (!line.trim()) return;

                    // Filter out high-frequency progress logs from being stored in memory
                    // This prevents dumping them into the final result/error message
                    if (!line.startsWith('[progress]') && !line.startsWith('[download]')) {
                        stdout += line + '\n';
                    }

                    parseProgress(line);
                });
            });

            child.stderr?.on('data', (data: Buffer) => {
                const text = data.toString();
                text.split('\n').forEach((line: string) => {
                    if (!line.trim()) return;

                    // Filter out high-frequency progress logs
                    if (!line.startsWith('[progress]') && !line.startsWith('[download]')) {
                        stderr += line + '\n';
                    }

                    // Log errors to the server console for better visibility
                    if (line.includes('[error]') || line.includes('ERROR:')) {
                        console.error(`[ScraperRunner] ${tool} Error:`, line.trim());
                    }

                    parseProgress(line);
                });
            });

            child.on('close', (code) => {
                if (options.onProgress) {
                    options.onProgress({
                        downloadedCount,
                        speed: '0B/s',
                        totalSize: currentTotalSize,
                        errorCount,
                        isRateLimited,
                        isFinished: true
                    });
                }

                if (code === 0) {
                    resolve({
                        success: true,
                        output: stdout,
                        items: [],
                    });
                } else if (code === null) {
                    // Process was killed
                    resolve({
                        success: false,
                        output: stdout,
                        error: 'Process was terminated',
                        items: [],
                    });
                } else {
                    resolve({
                        success: false,
                        output: stdout,
                        error: stderr,
                        items: [],
                    });
                }
            });
        });

        return { promise, child: childProcess! };
    }
}
