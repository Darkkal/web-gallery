
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs, { promises as fsPromises } from 'fs';
import { db } from '@/lib/db';
import { twitterUsers, pixivUsers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { avatarRequestQueue } from '@/lib/request-queue';

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
    // We don't know the extension, so we have to search or try common ones.
    // Or we can just look for files starting with userId.
    try {
        await fsPromises.mkdir(platformDir, { recursive: true });
        const files = await fsPromises.readdir(platformDir);
        const existingFile = files.find(f => f.startsWith(userId + '.'));

        if (existingFile) {
            return NextResponse.redirect(new URL(`/avatars/${platform}/${existingFile}`, request.url));
        }
    } catch (e) {
        console.error("Avatar dir error:", e);
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
        // Fallback or 404? 
        // Return 404 for now, or maybe a default placeholder redirect?
        return new NextResponse('User not found or no avatar URL', { status: 404 });
    }

    // 3. Download with Rate Limiting
    try {
        if (!avatarUrl || !avatarUrl.startsWith('http')) {
            // If it's a legacy local path, we can try to redirect, but if the file is deleted, it's a 404.
            // If we don't have the remote URL, we can't recover.
            console.warn(`[API] No remote URL for ${platform}/${userId}. DB value: ${avatarUrl}`);
            return new NextResponse(`Avatar not found and no remote URL available`, { status: 404 });
        }

        let filename: string | null = null;

        // console.log(`[API] Queueing download for ${userId}: ${avatarUrl}`);

        await avatarRequestQueue.enqueue(async () => {
            const headers: Record<string, string> = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            };
            if (platform === 'pixiv') headers['Referer'] = 'https://www.pixiv.net/';

            // Pass signal to fetch
            const response = await fetch(avatarUrl!, { headers, signal: request.signal });
            if (!response.ok) {
                throw new Error('Failed to fetch remote avatar');
            }

            const buffer = await response.arrayBuffer();

            let ext = path.extname(avatarUrl!).split('?')[0] || '.jpg';
            if (ext === '.') ext = '.jpg';
            if (ext.length > 5) ext = '.jpg';

            const fname = `${userId}${ext}`;
            const localPath = path.join(platformDir, fname);

            await fsPromises.writeFile(localPath, Buffer.from(buffer));
            filename = fname;
        }, request.signal);

        if (filename) {
            return NextResponse.redirect(new URL(`/avatars/${platform}/${filename}`, request.url));
        } else {
            return new NextResponse('Download failed', { status: 502 });
        }

    } catch (e: any) {
        if (e.message === 'Aborted' || request.signal.aborted) {
            return new NextResponse('Aborted', { status: 503 });
        }
        console.error(`[API] Avatar download failed for ${userId}:`, e);
        return new NextResponse(`Internal Server Error: ${e.message}`, { status: 500 });
    }
}
