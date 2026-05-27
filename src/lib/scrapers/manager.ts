import { type ChildProcess, spawn } from "node:child_process";
import path from "node:path";
import { eq } from "drizzle-orm";
import { paths } from "@/lib/config";
import { db } from "@/lib/db";
import { scrapeHistory, scraperDownloadLogs } from "@/lib/db/schema";
import { queueIncrementalScan } from "@/lib/library/scanner";
import { type ScrapeLimits, ScraperRunner } from "@/lib/scrapers/runner";
import type { BaseScraperStrategy } from "@/lib/scrapers/strategies/base";
import type { ScrapeProgress } from "@/lib/scrapers/types";
import { parseSizeToBytes } from "@/lib/utils/format";

export interface ScrapingStatus extends ScrapeProgress {
  historyId: number;
  sourceId: number;
  url: string;
  type: "gallery-dl" | "yt-dlp";
  startTime: Date;
  taskId?: number;
  logPath?: string;
  lastDbUpdate?: number;
  resumeCursor?: string;
  status?: "running" | "completed" | "stopped" | "failed";
}

class ScraperManager {
  private static instance: ScraperManager;
  private activeScrapes: Map<
    number,
    {
      process: ChildProcess;
      status: ScrapingStatus;
      strategy: BaseScraperStrategy;
    }
  > = new Map();

  private constructor() {
    // Skip zombie cleanup during Next.js build phase (no database available)
    if (process.env.NEXT_PHASE === "phase-production-build") {
      return;
    }

    // Cleanup any zombie tasks from previous crashes/restarts
    db.update(scrapeHistory)
      .set({
        status: "failed",
        lastError: "Application stopped unexpectedly",
        endTime: new Date(),
      })
      .where(eq(scrapeHistory.status, "running"))
      .returning({ id: scrapeHistory.id })
      .then((res) => {
        if (res.length > 0) {
          console.log(
            `[ScraperManager] Cleaned up ${res.length} zombie scrape tasks`,
          );
        }
      })
      .catch((err) =>
        console.error(
          "[ScraperManager] Failed to cleanup zombie scrapes:",
          err,
        ),
      );
  }

  public static getInstance(): ScraperManager {
    if (!ScraperManager.instance) {
      ScraperManager.instance = new ScraperManager();
    }
    return ScraperManager.instance;
  }

  async startScrape(
    sourceId: number,
    type: "gallery-dl" | "yt-dlp",
    url: string,
    downloadDir: string,
    options: {
      mode?: "full" | "quick";
      taskId?: number;
      limits?: ScrapeLimits;
      cursor?: string;
    } = {},
  ) {
    console.log(
      `[ScraperManager] STARTING scrape for source ID: ${sourceId} (${type}) - URL: ${url}`,
    );
    if (this.activeScrapes.has(sourceId)) {
      const active = this.activeScrapes.get(sourceId);
      if (active && !active.status.isFinished) {
        console.warn(
          `[ScraperManager] Scrape already in progress for source ${sourceId}`,
        );
        return;
      }
      this.activeScrapes.delete(sourceId);
    }

    const runner = new ScraperRunner(downloadDir);
    const startTime = new Date();

    // Create history record at the start
    const historyRows = await db
      .insert(scrapeHistory)
      .values({
        sourceId,
        startTime,
        status: "running",
        filesDownloaded: 0,
        bytesDownloaded: 0,
        errorCount: 0,
        skippedCount: 0,
        postsProcessed: 0,
        averageSpeed: 0,
        taskId: options.taskId,
      })
      .returning({ id: scrapeHistory.id });

    if (!historyRows || historyRows.length === 0) {
      console.error(
        `[ScraperManager] Failed to create history record for source ${sourceId}`,
      );
      return;
    }

    const historyId = historyRows[0].id;
    const logPath = path.join(paths.galleryDl.logs, `scrape_${historyId}.log`);

    // Update history with log path (store absolute path)
    await db
      .update(scrapeHistory)
      .set({ logPath })
      .where(eq(scrapeHistory.id, historyId));

    console.log(
      `[ScraperManager] Created history record ${historyId} for source ${sourceId}`,
    );

    const status: ScrapingStatus = {
      historyId,
      sourceId,
      url,
      type,
      startTime,
      taskId: options.taskId,
      downloadedCount: 0,
      speed: "0B/s",
      totalSize: "0B",
      errorCount: 0,
      skippedCount: 0,
      postsProcessed: 0,
      isRateLimited: false,
      isFinished: false,
      logPath,
      resumeCursor: options.cursor,
      status: "running",
    };

    const { promise, child, strategy } = runner.run(
      type,
      {
        url,
        logPath: logPath,
        mode: options.mode,
        cursor: options.cursor,
        onProgress: (p) => {
          const current = this.activeScrapes.get(sourceId);
          if (current) {
            current.status = { ...current.status, ...p };

            // Throttle database updates to every 5 seconds
            const now = Date.now();
            if (
              !current.status.lastDbUpdate ||
              now - current.status.lastDbUpdate > 5000
            ) {
              current.status.lastDbUpdate = now;

              const durationSeconds =
                (now - current.status.startTime.getTime()) / 1000;
              const bytesDownloaded = this.parseSizeToBytes(
                current.status.totalSize,
              );
              const averageSpeed =
                durationSeconds > 0
                  ? Math.floor(bytesDownloaded / durationSeconds)
                  : 0;

              db.update(scrapeHistory)
                .set({
                  filesDownloaded: current.status.downloadedCount,
                  bytesDownloaded,
                  errorCount: current.status.errorCount,
                  skippedCount: current.status.skippedCount,
                  postsProcessed: current.status.postsProcessed,
                  averageSpeed,
                })
                .where(eq(scrapeHistory.id, current.status.historyId))
                .execute()
                .catch((err) =>
                  console.error(
                    `[ScraperManager] Failed to update progress for history ${current.status.historyId}`,
                    err,
                  ),
                );
            }
          }
        },
      },
      options.limits,
    );

    this.activeScrapes.set(sourceId, { process: child, status, strategy });

    promise
      .then(async (result) => {
        let logMsg = result.error || result.output || "";
        if (logMsg.length > 200) {
          logMsg = `${logMsg.substring(0, 200)}...`;
        }
        console.log(
          `[ScraperManager] FINISHED scrape for source ID: ${sourceId} - Result: ${result.success ? "Success" : "Failed"} ${logMsg}`,
        );

        // Log downloaded files for source linking
        if (result.items && result.items.length > 0) {
          try {
            console.log(
              `[ScraperManager] Logging ${result.items.length} files for source ${sourceId}...`,
            );
            const values = result.items.map((path) => ({
              sourceId,
              filePath: path,
            }));

            // Batch insert might be too big if thousands, but safe for now or chunk it
            // SQLite limit is usually variable limits, safe to chunk
            const chunkSize = 100;
            for (let i = 0; i < values.length; i += chunkSize) {
              const batch = values.slice(i, i + chunkSize);
              await db
                .insert(scraperDownloadLogs)
                .values(batch)
                .onConflictDoNothing();
            }
          } catch (e: unknown) {
            const err = e as Error;
            console.error(
              "[ScraperManager] Failed to save download logs:",
              err.message,
            );
          }
        }

        const current = this.activeScrapes.get(sourceId);
        if (current) {
          current.status.isFinished = true;
          const finalStatus = current.strategy.manualStop
            ? "stopped"
            : result.success
              ? "completed"
              : "failed";
          current.status.status = finalStatus;

          // Update history record with final metrics
          const endTime = new Date();
          const durationSeconds =
            (endTime.getTime() - startTime.getTime()) / 1000;
          const bytesDownloaded = this.parseSizeToBytes(
            current.status.totalSize,
          );
          const averageSpeed =
            durationSeconds > 0
              ? Math.floor(bytesDownloaded / durationSeconds)
              : 0;

          await db
            .update(scrapeHistory)
            .set({
              endTime,
              status: finalStatus,
              filesDownloaded: current.status.downloadedCount,
              bytesDownloaded,
              errorCount: current.status.errorCount,
              skippedCount: current.status.skippedCount,
              postsProcessed: current.status.postsProcessed,
              averageSpeed,
              lastError:
                result.error || (result.success ? null : result.output),
              cursor: result.cursor || current.status.cursor || null,
            })
            .where(eq(scrapeHistory.id, historyId));

          console.log(
            `[ScraperManager] Updated history record ${historyId} with final metrics`,
          );

          // Queue incremental scan for only the downloaded files
          console.log(
            `[ScraperManager] Queuing incremental scan for ${result.items?.length ?? 0} downloaded files...`,
          );
          queueIncrementalScan(result.items ?? []);

          // Keep it in the map for a bit so the UI can see "Finished"
          setTimeout(() => {
            this.activeScrapes.delete(sourceId);
          }, 30000); // 30 seconds
        }
      })
      .catch(async (err) => {
        console.error(`[ScraperManager] ERROR for source ID:`, sourceId, err);

        // Update history record as failed
        await db
          .update(scrapeHistory)
          .set({
            endTime: new Date(),
            status: "failed",
            lastError: err instanceof Error ? err.message : String(err),
          })
          .where(eq(scrapeHistory.id, historyId));

        this.activeScrapes.delete(sourceId);

        // No result.items available on promise rejection — log and let user manually full-scan if needed
        console.log(
          `[ScraperManager] Scrape failed for source ${sourceId}. No incremental scan queued — use manual full scan if needed.`,
        );
      });
  }

  getStatus(sourceId: number): ScrapingStatus | undefined {
    return this.activeScrapes.get(sourceId)?.status;
  }

  getAllStatuses(): ScrapingStatus[] {
    return Array.from(this.activeScrapes.values()).map((s) => s.status);
  }

  async stopScrape(sourceId: number) {
    const active = this.activeScrapes.get(sourceId);
    if (active) {
      const pid = active.process.pid;
      console.log(
        `[ScraperManager] STOPPING scrape for source ID: ${sourceId} (PID: ${pid})`,
      );

      // Mark as intentional stop so runner reports it correctly
      active.strategy.intentionalStop = true;
      active.strategy.manualStop = true;
      active.status.status = "stopped";

      if (pid) {
        if (process.platform === "win32") {
          spawn("taskkill", ["/pid", pid.toString(), "/f", "/t"]);
        } else {
          active.process.kill("SIGINT");
        }
      }

      return true;
    }
    console.log(
      `[ScraperManager] STOP REQUESTED for source ID: ${sourceId} but no active scrape found.`,
    );
    return false;
  }

  // Size parsing delegated to shared utility
  private parseSizeToBytes = parseSizeToBytes;
}

const globalForScraper = globalThis as unknown as {
  scraperManager: ScraperManager | undefined;
};

export const scraperManager =
  globalForScraper.scraperManager ?? ScraperManager.getInstance();

if (process.env.NODE_ENV !== "production") {
  globalForScraper.scraperManager = scraperManager;
}
