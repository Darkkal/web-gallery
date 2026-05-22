import fs, { promises as fsPromises } from "node:fs";
import path from "node:path";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { paths } from "@/lib/config";
import { db } from "@/lib/db";
import {
  gallerydlExtractorTypes,
  mediaItems,
  pixivUsers,
  // New Tables
  posts,
  scanHistory,
  scraperDownloadLogs,
  tags,
  twitterUsers,
} from "@/lib/db/schema";
import { MetadataProcessorFactory } from "@/lib/library/processors/factory";
import type {
  ProcessorContext,
  ProcessTask,
  TagCache,
  UserCache,
} from "@/lib/library/types";

const DOWNLOAD_DIR = paths.downloads;
// Global control flags for this module process
let isScanning = false;
let stopRequested = false;

export function isScanRunning(): boolean {
  return isScanning;
}

/**
 * Clean up stale "running" scan records left from a previous crash/restart.
 * Uses the DB as source of truth — called at app startup via instrumentation.ts.
 */
export async function cleanupStaleScans() {
  const scans = await db
    .select()
    .from(scanHistory)
    .where(eq(scanHistory.status, "running"));

  for (const scan of scans) {
    console.log(
      `[Scanner] Cleaning up stale scan record #${scan.id} (started ${scan.startTime})`,
    );
    await db
      .update(scanHistory)
      .set({
        status: "stopped",
        endTime: new Date(),
        lastError: "Scan was interrupted (server restart or crash)",
      })
      .where(eq(scanHistory.id, scan.id));
  }
}

export async function stopScanning(): Promise<boolean> {
  if (isScanning) {
    console.log("Stopping scan requested...");
    stopRequested = true;
    return true;
  }

  // If no scan is running in-memory but DB has a stale "running" record, clean it up
  console.log(
    "No scan running in-memory. Checking for stale running records...",
  );
  const scans = await db
    .select()
    .from(scanHistory)
    .orderBy(desc(scanHistory.startTime))
    .limit(1);
  const latest = scans[0];
  if (latest && latest.status === "running") {
    console.log(
      `Cleaning up stale scan record #${latest.id} (started ${latest.startTime})`,
    );
    await db
      .update(scanHistory)
      .set({
        status: "stopped",
        endTime: new Date(),
        lastError: "Scan was interrupted (server restart or crash)",
      })
      .where(eq(scanHistory.id, latest.id));
    return true;
  }

  return false;
}

function getAllFiles(dirPath: string): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dirPath)) return results;
  const list = fs.readdirSync(dirPath);
  list.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    try {
      const stat = fs.statSync(fullPath);
      if (stat?.isDirectory()) results = results.concat(getAllFiles(fullPath));
      else results.push(fullPath);
    } catch {}
  });
  return results;
}

export async function syncLibrary() {
  if (isScanning) {
    console.warn("Scan already running.");
    return;
  }

  console.log("Starting library sync...");
  isScanning = true;
  stopRequested = false;

  const start = Date.now();

  // Create Scan History Record
  const scanRecord = await db
    .insert(scanHistory)
    .values({
      startTime: new Date(),
      status: "running",
      filesProcessed: 0,
      filesAdded: 0,
      filesUpdated: 0,
      filesDeleted: 0,
      errors: 0,
    })
    .returning({ id: scanHistory.id });
  const scanId = scanRecord[0].id;

  const stats = {
    processed: 0,
    added: 0,
    updated: 0,
    deleted: 0,
    errors: 0,
  };

  try {
    // Enable WAL mode for much better write throughput during bulk operations
    await db.run(sql`PRAGMA journal_mode=WAL`);

    const legacyFiles = getAllFiles(DOWNLOAD_DIR);

    console.log(`Found ${legacyFiles.length} files in downloads.`);

    // Map<DirPath, Group>
    const dirGroups = new Map<
      string,
      {
        jsonFiles: string[];
        mediaFiles: string[];
        sourceId: number | null;
        sourceRoot: string; // To calculate relative path
      }
    >();

    // Process Download Files
    // publicRoot is the parent of "downloads" — used to compute URL-relative paths.
    // Dev:  files at ./public/downloads/... → publicRoot = ./public → URL = /downloads/...
    // Docker: files at /media/downloads/... → publicRoot = /media → URL = /downloads/...
    const publicRoot = path.dirname(paths.downloads);
    legacyFiles.forEach((absPath) => {
      const ext = path.extname(absPath).toLowerCase();
      const dir = path.dirname(absPath);
      if (!dirGroups.has(dir))
        dirGroups.set(dir, {
          jsonFiles: [],
          mediaFiles: [],
          sourceId: null,
          sourceRoot: publicRoot,
        });
      const group = dirGroups.get(dir);
      if (!group) return; // Should not happen given the check above

      if (ext === ".json") group.jsonFiles.push(absPath);
      else if (
        [
          ".mp4",
          ".webm",
          ".mkv",
          ".mp3",
          ".wav",
          ".m4a",
          ".jpg",
          ".jpeg",
          ".png",
          ".gif",
          ".webp",
        ].includes(ext)
      )
        group.mediaFiles.push(absPath);
    });

    console.log("Loading existing DB records...");
    const existingMediaPaths = new Set<string>();
    const dbItems = await db
      .select({ id: mediaItems.id, filePath: mediaItems.filePath })
      .from(mediaItems);
    dbItems.forEach((i) => {
      existingMediaPaths.add(i.filePath);
    });

    const existingTwitterUsers = new Set<string>();
    (await db.select({ id: twitterUsers.id }).from(twitterUsers)).forEach(
      (u) => {
        existingTwitterUsers.add(u.id);
      },
    );

    const existingPixivUsers = new Set<string>();
    (await db.select({ id: pixivUsers.id }).from(pixivUsers)).forEach((u) => {
      existingPixivUsers.add(u.id);
    });

    const existingTags = new Map<string, number>();
    (await db.select({ id: tags.id, name: tags.name }).from(tags)).forEach(
      (t) => {
        existingTags.set(t.name, t.id);
      },
    );

    // Cache existing posts to avoid constant duplicate inserts
    // Map key format: "extractor:jsonId" -> postId
    const existingPosts = new Map<string, number>();
    (
      await db
        .select({
          id: posts.id,
          extractor: posts.extractorType,
          jsonId: posts.jsonSourceId,
        })
        .from(posts)
    ).forEach((p) => {
      if (p.jsonId) {
        existingPosts.set(`${p.extractor}:${p.jsonId}`, p.id);
      }
    });

    // Pre-load all source ID lookups into memory.
    // This avoids a per-item SELECT on scraperDownloadLogs during processing.
    console.log("Loading source mappings...");
    const sourceMap = new Map<string, number>();
    const allDownloadLogs = await db
      .select({
        sourceId: scraperDownloadLogs.sourceId,
        filePath: scraperDownloadLogs.filePath,
      })
      .from(scraperDownloadLogs);
    for (const row of allDownloadLogs) {
      sourceMap.set(row.filePath, row.sourceId);
    }
    console.log(`Loaded ${sourceMap.size} source mappings.`);

    // Ensure Extractors
    await db
      .insert(gallerydlExtractorTypes)
      .values([
        { id: "twitter", description: "Twitter/X" },
        { id: "pixiv", description: "Pixiv" },
        { id: "gelbooruv02", description: "Gelbooru/Safebooru" },
        { id: "gallery-dl", description: "Generic gallery-dl" },
      ])
      .onConflictDoNothing();

    const processedPaths = new Set<string>();
    const tasks: ProcessTask[] = [];

    for (const [, group] of dirGroups) {
      const mediaToJson = new Map<string, string>();
      const usedJsons = new Set<string>();

      for (const mediaPath of group.mediaFiles) {
        const mediaName = path.basename(mediaPath, path.extname(mediaPath));
        let bestMatchJson: string | null = null;
        let bestMatchLen = 0;

        for (const jsonPath of group.jsonFiles) {
          const jsonName = path.basename(jsonPath, ".json");

          // 1. Exact match or prefix match (Twitter/Pixiv)
          if (
            mediaName === jsonName ||
            (mediaName.startsWith(jsonName) &&
              ["-", "_", "."].includes(mediaName[jsonName.length]))
          ) {
            if (jsonName.length > bestMatchLen) {
              bestMatchLen = jsonName.length;
              bestMatchJson = jsonPath;
            }
          }
          // 2. Contains match (Safebooru: category_id_hash)
          else if (
            mediaName.includes(`_${jsonName}_`) ||
            mediaName.includes(`-${jsonName}-`) ||
            mediaName.endsWith(`_${jsonName}`) ||
            mediaName.startsWith(`${jsonName}_`)
          ) {
            if (jsonName.length > bestMatchLen) {
              bestMatchLen = jsonName.length;
              bestMatchJson = jsonPath;
            }
          }
        }
        if (bestMatchJson) {
          mediaToJson.set(mediaPath, bestMatchJson);
          usedJsons.add(bestMatchJson);
        }
      }

      for (const mediaPath of group.mediaFiles) {
        let urlPath: string;
        if (group.sourceId) {
          const relativePath = path
            .relative(group.sourceRoot, mediaPath)
            .split(path.sep)
            .join("/");
          urlPath = `/api/media/${group.sourceId}/${relativePath}`;
        } else {
          const relativePath = path
            .relative(group.sourceRoot, mediaPath)
            .split(path.sep)
            .join("/");
          urlPath = `/${relativePath}`;
        }

        processedPaths.add(urlPath);
        tasks.push({
          fsPath: mediaPath,
          dbFilePath: urlPath,
          jsonPath: mediaToJson.get(mediaPath),
          defaultType: "image",
          sourceId: group.sourceId,
        });
      }

      // Process unused JSONs (Text-only posts)
      for (const jsonPath of group.jsonFiles) {
        if (!usedJsons.has(jsonPath)) {
          let urlPath: string;
          if (group.sourceId) {
            const relativePath = path
              .relative(group.sourceRoot, jsonPath)
              .split(path.sep)
              .join("/");
            urlPath = `/api/media/${group.sourceId}/${relativePath}`;
          } else {
            const relativePath = path
              .relative(group.sourceRoot, jsonPath)
              .split(path.sep)
              .join("/");
            urlPath = `/${relativePath}`;
          }

          tasks.push({
            fsPath: jsonPath,
            dbFilePath: urlPath,
            jsonPath: jsonPath,
            defaultType: "text",
            sourceId: group.sourceId,
          });
        }
      }
    }

    console.log(`Processing ${tasks.length} items in batches...`);

    // libsql leaks ~0.85MB of native (non-heap) memory per db.transaction() call.
    // Using batched transactions keeps the total count manageable:
    //   6000 items / 100 per batch = 60 transactions × 0.85MB ≈ 51MB native overhead
    //   vs. 6000 individual transactions × 0.85MB ≈ 5.1GB → OOM
    const BATCH_SIZE = 100;
    const DB_UPDATE_INTERVAL = 500;

    for (
      let batchStart = 0;
      batchStart < tasks.length;
      batchStart += BATCH_SIZE
    ) {
      if (stopRequested) {
        console.log("Scan stopped by user.");
        break;
      }

      const chunk = tasks.slice(batchStart, batchStart + BATCH_SIZE);

      // Prepare items sequentially (no memory spikes from concurrent reads)
      const prepared: PrepareResult[] = [];
      for (const task of chunk) {
        prepared.push(await prepareTask(task));
      }

      const userAvatars = new Map<string, string>();
      for (const p of prepared) {
        collectAvatarUrl(p.meta, userAvatars);
      }

      try {
        await db.transaction(async (tx) => {
          for (const p of prepared) {
            await processItem(
              p,
              existingMediaPaths,
              existingTwitterUsers,
              existingPixivUsers,
              existingTags,
              existingPosts,
              userAvatars,
              sourceMap,
              tx,
            );
          }
        });

        // Count results for successfully committed batch
        for (const p of prepared) {
          if (p.mediaType !== "text") {
            if (existingMediaPaths.has(p.task.dbFilePath)) {
              stats.updated++;
            } else {
              stats.added++;
            }
          }
        }
      } catch (batchErr) {
        // Entire batch failed — log and count as errors
        stats.errors += chunk.length;
        const msg =
          batchErr instanceof Error ? batchErr.message : String(batchErr);
        console.error(`[Scanner] Batch failed at item ${batchStart}: ${msg}`);
      }

      stats.processed += chunk.length;

      // Periodic DB update + progress log with memory stats
      if (
        stats.processed % DB_UPDATE_INTERVAL === 0 ||
        batchStart + BATCH_SIZE >= tasks.length
      ) {
        const mem = process.memoryUsage();
        console.log(
          `Processed ${stats.processed} / ${tasks.length} | RSS: ${Math.round(mem.rss / 1024 / 1024)}MB | Heap: ${Math.round(mem.heapUsed / 1024 / 1024)}/${Math.round(mem.heapTotal / 1024 / 1024)}MB`,
        );
        await db
          .update(scanHistory)
          .set({
            filesProcessed: stats.processed,
            filesAdded: stats.added,
            filesUpdated: stats.updated,
            filesDeleted: stats.deleted,
            errors: stats.errors,
          })
          .where(eq(scanHistory.id, scanId));
      }
    }

    if (!stopRequested) {
      console.log("Cleaning up removed items...");
      const pathsToDelete: string[] = [];
      for (const p of existingMediaPaths) {
        if (!processedPaths.has(p)) {
          const cleanRelPath = p.replace(/^\//, "").split("/").join(path.sep);
          const absPath = path.join(publicRoot, cleanRelPath);
          if (!fs.existsSync(absPath)) {
            pathsToDelete.push(p);
          } else {
            console.log(
              `[Scanner] Keeping ${p} because it still exists on disk (likely skipped in directory listing)`,
            );
          }
        }
      }

      if (pathsToDelete.length > 0) {
        console.log(`Deleting ${pathsToDelete.length} missing items...`);
        stats.deleted = pathsToDelete.length;
        for (let i = 0; i < pathsToDelete.length; i += BATCH_SIZE) {
          const batch = pathsToDelete.slice(i, i + BATCH_SIZE);
          await db
            .delete(mediaItems)
            .where(inArray(mediaItems.filePath, batch));
        }
      }
    }

    const finalStatus = stopRequested ? "stopped" : "completed";

    await db
      .update(scanHistory)
      .set({
        status: finalStatus as "completed" | "stopped",
        endTime: new Date(),
        filesProcessed: stats.processed,
        filesAdded: stats.added,
        filesUpdated: stats.updated,
        filesDeleted: stats.deleted,
        errors: stats.errors,
      })
      .where(eq(scanHistory.id, scanId));

    console.log(`Sync ${finalStatus} in ${(Date.now() - start) / 1000}s`);
  } catch (e: unknown) {
    console.error("Scan failed with error:", e);
    await db
      .update(scanHistory)
      .set({
        status: "failed",
        endTime: new Date(),
        filesProcessed: stats.processed,
        filesAdded: stats.added,
        filesUpdated: stats.updated,
        filesDeleted: stats.deleted,
        errors: stats.errors + 1,
        lastError: e instanceof Error ? e.message : String(e),
      })
      .where(eq(scanHistory.id, scanId));
  } finally {
    isScanning = false;
    stopRequested = false;
  }
}

interface PlatformMetadata {
  category?: string;
  extractor?: string;
  tweet_id?: string;
  user_id?: string;
  uploader_id?: string;
  user?: {
    id?: string | number;
    profile_image?: string;
    profile_image_url_https?: string;
    profile_image_urls?: {
      medium?: string;
      px_1600x1600?: string;
      px_170x170?: string;
    };
  };
  author?: {
    id?: string | number;
    profile_image?: string;
  };
  create_date?: string;
  created_at?: string;
  date?: string;
  [key: string]: unknown;
}

interface PrepareResult {
  task: ProcessTask;
  meta: PlatformMetadata | null;
  stat: fs.Stats | null;
  mediaType: "image" | "video" | "audio" | "text";
}

async function prepareTask(task: ProcessTask): Promise<PrepareResult> {
  let meta = null;
  let stat = null;

  if (task.jsonPath) {
    try {
      const raw = await fsPromises.readFile(task.jsonPath, "utf-8");
      // Fix for large integers (e.g. Twitter Snowflakes) that exceed Number.MAX_SAFE_INTEGER
      // We wrap numbers with 16 or more digits in quotes so JSON.parse treats them as strings.
      const fixedRaw = raw.replace(/([:[,]\s*)([0-9]{16,})/g, '$1"$2"');
      meta = JSON.parse(fixedRaw);
    } catch {}
  }

  try {
    stat = await fsPromises.stat(task.fsPath);
  } catch {}

  let type = task.defaultType;
  if (type !== "text") {
    const ext = path.extname(task.fsPath).toLowerCase();
    if ([".mp4", ".webm", ".mkv"].includes(ext)) type = "video";
    if ([".mp3", ".wav", ".m4a"].includes(ext)) type = "audio";
  }

  return { task, meta, stat, mediaType: type };
}

/**
 * Extract avatar URL from metadata for pre-processing.
 */
function collectAvatarUrl(
  meta: PlatformMetadata | null,
  userAvatars: Map<string, string>,
) {
  if (!meta) return;

  // Twitter
  if (
    meta.category === "twitter" ||
    meta.extractor === "twitter" ||
    meta.tweet_id
  ) {
    // biome-ignore lint/suspicious/noExplicitAny: Metadata is highly dynamic across platforms
    const userObj = (meta.user || meta.author || {}) as any;
    const userId = userObj.id || meta.user_id || meta.uploader_id;
    const avatarUrl = userObj.profile_image || userObj.profile_image_url_https;
    if (userId && avatarUrl) {
      userAvatars.set(String(userId), avatarUrl);
    }
  }

  // Pixiv
  if (meta.category === "pixiv" || meta.extractor === "pixiv") {
    const userId = meta.user?.id;
    const avatarUrl =
      meta.user?.profile_image_urls?.medium ||
      meta.user?.profile_image_urls?.px_1600x1600 ||
      meta.user?.profile_image_urls?.px_170x170;
    if (userId && avatarUrl) {
      userAvatars.set(String(userId), avatarUrl);
    }
  }
}

/**
 * Process a single prepared item inside a transaction.
 * Individual errors are caught by the caller so the batch can continue.
 */
async function processItem(
  prepared: PrepareResult,
  existingMediaPaths: Set<string>,
  existingTwitterUsers: UserCache,
  existingPixivUsers: UserCache,
  existingTags: TagCache,
  existingPosts: Map<string, number>,
  userAvatars: Map<string, string>,
  sourceMap: Map<string, number>,
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
) {
  const { task, meta, stat, mediaType } = prepared;
  let postId: number | null = null;
  let extractorType: string | null = null;

  // Lookup Internal Source ID from pre-loaded map
  let internalSourceId: number | null = task.sourceId;

  if (!internalSourceId) {
    const cleanRelPath = task.dbFilePath
      .replace(/^\//, "")
      .split("/")
      .join(path.sep);
    const absLookupPath = path.join(process.cwd(), "public", cleanRelPath);
    internalSourceId = sourceMap.get(absLookupPath) ?? null;
  }

  // 2. Process Post Metadata (Users & Posts)
  if (meta) {
    // Determine Extractor Type
    if (
      meta.category === "twitter" ||
      meta.extractor === "twitter" ||
      meta.tweet_id
    )
      extractorType = "twitter";
    else if (meta.category === "pixiv" || meta.extractor === "pixiv")
      extractorType = "pixiv";
    else if (
      meta.category === "gelbooru" ||
      meta.category === "safebooru" ||
      meta.extractor === "gelbooru" ||
      meta.extractor === "gelbooruv02" ||
      meta.extractor === "safebooru"
    )
      extractorType = "gelbooruv02";

    if (extractorType) {
      const processor = MetadataProcessorFactory.getProcessor(extractorType);
      if (processor) {
        const context: ProcessorContext = {
          tx,
          existingTwitterUsers,
          existingPixivUsers,
          existingTags,
          existingPosts,
          userAvatars,
          internalSourceId,
        };
        postId = await processor.process(meta, task, context);
      }
    }
  }

  // 3. Insert/Update Media Item
  let capturedAt = stat ? stat.mtime : new Date();
  if (meta) {
    if (meta.date) capturedAt = new Date(meta.date);
    else if (meta.create_date) capturedAt = new Date(meta.create_date);
    else if (meta.created_at) capturedAt = new Date(meta.created_at);
  }

  if (mediaType !== "text" && !existingMediaPaths.has(task.dbFilePath)) {
    await tx.insert(mediaItems).values({
      filePath: task.dbFilePath,
      mediaType,
      capturedAt,
      postId: postId,
    });
    existingMediaPaths.add(task.dbFilePath);
  } else if (mediaType !== "text") {
    if (postId) {
      await tx
        .update(mediaItems)
        .set({
          postId,
        })
        .where(eq(mediaItems.filePath, task.dbFilePath));
    }
  }
}
