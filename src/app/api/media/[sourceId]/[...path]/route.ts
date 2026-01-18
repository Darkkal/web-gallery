
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sources } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ sourceId: string; path: string[] }> }
) {
    const { sourceId, path: pathSegments } = await params;

    const id = parseInt(sourceId);
    if (isNaN(id)) {
        return new NextResponse('Invalid Source ID', { status: 400 });
    }

    // Fetch source
    const source = await db.query.sources.findFirst({
        where: and(eq(sources.id, id), isNull(sources.deletedAt))
    });

    if (!source || source.extractorType !== 'local') {
        return new NextResponse('Source not found or not local', { status: 404 });
    }

    // Construct Path
    // source.url is the root directory
    const relPath = pathSegments.join(path.sep);
    const fullPath = path.join(source.url, relPath);

    // SECURITY CHECK: Path Traversal
    const resolvedPath = path.resolve(fullPath);
    const resolvedRoot = path.resolve(source.url);

    if (!resolvedPath.startsWith(resolvedRoot)) {
        return new NextResponse('Forbidden: Path traversal detected', { status: 403 });
    }

    try {
        // Check existence
        if (!fs.existsSync(resolvedPath)) {
            return new NextResponse('File not found', { status: 404 });
        }

        const stat = fs.statSync(resolvedPath);
        if (!stat.isFile()) {
            return new NextResponse('Not a file', { status: 400 });
        }

        // Determine MIME
        const ext = path.extname(resolvedPath).toLowerCase();
        let contentType = 'application/octet-stream';

        switch (ext) {
            case '.jpg': case '.jpeg': contentType = 'image/jpeg'; break;
            case '.png': contentType = 'image/png'; break;
            case '.gif': contentType = 'image/gif'; break;
            case '.webp': contentType = 'image/webp'; break;
            case '.mp4': contentType = 'video/mp4'; break;
            case '.webm': contentType = 'video/webm'; break;
            case '.mkv': contentType = 'video/x-matroska'; break;
            case '.mp3': contentType = 'audio/mpeg'; break;
            case '.wav': contentType = 'audio/wav'; break;
            case '.m4a': contentType = 'audio/mp4'; break;
        }

        // Create Stream
        const fileStream = fs.createReadStream(resolvedPath);
        // Convert node stream to web stream for Next.js
        const webStream = Readable.toWeb(fileStream) as ReadableStream;

        return new NextResponse(webStream, {
            headers: {
                'Content-Type': contentType,
                'Content-Length': stat.size.toString(),
                'Cache-Control': 'public, max-age=31536000, immutable'
            }
        });

    } catch (e) {
        console.error("Error serving local media:", e);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
