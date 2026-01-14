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
    const fileSet = new Set<string>();

    // 1. Process files on disk and prepare for comparison
    const filesOnDisk = files.map(absPath => {
        const relativePath = path.relative(path.join(process.cwd(), 'public'), absPath);
        const urlPath = '/' + relativePath.split(path.sep).join('/');
        fileSet.add(urlPath);
        return { absPath, urlPath };
    });

    // 2. Fetch existing media items
    const existingItems = await db.query.mediaItems.findMany();
    const existingUrlSet = new Set(existingItems.map((i: typeof mediaItems.$inferSelect) => i.filePath));

    // 3. Identify and Delete removed files
    const itemsToDelete = existingItems.filter((item: typeof mediaItems.$inferSelect) => !fileSet.has(item.filePath));

    if (itemsToDelete.length > 0) {
        console.log(`Deleting ${itemsToDelete.length} missing items...`);
        for (const item of itemsToDelete) {
            await db.delete(mediaItems).where(eq(mediaItems.id, item.id));
        }
    }

    // 4. Identify and Add new files
    for (const { absPath, urlPath } of filesOnDisk) {
        if (!existingUrlSet.has(urlPath)) {
            // Simple type inference
            const ext = path.extname(absPath).toLowerCase();
            let type: 'image' | 'video' | 'audio' | 'text' = 'image';
            if (['.mp4', '.webm', '.mkv'].includes(ext)) type = 'video';
            if (['.mp3', '.wav', '.m4a'].includes(ext)) type = 'audio';
            if (['.json', '.txt', '.md'].includes(ext)) type = 'text';

            await db.insert(mediaItems).values({
                filePath: urlPath,
                mediaType: type,
                title: path.basename(absPath),
            });
        }
    }
}
