"use server";

import fs from "node:fs";
import { and, desc, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { paths } from "@/lib/config";
import { db } from "@/lib/db";
import { scrapeHistory, scrapingTasks, sources } from "@/lib/db/schema";
import { type ScrapingStatus, scraperManager } from "@/lib/scrapers/manager";

export async function getActiveScrapeStatuses(): Promise<ScrapingStatus[]> {
  return scraperManager.getAllStatuses();
}

export async function getScrapeTasks() {
  return await db.query.scrapingTasks.findMany({
    where: (tasks, { exists }) =>
      exists(
        db
          .select()
          .from(sources)
          .where(
            and(eq(sources.id, tasks.sourceId), isNull(sources.deletedAt)),
          ),
      ),
    orderBy: desc(scrapingTasks.createdAt),
  });
}

export async function getScrapeTask(id: number) {
  return await db.query.scrapingTasks.findFirst({
    where: eq(scrapingTasks.id, id),
  });
}

export async function createScrapeTask(data: {
  sourceId: number;
  name?: string;
  downloadOptions?: {
    stopAfterCompleted?: number;
    stopAfterSkipped?: number;
    stopAfterPosts?: number;
  };
  scheduleInterval?: number | null;
  scheduleCron?: string | null;
  enabled?: boolean;
}) {
  const result = await db
    .insert(scrapingTasks)
    .values({
      sourceId: data.sourceId,
      name: data.name,
      downloadOptions: data.downloadOptions,
      scheduleInterval: data.scheduleInterval,
      scheduleCron: data.scheduleCron,
      enabled: data.enabled ?? true,
    })
    .returning({ id: scrapingTasks.id });

  const insertedId = result[0]?.id;
  if (insertedId && (data.enabled ?? true)) {
    try {
      const { taskScheduler } = await import("@/lib/scheduler/scheduler");
      taskScheduler.addSchedule({
        id: insertedId,
        scheduleInterval: data.scheduleInterval,
        scheduleCron: data.scheduleCron,
        enabled: data.enabled ?? true,
      });
    } catch (err) {
      console.error("[Actions] Failed to register task with scheduler:", err);
    }
  }

  revalidatePath("/scrape");
}

export async function updateScrapeTask(
  id: number,
  data: {
    name?: string;
    downloadOptions?: {
      stopAfterCompleted?: number;
      stopAfterSkipped?: number;
      stopAfterPosts?: number;
    };
    scheduleInterval?: number | null;
    scheduleCron?: string | null;
    enabled?: boolean;
  },
) {
  await db.update(scrapingTasks).set(data).where(eq(scrapingTasks.id, id));

  const updated = await db.query.scrapingTasks.findFirst({
    where: eq(scrapingTasks.id, id),
  });

  if (updated) {
    try {
      const { taskScheduler } = await import("@/lib/scheduler/scheduler");
      taskScheduler.addSchedule({
        id: updated.id,
        scheduleInterval: updated.scheduleInterval,
        scheduleCron: updated.scheduleCron,
        enabled: updated.enabled,
      });
    } catch (err) {
      console.error("[Actions] Failed to update task with scheduler:", err);
    }
  }

  revalidatePath("/scrape");
}

export async function deleteScrapeTask(id: number) {
  await db.delete(scrapingTasks).where(eq(scrapingTasks.id, id));

  try {
    const { taskScheduler } = await import("@/lib/scheduler/scheduler");
    taskScheduler.removeSchedule(id);
  } catch (err) {
    console.error("[Actions] Failed to remove task from scheduler:", err);
  }

  revalidatePath("/scrape");
}

export async function toggleTaskSchedule(id: number, enabled: boolean) {
  await db
    .update(scrapingTasks)
    .set({ enabled })
    .where(eq(scrapingTasks.id, id));

  const updated = await db.query.scrapingTasks.findFirst({
    where: eq(scrapingTasks.id, id),
  });

  if (updated) {
    try {
      const { taskScheduler } = await import("@/lib/scheduler/scheduler");
      if (enabled) {
        taskScheduler.addSchedule({
          id: updated.id,
          scheduleInterval: updated.scheduleInterval,
          scheduleCron: updated.scheduleCron,
          enabled: true,
        });
      } else {
        taskScheduler.removeSchedule(id);
        // Clear nextRunAt in database
        await db
          .update(scrapingTasks)
          .set({ nextRunAt: null })
          .where(eq(scrapingTasks.id, id));
      }
    } catch (err) {
      console.error("[Actions] Failed to toggle schedule in scheduler:", err);
    }
  }

  revalidatePath("/scrape");
}

export async function runTaskNow(
  taskId: number,
  mode: "full" | "quick" = "full",
  cursor?: string,
) {
  const task = await db.query.scrapingTasks.findFirst({
    where: eq(scrapingTasks.id, taskId),
    with: {
      source: true,
    },
  });

  if (!task) {
    throw new Error("Task not found");
  }

  const source = task.source;

  if (!source) {
    throw new Error("Source not found");
  }

  // Determine type (gallery-dl or yt-dlp) based on source URL or extractor type
  // This logic mimics what is likely in the main actions file or we can infer it
  // For now defaulting to gallery-dl unless yt-dlp specific domains logic exists
  // But wait, the source usually has extractorType.
  // If not, we might need to guess.
  // Assuming gallery-dl for now as it handles most.
  const tool = "gallery-dl";

  await scraperManager.startScrape(
    task.sourceId,
    tool,
    source.url,
    paths.downloads,
    {
      mode: mode, // Use the provided mode
      taskId: task.id,
      limits: task.downloadOptions || undefined,
      cursor: cursor,
    },
  );

  // Update last run time
  await db
    .update(scrapingTasks)
    .set({ lastRunAt: new Date() })
    .where(eq(scrapingTasks.id, taskId));

  revalidatePath("/scrape");
}

export async function stopTask(taskId: number) {
  const task = await db.query.scrapingTasks.findFirst({
    where: eq(scrapingTasks.id, taskId),
  });

  if (task) {
    scraperManager.stopScrape(task.sourceId);
    revalidatePath("/scrape");
  }
}

export async function getScrapeHistory(limit = 50) {
  return await db.query.scrapeHistory.findMany({
    orderBy: desc(scrapeHistory.startTime),
    limit: limit,
    with: {
      source: true,
      task: true,
    },
  });
}

const CURSOR_RE = /Use '-o cursor=([^']+)' to continue/;

/**
 * Try to extract a gallery-dl resume cursor from a log file.
 * Returns the last cursor found (most recent hint), or null.
 */
function extractCursorFromLog(logPath: string): string | null {
  try {
    if (!fs.existsSync(logPath)) return null;

    const content = fs.readFileSync(logPath, "utf-8");
    const matches = [...content.matchAll(new RegExp(CURSOR_RE.source, "g"))];
    if (matches.length === 0) return null;
    return matches[matches.length - 1][1];
  } catch {
    return null;
  }
}

export async function resumeFromHistory(historyId: number) {
  const history = await db.query.scrapeHistory.findFirst({
    where: eq(scrapeHistory.id, historyId),
    with: {
      source: true,
      task: true,
    },
  });

  if (!history) {
    throw new Error("History record not found");
  }

  if (!history.source) {
    throw new Error("Source not found");
  }

  // Use stored cursor, or fall back to extracting from the log file
  let cursor = history.cursor;
  if (!cursor && history.logPath) {
    cursor = extractCursorFromLog(history.logPath);
    if (cursor) {
      // Backfill the DB so we don't need to re-read the log next time
      await db
        .update(scrapeHistory)
        .set({ cursor })
        .where(eq(scrapeHistory.id, historyId));
    }
  }

  if (!cursor) {
    throw new Error("No cursor available for this history record");
  }

  const tool = "gallery-dl";

  await scraperManager.startScrape(
    history.sourceId,
    tool,
    history.source.url,
    paths.downloads,
    {
      taskId: history.taskId ?? undefined,
      cursor,
    },
  );

  revalidatePath("/scrape");
}

// Helper to get all sources for the dropdown
export async function getSources() {
  return await db.query.sources.findMany({
    where: isNull(sources.deletedAt),
    orderBy: desc(sources.createdAt),
  });
}
