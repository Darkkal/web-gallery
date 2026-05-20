import fs, { promises as fsPromises } from "node:fs";
import path from "node:path";
import { desc, eq, inArray } from "drizzle-orm";
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

const DOWNLOAD_DIR = path.join(process.cwd(), "public", "downloads");

// Store scan control flags on globalThis so they survive Next.js hot reloads.
const globalForScanner = globalThis as unknown as {
  __scanState?: { isScanning: boolean; stopRequested: boolean };
};

if (!globalForScanner.__scanState) {
  globalForScanner.__scanState = {
    isScanning: false,
    stopRequested: false,
  };
}
const scanState = globalForScanner.__scanState;

export function isScanRunning(): boolean {
  return scanState.isScanning;
}

export async function stopScanning(): Promise<boolean> {
  if (scanState.isScanning) {
    console.log("Stopping scan requested...");
    scanState.stopRequested = true;
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
  if (scanState.isScanning) {
    console.warn("Scan already running.");
    return;
  }

  console.log("Starting library sync...");
  scanState.isScanning = true;
  scanState.stopRequested = false;

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
    const publicRoot = path.join(process.cwd(), "public");
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
    // const existingMedia = new Map<string, { id: number, capturedAt: Date | null }>();
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

    // Plan Tasks - One task per FILE, but we need to link them
    // We will process groups of files that share JSON metadata
    // Actually, we can just pair them up like before, but inside processBatch check if post exists.

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
        // Determine URL Path
        let urlPath: string;
        if (group.sourceId) {
          // Local Source: /api/media/<sourceId>/<relativePath>
          // relativePath from sourceRoot
          const relativePath = path
            .relative(group.sourceRoot, mediaPath)
            .split(path.sep)
            .join("/");
          urlPath = `/api/media/${group.sourceId}/${relativePath}`;
        } else {
          // Legacy: /downloads/...
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

      // Process unused JSONs (Text-only posts) - Do NOT add to mediaItems anymore
      // But we might want to register them as Posts still if they were not registered via group.mediaFiles
      for (const jsonPath of group.jsonFiles) {
        if (!usedJsons.has(jsonPath)) {
          // Create a task that has NO fsPath (or skip?)
          // For text-only posts, we still need a "task" to trigger processBatch to create the Post record.
          // We'll use the jsonPath as fsPath but defaultType = 'text'
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

    const BATCH_SIZE = 100; // Smaller batch size due to more DB ops
    for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
      if (scanState.stopRequested) {
        console.log("Scan stopped by user.");
        break;
      }

      const chunk = tasks.slice(i, i + BATCH_SIZE);
      const batchStats = await processBatch(
        chunk,
        existingMediaPaths,
        existingTwitterUsers,
        existingPixivUsers,
        existingTags,
        existingPosts,
      );

      stats.processed += chunk.length;
      stats.added += batchStats.added;
      stats.updated += batchStats.updated;
      stats.errors += batchStats.errors;

      if (i % 500 === 0 && i > 0) {
        console.log(`Processed ${i} / ${tasks.length}`);
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

    if (!scanState.stopRequested) {
      console.log("Cleaning up removed items...");
      const pathsToDelete: string[] = [];
      // Re-fetch all paths to be safe or use what we cached if robust
      // Since we iterated ALL files on disk, existingMediaPaths that are NOT in processedPaths are deleted.
      for (const path of existingMediaPaths) {
        if (!processedPaths.has(path)) {
          pathsToDelete.push(path);
        }
      }

      if (pathsToDelete.length > 0) {
        console.log(`Deleting ${pathsToDelete.length} missing items...`);
        stats.deleted = pathsToDelete.length;
        for (let i = 0; i < pathsToDelete.length; i += 100) {
          const batch = pathsToDelete.slice(i, i + 100);
          await db
            .delete(mediaItems)
            .where(inArray(mediaItems.filePath, batch));
        }
      }
    }

    const finalStatus = scanState.stopRequested ? "stopped" : "completed";

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
    scanState.isScanning = false;
    scanState.stopRequested = false;
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

async function processBatch(
  chunk: ProcessTask[],
  existingMediaPaths: Set<string>,
  existingTwitterUsers: UserCache,
  existingPixivUsers: UserCache,
  existingTags: TagCache,
  existingPosts: Map<string, number>,
) {
  const results = await Promise.all(chunk.map(prepareTask));
  let added = 0;
  let updated = 0;
  let errors = 0;

  // 1. Pre-process Avatars (Just collect URLs, do not download)
  const userAvatars = new Map<string, string>();

  for (const res of results) {
    if (!res.meta) continue;

    // Twitter
    if (
      res.meta.category === "twitter" ||
      res.meta.extractor === "twitter" ||
      res.meta.tweet_id
    ) {
      // biome-ignore lint/suspicious/noExplicitAny: Metadata is highly dynamic across platforms
      const userObj = (res.meta.user || res.meta.author || {}) as any;
      const userId = userObj.id || res.meta.user_id || res.meta.uploader_id;
      const avatarUrl =
        userObj.profile_image || userObj.profile_image_url_https;
      if (userId && avatarUrl) {
        userAvatars.set(String(userId), avatarUrl);
      }
    }

    // Pixiv
    if (res.meta.category === "pixiv" || res.meta.extractor === "pixiv") {
      const userId = res.meta.user?.id;
      const avatarUrl =
        res.meta.user?.profile_image_urls?.medium ||
        res.meta.user?.profile_image_urls?.px_1600x1600 ||
        res.meta.user?.profile_image_urls?.px_170x170;
      if (userId && avatarUrl) {
        userAvatars.set(String(userId), avatarUrl);
      }
    }
  }

  await db.transaction(async (tx) => {
    for (const res of results) {
      try {
        const { task, meta, stat, mediaType } = res;
        let postId: number | null = null;
        let extractorType: string | null = null;

        // Lookup Internal Source ID from logs OR use explicit sourceId from scanner
        let internalSourceId: number | null = task.sourceId;

        if (!internalSourceId) {
          // Use absolute path for lookup to match scraper logs
          const cleanRelPath = task.dbFilePath
            .replace(/^\//, "")
            .split("/")
            .join(path.sep);
          const absLookupPath = path.join(
            process.cwd(),
            "public",
            cleanRelPath,
          );

          const logEntry = await tx
            .select({ sourceId: scraperDownloadLogs.sourceId })
            .from(scraperDownloadLogs)
            .where(eq(scraperDownloadLogs.filePath, absLookupPath));

          if (logEntry.length > 0) {
            internalSourceId = logEntry[0].sourceId;
          }
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
            const processor =
              MetadataProcessorFactory.getProcessor(extractorType);
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
            postId: postId, // New FK
          });
          existingMediaPaths.add(task.dbFilePath);
          added++;
        } else if (mediaType !== "text") {
          if (postId) {
            await tx
              .update(mediaItems)
              .set({
                postId,
              })
              .where(eq(mediaItems.filePath, task.dbFilePath));
            updated++;
          }
        }
      } catch (itemError: unknown) {
        errors++;
        const errMsg =
          itemError instanceof Error ? itemError.message : String(itemError);
        console.error(
          `[Scanner] Failed to process item ${res.task.dbFilePath}: ${errMsg}`,
        );
        // Do not re-throw — skip this item and continue processing the rest
        // of the batch so one bad file doesn't lose the entire batch.
      }
    }
  }); // End Transaction

  return { added, updated, errors };
}
