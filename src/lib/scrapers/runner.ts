import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { ScraperOptions, ScrapeResult } from './types';
import { GalleryDlStrategy } from './strategies/gallery-dl';
import { YtDlpStrategy } from './strategies/yt-dlp';
import { BaseScraperStrategy } from './strategies/base';

export interface ScrapeLimits {
    stopAfterCompleted?: number;
    stopAfterSkipped?: number;
    stopAfterPosts?: number;
}

export class ScraperRunner {
    private basePath: string;

    constructor(basePath: string) {
        this.basePath = basePath;
        if (!fs.existsSync(basePath)) {
            fs.mkdirSync(basePath, { recursive: true });
        }
        this.ensureConfig();
    }

    private ensureConfig() {
        const configPath = path.join(process.cwd(), 'gallery-dl.conf');
        const defaultConfigPath = path.join(process.cwd(), 'gallery-dl-default.conf');

        if (!fs.existsSync(configPath)) {
            if (fs.existsSync(defaultConfigPath)) {
                fs.copyFileSync(defaultConfigPath, configPath);
            } else {
                console.warn('Warning: gallery-dl-default.conf not found. Skipping default config creation.');
            }
        }
    }

    run(tool: 'gallery-dl' | 'yt-dlp', options: ScraperOptions, limits?: ScrapeLimits): {
        promise: Promise<ScrapeResult>,
        child: import('child_process').ChildProcess
    } {
        let childProcess: import('child_process').ChildProcess;
        let strategy: BaseScraperStrategy;

        if (tool === 'yt-dlp') {
            strategy = new YtDlpStrategy(this.basePath, options, limits);
        } else {
            strategy = new GalleryDlStrategy(this.basePath, options, limits);
        }

        const promise = new Promise<ScrapeResult>((resolve) => {
            const args = strategy.buildArgs();

            console.log(`Starting ${tool} with args:`, args);

            const child = spawn(tool, args, { shell: false, cwd: process.cwd() });
            childProcess = child;

            child.stdout?.on('data', (data: Buffer) => {
                const text = data.toString();
                text.split('\n').forEach((line: string) => {
                    if (!line.trim()) return;

                    if (!line.startsWith('[progress]') && !line.startsWith('[download]')) {
                        strategy.stdout += line + '\n';
                    }

                    strategy.parseLine(line, child);
                });
            });

            child.stderr?.on('data', (data: Buffer) => {
                const text = data.toString();
                text.split('\n').forEach((line: string) => {
                    if (!line.trim()) return;

                    if (!line.startsWith('[progress]') && !line.startsWith('[download]')) {
                        strategy.stderr += line + '\n';
                    }

                    if (line.includes('[error]') || line.includes('ERROR:')) {
                        console.error(`[ScraperRunner] ${tool} Error:`, line.trim());
                    }

                    strategy.parseLine(line, child);
                });
            });

            child.on('close', (code) => {
                if (code === 0) {
                    resolve(strategy.getFinalResult(true));
                } else if (code === null) {
                    resolve(strategy.getFinalResult(false, 'Process was terminated'));
                } else {
                    resolve(strategy.getFinalResult(false, strategy.stderr));
                }
            });
        });

        return { promise, child: childProcess! };
    }
}
