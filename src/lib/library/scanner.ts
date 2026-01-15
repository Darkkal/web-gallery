import fs from 'fs';
import path from 'path';
import { db } from '@/lib/db';
import { mediaItems, twitterUsers, twitterTweets } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

const DOWNLOAD_DIR = path.join(process.cwd(), 'public', 'downloads');

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

    // Group files by directory + basename (without extension)
    // Key: "relative/path/to/basename" -> { media: path?, json: path? }
    const fileGroups = new Map<string, { media?: string, json?: string, absPath: string }>();

    allFiles.forEach(absPath => {
        const ext = path.extname(absPath).toLowerCase();
        const dir = path.dirname(absPath);
        const basename = path.basename(absPath, ext);
        // Use relative path for key to be safe across systems
        const relDir = path.relative(DOWNLOAD_DIR, dir);
        const key = path.join(relDir, basename);

        if (!fileGroups.has(key)) {
            fileGroups.set(key, { absPath: absPath }); // store one absPath for reference
        }
        const group = fileGroups.get(key)!;

        if (ext === '.json') {
            group.json = absPath;
        } else {
            // Assume it's media if it's not json (and not other ignored types if any)
            // We can check exact extensions if needed, but keeping it broad for now
            if (['.mp4', '.webm', '.mkv', '.mp3', '.wav', '.m4a', '.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
                group.media = absPath;
            }
        }
    });

    const processedPaths = new Set<string>();

    // Process groups
    for (const [key, group] of fileGroups) {
        if (!group.media) continue; // Skip if no media file (e.g. orphan json)

        const relativePath = path.relative(path.join(process.cwd(), 'public'), group.media);
        const urlPath = '/' + relativePath.split(path.sep).join('/');
        processedPaths.add(urlPath);

        const existing = await db.query.mediaItems.findFirst({
            where: eq(mediaItems.filePath, urlPath),
        });

        // Prepare metadata fields
        let title = path.basename(group.media);
        let description = null;
        let originalUrl = null;
        let capturedAt = new Date(); // Default to now if not found, or file mtime?
        let metadataJson = null;

        if (group.json) {
            try {
                const jsonContent = fs.readFileSync(group.json, 'utf-8');
                const meta = JSON.parse(jsonContent);
                metadataJson = jsonContent;

                // Extract common fields (gallery-dl / yt-dlp patterns)
                // gallery-dl: author?.name, content, date, etc.
                // yt-dlp: title, description, upload_date

                if (meta.title) title = meta.title;
                // tweet_id fallback for title if twitter
                if (meta.tweet_id && !meta.title) title = `Tweet ${meta.tweet_id}`;

                if (meta.description) description = meta.description;
                if (!description && meta.content) description = meta.content; // twitter content

                // Date parsing
                if (meta.date) capturedAt = new Date(meta.date);
                else if (meta.upload_date) {
                    // yt-dlp often uses YYYYMMDD
                    const d = meta.upload_date;
                    if (d.length === 8) {
                        const year = parseInt(d.substring(0, 4));
                        const month = parseInt(d.substring(4, 6)) - 1;
                        const day = parseInt(d.substring(6, 8));
                        capturedAt = new Date(year, month, day);
                    }
                }

                // Original URL
                // gallery-dl often puts it in nothing standard, maybe we can construct it or find it
                // specific extractors might have 'post_url' or similar?
                // For now, let's look for known fields
            } catch (e) {
                console.error(`Failed to parse metadata for ${group.media}`, e);
            }
        } else {
            // If no metadata file, maybe use file creation time?
            const stat = fs.statSync(group.media);
            capturedAt = stat.mtime;
        }

        // Determine type
        const ext = path.extname(group.media).toLowerCase();
        let type: 'image' | 'video' | 'audio' | 'text' = 'image';
        if (['.mp4', '.webm', '.mkv'].includes(ext)) type = 'video';
        if (['.mp3', '.wav', '.m4a'].includes(ext)) type = 'audio';

        if (!existing) {
            const newItem = await db.insert(mediaItems).values({
                filePath: urlPath,
                mediaType: type,
                title,
                description,
                originalUrl,
                capturedAt,
                metadata: metadataJson,
            }).returning();

            // Handle Twitter Metadata
            if (metadataJson && (
                (metadataJson.includes('"tweet_id"') || metadataJson.includes('"extractor": "twitter"'))
            )) {
                try {
                    const meta = JSON.parse(metadataJson);
                    const isTwitter = meta.category === 'twitter' || meta.extractor_key === 'Twitter' || meta.extractor === 'twitter' || (meta.tweet_id !== undefined);

                    if (isTwitter) {
                        // 1. Upsert User
                        const userObj = meta.user || meta.author || {};
                        const userId = userObj.id || meta.user_id || meta.uploader_id;

                        if (userId) {
                            const existingUser = await db.query.twitterUsers.findFirst({
                                where: eq(twitterUsers.id, String(userId))
                            });

                            const userData = {
                                id: String(userId),
                                name: userObj.name || meta.uploader,
                                nick: userObj.nick,
                                location: userObj.location,
                                date: userObj.date,
                                verified: userObj.verified,
                                protected: userObj.protected,
                                profileBanner: userObj.profile_banner,
                                profileImage: userObj.profile_image,
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

                        // 2. Insert Tweet
                        const tweetId = meta.tweet_id || meta.id;
                        if (tweetId) {
                            // We insert a new row for this media item, linking it to the tweet info.
                            await db.insert(twitterTweets).values({
                                tweetId: String(tweetId),
                                mediaItemId: newItem[0].id,
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
                } catch (e) {
                    console.error("Error processing twitter metadata", e);
                }
            }

        } else {
            // Update existing items
            if (!existing.metadata && metadataJson) {
                await db.update(mediaItems).set({
                    title,
                    description,
                    originalUrl,
                    capturedAt,
                    metadata: metadataJson
                }).where(eq(mediaItems.id, existing.id));
            }

            // Backfill Twitter Metadata if needed
            // Check if we have metadata but no twitter entry
            // Backfill Twitter Metadata if needed
            if (metadataJson) {
                try {
                    const meta = JSON.parse(metadataJson);
                    const isTwitter = meta.category === 'twitter' || meta.extractor_key === 'Twitter' || meta.extractor === 'twitter' || (meta.tweet_id !== undefined);

                    if (isTwitter) {
                        const existingTweetForMedia = await db.query.twitterTweets.findFirst({
                            where: eq(twitterTweets.mediaItemId, existing.id)
                        });

                        if (!existingTweetForMedia) {
                            // 1. Upsert User
                            const userObj = meta.user || meta.author || {};
                            const userId = userObj.id || meta.user_id || meta.uploader_id;

                            if (userId) {
                                const existingUser = await db.query.twitterUsers.findFirst({
                                    where: eq(twitterUsers.id, String(userId))
                                });

                                const userData = {
                                    id: String(userId),
                                    name: userObj.name || meta.uploader,
                                    nick: userObj.nick,
                                    location: userObj.location,
                                    date: userObj.date,
                                    verified: userObj.verified,
                                    protected: userObj.protected,
                                    profileBanner: userObj.profile_banner,
                                    profileImage: userObj.profile_image,
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

                            // 2. Insert Tweet
                            const tweetId = meta.tweet_id || meta.id;
                            if (tweetId) {
                                await db.insert(twitterTweets).values({
                                    tweetId: String(tweetId),
                                    mediaItemId: existing.id,
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
                } catch (e) {
                    // ignore parse error or non-json
                    console.error("Backfill error", e);
                }
            }
        }
    }

    // Cleanup phase: Delete database items that no longer exist on disk
    // We only care about mediaItems, not the json files (which we don't store as separate items anymore)

    // Fetch all DB items
    const allDbItems = await db.query.mediaItems.findMany();

    for (const item of allDbItems) {
        if (!processedPaths.has(item.filePath)) {
            // Double check if file really doesn't exist (maybe processedPaths logic has a bug)
            // But processedPaths comes from walking the disk right now.
            // If it's a text file (old metadata files), we should definitely delete it as we filtered them out of processing loop

            console.log(`Removing missing item: ${item.filePath}`);
            await db.delete(mediaItems).where(eq(mediaItems.id, item.id));
        }
    }
}
