import fs, { promises as fsPromises } from 'fs';
import path from 'path';
import { db } from '@/lib/db';
import { mediaItems, twitterUsers, twitterTweets, pixivUsers, pixivIllusts, tags, pixivIllustTags } from '@/lib/db/schema';
import { eq, and, count } from 'drizzle-orm';

const DOWNLOAD_DIR = path.join(process.cwd(), 'public', 'downloads');
const AVATAR_DIR = path.join(process.cwd(), 'public', 'avatars');

async function ensureLocalAvatar(url: string | null | undefined, platform: string, userId: string): Promise<string | null> {
    if (!url) return null;

    try {
        const platformDir = path.join(AVATAR_DIR, platform);
        await fsPromises.mkdir(platformDir, { recursive: true });

        // Extract extension or default to .jpg
        // Pixiv URLs often look like: .../123.jpg or .../123.png
        // Twitter URLs: .../image.jpg
        let ext = path.extname(url).split('?')[0] || '.jpg';
        if (ext === '.') ext = '.jpg';
        if (ext.length > 5) ext = '.jpg'; // Safety check

        const filename = `${userId}${ext}`;
        const localPath = path.join(platformDir, filename);
        const publicPath = `/avatars/${platform}/${filename}`;

        try {
            await fsPromises.access(localPath);
            return publicPath; // Already exists
        } catch {
            // Needed to download
        }

        console.log(`Downloading avatar for ${platform} user ${userId}...`);

        // Pixiv requires Referer heades
        const headers: Record<string, string> = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        };

        if (platform === 'pixiv') {
            headers['Referer'] = 'https://www.pixiv.net/';
        }

        const response = await fetch(url, { headers });
        if (!response.ok) {
            console.error(`Failed to download avatar: ${response.status} ${response.statusText}`);
            return url; // Fallback to remote URL
        }

        const buffer = await response.arrayBuffer();
        await fsPromises.writeFile(localPath, Buffer.from(buffer));
        console.log(`Saved avatar to ${localPath}`);

        return publicPath;

    } catch (error) {
        console.error(`Error processing avatar for ${userId}:`, error);
        return url; // Fallback
    }
}

// Helper to get all files recursively
function getAllFiles(dirPath: string): string[] {
    let results: string[] = [];
    if (!fs.existsSync(dirPath)) return results;

    const list = fs.readdirSync(dirPath);
    list.forEach((file) => {
        const fullPath = path.join(dirPath, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            results = results.concat(getAllFiles(fullPath));
        } else {
            results.push(fullPath);
        }
    });
    return results;
}

export async function syncLibrary() {
    const allFiles = getAllFiles(DOWNLOAD_DIR);

    // Group files by directory
    const dirGroups = new Map<string, { jsonFiles: string[], mediaFiles: string[] }>();

    allFiles.forEach(absPath => {
        const ext = path.extname(absPath).toLowerCase();
        const dir = path.dirname(absPath);

        if (!dirGroups.has(dir)) {
            dirGroups.set(dir, { jsonFiles: [], mediaFiles: [] });
        }
        const group = dirGroups.get(dir)!;

        // Categorize file
        if (ext === '.json') {
            group.jsonFiles.push(absPath);
        } else if (['.mp4', '.webm', '.mkv', '.mp3', '.wav', '.m4a', '.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
            group.mediaFiles.push(absPath);
        }
    });

    const processedPaths = new Set<string>();

    // Process each directory
    for (const [dir, group] of dirGroups) {

        // 1. Map Media to JSON
        // We need to find the best matching JSON for each media file.
        // Rule: json basename should be a prefix of media basename
        // Example: 123.json matches 123_p0.jpg

        const mediaToJson = new Map<string, string>(); // mediaAbsPath -> jsonAbsPath
        const usedJsons = new Set<string>();

        // Sort files to ensure deterministic matching (longer names match first? actually we want shortest json that is prefix?)
        // Let's sort JSONs by length descending so we match "specific" ones first? 
        // Actually, gallery-dl usually does `id.json` and `id_p0.jpg`.
        // If we have `id.json` and `id_something.json`, valid media usually matches `id` more strongly.
        // Let's keep it simple: try to find a JSON whose name is a prefix of media name.

        for (const mediaPath of group.mediaFiles) {
            const mediaName = path.basename(mediaPath, path.extname(mediaPath));

            // Find candidate JSONs
            // Sort candidates by length descending to match longest prefix (most specific)?
            // Case: `post.json` vs `post_extra.json`. `post_img.jpg` should match `post.json`?
            // Actually usually `12345.json` covers `12345_p0.jpg`.

            let bestMatchJson: string | null = null;
            let bestMatchLen = 0;

            for (const jsonPath of group.jsonFiles) {
                const jsonName = path.basename(jsonPath, '.json');

                if (mediaName.startsWith(jsonName)) {
                    // Check if it's a valid prefix match (exact match or followed by separator like _ or - or .)
                    // to avoid `1234.json` matching `12345.jpg`
                    if (mediaName === jsonName ||
                        ['-', '_', '.'].includes(mediaName[jsonName.length])) {

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

        // 2. Process Media Items
        for (const mediaPath of group.mediaFiles) {
            const relativePath = path.relative(path.join(process.cwd(), 'public'), mediaPath);
            const urlPath = '/' + relativePath.split(path.sep).join('/');
            processedPaths.add(urlPath);

            const jsonPath = mediaToJson.get(mediaPath);
            await processMediaItem(mediaPath, urlPath, jsonPath, 'image'); // Default type image, will be corrected inside
        }

        // 3. Process Orphan JSONs (Text Posts)
        for (const jsonPath of group.jsonFiles) {
            if (!usedJsons.has(jsonPath)) {
                // This JSON was not used by any media file.
                // It might be a text post, or just a metadata file for a deleted image, 
                // or a "gallery" metadata file where images are in subfolders (not currently handled by this logic, but acceptable for now).

                // We create a "text" mediaItem for this.
                // We construct a fake "filePath" for it so we can track it in DB.
                // Use .json path as the filePath? Or a constructed one?
                // The DB schema expects `filePath` to verify existence?
                // If we use the .json path, `view_file` on it would show json.
                // That's fine.

                const relativePath = path.relative(path.join(process.cwd(), 'public'), jsonPath);
                const urlPath = '/' + relativePath.split(path.sep).join('/');
                processedPaths.add(urlPath);

                await processMediaItem(jsonPath, urlPath, jsonPath, 'text');
            }
        }
    }

    // Cleanup phase: Delete database items that no longer exist on disk
    const allDbItems = await db.query.mediaItems.findMany();

    for (const item of allDbItems) {
        if (!processedPaths.has(item.filePath)) {
            console.log(`Removing missing item: ${item.filePath}`);
            await db.delete(mediaItems).where(eq(mediaItems.id, item.id));
        }
    }
}

async function processMediaItem(fsPath: string, dbFilePath: string, jsonPath: string | undefined, defaultType: 'image' | 'video' | 'audio' | 'text') {
    const existing = await db.query.mediaItems.findFirst({
        where: eq(mediaItems.filePath, dbFilePath),
    });

    let title = path.basename(fsPath);
    let description = null;
    let originalUrl = null;
    let capturedAt = new Date();
    let metadataJson: string | null = null;

    if (jsonPath) {
        try {
            const jsonContent = await fsPromises.readFile(jsonPath, 'utf-8');
            const meta = JSON.parse(jsonContent);
            metadataJson = jsonContent;

            if (meta.title) title = meta.title;
            if (meta.tweet_id && !meta.title) title = `Tweet ${meta.tweet_id}`;
            if (meta.description) description = meta.description;
            if (!description && meta.content) description = meta.content;

            if (meta.date) capturedAt = new Date(meta.date);
            else if (meta.upload_date) {
                const d = meta.upload_date;
                if (d.length === 8) {
                    const year = parseInt(d.substring(0, 4));
                    const month = parseInt(d.substring(4, 6)) - 1;
                    const day = parseInt(d.substring(6, 8));
                    capturedAt = new Date(year, month, day);
                }
            }
        } catch (e) {
            console.error(`Failed to parse metadata for ${jsonPath}`, e);
        }
    } else {
        try {
            const stat = await fsPromises.stat(fsPath);
            capturedAt = stat.mtime;
        } catch { }
    }

    // Determine type
    // If passed 'text', keep it 'text'. Otherwise check extension.
    let type: 'image' | 'video' | 'audio' | 'text' = defaultType;
    if (defaultType !== 'text') {
        const ext = path.extname(fsPath).toLowerCase();
        if (['.mp4', '.webm', '.mkv'].includes(ext)) type = 'video';
        if (['.mp3', '.wav', '.m4a'].includes(ext)) type = 'audio';
    }

    let mediaItemId: number;

    if (!existing) {
        const newItem = await db.insert(mediaItems).values({
            filePath: dbFilePath,
            mediaType: type,
            title,
            description,
            originalUrl,
            capturedAt,
            metadata: metadataJson,
        }).returning();
        mediaItemId = newItem[0].id;
    } else {
        mediaItemId = existing.id;
        // Update existing if metadata changed or gained
        if (!existing.metadata && metadataJson) {
            await db.update(mediaItems).set({
                title,
                description,
                originalUrl,
                capturedAt,
                metadata: metadataJson
            }).where(eq(mediaItems.id, existing.id));
        }
    }

    // Process Platform Specifics
    if (metadataJson) {
        try {
            const meta = JSON.parse(metadataJson);

            // Twitter
            if (meta.category === 'twitter' || meta.extractor_key === 'Twitter' || meta.extractor === 'twitter' || (meta.tweet_id !== undefined)) {
                await processTwitterMetadata(meta, mediaItemId);
            }

            // Pixiv
            if (meta.category === 'pixiv' || meta.extractor === 'pixiv') {
                await processPixivMetadata(meta, mediaItemId);
            }
        } catch (e) {
            console.error("Error processing platform metadata", e);
        }
    }
}

async function processTwitterMetadata(meta: any, mediaItemId: number) {
    const isTwitter = meta.category === 'twitter' || meta.extractor_key === 'Twitter' || meta.extractor === 'twitter' || (meta.tweet_id !== undefined);
    if (!isTwitter) return;

    const userObj = meta.user || meta.author || {};
    const userId = userObj.id || meta.user_id || meta.uploader_id;

    if (userId) {
        // Upsert User
        const existingUser = await db.query.twitterUsers.findFirst({
            where: eq(twitterUsers.id, String(userId))
        });

        const avatarUrl = await ensureLocalAvatar(userObj.profile_image || meta.profile_image_url || userObj.profile_image_url_https, 'twitter', String(userId));

        const userData = {
            id: String(userId),
            name: userObj.name || meta.uploader,
            nick: userObj.nick,
            location: userObj.location,
            date: userObj.date,
            verified: userObj.verified,
            protected: userObj.protected,
            profileBanner: userObj.profile_banner,
            profileImage: avatarUrl,
            favouritesCount: userObj.favourites_count,
            followersCount: userObj.followers_count,
            friendsCount: userObj.friends_count,
            listedCount: userObj.listed_count,
            mediaCount: userObj.media_count,
            statusesCount: userObj.statuses_count,
            description: userObj.description
        };

        if (existingUser) {
            await db.update(twitterUsers).set(userData).where(eq(twitterUsers.id, String(userId)));
        } else {
            await db.insert(twitterUsers).values(userData);
        }
    }

    // Insert Tweet
    const existingTweetForMedia = await db.query.twitterTweets.findFirst({
        where: eq(twitterTweets.mediaItemId, mediaItemId)
    });

    if (!existingTweetForMedia) {
        const tweetId = meta.tweet_id || meta.id;
        if (tweetId) {
            await db.insert(twitterTweets).values({
                tweetId: String(tweetId),
                mediaItemId: mediaItemId,
                retweetId: meta.retweet_id ? String(meta.retweet_id) : null,
                quoteId: meta.quote_id ? String(meta.quote_id) : null,
                replyId: meta.reply_id ? String(meta.reply_id) : null,
                conversationId: meta.conversation_id ? String(meta.conversation_id) : null,
                sourceId: meta.source_id ? String(meta.source_id) : null,
                date: meta.date,
                userId: userId ? String(userId) : null,
                lang: meta.lang,
                source: meta.source,
                sensitive: meta.sensitive,
                sensitiveFlags: meta.sensitive_flags,
                favoriteCount: meta.favorite_count,
                quoteCount: meta.quote_count,
                replyCount: meta.reply_count,
                retweetCount: meta.retweet_count,
                bookmarkCount: meta.bookmark_count,
                viewCount: meta.view_count,
                content: meta.content,
                count: meta.count,
                category: meta.category,
                subcategory: meta.subcategory
            });
        }
    }
}

async function processPixivMetadata(meta: any, mediaItemId: number) {
    const isPixiv = meta.category === 'pixiv' || meta.extractor === 'pixiv';
    if (!isPixiv) return;

    // Upsert User
    const userObj = meta.user || {};
    const userId = userObj.id;

    if (userId) {
        const existingUser = await db.query.pixivUsers.findFirst({
            where: eq(pixivUsers.id, String(userId))
        });

        const avatarUrl = await ensureLocalAvatar(userObj.profile_image_urls?.medium, 'pixiv', String(userId));

        const userData = {
            id: String(userId),
            name: userObj.name,
            account: userObj.account,
            profileImage: avatarUrl,
            isFollowed: userObj.is_followed,
            isAcceptRequest: userObj.is_accept_request,
        };

        if (existingUser) {
            await db.update(pixivUsers).set(userData).where(eq(pixivUsers.id, String(userId)));
        } else {
            await db.insert(pixivUsers).values(userData);
        }
    }

    // Insert Illust
    const existingIllustForMedia = await db.query.pixivIllusts.findFirst({
        where: eq(pixivIllusts.mediaItemId, mediaItemId)
    });

    let illustRecordId: number;

    if (!existingIllustForMedia) {
        const pixivId = meta.id;
        if (pixivId) {
            const illustResult = await db.insert(pixivIllusts).values({
                pixivId: Number(pixivId),
                mediaItemId: mediaItemId,
                userId: userId ? String(userId) : null,
                title: meta.title,
                type: meta.type,
                caption: meta.caption,
                restrict: meta.restrict,
                xRestrict: meta.x_restrict,
                sanityLevel: meta.sanity_level,
                width: meta.width,
                height: meta.height,
                pageCount: meta.page_count,
                totalView: meta.total_view,
                totalBookmarks: meta.total_bookmarks,
                isBookmarked: meta.is_bookmarked,
                visible: meta.visible,
                isMuted: meta.is_muted,
                illustAiType: meta.illust_ai_type,
                illustBookStyle: meta.illust_book_style,
                tags: meta.tags,
                date: meta.date,
                category: meta.category,
                subcategory: meta.subcategory
            }).returning({ id: pixivIllusts.id });
            illustRecordId = illustResult[0].id;
        } else {
            return;
        }
    } else {
        illustRecordId = existingIllustForMedia.id;
        // Optimization: check existing tags
        const existingLinks = await db.select({ count: count() })
            .from(pixivIllustTags)
            .where(eq(pixivIllustTags.illustId, illustRecordId))
            .get() as { count: number };

        if (existingLinks && existingLinks.count > 0) {
            return;
        }
    }

    // Process Tags
    if (meta.tags && Array.isArray(meta.tags)) {
        for (const rawTag of meta.tags) {
            let tagName: string;
            if (typeof rawTag === 'string') {
                tagName = rawTag.trim();
            } else if (rawTag && typeof rawTag === 'object' && 'name' in rawTag) {
                tagName = String(rawTag.name).trim();
            } else {
                continue;
            }

            if (!tagName || tagName === '[object Object]') continue;

            let tagId: number;
            const existingTag = await db.select({ id: tags.id })
                .from(tags)
                .where(eq(tags.name, tagName))
                .get();

            if (existingTag) {
                tagId = existingTag.id;
            } else {
                const newTag = await db.insert(tags).values({
                    name: tagName,
                    type: 'pixiv'
                }).returning({ id: tags.id });
                tagId = newTag[0].id;
            }

            await db.insert(pixivIllustTags).values({
                illustId: illustRecordId,
                tagId
            }).onConflictDoNothing();
        }
    }
}
