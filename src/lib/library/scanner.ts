import fs from 'fs';
import path from 'path';
import { db } from '@/lib/db';
import { mediaItems } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

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
            await db.insert(mediaItems).values({
                filePath: urlPath,
                mediaType: type,
                title,
                description,
                originalUrl,
                capturedAt,
                metadata: metadataJson,
            });
        } else {
            // Optional: Update existing items if we want to sync metadata changes?
            // For now, let's assume if it exists, it's good. 
            // BUT, user just complained about nulls. So we SHOULD update if nulls exist.
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
