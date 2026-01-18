import fs, { promises as fsPromises } from 'fs';
import path from 'path';
import { db } from '@/lib/db';
import { mediaItems, twitterUsers, twitterTweets, pixivUsers, pixivIllusts, tags, pixivIllustTags, scanHistory } from '@/lib/db/schema';
import { eq, and, count, inArray } from 'drizzle-orm';

const DOWNLOAD_DIR = path.join(process.cwd(), 'public', 'downloads');
const AVATAR_DIR = path.join(process.cwd(), 'public', 'avatars');

// Global control flags for this module process
let isScanning = false;
let stopRequested = false;

export function stopScanning() {
    if (isScanning) {
        console.log("Stopping scan requested...");
        stopRequested = true;
    }
}

async function ensureLocalAvatar(url: string | null | undefined, platform: string, userId: string): Promise<string | null> {
    if (!url) return null;

    try {
        const platformDir = path.join(AVATAR_DIR, platform);
        await fsPromises.mkdir(platformDir, { recursive: true });

        let ext = path.extname(url).split('?')[0] || '.jpg';
        if (ext === '.') ext = '.jpg';
        if (ext.length > 5) ext = '.jpg';

        const filename = `${userId}${ext}`;
        const localPath = path.join(platformDir, filename);
        const publicPath = `/avatars/${platform}/${filename}`;

        try {
            await fsPromises.access(localPath);
            return publicPath;
        } catch { }

        const headers: Record<string, string> = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        };
        if (platform === 'pixiv') headers['Referer'] = 'https://www.pixiv.net/';

        const response = await fetch(url, { headers });
        if (!response.ok) return url;

        const buffer = await response.arrayBuffer();
        await fsPromises.writeFile(localPath, Buffer.from(buffer));
        return publicPath;

    } catch (error) {
        return url;
    }
}

function getAllFiles(dirPath: string): string[] {
    let results: string[] = [];
    if (!fs.existsSync(dirPath)) return results;
    const list = fs.readdirSync(dirPath);
    list.forEach((file) => {
        const fullPath = path.join(dirPath, file);
        try {
            const stat = fs.statSync(fullPath);
            if (stat && stat.isDirectory()) results = results.concat(getAllFiles(fullPath));
            else results.push(fullPath);
        } catch { }
    });
    return results;
}

// Memory Cache Types
type MediaCache = Map<string, { id: number, metadataHash: string | null }>; // path -> info
type TagCache = Map<string, number>; // name -> id
type UserCache = Set<string>; // id

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
    const scanRecord = await db.insert(scanHistory).values({
        startTime: new Date(),
        status: 'running',
        filesProcessed: 0,
        filesAdded: 0,
        filesUpdated: 0,
        filesDeleted: 0,
        errors: 0
    }).returning({ id: scanHistory.id });
    const scanId = scanRecord[0].id;

    let stats = {
        processed: 0,
        added: 0,
        updated: 0,
        deleted: 0,
        errors: 0
    };

    try {
        const allFiles = getAllFiles(DOWNLOAD_DIR);
        console.log(`Found ${allFiles.length} files. Grouping...`);

        const dirGroups = new Map<string, { jsonFiles: string[], mediaFiles: string[] }>();
        allFiles.forEach(absPath => {
            const ext = path.extname(absPath).toLowerCase();
            const dir = path.dirname(absPath);
            if (!dirGroups.has(dir)) dirGroups.set(dir, { jsonFiles: [], mediaFiles: [] });
            const group = dirGroups.get(dir)!;
            if (ext === '.json') group.jsonFiles.push(absPath);
            else if (['.mp4', '.webm', '.mkv', '.mp3', '.wav', '.m4a', '.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) group.mediaFiles.push(absPath);
        });

        console.log("Loading existing DB records...");
        const existingMedia = new Map<string, { id: number, metadataHash: string | null }>();
        const dbItems = await db.select({ id: mediaItems.id, filePath: mediaItems.filePath, metadata: mediaItems.metadata }).from(mediaItems);
        dbItems.forEach(i => existingMedia.set(i.filePath, { id: i.id, metadataHash: i.metadata ? String(i.metadata.length) : null }));

        const existingTwitterUsers = new Set<string>();
        (await db.select({ id: twitterUsers.id }).from(twitterUsers)).forEach(u => existingTwitterUsers.add(u.id));

        const existingPixivUsers = new Set<string>();
        (await db.select({ id: pixivUsers.id }).from(pixivUsers)).forEach(u => existingPixivUsers.add(u.id));

        const existingTags = new Map<string, number>();
        (await db.select({ id: tags.id, name: tags.name }).from(tags)).forEach(t => existingTags.set(t.name, t.id));

        const processedPaths = new Set<string>();
        const tasks: ProcessTask[] = [];

        // Plan Tasks
        for (const [dir, group] of dirGroups) {
            const mediaToJson = new Map<string, string>();
            const usedJsons = new Set<string>();

            for (const mediaPath of group.mediaFiles) {
                const mediaName = path.basename(mediaPath, path.extname(mediaPath));
                let bestMatchJson: string | null = null;
                let bestMatchLen = 0;

                for (const jsonPath of group.jsonFiles) {
                    const jsonName = path.basename(jsonPath, '.json');
                    if (mediaName.startsWith(jsonName)) {
                        if (mediaName === jsonName || ['-', '_', '.'].includes(mediaName[jsonName.length])) {
                            if (jsonName.length > bestMatchLen) {
                                bestMatchLen = jsonName.length;
                                bestMatchJson = jsonPath;
                            }
                        }
                    }
                }
                if (bestMatchJson) {
                    mediaToJson.set(mediaPath, bestMatchJson);
                    usedJsons.add(bestMatchJson);
                }
            }

            for (const mediaPath of group.mediaFiles) {
                const relativePath = path.relative(path.join(process.cwd(), 'public'), mediaPath);
                const urlPath = '/' + relativePath.split(path.sep).join('/');
                processedPaths.add(urlPath);
                tasks.push({ fsPath: mediaPath, dbFilePath: urlPath, jsonPath: mediaToJson.get(mediaPath), defaultType: 'image' });
            }

            for (const jsonPath of group.jsonFiles) {
                if (!usedJsons.has(jsonPath)) {
                    const relativePath = path.relative(path.join(process.cwd(), 'public'), jsonPath);
                    const urlPath = '/' + relativePath.split(path.sep).join('/');
                    processedPaths.add(urlPath);
                    tasks.push({ fsPath: jsonPath, dbFilePath: urlPath, jsonPath: jsonPath, defaultType: 'text' });
                }
            }
        }

        console.log(`Processing ${tasks.length} items in batches...`);

        const BATCH_SIZE = 250;
        for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
            if (stopRequested) {
                console.log("Scan stopped by user.");
                break;
            }

            const chunk = tasks.slice(i, i + BATCH_SIZE);
            const batchStats = await processBatch(chunk, existingMedia, existingTwitterUsers, existingPixivUsers, existingTags);

            stats.processed += chunk.length;
            stats.added += batchStats.added;
            stats.updated += batchStats.updated;

            if (i % 1000 === 0 && i > 0) {
                console.log(`Processed ${i} / ${tasks.length}`);
                // Update DB progress
                await db.update(scanHistory).set({
                    filesProcessed: stats.processed,
                    filesAdded: stats.added,
                    filesUpdated: stats.updated,
                    filesDeleted: stats.deleted,
                    errors: stats.errors
                }).where(eq(scanHistory.id, scanId));
            }
        }

        if (!stopRequested) {
            // Cleanup Phase (only if completed)
            console.log("Cleaning up removed items...");
            const pathsToDelete: string[] = [];
            for (const [path] of existingMedia) {
                if (!processedPaths.has(path)) {
                    pathsToDelete.push(path);
                }
            }

            if (pathsToDelete.length > 0) {
                console.log(`Deleting ${pathsToDelete.length} missing items...`);
                stats.deleted = pathsToDelete.length;
                for (let i = 0; i < pathsToDelete.length; i += 100) {
                    const batch = pathsToDelete.slice(i, i + 100);
                    await db.delete(mediaItems).where(inArray(mediaItems.filePath, batch));
                }
            }
        }

        const finalStatus = stopRequested ? 'stopped' : 'completed';

        await db.update(scanHistory).set({
            status: finalStatus as any, // Drizzle type might not be updated yet in running memory, but schema has it? Wait, schema has 'completed' | 'failed' | 'running'. I should add 'stopped'.
            endTime: new Date(),
            filesProcessed: stats.processed,
            filesAdded: stats.added,
            filesUpdated: stats.updated,
            filesDeleted: stats.deleted,
            errors: stats.errors
        }).where(eq(scanHistory.id, scanId));

        console.log(`Sync ${finalStatus} in ${(Date.now() - start) / 1000}s`);

    } catch (e) {
        console.error("Scan failed with error:", e);
        await db.update(scanHistory).set({
            status: 'failed',
            endTime: new Date(),
            filesProcessed: stats.processed,
            filesAdded: stats.added,
            filesUpdated: stats.updated,
            filesDeleted: stats.deleted,
            errors: stats.errors + 1
        }).where(eq(scanHistory.id, scanId));
    } finally {
        isScanning = false;
        stopRequested = false;
    }
}

interface ProcessTask {
    fsPath: string;
    dbFilePath: string;
    jsonPath: string | undefined;
    defaultType: 'image' | 'video' | 'audio' | 'text';
}

interface PrepareResult {
    task: ProcessTask;
    meta: any | null;
    rawMeta: string | null;
    stat: fs.Stats | null;
    mediaType: 'image' | 'video' | 'audio' | 'text';
}

async function prepareTask(task: ProcessTask): Promise<PrepareResult> {
    let meta = null;
    let rawMeta = null;
    let stat = null;

    if (task.jsonPath) {
        try {
            rawMeta = await fsPromises.readFile(task.jsonPath, 'utf-8');
            meta = JSON.parse(rawMeta);
        } catch { }
    }

    try {
        stat = await fsPromises.stat(task.fsPath);
    } catch { }

    let type = task.defaultType;
    if (type !== 'text') {
        const ext = path.extname(task.fsPath).toLowerCase();
        if (['.mp4', '.webm', '.mkv'].includes(ext)) type = 'video';
        if (['.mp3', '.wav', '.m4a'].includes(ext)) type = 'audio';
    }

    return { task, meta, rawMeta, stat, mediaType: type };
}

async function processBatch(
    chunk: ProcessTask[],
    existingMedia: MediaCache,
    existingTwitterUsers: UserCache,
    existingPixivUsers: UserCache,
    existingTags: TagCache
) {
    const results = await Promise.all(chunk.map(prepareTask));
    let added = 0;
    let updated = 0;

    // Pre-process batch to identify unique users and download avatars
    const userAvatars = new Map<string, string>(); // userId -> localPath
    const uniqueUsers = new Map<string, { url: string, platform: 'twitter' | 'pixiv' }>();

    for (const res of results) {
        if (!res.meta) continue;

        // Twitter
        if (res.meta.category === 'twitter' || res.meta.extractor === 'twitter' || res.meta.tweet_id) {
            const userObj = res.meta.user || res.meta.author || {};
            const userId = userObj.id || res.meta.user_id || res.meta.uploader_id;
            const avatarUrl = userObj.profile_image || userObj.profile_image_url_https;
            if (userId && avatarUrl) {
                uniqueUsers.set(String(userId), { url: avatarUrl, platform: 'twitter' });
            }
        }

        // Pixiv
        if (res.meta.category === 'pixiv' || res.meta.extractor === 'pixiv') {
            const userId = res.meta.user?.id;
            // Try to get medium, falling back to other sizes if needed, though usually medium is good for avatars
            const avatarUrl = res.meta.user?.profile_image_urls?.medium || res.meta.user?.profile_image_urls?.px_170x170;
            if (userId && avatarUrl) {
                uniqueUsers.set(String(userId), { url: avatarUrl, platform: 'pixiv' });
            }
        }
    }

    // Download avatars concurrently
    if (uniqueUsers.size > 0) {
        const avatarPromises = Array.from(uniqueUsers.entries()).map(async ([userId, { url, platform }]) => {
            const localPath = await ensureLocalAvatar(url, platform, userId);
            if (localPath) {
                return { userId, localPath };
            }
            return null;
        });

        const avatarResults = await Promise.all(avatarPromises);
        avatarResults.forEach(r => {
            if (r) userAvatars.set(r.userId, r.localPath);
        });
    }

    await db.transaction((tx) => {
        // 1. Upsert Media Items
        for (const res of results) {
            const { task, meta, rawMeta, stat, mediaType } = res;

            let title = path.basename(task.fsPath);
            let description = null;
            let originalUrl = null;
            let capturedAt = stat ? stat.mtime : new Date();

            if (meta) {
                if (meta.title) title = meta.title;
                else if (meta.tweet_id) title = `Tweet ${meta.tweet_id}`;
                if (meta.description) description = meta.description;
                if (!description && meta.content) description = meta.content;

                if (meta.date) capturedAt = new Date(meta.date);
                else if (meta.upload_date && meta.upload_date.length === 8) {
                    const d = meta.upload_date;
                    capturedAt = new Date(parseInt(d.substring(0, 4)), parseInt(d.substring(4, 6)) - 1, parseInt(d.substring(6, 8)));
                }
            }

            const existing = existingMedia.get(task.dbFilePath);
            let mediaId: number;

            const needsUpdate = existing && rawMeta && existing.metadataHash !== String(rawMeta.length);

            if (!existing) {
                // returning().get() returns the single inserted row object directly
                const inserted = tx.insert(mediaItems).values({
                    filePath: task.dbFilePath,
                    mediaType,
                    title,
                    description,
                    originalUrl,
                    capturedAt,
                    metadata: rawMeta
                }).returning({ id: mediaItems.id }).get();

                if (inserted) {
                    mediaId = inserted.id;
                    existingMedia.set(task.dbFilePath, { id: mediaId, metadataHash: rawMeta ? String(rawMeta.length) : null });
                    added++;
                } else {
                    console.error("Failed to insert media item (no ID returned):", task.dbFilePath);
                    continue;
                }
            } else {
                mediaId = existing.id;
                if (needsUpdate || !existing.metadataHash) {
                    tx.update(mediaItems).set({
                        title,
                        description,
                        originalUrl,
                        capturedAt,
                        metadata: rawMeta
                    }).where(eq(mediaItems.id, mediaId)).run();
                    existing.metadataHash = rawMeta ? String(rawMeta.length) : null;
                    updated++;
                }
            }

            if (meta) {
                if (meta.category === 'twitter' || meta.extractor === 'twitter' || meta.tweet_id) {
                    processTwitter(tx, meta, mediaId, existingTwitterUsers, userAvatars);
                }
                if (meta.category === 'pixiv' || meta.extractor === 'pixiv') {
                    processPixiv(tx, meta, mediaId, existingPixivUsers, existingTags, userAvatars);
                }
            }
        }
    });

    return { added, updated };
}

function processTwitter(tx: any, meta: any, mediaId: number, userCache: UserCache, avatarMap: Map<string, string>) {
    const userObj = meta.user || meta.author || {};
    const userId = userObj.id || meta.user_id || meta.uploader_id;

    if (userId) {
        const uidStr = String(userId);
        const avatarPath = avatarMap.get(uidStr);

        if (!userCache.has(uidStr)) {
            tx.insert(twitterUsers).values({
                id: uidStr,
                name: userObj.name || meta.uploader,
                nick: userObj.nick,
                description: userObj.description,
                profileImage: avatarPath
            }).onConflictDoUpdate({ target: twitterUsers.id, set: { name: userObj.name, profileImage: avatarPath } }).run();
            userCache.add(uidStr);
        } else if (avatarPath) {
            // Setup update for avatar if it exists and wasn't there before or changed
            tx.update(twitterUsers).set({ profileImage: avatarPath }).where(eq(twitterUsers.id, uidStr)).run();
        }
    }

    const tweetId = meta.tweet_id || meta.id;
    if (tweetId) {
        const existing = tx.select({ id: twitterTweets.id }).from(twitterTweets).where(eq(twitterTweets.mediaItemId, mediaId)).get();
        if (!existing) {
            tx.insert(twitterTweets).values({
                tweetId: String(tweetId),
                mediaItemId: mediaId,
                userId: userId ? String(userId) : null,
                date: meta.date,
                content: meta.content
            }).run();
        }
    }
}

function processPixiv(tx: any, meta: any, mediaId: number, userCache: UserCache, tagCache: TagCache, avatarMap: Map<string, string>) {
    const userId = meta.user?.id;
    if (userId) {
        const uidStr = String(userId);
        const avatarPath = avatarMap.get(uidStr);

        if (!userCache.has(uidStr)) {
            tx.insert(pixivUsers).values({
                id: uidStr,
                name: meta.user.name,
                account: meta.user.account,
                profileImage: avatarPath
            }).onConflictDoUpdate({ target: pixivUsers.id, set: { name: meta.user.name, profileImage: avatarPath } }).run();
            userCache.add(uidStr);
        } else if (avatarPath) {
            tx.update(pixivUsers).set({ profileImage: avatarPath }).where(eq(pixivUsers.id, uidStr)).run();
        }
    }

    const pixivId = meta.id;
    if (!pixivId) return;

    let illustId: number;
    const existing = tx.select({ id: pixivIllusts.id }).from(pixivIllusts).where(eq(pixivIllusts.mediaItemId, mediaId)).get();

    if (existing) {
        illustId = existing.id;
    } else {
        const res = tx.insert(pixivIllusts).values({
            pixivId: Number(pixivId),
            mediaItemId: mediaId,
            userId: userId ? String(userId) : null,
            title: meta.title,
            tags: meta.tags
        }).returning({ id: pixivIllusts.id }).get();

        if (res) {
            illustId = res.id;
        } else {
            console.error("Failed to insert Pixiv illust", pixivId);
            return; // Failed to insert illust
        }
    }

    if (meta.tags && Array.isArray(meta.tags)) {
        for (const rawTag of meta.tags) {
            let tagName = typeof rawTag === 'string' ? rawTag : rawTag.name;
            if (!tagName) continue;
            tagName = tagName.trim();

            let tagId = tagCache.get(tagName);
            if (!tagId) {
                // returning().get() for single result
                const newTag = tx.insert(tags).values({ name: tagName, type: 'pixiv' }).onConflictDoNothing().returning({ id: tags.id }).get();
                if (newTag) {
                    tagId = newTag.id;
                    tagCache.set(tagName, newTag.id);
                } else {
                    const e = tx.select({ id: tags.id }).from(tags).where(eq(tags.name, tagName)).get();
                    if (e) {
                        tagId = e.id;
                        tagCache.set(tagName, e.id);
                    }
                }
            }
            if (tagId) {
                tx.insert(pixivIllustTags).values({ illustId, tagId }).onConflictDoNothing().run(); // Run without returning
            }
        }
    }
}
