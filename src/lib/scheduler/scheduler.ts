import { Cron } from "croner";
import { eq } from "drizzle-orm";
import { paths } from "@/lib/config";
import { db } from "@/lib/db";
import { scrapingTasks } from "@/lib/db/schema";
import { scraperManager } from "@/lib/scrapers/manager";
import { intervalToCron, isValidCron } from "@/lib/utils/schedule-utils";

interface QueueItem {
  taskId: number;
  mode: "full" | "quick";
}

class TaskScheduler {
  private static instance: TaskScheduler;
  private jobs: Map<number, Cron> = new Map();
  private queue: QueueItem[] = [];
  private isProcessingQueue = false;
  private isInitialized = false;

  private constructor() {
    // Do not initialize or start scheduler in build phase
    if (process.env.NEXT_PHASE === "phase-production-build") {
      return;
    }
  }

  public static getInstance(): TaskScheduler {
    if (!TaskScheduler.instance) {
      TaskScheduler.instance = new TaskScheduler();
    }
    return TaskScheduler.instance;
  }

  /**
   * Initializes the scheduler by loading all enabled scraping tasks from the database.
   */
  public async init() {
    if (this.isInitialized) {
      console.log("[TaskScheduler] Scheduler already initialized.");
      return;
    }

    console.log("[TaskScheduler] Initializing task scheduler...");
    this.isInitialized = true;

    try {
      const activeTasks = await db.query.scrapingTasks.findMany({
        where: eq(scrapingTasks.enabled, true),
      });

      console.log(
        `[TaskScheduler] Found ${activeTasks.length} enabled tasks to schedule.`,
      );

      for (const task of activeTasks) {
        this.addSchedule(task);
      }

      console.log("[TaskScheduler] Scheduler successfully initialized.");
    } catch (err) {
      console.error(
        "[TaskScheduler] Failed to load scraping tasks during initialization:",
        err,
      );
      this.isInitialized = false;
    }
  }

  /**
   * Adds or updates a schedule in memory and calculates its next run date.
   */
  public addSchedule(task: {
    id: number;
    scheduleInterval?: number | null;
    scheduleCron?: string | null;
    enabled?: boolean | null;
  }) {
    if (!task.enabled) {
      this.removeSchedule(task.id);
      return;
    }

    // Cancel existing job first
    this.removeSchedule(task.id);

    let pattern: string | null = null;

    if (task.scheduleCron) {
      if (isValidCron(task.scheduleCron)) {
        pattern = task.scheduleCron;
      } else {
        console.error(
          `[TaskScheduler] Invalid cron pattern for task ID ${task.id}: ${task.scheduleCron}`,
        );
        return;
      }
    } else if (task.scheduleInterval) {
      pattern = intervalToCron(task.scheduleInterval);
    }

    if (pattern) {
      console.log(
        `[TaskScheduler] Scheduling task ID ${task.id} with pattern: ${pattern}`,
      );
      try {
        const job = new Cron(pattern, () => {
          console.log(
            `[TaskScheduler] Cron trigger fired for task ID: ${task.id}`,
          );
          this.enqueue(task.id, "quick");

          // Update next run time after trigger fires
          const nextDate = job.nextRun();
          this.updateNextRunAt(task.id, nextDate);
        });

        this.jobs.set(task.id, job);

        // Update database with the initial next run time
        const nextDate = job.nextRun();
        this.updateNextRunAt(task.id, nextDate);
      } catch (err) {
        console.error(
          `[TaskScheduler] Failed to schedule task ID ${task.id} with pattern ${pattern}:`,
          err,
        );
      }
    } else {
      // Manual task, ensure nextRunAt is cleared
      this.updateNextRunAt(task.id, null);
    }
  }

  /**
   * Cancels and removes a scheduled job from memory.
   */
  public removeSchedule(taskId: number) {
    const job = this.jobs.get(taskId);
    if (job) {
      job.stop();
      this.jobs.delete(taskId);
      console.log(
        `[TaskScheduler] Removed active schedule for task ID: ${taskId}`,
      );
    }
  }

  /**
   * Enqueues a task to run sequentially through the FIFO queue.
   */
  public enqueue(taskId: number, mode: "full" | "quick" = "quick") {
    console.log(`[TaskScheduler] Enqueuing task ID: ${taskId} (${mode})`);

    // Avoid double enqueuing same task if it is already in queue
    const alreadyQueued = this.queue.some(
      (item) => item.taskId === taskId && item.mode === mode,
    );
    if (alreadyQueued) {
      console.log(
        `[TaskScheduler] Task ID ${taskId} is already in the execution queue. Skipping.`,
      );
      return;
    }

    this.queue.push({ taskId, mode });
    this.processQueue().catch((err) => {
      console.error("[TaskScheduler] Error running execution queue:", err);
    });
  }

  /**
   * Processes the execution queue sequentially to prevent SQLite write contention.
   */
  private async processQueue() {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    try {
      while (this.queue.length > 0) {
        const item = this.queue.shift();
        if (item) {
          try {
            await this.executeTask(item.taskId, item.mode);
          } catch (taskErr) {
            console.error(
              `[TaskScheduler] Failed to execute task ID ${item.taskId}:`,
              taskErr,
            );
          }
        }
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Executes the task by starting it with ScraperManager and awaiting completion.
   */
  private async executeTask(taskId: number, mode: "full" | "quick") {
    console.log(
      `[TaskScheduler] Starting execution for task ID: ${taskId} (${mode})`,
    );

    const task = await db.query.scrapingTasks.findFirst({
      where: eq(scrapingTasks.id, taskId),
      with: {
        source: true,
      },
    });

    if (!task) {
      console.log(
        `[TaskScheduler] Execution aborted: Task ID ${taskId} not found in database.`,
      );
      this.removeSchedule(taskId);
      return;
    }

    if (!task.enabled) {
      console.log(
        `[TaskScheduler] Execution aborted: Task ID ${taskId} is currently disabled.`,
      );
      this.removeSchedule(taskId);
      return;
    }

    const source = task.source;
    if (!source) {
      console.log(
        `[TaskScheduler] Execution aborted: Task ID ${taskId} is missing its source.`,
      );
      return;
    }

    // Wait for any existing scrape on this source to finish
    let activeStatus = scraperManager.getStatus(task.sourceId);
    if (activeStatus && activeStatus.status === "running") {
      console.log(
        `[TaskScheduler] Source ID ${task.sourceId} is already scraping. Awaiting completion...`,
      );
      while (activeStatus && activeStatus.status === "running") {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        activeStatus = scraperManager.getStatus(task.sourceId);
      }
      console.log(
        `[TaskScheduler] Existing scrape for source ID ${task.sourceId} finished. Continuing task execution.`,
      );
    }

    // Update database last run time immediately as we start
    await db
      .update(scrapingTasks)
      .set({ lastRunAt: new Date() })
      .where(eq(scrapingTasks.id, taskId));

    const tool = "gallery-dl"; // default tool

    // Trigger scrape in ScraperManager
    await scraperManager.startScrape(
      task.sourceId,
      tool,
      source.url,
      paths.downloads,
      {
        mode,
        taskId: task.id,
        limits: task.downloadOptions || undefined,
      },
    );

    // Await completion of the scraper run
    while (true) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      const status = scraperManager.getStatus(task.sourceId);
      if (!status || status.status !== "running") {
        break;
      }
    }

    console.log(`[TaskScheduler] Task ID ${taskId} has completed scraping.`);
  }

  /**
   * Helper to write nextRunAt to database.
   */
  private async updateNextRunAt(taskId: number, nextRun: Date | null) {
    try {
      await db
        .update(scrapingTasks)
        .set({ nextRunAt: nextRun })
        .where(eq(scrapingTasks.id, taskId));
    } catch (err) {
      console.error(
        `[TaskScheduler] Failed to update nextRunAt in database for task ${taskId}:`,
        err,
      );
    }
  }
}

// GlobalThis singleton pattern to persist TaskScheduler across fast refreshes in development
const globalForScheduler = globalThis as unknown as {
  taskScheduler: TaskScheduler | undefined;
};

export const taskScheduler =
  globalForScheduler.taskScheduler ?? TaskScheduler.getInstance();

if (process.env.NODE_ENV !== "production") {
  globalForScheduler.taskScheduler = taskScheduler;
}
