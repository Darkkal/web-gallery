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
                    }
                },
                "extractor": {
                    "base-directory": "./public/downloads",
                    "archive": "./gallery-dl-archive.sqlite3",
                    "postprocessors": [{
                        "name": "metadata",
                        "event": "post",
                        "filename": "{tweet_id|id|filename}.json"
                    }],
                    "sleep": "2.0-4.0",
                    "cookies": ["firefox"]
                },
                "downloader": {
                    "rate-limit": "5M",
                    "retries": 3
                }
            }, null, 4);
            fs.writeFileSync(configPath, configContent);
        }
    }

    async run(tool: 'gallery-dl' | 'yt-dlp', options: ScraperOptions): Promise<ScrapeResult> {
        return new Promise((resolve) => {
            const args: string[] = [];

            // Basic configuration for json output
            if (tool === 'gallery-dl') {
                // Use isolated config
                args.push('--config-ignore');
                args.push('--config', path.join(process.cwd(), 'gallery-dl.conf'));

                args.push(options.url);
                args.push('--directory', this.basePath);
            } else {
                // yt-dlp specific args
                args.push(options.url);
                args.push('-P', this.basePath);
                args.push('-j'); // Print JSON info
                // We might want to actually download too, so maybe don't use -j solely for info?
                // yt-dlp prints JSON line by line for each video with -j *and* downloads if we don't say --simulate.
                // No, -j implies simulate usually? No, "Simulate, quiet but print JSON info".
                // To download and get JSON: `yt-dlp URL --print-json --no-simulate` ?
                // or just `-j` which defaults to simulate?
                // Let's check docs or assume defaults for now.
                // Use -P for path.
            }

            console.log(`Starting ${tool} with args:`, args);

            const child = spawn(tool, args, { shell: true, cwd: process.cwd() });

            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            child.on('close', (code) => {
                if (code === 0) {
                    resolve({
                        success: true,
                        output: stdout,
                        items: [], // Parsing implementation needed
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
    }
}
