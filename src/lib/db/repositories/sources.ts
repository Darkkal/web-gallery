import { db } from '@/lib/db';
import { sources, scrapeHistory, posts, mediaItems, gallerydlExtractorTypes } from '@/lib/db/schema';
import { eq, desc, isNull, and } from 'drizzle-orm';
import path from 'path';
import fs from 'fs/promises';

export async function addSource(url: string, name?: string) {
    let isLocal = false;
    let type: 'twitter' | 'pixiv' | 'gallery-dl' | 'local' | 'gelbooruv02' = 'gallery-dl';

    const isWebUrl = url.startsWith('http://') || url.startsWith('https://');

    if (!isWebUrl) {
        try {
            if (url.includes('\0')) throw new Error("Invalid path characters");

            const stat = await fs.stat(url);
            if (stat.isDirectory()) {
                isLocal = true;
                type = 'local';

                const resolved = path.resolve(url);
                const { root } = path.parse(resolved);
                if (resolved === root || resolved === path.resolve('/')) {
                    throw new Error("Cannot add root directory as source.");
                }
                const blocked = ['/etc', '/var', '/bin', '/usr', 'C:\\Windows', 'C:\\Program Files'];
                for (const b of blocked) {
                    if (resolved.startsWith(path.resolve(b))) {
                        throw new Error("Cannot add system directory as source.");
                    }
                }
            }
        } catch {
            // Not a local path or doesn't exist
        }
    }

    if (!isLocal) {
        try {
            const parsed = new URL(url);
            const hostname = parsed.hostname.toLowerCase();

            if (hostname === 'twitter.com' || hostname === 'www.twitter.com' || hostname === 'x.com' || hostname === 'www.x.com') {
                type = 'twitter';
            } else if (hostname === 'pixiv.net' || hostname === 'www.pixiv.net') {
                type = 'pixiv';
            } else if (hostname.endsWith('gelbooru.com') || hostname.endsWith('safebooru.org')) {
                type = 'gelbooruv02';
            }
        } catch {
            // Treat as generic gallery-dl
        }
    }

    await db.insert(gallerydlExtractorTypes).values({ id: type }).onConflictDoNothing().run();

    await db.insert(sources).values({
        url,
        extractorType: type,
        name: name || (isLocal ? path.basename(url) : url),
    });
}

export async function updateSource(id: number, updates: { url?: string; name?: string }) {
    if (!updates.url && !updates.name) return;

    await db.update(sources)
        .set({
            ...(updates.url ? { url: updates.url } : {}),
            ...(updates.name ? { name: updates.name } : {}),
        })
        .where(eq(sources.id, id))
        .run();
}

export async function getSources() {
    return await db.select().from(sources).where(isNull(sources.deletedAt));
}

export async function getSourceById(id: number) {
    return await db.query.sources.findFirst({
        where: and(eq(sources.id, id), isNull(sources.deletedAt)),
    });
}

export async function getSourcesWithHistory() {
    const allSources = await db.select().from(sources).where(isNull(sources.deletedAt));

    const sourcesWithData = await Promise.all(
        allSources.map(async (source) => {
            const recentHistory = await db
                .select()
                .from(scrapeHistory)
                .where(eq(scrapeHistory.sourceId, source.id))
                .orderBy(desc(scrapeHistory.startTime))
                .limit(1);

            let previewImage: string | null = null;
            const recentPost = await db.select({ id: posts.id })
                .from(posts)
                .where(eq(posts.internalSourceId, source.id))
                .orderBy(desc(posts.createdAt))
                .limit(1);

            if (recentPost.length > 0) {
                const media = await db.select({ filePath: mediaItems.filePath })
                    .from(mediaItems)
                    .where(and(
                        eq(mediaItems.postId, recentPost[0].id),
                        eq(mediaItems.mediaType, 'image')
                    ))
                    .limit(1);

                if (media.length > 0) {
                    previewImage = media[0].filePath;
                }
            }

            return {
                ...source,
                lastScrape: recentHistory[0] || null,
                previewImage,
            };
        })
    );

    return sourcesWithData;
}

export async function deleteSource(id: number) {
    const numericId = Number(id);
    if (isNaN(numericId)) {
        throw new Error(`Invalid source ID: ${id}`);
    }

    await db.update(sources)
        .set({ deletedAt: new Date() })
        .where(eq(sources.id, numericId))
        .run();
}
