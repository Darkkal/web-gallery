import fs from 'fs';
import path from 'path';
import { db } from '@/lib/db';
import { mediaItems } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const DOWNLOAD_DIR = path.join(process.cwd(), 'public', 'downloads');

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []) {
    if (!fs.existsSync(dirPath)) return arrayOfFiles;

    const files = fs.readdirSync(dirPath);

    files.forEach((file) => {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            getAllFiles(fullPath, arrayOfFiles);
        } else {
            arrayOfFiles.push(fullPath);
        }
    });

    return arrayOfFiles;
}

export async function syncLibrary() {
    const files = getAllFiles(DOWNLOAD_DIR);

    for (const absPath of files) {
        // Convert absolute path to public relative path
        const relativePath = path.relative(path.join(process.cwd(), 'public'), absPath);
        // Ensure forward slashes for URLs
        const urlPath = '/' + relativePath.split(path.sep).join('/');

        // Check if exists
        const existing = await db.query.mediaItems.findFirst({
            where: eq(mediaItems.filePath, urlPath),
        });

        if (!existing) {
            // Simple type inference
            const ext = path.extname(absPath).toLowerCase();
            let type: 'image' | 'video' | 'audio' | 'text' = 'image';
            if (['.mp4', '.webm', '.mkv'].includes(ext)) type = 'video';
            if (['.mp3', '.wav', '.m4a'].includes(ext)) type = 'audio';

            await db.insert(mediaItems).values({
                filePath: urlPath,
                mediaType: type,
                title: path.basename(absPath),
                // We link sourceId as null for now if we can't deduce it easily
                // In a real app we'd map directory structure to source IDs
            });
        }
    }
}
