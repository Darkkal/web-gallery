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

import { getScrapeLog } from "@/app/scrape/actions";
import { scrapeHistory } from "@/lib/db/schema";

describe("Scrape Server Actions - getScrapeLog", () => {
  beforeAll(async () => {
    await testDbHelper.runMigrations();
  });

  beforeEach(async () => {
    await testDbHelper.clearDb();
  });

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
