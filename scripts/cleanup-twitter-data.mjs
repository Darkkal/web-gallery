import fs from 'fs';
import path from 'path';

// CONFIGURATION
const DRY_RUN = false;
const BASE_DIR = path.join(process.cwd(), 'public', 'downloads', 'twitter');

function log(msg) {
    console.log(msg);
}

function error(msg) {
    console.error(msg);
}

function main() {
    log(`Starting Twitter Data Cleanup (DRY_RUN=${DRY_RUN})`);

    if (!fs.existsSync(BASE_DIR)) {
        error(`Directory not found: ${BASE_DIR}`);
        return;
    }

    const entries = fs.readdirSync(BASE_DIR, { withFileTypes: true });

    // 1. Process Directories (Rename/Merge)
    for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const dirName = entry.name;
        const fullPath = path.join(BASE_DIR, dirName);

        // Skip if already an ID (all digits) - but still process content
        if (/^\d+$/.test(dirName)) {
            processDirectoryContents(fullPath, dirName);
            continue;
        }

        // It's a non-ID directory (Author Name)
        log(`Processing Author Directory: ${dirName}`);

        // Scrape for ID to determine target
        const userId = findUserIdInDir(fullPath);

        if (!userId) {
            log(`[SKIP] No ID found in ${dirName} (Orphaned or no JSON). Leaving as is.`);
            continue;
        }

        const targetPath = path.join(BASE_DIR, userId);

        if (targetPath === fullPath) {
            processDirectoryContents(fullPath, userId);
            continue;
        }

        // Move/Merge Logic
        if (fs.existsSync(targetPath)) {
            log(`[MERGE] ${dirName} -> ${userId}`);
            moveDirectoryContents(fullPath, targetPath);
            // After move, try to remove old dir
            if (!DRY_RUN) {
                try {
                    fs.rmdirSync(fullPath);
                    log(`[DELETED] Old dir ${dirName}`);
                } catch (e) {
                    log(`[WARN] Could not delete empty dir ${dirName}: ${e}`);
                }
            }
            // Process the TARGET directory now that it has new files
            processDirectoryContents(targetPath, userId);
        } else {
            log(`[RENAME] ${dirName} -> ${userId}`);
            if (!DRY_RUN) {
                fs.renameSync(fullPath, targetPath);
            }
            // Process contents (target logic depends on dry run)
            processDirectoryContents(DRY_RUN ? fullPath : targetPath, userId);
        }
    }
}

function findUserIdInDir(dirPath) {
    const files = fs.readdirSync(dirPath);
    const jsonFile = files.find(f => f.endsWith('.json'));

    if (!jsonFile) return null;

    try {
        const content = fs.readFileSync(path.join(dirPath, jsonFile), 'utf-8');

        // Strategy: Regex Extraction to avoid precision loss with JSON.parse on large integers

        // 1. Check for "user": { ... "id": 12345 ... }
        // We use [^}]*? to ensure we stay within the object curly braces roughly
        let match = content.match(/"user"\s*:\s*\{[^}]*?"id"\s*:\s*(\d+)/);
        if (match) return match[1];

        // 2. Check for "author": { ... "id": 12345 ... }
        match = content.match(/"author"\s*:\s*\{[^}]*?"id"\s*:\s*(\d+)/);
        if (match) return match[1];

        // 3. Check for "user_id": 12345
        match = content.match(/"user_id"\s*:\s*(\d+)/);
        if (match) return match[1];

        // 4. Fallback: If "id_str" exists in standard places, our regex might have missed it if format is weird,
        // but id_str is usually quoted.
        // Let's explicitly check for id_str too just in case
        match = content.match(/"id_str"\s*:\s*"(\d+)"/);
        // This is risky as it finds ANY id_str (tweet id etc), so maybe skip this unless scoped.
        // Only safely return if we know it's the user ID. 
        // Standard JSON often puts tweet ID at top, so likely not what we want.

        // If regex fails, fallback to JSON.parse but warn
        // (If we reach here, either the format is very weird or ID is missing)
        const data = JSON.parse(content);

        if (data.user && data.user.id_str) return data.user.id_str;
        if (data.user && data.user.id) {
            // If we are here, regex failed to find "id" pattern, but JSON found it? 
            // That implies weird formatting (e.g. newlines inside key?). 
            // Return it but valid large integers will be rounded.
            return String(data.user.id);
        }

    } catch (e) {
        error(`Failed to parse ${jsonFile}: ${e}`);
    }
    return null;
}

function moveDirectoryContents(srcDir, destDir) {
    const files = fs.readdirSync(srcDir);
    for (const file of files) {
        const srcFile = path.join(srcDir, file);
        const destFile = path.join(destDir, file);

        if (fs.existsSync(destFile)) {
            log(`   [DUPLICATE] ${file} exists in target. Deleting source version.`);
            if (!DRY_RUN) {
                fs.unlinkSync(srcFile);
            }
        } else {
            log(`   [MOVE] ${file}`);
            if (!DRY_RUN) {
                fs.renameSync(srcFile, destFile);
            }
        }
    }
}

function processDirectoryContents(dirPath, userId) {
    // This function renames metadata files to {tweet_id}.json
    const files = fs.readdirSync(dirPath);

    for (const file of files) {
        if (!file.endsWith('.json')) continue;

        // Check if matches old pattern: {tweetid}_{imgindex}.{ext}.json OR {tweetid}_{imgindex}.json
        const match = file.match(/^(\d+)_(\d+)\..+\.json$/);

        if (match) {
            const tweetId = match[1];
            const newName = `${tweetId}.json`;
            const fullOldPath = path.join(dirPath, file);
            const fullNewPath = path.join(dirPath, newName);

            if (file === newName) continue;

            if (fs.existsSync(fullNewPath)) {
                if (!shouldKeep(fullOldPath, fullNewPath)) {
                    log(`   [DELETE REDUNDANT] ${file} (Target ${newName} exists)`);
                    if (!DRY_RUN) fs.unlinkSync(fullOldPath);
                }
            } else {
                log(`   [RENAME JSON] ${file} -> ${newName}`);
                if (!DRY_RUN) fs.renameSync(fullOldPath, fullNewPath);
            }
        }
    }
}

function shouldKeep(oldFile, newFile) {
    return false; // Always prefer the simple name
}

main();
