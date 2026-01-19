import fs from 'fs';
import path from 'path';
import { db } from '@/lib/db';
import { repairRuns } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { ScraperRunner } from '@/lib/scrapers/runner';

interface RepairStats {
    filesChecked: number;
    filesRepaired: number;
    errors: number;
    currentPath: string;
    startTime: number;
    status: 'running' | 'paused' | 'stopped' | 'completed' | 'failed' | 'idle';
}

class TwitterRepairManager {
    private isRunning = false;
    private isPaused = false;
    private abortController: AbortController | null = null;
    private currentRunId: number | null = null;

    // Batching
    private repairQueue: string[] = [];
    private tempListPath = path.join(process.cwd(), 'repair-list.txt');
    private currentChildProcess: import('child_process').ChildProcess | null = null;

    private stats: RepairStats = {
        filesChecked: 0,
        filesRepaired: 0, // This will track SUCCESSFUL repairs
        errors: 0,
        currentPath: '',
        startTime: 0,
        status: 'idle'
    };

    private basePath = path.join(process.cwd(), 'public', 'downloads', 'twitter');
    private scraperRunner: ScraperRunner;

    constructor() {
        this.scraperRunner = new ScraperRunner(path.join(process.cwd(), 'public', 'downloads'));
    }

    public getStatus() {
        return { ...this.stats };
    }

    public async start() {
        if (this.isRunning) return;

        this.isRunning = true;
        this.isPaused = false;
        this.abortController = new AbortController();
        this.repairQueue = []; // Reset queue

        this.stats = {
            filesChecked: 0,
            filesRepaired: 0,
            errors: 0,
            currentPath: 'Initializing...',
            startTime: Date.now(),
            status: 'running'
        };

        try {
            // Create DB Entry
            const [entry] = await db.insert(repairRuns).values({
                type: 'twitter',
                startTime: new Date(),
                status: 'running',
                filesChecked: 0,
                filesRepaired: 0,
                errors: 0,
                currentPath: 'Starting...'
            }).returning();
            this.currentRunId = entry.id;

            this.runRepairLoop();
        } catch (e) {
            console.error('Failed to start repair:', e);
            this.stats.status = 'failed';
            this.isRunning = false;
        }
    }

    public async stop() {
        if (!this.isRunning) return;
        this.abortController?.abort();

        // Kill the child process if running
        if (this.currentChildProcess && this.currentChildProcess.pid) {
            console.log('[TwitterRepair] Killing gallery-dl process...');
            // On Windows, we need to use taskkill to kill the process tree
            // SIGTERM doesn't work properly on Windows
            if (process.platform === 'win32') {
                const { spawn } = require('child_process');
                spawn('taskkill', ['/pid', String(this.currentChildProcess.pid), '/f', '/t'], { shell: true });
            } else {
                this.currentChildProcess.kill('SIGKILL');
            }
            this.currentChildProcess = null;
        }

        this.isRunning = false;
        this.isPaused = false;
        this.stats.status = 'stopped';
        this.stats.currentPath = 'Stopped by user';

        // Clear repair queue and temp file
        this.repairQueue = [];
        if (fs.existsSync(this.tempListPath)) {
            try { fs.unlinkSync(this.tempListPath); } catch { }
        }

        if (this.currentRunId) {
            await db.update(repairRuns)
                .set({ status: 'stopped', endTime: new Date() })
                .where(eq(repairRuns.id, this.currentRunId));
        }
    }

    public pause() {
        if (this.isRunning && !this.isPaused) {
            this.isPaused = true;
            this.stats.status = 'paused';
            this.updateDbStatus();
            // Note: If we are in batch download phase, we can't really "pause" the child process easily.
            // For now, pause is mostly effective during the SCAN phase. 
            // If in download phase, user might have to Stop.
        }
    }

    public resume() {
        if (this.isRunning && this.isPaused) {
            this.isPaused = false;
            this.stats.status = 'running';
            this.updateDbStatus();
            // The loop checks isPaused, so it will resume automatically
        }
    }

    private async updateDbStatus() {
        if (!this.currentRunId) return;

        // Map 'idle' to 'completed' or 'stopped' if needed, or just don't update if idle.
        // Actually, if status is 'idle', we shouldn't be updating the DB for an active run usually.
        // But let's handle it safely.
        let statusToSave = this.stats.status;
        if (statusToSave === 'idle') statusToSave = 'completed'; // Default fallback

        await db.update(repairRuns).set({
            status: statusToSave,
            filesChecked: this.stats.filesChecked,
            filesRepaired: this.stats.filesRepaired,
            errors: this.stats.errors,
            currentPath: this.stats.currentPath,
        }).where(eq(repairRuns.id, this.currentRunId));
    }

    private async runRepairLoop() {
        try {
            // PHASE 1: SCANNING
            const userDirs = fs.readdirSync(this.basePath)
                .filter(d => /^\d+$/.test(d)); // Only numeric folders (User IDs)

            console.log(`[TwitterRepair] Starting scan of ${userDirs.length} user directories`);
            let scannedDirs = 0;

            for (const userId of userDirs) {
                if (this.abortController?.signal.aborted) break;

                while (this.isPaused) {
                    if (this.abortController?.signal.aborted) break;
                    await new Promise(r => setTimeout(r, 1000));
                }

                const dirPath = path.join(this.basePath, userId);
                this.scanUserDirectory(dirPath, userId);
                scannedDirs++;

                // Update progress every 50 dirs to avoid blocking
                if (scannedDirs % 50 === 0) {
                    this.stats.currentPath = `Scanning... (${scannedDirs}/${userDirs.length} dirs, ${this.stats.filesChecked} files, ${this.repairQueue.length} need repair)`;
                    await this.updateDbStatus();
                    // Yield to event loop
                    await new Promise(r => setTimeout(r, 0));
                }
            }

            console.log(`[TwitterRepair] Scan complete: ${this.stats.filesChecked} files checked, ${this.repairQueue.length} need repair`);

            // PHASE 2: BATCH REPAIR
            if (!this.abortController?.signal.aborted && this.repairQueue.length > 0) {
                this.stats.currentPath = `Starting Batch Repair (${this.repairQueue.length} items)...`;
                await this.updateDbStatus();

                await this.runBatchRepair();
            } else if (this.repairQueue.length === 0) {
                this.stats.currentPath = 'No repairs needed.';
            }

            if (!this.abortController?.signal.aborted) {
                this.stats.status = 'completed';
                if (this.currentRunId) {
                    await db.update(repairRuns)
                        .set({ status: 'completed', endTime: new Date() })
                        .where(eq(repairRuns.id, this.currentRunId));
                }
            }
        } catch (e) {
            console.error('Repair loop error:', e);
            this.stats.status = 'failed';
            this.stats.errors++;
            if (this.currentRunId) {
                await db.update(repairRuns)
                    .set({ status: 'failed', endTime: new Date() })
                    .where(eq(repairRuns.id, this.currentRunId));
            }
        } finally {
            this.isRunning = false;
            // Cleanup temp file
            if (fs.existsSync(this.tempListPath)) {
                try { fs.unlinkSync(this.tempListPath); } catch { }
            }
        }
    }

    private scanUserDirectory(dirPath: string, userId: string) {
        // Find all JSONs and potential media
        const files = fs.readdirSync(dirPath);
        const tweetIds = new Set<string>();

        for (const f of files) {
            const match = f.match(/^(\d+)/);
            if (match) {
                tweetIds.add(match[1]);
            }
        }

        for (const tweetId of tweetIds) {
            this.stats.filesChecked++;

            // Check 1: Metadata exists
            const jsonPath = path.join(dirPath, `${tweetId}.json`);
            let needsRepair = false;

            if (!fs.existsSync(jsonPath)) {
                needsRepair = true;
            } else {
                try {
                    // Check Media presence strictly by checking if any media file exists
                    // This avoids overhead of reading every JSON
                    const hasMedia = files.some(f => f.startsWith(`${tweetId}_`) && !f.endsWith('.json'));

                    if (!hasMedia) {
                        // Only read JSON if we suspect missing media
                        const content = fs.readFileSync(jsonPath, 'utf-8');
                        const json = JSON.parse(content);
                        // gallery-dl JSON uses 'count' field for total media items in this tweet
                        const mediaCount = json.count || 0;

                        if (mediaCount > 0) {
                            needsRepair = true;
                        }
                    }
                } catch (e) {
                    needsRepair = true;
                }
            }

            if (needsRepair) {
                this.repairQueue.push(`https://twitter.com/i/web/status/${tweetId}`);
            }
        }
    }

    private async runBatchRepair() {
        // Write queue to file
        fs.writeFileSync(this.tempListPath, this.repairQueue.join('\n'));
        console.log(`[TwitterRepair] Starting batch repair with ${this.repairQueue.length} URLs`);
        console.log(`[TwitterRepair] Input file: ${this.tempListPath}`);
        console.log(`[TwitterRepair] First 5 URLs:`, this.repairQueue.slice(0, 5));

        // Setup periodic DB update interval
        const updateInterval = setInterval(() => {
            this.updateDbStatus();
        }, 3000); // Update DB every 3 seconds

        try {
            const { promise, child } = this.scraperRunner.run('gallery-dl', {
                url: '', // Ignored/Empty since we use inputFile
                inputFile: this.tempListPath,
                noArchive: true, // Bypass archive so gallery-dl processes items fresh (skips existing media but writes metadata)
                onProgress: (p) => {
                    // Update stats live
                    this.stats.filesRepaired = p.downloadedCount;
                    this.stats.errors = p.errorCount;
                    this.stats.currentPath = `Repairing... (${p.downloadedCount} files, ${p.totalSize})`;

                    // Log progress for debugging
                    if (p.downloadedCount > 0 && p.downloadedCount % 10 === 0) {
                        console.log(`[TwitterRepair] Progress: ${p.downloadedCount} files downloaded`);
                    }
                }
            });

            this.currentChildProcess = child;
            await promise;
            this.currentChildProcess = null;

        } catch (e) {
            console.error('[TwitterRepair] Batch repair failed:', e);
            this.stats.errors++;
        } finally {
            clearInterval(updateInterval);
            await this.updateDbStatus(); // Final update
        }
    }
}

// Singleton - Version 3 to force refresh
const globalForRepair = globalThis as unknown as { twitterRepairManagerV3: TwitterRepairManager };
export const twitterRepairManager = globalForRepair.twitterRepairManagerV3 || new TwitterRepairManager();
if (process.env.NODE_ENV !== 'production') globalForRepair.twitterRepairManagerV3 = twitterRepairManager;
