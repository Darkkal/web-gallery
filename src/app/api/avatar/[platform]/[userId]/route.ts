
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import { db } from '@/lib/db';
import { twitterUsers, pixivUsers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { avatarRequestQueue } from '@/lib/request-queue';
import { Readable } from 'stream';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ platform: string; userId: string }> }
) {
    const { platform, userId } = await params;

    if (!['twitter', 'pixiv'].includes(platform)) {
        return new NextResponse('Invalid platform', { status: 400 });
    }

    const AVATAR_DIR = path.join(process.cwd(), 'public', 'avatars');
    const platformDir = path.join(AVATAR_DIR, platform);

    // 1. Check if local file exists
    let existingFile: string | undefined;
    try {
        await fsPromises.mkdir(platformDir, { recursive: true });
        const files = await fsPromises.readdir(platformDir);
        existingFile = files.find(f => f.startsWith(userId + '.'));
    } catch (e) {
        console.error("[API] Avatar dir error:", e);
    }

    if (existingFile) {
        return serveLocalFile(path.join(platformDir, existingFile));
    }

    // 2. Not found, fetch URL from DB
    let avatarUrl: string | null = null;

    if (platform === 'twitter') {
        const user = await db.select({ profileImage: twitterUsers.profileImage })
            .from(twitterUsers)
            .where(eq(twitterUsers.id, userId))
            .get();
        if (user) avatarUrl = user.profileImage;
    } else if (platform === 'pixiv') {
        const user = await db.select({ profileImage: pixivUsers.profileImage })
            .from(pixivUsers)
            .where(eq(pixivUsers.id, userId))
            .get();
        if (user) avatarUrl = user.profileImage;
    }

    if (!avatarUrl) {
        return new NextResponse('User not found or no avatar URL', { status: 404 });
    }

    // 3. Download with Rate Limiting
    try {
        if (!avatarUrl.startsWith('http')) {
            console.warn(`[API] Invalid or non-remote URL for ${platform}/${userId}. DB value: ${avatarUrl}`);
            return new NextResponse(`Avatar not found and no remote URL available`, { status: 404 });
        }

        // Validate URL
        try {
            const parsedUrl = new URL(avatarUrl);
            if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
                throw new Error('Invalid protocol');
            }
        } catch {
            return new NextResponse('Invalid Avatar URL', { status: 400 });
        }

        // Path Traversal Protection
        if (!/^[a-zA-Z0-9_-]+$/.test(userId)) {
            return new NextResponse('Invalid User ID', { status: 400 });
        }

        let downloadedPath: string | null = null;

        await avatarRequestQueue.enqueue(async () => {
            const headers: Record<string, string> = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            };
            if (platform === 'pixiv') headers['Referer'] = 'https://www.pixiv.net/';

            const response = await fetch(avatarUrl!, { headers, signal: request.signal });
            if (!response.ok) {
                throw new Error(`Failed to fetch remote avatar: ${response.status} ${response.statusText}`);
            }

            const buffer = await response.arrayBuffer();

            let ext = path.extname(avatarUrl!).split('?')[0] || '.jpg';
            if (ext === '.' || ext.length > 5) ext = '.jpg';

            const fname = `${userId}${ext}`;
            const localPath = path.join(platformDir, fname);

            await fsPromises.writeFile(localPath, Buffer.from(buffer));
            downloadedPath = localPath;
        }, request.signal);

        if (downloadedPath) {
            return serveLocalFile(downloadedPath);
        } else {
            return new NextResponse('Download failed', { status: 502 });
        }

    } catch (e: unknown) {
        const err = e as Error;
        if (err.message === 'Aborted' || request.signal.aborted) {
            return new NextResponse('Aborted', { status: 503 });
        }
        console.error(`[API] Avatar download failed for ${userId}:`, err);
        return new NextResponse(`Internal Server Error: ${err.message}`, { status: 500 });
    }
}

function serveLocalFile(filePath: string) {
    const stat = fs.statSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    let contentType = 'image/jpeg';
    if (ext === '.png') contentType = 'image/png';
    else if (ext === '.gif') contentType = 'image/gif';
    else if (ext === '.webp') contentType = 'image/webp';

    const fileStream = fs.createReadStream(filePath);
    const webStream = Readable.toWeb(fileStream) as ReadableStream;

    return new NextResponse(webStream, {
        headers: {
            'Content-Type': contentType,
            'Content-Length': stat.size.toString(),
            'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
        }
    });
}
