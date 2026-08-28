import fs from "node:fs";
import path from "node:path";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { setupTestDb } from "../helpers/db";
import { seedSource } from "../helpers/seed";

const testDbHelper = setupTestDb();

let activeDb: ReturnType<typeof setupTestDb>["db"];

vi.mock("@/lib/db", () => {
  return {
    get db() {
      return activeDb;
    },
    initDb: vi.fn(),
  };
});

vi.mock("next/cache", () => {
  return {
    revalidatePath: vi.fn(),
    revalidateTag: vi.fn(),
  };
});

vi.mock("@/lib/scrapers/manager", () => {
  return {
    scraperManager: {
      startScrape: vi.fn(),
      stopScrape: vi.fn(),
      getAllStatuses: vi.fn().mockReturnValue([]),
    },
  };
});

const testDb = testDbHelper.db;
activeDb = testDb;

import { eq } from "drizzle-orm";
import {
  createScrapeTask,
  getScrapeLog,
  getScrapeTask,
  runTaskNow,
  stopTask,
  toggleTaskSchedule,
  updateScrapeTask,
} from "@/app/scrape/actions";
import { scrapeHistory, scrapingTasks } from "@/lib/db/schema";
import { scraperManager } from "@/lib/scrapers/manager";

describe("Scrape Server Actions", () => {
  beforeAll(async () => {
    await testDbHelper.runMigrations();
  });

  beforeEach(async () => {
    await testDbHelper.clearDb();
  });

  describe("getScrapeLog", () => {
    it("should return error when history record is not found", async () => {
      const res = await getScrapeLog(99999);
      expect(res.success).toBe(false);
      expect(res.error).toBe("History record not found");
    });

    it("should return error when history record has no log path", async () => {
      const source = await seedSource(testDb);
      const [inserted] = await testDb
        .insert(scrapeHistory)
        .values({
          sourceId: source.id,
          startTime: new Date(),
          status: "completed",
          logPath: null,
        })
        .returning({ id: scrapeHistory.id });

      const res = await getScrapeLog(inserted.id);
      expect(res.success).toBe(false);
      expect(res.error).toBe("No log path recorded for this run");
    });

    it("should return error when log file does not exist on disk", async () => {
      const source = await seedSource(testDb);
      const nonExistentPath = path.join("/tmp", "non_existent_scrape_9999.log");
      const [inserted] = await testDb
        .insert(scrapeHistory)
        .values({
          sourceId: source.id,
          startTime: new Date(),
          status: "failed",
          logPath: nonExistentPath,
        })
        .returning({ id: scrapeHistory.id });

      const res = await getScrapeLog(inserted.id);
      expect(res.success).toBe(false);
      expect(res.error).toBe("Log file not found or has been cleaned up");
    });

    it("should read and return log contents when file exists", async () => {
      const source = await seedSource(testDb);
      const tempLogPath = path.join(
        process.cwd(),
        "scratch",
        `test_scrape_${Date.now()}.log`,
      );
      const sampleLogContent =
        "[info] gallery-dl 1.25.0\n[info] Downloading items...\n[success] file1.png";

      // Ensure directory exists and write sample file
      fs.mkdirSync(path.dirname(tempLogPath), { recursive: true });
      fs.writeFileSync(tempLogPath, sampleLogContent, "utf-8");

      try {
        const [inserted] = await testDb
          .insert(scrapeHistory)
          .values({
            sourceId: source.id,
            startTime: new Date(),
            status: "completed",
            logPath: tempLogPath,
          })
          .returning({ id: scrapeHistory.id });

        const res = await getScrapeLog(inserted.id);
        expect(res.success).toBe(true);
        expect(res.log).toBe(sampleLogContent);
        expect(res.logPath).toBe(tempLogPath);
        expect(res.status).toBe("completed");
      } finally {
        if (fs.existsSync(tempLogPath)) {
          fs.unlinkSync(tempLogPath);
        }
      }
    });
  });

  describe("Task Schedule Editing & Persistence", () => {
    it("should create a scrape task with an interval schedule", async () => {
      const source = await seedSource(testDb);
      await createScrapeTask({
        sourceId: source.id,
        name: "Initial Task",
        scheduleInterval: 3600,
        enabled: true,
      });

      const tasks = await testDb.query.scrapingTasks.findMany({
        where: eq(scrapingTasks.sourceId, source.id),
      });

      expect(tasks).toHaveLength(1);
      expect(tasks[0].name).toBe("Initial Task");
      expect(tasks[0].scheduleInterval).toBe(3600);
      expect(tasks[0].scheduleCron).toBeNull();
      expect(tasks[0].nextRunAt).not.toBeNull();
    });

    it("should update a task schedule from interval to cron and persist changes", async () => {
      const source = await seedSource(testDb);
      const [task] = await testDb
        .insert(scrapingTasks)
        .values({
          sourceId: source.id,
          name: "Test Task",
          scheduleInterval: 3600,
          scheduleCron: null,
          enabled: true,
        })
        .returning();

      // Update from 3600s interval to Daily at 12:00 Cron
      await updateScrapeTask(task.id, {
        name: "Updated Task Name",
        scheduleInterval: null,
        scheduleCron: "0 12 */1 * *",
        enabled: true,
      });

      const updatedTask = await getScrapeTask(task.id);
      expect(updatedTask).toBeDefined();
      expect(updatedTask?.name).toBe("Updated Task Name");
      expect(updatedTask?.scheduleInterval).toBeNull();
      expect(updatedTask?.scheduleCron).toBe("0 12 */1 * *");
      expect(updatedTask?.nextRunAt).not.toBeNull();
    });

    it("should update a task schedule to manual (null schedule) and clear nextRunAt", async () => {
      const source = await seedSource(testDb);
      const [task] = await testDb
        .insert(scrapingTasks)
        .values({
          sourceId: source.id,
          name: "Cron Task",
          scheduleCron: "0 12 */1 * *",
          enabled: true,
        })
        .returning();

      await updateScrapeTask(task.id, {
        scheduleInterval: null,
        scheduleCron: null,
      });

      const updatedTask = await getScrapeTask(task.id);
      expect(updatedTask?.scheduleInterval).toBeNull();
      expect(updatedTask?.scheduleCron).toBeNull();
      expect(updatedTask?.nextRunAt).toBeNull();
    });

    it("should toggle task schedule enabled state and update nextRunAt", async () => {
      const source = await seedSource(testDb);
      const [task] = await testDb
        .insert(scrapingTasks)
        .values({
          sourceId: source.id,
          name: "Toggle Task",
          scheduleInterval: 1800,
          enabled: true,
        })
        .returning();

      // Disable schedule
      await toggleTaskSchedule(task.id, false);
      let updatedTask = await getScrapeTask(task.id);
      expect(updatedTask?.enabled).toBe(false);
      expect(updatedTask?.nextRunAt).toBeNull();

      // Enable schedule
      await toggleTaskSchedule(task.id, true);
      updatedTask = await getScrapeTask(task.id);
      expect(updatedTask?.enabled).toBe(true);
      expect(updatedTask?.nextRunAt).not.toBeNull();
    });
  });

  describe("Scrape lifecycle actions", () => {
    it("returns after launching a manual scrape instead of waiting for completion", async () => {
      const source = await seedSource(testDb);
      const [task] = await testDb
        .insert(scrapingTasks)
        .values({ sourceId: source.id, name: "Background Task" })
        .returning();

      vi.mocked(scraperManager.startScrape).mockResolvedValueOnce(undefined);

      await runTaskNow(task.id, "quick");

      expect(scraperManager.startScrape).toHaveBeenLastCalledWith(
        task.sourceId,
        "gallery-dl",
        source.url,
        expect.any(String),
        expect.objectContaining({ background: true, mode: "quick" }),
      );
    });

    it("waits for the manager to persist a stop before returning", async () => {
      const source = await seedSource(testDb);
      const [task] = await testDb
        .insert(scrapingTasks)
        .values({ sourceId: source.id, name: "Stopping Task" })
        .returning();
      let resolveStop!: (value: boolean) => void;
      const stopPromise = new Promise<boolean>((resolve) => {
        resolveStop = resolve;
      });
      vi.mocked(scraperManager.stopScrape).mockReturnValueOnce(stopPromise);

      let settled = false;
      const action = stopTask(task.id).then(() => {
        settled = true;
      });
      await Promise.resolve();
      expect(settled).toBe(false);

      resolveStop(true);
      await action;
      expect(settled).toBe(true);
    });
  });
});
