import fs, { promises as fsPromises } from 'fs';
import path from 'path';
import { db } from '@/lib/db';
import {
    mediaItems,
    twitterUsers,
    twitterTweets,
    pixivUsers,
    pixivIllusts,
    tags,
    postTags,
    scanHistory,
    gallerydlExtractorTypes,
    scraperDownloadLogs,
    sources
} from '@/lib/db/schema';
import { eq, and, inArray, isNull } from 'drizzle-orm';

const DOWNLOAD_DIR = path.join(process.cwd(), 'public', 'downloads');
// Global control flags for this module process
let isScanning = false;
let stopRequested = false;

export function stopScanning() {
    if (isScanning) {
        console.log("Stopping scan requested...");
        stopRequested = true;
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
type TagCache = Map<string, number>; // name -> id
type UserCache = Set<string>; // id
type PostCache = Set<string>; // id (stringified)

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
        const legacyFiles = getAllFiles(DOWNLOAD_DIR);

        // Fetch Local Sources
        const localSources = await db.select().from(sources).where(and(isNull(sources.deletedAt), eq(sources.extractorType, 'local')));

        console.log(`Found ${legacyFiles.length} files in downloads. Found ${localSources.length} local sources.`);

        // Map<DirPath, Group>
        const dirGroups = new Map<string, {
            jsonFiles: string[],
            mediaFiles: string[],
            sourceId: number | null,
            sourceRoot: string // To calculate relative path 
        }>();

        // 1. Process Legacy Files
        const publicRoot = path.join(process.cwd(), 'public');
        legacyFiles.forEach(absPath => {
            const ext = path.extname(absPath).toLowerCase();
            const dir = path.dirname(absPath);
            if (!dirGroups.has(dir)) dirGroups.set(dir, { jsonFiles: [], mediaFiles: [], sourceId: null, sourceRoot: publicRoot });
            const group = dirGroups.get(dir)!;
            if (ext === '.json') group.jsonFiles.push(absPath);
            else if (['.mp4', '.webm', '.mkv', '.mp3', '.wav', '.m4a', '.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) group.mediaFiles.push(absPath);
        });

        // 2. Process Local Sources
        for (const source of localSources) {
            const sourceFiles = getAllFiles(source.url);
            console.log(`Source [${source.name}] has ${sourceFiles.length} files.`);

            sourceFiles.forEach(absPath => {
                const ext = path.extname(absPath).toLowerCase();
                const dir = path.dirname(absPath);

                // If this dir was already claimed by another source (nested?), we might have a conflict or just mix them.
                // Assuming distinct folders for now.
                if (!dirGroups.has(dir)) dirGroups.set(dir, { jsonFiles: [], mediaFiles: [], sourceId: source.id, sourceRoot: source.url });

                const group = dirGroups.get(dir)!;
                if (ext === '.json') group.jsonFiles.push(absPath);
                else if (['.mp4', '.webm', '.mkv', '.mp3', '.wav', '.m4a', '.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) group.mediaFiles.push(absPath);
            });
        }

        console.log("Loading existing DB records...");
        // const existingMedia = new Map<string, { id: number, capturedAt: Date | null }>();
        const existingMediaPaths = new Set<string>();
        const dbItems = await db.select({ id: mediaItems.id, filePath: mediaItems.filePath }).from(mediaItems);
        dbItems.forEach(i => existingMediaPaths.add(i.filePath));

        const existingTwitterUsers = new Set<string>();
        (await db.select({ id: twitterUsers.id }).from(twitterUsers)).forEach(u => existingTwitterUsers.add(u.id));

        const existingPixivUsers = new Set<string>();
        (await db.select({ id: pixivUsers.id }).from(pixivUsers)).forEach(u => existingPixivUsers.add(u.id));

        const existingTags = new Map<string, number>();
        (await db.select({ id: tags.id, name: tags.name }).from(tags)).forEach(t => existingTags.set(t.name, t.id));

        // Cache existing posts to avoid constant duplicate inserts
        const existingTweets = new Set<string>();
        (await db.select({ id: twitterTweets.tweetId }).from(twitterTweets)).forEach(t => existingTweets.add(t.id));

        const existingIllusts = new Set<number>();
        (await db.select({ id: pixivIllusts.pixivId }).from(pixivIllusts)).forEach(i => existingIllusts.add(i.id));

        // Ensure Extractors
        await db.insert(gallerydlExtractorTypes).values([
            { id: 'twitter', description: 'Twitter/X' },
            { id: 'pixiv', description: 'Pixiv' }
        ]).onConflictDoNothing().run();


        const processedPaths = new Set<string>();
        const tasks: ProcessTask[] = [];

        // Plan Tasks - One task per FILE, but we need to link them
        // We will process groups of files that share JSON metadata
        // Actually, we can just pair them up like before, but inside processBatch check if post exists.

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
                // Determine URL Path
                let urlPath: string;
                if (group.sourceId) {
                    // Local Source: /api/media/<sourceId>/<relativePath>
                    // relativePath from sourceRoot
                    const relativePath = path.relative(group.sourceRoot, mediaPath).split(path.sep).join('/');
                    urlPath = `/api/media/${group.sourceId}/${relativePath}`;
                } else {
                    // Legacy: /downloads/...
                    const relativePath = path.relative(group.sourceRoot, mediaPath).split(path.sep).join('/');
                    urlPath = '/' + relativePath;
                }

                processedPaths.add(urlPath);
                tasks.push({
                    fsPath: mediaPath,
                    dbFilePath: urlPath,
                    jsonPath: mediaToJson.get(mediaPath),
                    defaultType: 'image',
                    sourceId: group.sourceId
                });
            }

            // Process unused JSONs (Text-only posts)
            for (const jsonPath of group.jsonFiles) {
                if (!usedJsons.has(jsonPath)) {
                    let urlPath: string;
                    if (group.sourceId) {
                        const relativePath = path.relative(group.sourceRoot, jsonPath).split(path.sep).join('/');
                        urlPath = `/api/media/${group.sourceId}/${relativePath}`;
                    } else {
                        const relativePath = path.relative(group.sourceRoot, jsonPath).split(path.sep).join('/');
                        urlPath = '/' + relativePath;
                    }

                    processedPaths.add(urlPath);
                    tasks.push({
                        fsPath: jsonPath,
                        dbFilePath: urlPath,
                        jsonPath: jsonPath,
                        defaultType: 'text',
                        sourceId: group.sourceId
                    });
                }
            }
        }

        console.log(`Processing ${tasks.length} items in batches...`);

        const BATCH_SIZE = 100; // Smaller batch size due to more DB ops
        for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
            if (stopRequested) {
                console.log("Scan stopped by user.");
                break;
            }

            const chunk = tasks.slice(i, i + BATCH_SIZE);
            const batchStats = await processBatch(chunk, existingMediaPaths, existingTwitterUsers, existingPixivUsers, existingTags, existingTweets, existingIllusts);

            stats.processed += chunk.length;
            stats.added += batchStats.added;
            stats.updated += batchStats.updated;
            // errors tracked inside

            if (i % 500 === 0 && i > 0) {
                console.log(`Processed ${i} / ${tasks.length}`);
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
                    await db.delete(mediaItems).where(inArray(mediaItems.filePath, batch));
                }
            }
        }

        const finalStatus = stopRequested ? 'stopped' : 'completed';

        await db.update(scanHistory).set({
            status: finalStatus as any,
            endTime: new Date(),
            filesProcessed: stats.processed,
            filesAdded: stats.added,
            filesUpdated: stats.updated,
            filesDeleted: stats.deleted,
            errors: stats.errors
        }).where(eq(scanHistory.id, scanId));

        console.log(`Sync ${finalStatus} in ${(Date.now() - start) / 1000}s`);

    } catch (e: any) {
        console.error("Scan failed with error:", e);
        await db.update(scanHistory).set({
            status: 'failed',
            endTime: new Date(),
            filesProcessed: stats.processed,
            filesAdded: stats.added,
            filesUpdated: stats.updated,
            filesDeleted: stats.deleted,
            errors: stats.errors + 1,
            lastError: e.message || String(e)
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
    sourceId: number | null;
}

interface PrepareResult {
    task: ProcessTask;
    meta: any | null;
    stat: fs.Stats | null;
    mediaType: 'image' | 'video' | 'audio' | 'text';
}

async function prepareTask(task: ProcessTask): Promise<PrepareResult> {
    let meta = null;
    let stat = null;

    if (task.jsonPath) {
        try {
            const raw = await fsPromises.readFile(task.jsonPath, 'utf-8');
            meta = JSON.parse(raw);
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

    return { task, meta, stat, mediaType: type };
}

async function processBatch(
    chunk: ProcessTask[],
    existingMediaPaths: Set<string>,
    existingTwitterUsers: UserCache,
    existingPixivUsers: UserCache,
    existingTags: TagCache,
    existingTweets: PostCache,
    existingIllusts: Set<number>
) {
    const results = await Promise.all(chunk.map(prepareTask));
    let added = 0;
    let updated = 0;

    // 1. Pre-process Avatars (Just collect URLs, do not download)
    const userAvatars = new Map<string, string>();

    for (const res of results) {
        if (!res.meta) continue;

        // Twitter
        if (res.meta.category === 'twitter' || res.meta.extractor === 'twitter' || res.meta.tweet_id) {
            const userObj = res.meta.user || res.meta.author || {};
            const userId = userObj.id || res.meta.user_id || res.meta.uploader_id;
            const avatarUrl = userObj.profile_image || userObj.profile_image_url_https;
            if (userId && avatarUrl) {
                userAvatars.set(String(userId), avatarUrl);
            }
        }

        // Pixiv
        if (res.meta.category === 'pixiv' || res.meta.extractor === 'pixiv') {
            const userId = res.meta.user?.id;
            const avatarUrl = res.meta.user?.profile_image_urls?.medium || res.meta.user?.profile_image_urls?.px_170x170;
            if (userId && avatarUrl) {
                userAvatars.set(String(userId), avatarUrl);
            }
        }
    }

    db.transaction((tx) => {
        for (const res of results) {
            const { task, meta, stat, mediaType } = res;
            let internalPostId: number | null = null;
            let extractorType: string | null = null;

            // Lookup Internal Source ID from logs OR use explicit sourceId from scanner
            let internalSourceId: number | null = task.sourceId;

            if (!internalSourceId) {
                // Use absolute path for lookup to match scraper logs
                // Scraper logs store absolute paths. task.dbFilePath is relative (/downloads/...).
                // Construct absolute path from dbFilePath
                // Note: dbFilePath startswith /
                const cleanRelPath = task.dbFilePath.replace(/^\//, '').split('/').join(path.sep);
                const absLookupPath = path.join(process.cwd(), 'public', cleanRelPath);

                const logEntry = tx.select({ sourceId: scraperDownloadLogs.sourceId })
                    .from(scraperDownloadLogs)
                    .where(eq(scraperDownloadLogs.filePath, absLookupPath))
                    .get();

                if (logEntry) {
                    internalSourceId = logEntry.sourceId;
                }
            }

            // 2. Process Post Metadata (Users & Posts)
            if (meta) {
                // TWITTER
                if (meta.category === 'twitter' || meta.extractor === 'twitter' || meta.tweet_id) {
                    extractorType = 'twitter';
                    // Update User
                    const userObj = meta.user || meta.author || {};
                    const userId = userObj.id || meta.user_id;
                    const uidStr = userId ? String(userId) : null;

                    if (uidStr) {
                        const avatarPath = userAvatars.get(uidStr);
                        // Upsert User
                        if (!existingTwitterUsers.has(uidStr)) {
                            tx.insert(twitterUsers).values({
                                id: uidStr,
                                name: userObj.name || meta.uploader,
                                nick: userObj.nick,
                                description: userObj.description,
                                location: userObj.location,
                                date: userObj.date,
                                verified: userObj.verified,
                                protected: userObj.protected,
                                profileBanner: userObj.profile_banner,
                                profileImage: avatarPath,
                                favouritesCount: userObj.favourites_count,
                                followersCount: userObj.followers_count,
                                friendsCount: userObj.friends_count,
                                listedCount: userObj.listed_count,
                                mediaCount: userObj.media_count,
                                statusesCount: userObj.statuses_count
                            }).onConflictDoUpdate({
                                target: twitterUsers.id, set: {
                                    name: userObj.name,
                                    profileImage: avatarPath,
                                    followersCount: userObj.followers_count
                                }
                            }).run();
                            existingTwitterUsers.add(uidStr);
                        }
                    }

                    // Update Tweet
                    const tid = meta.tweet_id ? String(meta.tweet_id) : null;
                    if (tid) {
                        if (!existingTweets.has(tid)) {
                            // Insert Tweet
                            const inserted = tx.insert(twitterTweets).values({
                                tweetId: tid,
                                date: meta.date,
                                content: meta.content,
                                userId: uidStr,
                                retweetId: meta.retweet_id ? String(meta.retweet_id) : null,
                                quoteId: meta.quote_id ? String(meta.quote_id) : null,
                                replyId: meta.reply_id ? String(meta.reply_id) : null,
                                conversationId: meta.conversation_id ? String(meta.conversation_id) : null,
                                jsonSourceId: meta.source_id ? String(meta.source_id) : null, // Renamed column
                                internalSourceId: internalSourceId,
                                source: meta.source, // The HTML source string
                                lang: meta.lang,
                                sensitive: meta.sensitive,
                                sensitiveFlags: meta.sensitive_flags,
                                favoriteCount: meta.favorite_count,
                                retweetCount: meta.retweet_count,
                                quoteCount: meta.quote_count,
                                replyCount: meta.reply_count,
                                bookmarkCount: meta.bookmark_count,
                                viewCount: meta.view_count,
                                category: 'twitter',
                                subcategory: 'tweet'
                            }).onConflictDoNothing().returning({ id: twitterTweets.id }).get();

                            if (inserted) {
                                internalPostId = inserted.id;
                                existingTweets.add(tid);
                            } else {
                                // Already exists, fetch ID
                                const e = tx.select({ id: twitterTweets.id }).from(twitterTweets).where(eq(twitterTweets.tweetId, tid)).get();
                                if (e) {
                                    internalPostId = e.id;
                                    // Optionally update internalSourceId if it was null and we found it now?
                                    if (internalSourceId) {
                                        tx.update(twitterTweets).set({ internalSourceId }).where(eq(twitterTweets.id, e.id)).run();
                                    }
                                }
                            }
                        } else {
                            // Already processed in session, find ID
                            const e = tx.select({ id: twitterTweets.id }).from(twitterTweets).where(eq(twitterTweets.tweetId, tid)).get();
                            if (e) {
                                internalPostId = e.id;
                                // Optionally update internalSourceId
                                if (internalSourceId) {
                                    tx.update(twitterTweets).set({ internalSourceId }).where(eq(twitterTweets.id, e.id)).run();
                                }
                            }
                        }
                    }
                }

                // PIXIV
                if (meta.category === 'pixiv' || meta.extractor === 'pixiv') {
                    extractorType = 'pixiv';
                    const userId = meta.user?.id;
                    const uidStr = userId ? String(userId) : null;

                    if (uidStr) {
                        const avatarPath = userAvatars.get(uidStr);
                        if (!existingPixivUsers.has(uidStr)) {
                            tx.insert(pixivUsers).values({
                                id: uidStr,
                                name: meta.user.name,
                                account: meta.user.account,
                                profileImage: avatarPath,
                                isFollowed: meta.user.is_followed,
                                isAcceptRequest: meta.user.is_accept_request
                            }).onConflictDoUpdate({
                                target: pixivUsers.id, set: {
                                    name: meta.user.name,
                                    profileImage: avatarPath
                                }
                            }).run();
                            existingPixivUsers.add(uidStr);
                        }
                    }

                    const pid = meta.id ? Number(meta.id) : null;
                    if (pid) {
                        if (!existingIllusts.has(pid)) {
                            const inserted = tx.insert(pixivIllusts).values({
                                pixivId: pid,
                                userId: uidStr,
                                internalSourceId: internalSourceId,
                                title: meta.title,
                                caption: meta.caption,
                                type: meta.type,
                                date: meta.date || meta.create_date,
                                width: meta.width,
                                height: meta.height,
                                pageCount: meta.page_count,
                                restrict: meta.restrict,
                                xRestrict: meta.x_restrict,
                                sanityLevel: meta.sanity_level,
                                totalView: meta.total_view,
                                totalBookmarks: meta.total_bookmarks,
                                isBookmarked: meta.is_bookmarked,
                                visible: meta.visible,
                                isMuted: meta.is_muted,
                                illustAiType: meta.illust_ai_type,
                                illustBookStyle: meta.illust_book_style,
                                tags: meta.tags,
                                category: 'pixiv',
                                subcategory: meta.subcategory
                            }).onConflictDoNothing().returning({ id: pixivIllusts.id }).get();

                            if (inserted) {
                                internalPostId = inserted.id;
                                existingIllusts.add(pid);

                                // Tags
                                if (meta.tags && Array.isArray(meta.tags)) {
                                    for (const rawTag of meta.tags) {
                                        let baseTagName = typeof rawTag === 'string' ? rawTag : rawTag.name;
                                        if (!baseTagName) continue;

                                        // No Prefix
                                        const tagName = baseTagName.trim();
                                        let tagId = existingTags.get(tagName);

                                        if (!tagId) {
                                            // Insert into tags (name only)
                                            const newTag = tx.insert(tags).values({ name: tagName }).onConflictDoNothing().returning({ id: tags.id }).get();
                                            if (newTag) tagId = newTag.id;
                                            else {
                                                const e = tx.select({ id: tags.id }).from(tags).where(eq(tags.name, tagName)).get();
                                                if (e) tagId = e.id;
                                            }
                                            if (tagId) existingTags.set(tagName, tagId);
                                        }

                                        if (tagId && internalPostId) {
                                            tx.insert(postTags).values({
                                                tagId,
                                                extractorType: 'pixiv',
                                                internalPostId
                                            }).onConflictDoNothing().run();
                                        }
                                    }
                                }

                            } else {
                                // Find existing
                                const e = tx.select({ id: pixivIllusts.id }).from(pixivIllusts).where(eq(pixivIllusts.pixivId, pid)).get();
                                if (e) {
                                    internalPostId = e.id;
                                    if (internalSourceId) {
                                        tx.update(pixivIllusts).set({ internalSourceId }).where(eq(pixivIllusts.id, e.id)).run();
                                    }
                                }
                            }
                        } else {
                            const e = tx.select({ id: pixivIllusts.id }).from(pixivIllusts).where(eq(pixivIllusts.pixivId, pid)).get();
                            if (e) {
                                internalPostId = e.id;
                                if (internalSourceId) {
                                    tx.update(pixivIllusts).set({ internalSourceId }).where(eq(pixivIllusts.id, e.id)).run();
                                }
                            }
                        }
                    }
                }
            }

            // 3. Insert/Update Media Item
            let capturedAt = stat ? stat.mtime : new Date();
            if (meta) {
                if (meta.date) capturedAt = new Date(meta.date);
                else if (meta.create_date) capturedAt = new Date(meta.create_date);
            }

            if (!existingMediaPaths.has(task.dbFilePath)) {
                tx.insert(mediaItems).values({
                    filePath: task.dbFilePath,
                    mediaType,
                    capturedAt,
                    extractorType, // Polymorphic
                    internalPostId // Polymorphic
                }).run();
                existingMediaPaths.add(task.dbFilePath);
                added++;
            } else {
                if (internalPostId && extractorType) {
                    tx.update(mediaItems).set({
                        extractorType,
                        internalPostId
                    }).where(eq(mediaItems.filePath, task.dbFilePath)).run();
                    updated++;
                }
            }
        }
    }); // End Transaction

    return { added, updated };
}
