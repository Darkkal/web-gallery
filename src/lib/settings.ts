import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { paths } from "@/lib/config";
import { db } from "@/lib/db";
import { scrapeHistory } from "@/lib/db/schema";
import {
  type AppSettings,
  DEFAULT_SETTINGS,
  type SystemSettings,
} from "@/types/settings";

const SETTINGS_FILE_PATH = path.join(paths.dataDir, "settings.json");

/**
 * Ensures the config directories exist and returns settings.json.
 * If settings.json doesn't exist, tries to pre-populate scraper settings
 * from gallery-dl.conf before falling back to DEFAULT_SETTINGS.
 */
export async function getSettings(): Promise<SystemSettings> {
  try {
    if (existsSync(SETTINGS_FILE_PATH)) {
      const data = await fs.readFile(SETTINGS_FILE_PATH, "utf-8");
      const parsed = JSON.parse(data) as SystemSettings;

      // Perform a shallow merge of settings groups to support schema evolution
      const merged: SystemSettings = {
        app: { ...DEFAULT_SETTINGS.app, ...parsed.app },
        scraper: { ...DEFAULT_SETTINGS.scraper, ...parsed.scraper },
      };
      return merged;
    }
  } catch (error) {
    console.error("[Settings] Failed to read settings.json:", error);
  }

  // Pre-populate scraper settings from existing gallery-dl.conf if it exists
  const settings: SystemSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  const configPath = paths.galleryDl.config;

  if (existsSync(configPath)) {
    try {
      const configData = await fs.readFile(configPath, "utf-8");
      const configJson = JSON.parse(configData) as Record<
        string,
        Record<string, unknown>
      >;

      if (configJson.downloader) {
        const downloader = configJson.downloader;
        if (downloader["rate-limit"] !== undefined) {
          settings.scraper.rateLimit =
            (downloader["rate-limit"] as string) || "No Limit";
        }
        if (downloader.retries !== undefined) {
          settings.scraper.retries = Number(downloader.retries);
        }
        if (downloader.proxy !== undefined) {
          settings.scraper.proxy = downloader.proxy as string;
        }
      }

      if (configJson.extractor) {
        const extractor = configJson.extractor;
        if (Array.isArray(extractor.cookies)) {
          settings.scraper.cookiesSource =
            (extractor.cookies[0] as
              | "firefox"
              | "chrome"
              | "edge"
              | "safari"
              | "opera"
              | "vivaldi"
              | "none") || "none";
        }
        if (Array.isArray(extractor.sleep)) {
          settings.scraper.sleepMin = Number(extractor.sleep[0] ?? 5);
          settings.scraper.sleepMax = Number(extractor.sleep[1] ?? 10);
        }
        if (Array.isArray(extractor["sleep-request"])) {
          settings.scraper.sleepRequestMin = Number(
            extractor["sleep-request"][0] ?? 5,
          );
          settings.scraper.sleepRequestMax = Number(
            extractor["sleep-request"][1] ?? 10,
          );
        }
      }
    } catch (e) {
      console.warn(
        "[Settings] Failed to pre-populate settings from gallery-dl.conf:",
        e,
      );
    }
  }

  // Save the resolved settings so it exists next time
  await saveSettings(settings);
  return settings;
}

/**
 * Helper to fetch only the AppSettings
 */
export async function getAppSettings(): Promise<AppSettings> {
  const settings = await getSettings();
  return settings.app;
}

/**
 * Saves both app and scraper settings to settings.json,
 * and updates gallery-dl.conf dynamically.
 */
export async function saveSettings(settings: SystemSettings): Promise<void> {
  // Ensure DATA_DIR and scraper directories exist
  const dirs = [paths.dataDir, paths.galleryDl.root];
  for (const dir of dirs) {
    if (!existsSync(dir)) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  // 1. Save to settings.json
  await fs.writeFile(
    SETTINGS_FILE_PATH,
    JSON.stringify(settings, null, 4),
    "utf-8",
  );

  // 2. Update gallery-dl.conf
  const configPath = paths.galleryDl.config;
  const defaultConfigPath = path.join(process.cwd(), "gallery-dl-default.conf");
  let resolvedDefaultConfigPath = defaultConfigPath;
  if (!existsSync(defaultConfigPath)) {
    const pathsToTry = [
      path.join(__dirname, "..", "..", "..", "gallery-dl-default.conf"),
      path.join(__dirname, "..", "..", "..", "..", "gallery-dl-default.conf"),
      path.join(
        __dirname,
        "..",
        "..",
        "..",
        "..",
        "..",
        "gallery-dl-default.conf",
      ),
      "/snapshot/web-gallery/gallery-dl-default.conf",
      "/snapshot/web-gallery/.next/standalone/gallery-dl-default.conf",
    ];
    for (const p of pathsToTry) {
      if (existsSync(p)) {
        resolvedDefaultConfigPath = p;
        break;
      }
    }
  }

  let configJson: Record<string, unknown> = {};

  if (existsSync(configPath)) {
    try {
      configJson = JSON.parse(await fs.readFile(configPath, "utf-8")) as Record<
        string,
        unknown
      >;
    } catch (e) {
      console.error(
        "[Settings] Could not parse gallery-dl.conf, resetting to default:",
        e,
      );
    }
  }

  // If config is empty, read from default template first
  if (
    Object.keys(configJson).length === 0 &&
    existsSync(resolvedDefaultConfigPath)
  ) {
    try {
      configJson = JSON.parse(
        await fs.readFile(resolvedDefaultConfigPath, "utf-8"),
      ) as Record<string, unknown>;
    } catch (e) {
      console.error("[Settings] Could not parse default template config:", e);
    }
  }

  // Merge scraper settings into configJson in a type-safe way
  const downloader = (configJson.downloader || {}) as Record<string, unknown>;
  configJson.downloader = downloader;
  downloader["rate-limit"] =
    settings.scraper.rateLimit === "No Limit" ? "" : settings.scraper.rateLimit;
  downloader.retries = settings.scraper.retries;
  downloader.proxy = settings.scraper.proxy;

  const extractor = (configJson.extractor || {}) as Record<string, unknown>;
  configJson.extractor = extractor;
  extractor.cookies =
    settings.scraper.cookiesSource === "none"
      ? []
      : [settings.scraper.cookiesSource];
  extractor.sleep = [settings.scraper.sleepMin, settings.scraper.sleepMax];
  extractor["sleep-request"] = [
    settings.scraper.sleepRequestMin,
    settings.scraper.sleepRequestMax,
  ];

  // Write updated gallery-dl.conf
  await fs.writeFile(configPath, JSON.stringify(configJson, null, 4), "utf-8");
}

/**
 * Cleans up old scrape logs based on retention settings.
 * Deletes physical log files and clears logPath in db.
 */
export async function cleanupOldScrapeLogs(): Promise<void> {
  try {
    const settings = await getSettings();
    const retentionDays = settings.app.scrapeLogRetentionDays;

    // 0 means keep forever
    if (retentionDays <= 0) return;

    const logDir = paths.galleryDl.logs;
    if (!existsSync(logDir)) return;

    const files = await fs.readdir(logDir);
    const now = Date.now();
    const retentionMs = retentionDays * 24 * 60 * 60 * 1000;
    const cutoffTime = now - retentionMs;

    let deletedCount = 0;

    for (const file of files) {
      if (file.startsWith("scrape_") && file.endsWith(".log")) {
        const filePath = path.join(logDir, file);
        const stat = await fs.stat(filePath);

        if (stat.mtimeMs < cutoffTime) {
          // Parse out the history ID
          const match = file.match(/^scrape_(\d+)\.log$/);
          if (match) {
            const historyId = parseInt(match[1], 10);

            // Delete log file
            await fs.unlink(filePath);
            deletedCount++;

            // Clear log path in database
            await db
              .update(scrapeHistory)
              .set({ logPath: null })
              .where(eq(scrapeHistory.id, historyId));
          }
        }
      }
    }

    if (deletedCount > 0) {
      console.log(
        `[Settings] Log retention policy cleaned up ${deletedCount} logs older than ${retentionDays} days.`,
      );
    }
  } catch (error) {
    console.error("[Settings] Log cleanup error:", error);
  }
}
