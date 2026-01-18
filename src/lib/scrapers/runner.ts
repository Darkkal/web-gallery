import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { ScraperOptions, ScrapeResult } from './types';

// Helper function to parse size strings like "120MiB" or "5.2M" to bytes
function parseSizeStringToBytes(sizeStr: string): number {
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

// Helper function to format bytes to human-readable string
function formatBytes(bytes: number): string {
    if (bytes === 0) return '0B';
    if (bytes < 1024) return bytes + 'B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + sizes[i];
}

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
                    "#": "shorten filenames to fit into one terminal line",
                    "shorten": "eaw",
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
                    "archive": "./gallery-dl-{category}-archive.sqlite3",
                    "sleep": [5, 10],
                    "sleep-request": [5, 10],
                    "cookies": [
                        "firefox"
                    ],
                    "directory": ["{category}"],
                    "twitter": {
                        "directory": ["{category}", "{author[id]}"],
                        "filename": "{tweet_id}_{img_index}.{extension}",
                        "postprocessors": [
                            {
                                "name": "metadata",
                                "event": "post",
                                "filename": "{tweet_id}_{img_index}.json"
                            }
                        ]
                    },
                    "pixiv": {
                        "directory": ["{category}", "{user[id]}"],
                        "filename": "{id}_{img_index}.{extension}",
                        "postprocessors": [
                            {
                                "name": "metadata",
                                "event": "post",
                                "filename": "{id}_{img_index}.json"
                            }
                        ],
                        "#": "transform ugoira into mkvs",
                        "ugoira": true,
                        "tags": "original",
                        "metadata-bookmark": "true"
                    }
                },
                "downloader": {
                    "rate-limit": "5M",
                    "retries": 3,
                    "progress": 0,
                    "proxy": ""
                },
                "postprocessor": {
                    "#": "various ugoira post processor configurations to create different file formats",
                    "ugoira-mp4": {
                        "name": "ugoira",
                        "extension": "mp4",
                        "ffmpeg-args": ["-c:v", "libx264", "-an", "-b:v", "4M", "-preset", "veryslow"],
                        "ffmpeg-twopass": true,
                        "libx264-prevent-odd": true,
                        "ffmpeg-location": "C:/ffmpeg/bin/ffmpeg.exe"
                    }
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
            let cumulativeBytes = 0; // Bytes from previously completed files
            let currentFileBytes = 0; // Bytes from the currently downloading file
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
                            currentFileBytes = parseSizeStringToBytes(parts[0]);
                            currentSpeed = parts[1];
                            currentTotalSize = parts[2];
                        }
                    } else if (line.startsWith('[success]')) {
                        downloadedCount++;
                        // When a file is successful, add its total size to cumulative
                        // and reset current file bytes
                        cumulativeBytes += parseSizeStringToBytes(currentTotalSize);
                        currentFileBytes = 0;
                    } else if (line.includes('public/downloads/') || line.includes('public\\downloads\\')) {
                        if (!line.endsWith('.json') && !line.includes('[debug]') && !line.includes('[info]') && !line.includes('[warning]')) {
                            if (currentSpeed === '0B/s') {
                                downloadedCount++;
                            }
                        }
                    }
                }

                if (options.onProgress) {
                    // Include current file progress in the total
                    const totalSoFar = cumulativeBytes + currentFileBytes;
                    options.onProgress({
                        downloadedCount,
                        speed: currentSpeed,
                        totalSize: formatBytes(totalSoFar),
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
                    // Final report includes whatever was downloaded (even partials if closed)
                    const totalSoFar = cumulativeBytes + currentFileBytes;
                    options.onProgress({
                        downloadedCount,
                        speed: '0B/s',
                        totalSize: formatBytes(totalSoFar),
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
