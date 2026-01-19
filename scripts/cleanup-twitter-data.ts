import fs from 'fs';
import path from 'path';

// CONFIGURATION
const DRY_RUN = true;
const BASE_DIR = path.join(process.cwd(), 'public', 'downloads', 'twitter');

function log(msg: string) {
    console.log(msg);
}

function error(msg: string) {
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

        // Skip if already an ID (all digits) - we still process its CONTENTS later, but we don't move the DIR.
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
            // Should not happen if regex check passed, but sanity check
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
            // Process the TARGET directory (which is the new location)
            processDirectoryContents(DRY_RUN ? fullPath : targetPath, userId);
        }
    }
}

function findUserIdInDir(dirPath: string): string | null {
    const files = fs.readdirSync(dirPath);
    const jsonFile = files.find(f => f.endsWith('.json'));

    if (!jsonFile) return null;

    try {
        const content = fs.readFileSync(path.join(dirPath, jsonFile), 'utf-8');
        const data = JSON.parse(content);

        if (data.user && data.user.id) return String(data.user.id);
        if (data.user_id) return String(data.user_id);
        if (data.author && data.author.id) return String(data.author.id);
    } catch (e) {
        error(`Failed to parse ${jsonFile}: ${e}`);
    }
    return null;
}

function moveDirectoryContents(srcDir: string, destDir: string) {
    const files = fs.readdirSync(srcDir);
    for (const file of files) {
        const srcFile = path.join(srcDir, file);
        const destFile = path.join(destDir, file);

        if (fs.existsSync(destFile)) {
            // If we're merging, and file exists, we generally assume the existing one in target ID dir is "better" or equal.
            // But let's check if they are identical? No, simple overwrite or skip.
            // gallery-dl skips if file exists usually. 
            // We will DELETE the source file to effectively "merge" (discarding the duplicate source)
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

function processDirectoryContents(dirPath: string, userId: string) {
    // This function renames metadata files to {tweet_id}.json
    const files = fs.readdirSync(dirPath);

    for (const file of files) {
        if (!file.endsWith('.json')) continue;

        // Check if matches old pattern: {tweetid}_{imgindex}.{ext}.json OR {tweetid}_{imgindex}.json
        // Actually user said: "{tweetid}_{imgindex}.{extention}.json"

        // Regex to capture tweetID. 
        // We assume TweetID is all digits.
        // Example: 123456789_0.jpg.json -> 123456789.json

        const match = file.match(/^(\d+)_(\d+)\..+\.json$/);

        if (match) {
            const tweetId = match[1];
            const newName = `${tweetId}.json`;
            const fullOldPath = path.join(dirPath, file);
            const fullNewPath = path.join(dirPath, newName);

            if (file === newName) continue; // Already correct (unlikely given regex)

            if (fs.existsSync(fullNewPath)) {
                // We have multiple metadata files for the same tweet (one per image maybe?)
                // Since they are identical metadata usually (just duplicated for each image), we can keep one and delete others.
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

// Helper to determine if we should keep the new file or old one? 
// Actually if {tweetid}.json exists, it's likely the canonical one we want.
// The "bad" ones are {tweetid}_{imgindex}.jpg.json.
// If {tweetid}.json exists, we can safely remove the specific image json variants as they contain the same info usually.
function shouldKeep(oldFile: string, newFile: string): boolean {
    return false; // Always prefer the simple name, so delete the complex one
}

main();
