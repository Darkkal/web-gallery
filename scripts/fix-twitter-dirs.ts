import fs from 'fs';
import path from 'path';

const BASE_DIR = path.join(process.cwd(), 'public', 'downloads', 'twitter');

function main() {
    if (!fs.existsSync(BASE_DIR)) {
        console.error(`Directory not found: ${BASE_DIR}`);
        return;
    }

    const entries = fs.readdirSync(BASE_DIR, { withFileTypes: true });

    for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const dirName = entry.name;
        // Check if already an ID (all digits)
        if (/^\d+$/.test(dirName)) {
            // console.log(`Skipping likely ID: ${dirName}`);
            continue;
        }

        const fullPath = path.join(BASE_DIR, dirName);

        // Find a JSON file
        try {
            const files = fs.readdirSync(fullPath);
            const jsonFile = files.find(f => f.endsWith('.json'));

            if (!jsonFile) {
                console.warn(`[WARN] No JSON file found in ${dirName}, skipping.`);
                continue;
            }

            const jsonContent = fs.readFileSync(path.join(fullPath, jsonFile), 'utf-8');
            const data = JSON.parse(jsonContent);

            // Try to find user ID
            let userId: string | null = null;
            if (data.user && data.user.id) {
                userId = String(data.user.id);
            } else if (data.user_id) {
                userId = String(data.user_id);
            } else if (data.author && data.author.id) {
                userId = String(data.author.id);
            }

            if (!userId) {
                console.warn(`[WARN] Could not find user ID in ${jsonFile} for ${dirName}`);
                continue;
            }

            const targetPath = path.join(BASE_DIR, userId);

            if (targetPath === fullPath) {
                console.log(`[INFO] Directory ${dirName} matches ID ${userId}, correctly named.`);
                continue;
            }

            if (fs.existsSync(targetPath)) {
                console.log(`[MERGE] Merging ${dirName} -> ${userId}`);
                // Move contents
                const sourceFiles = fs.readdirSync(fullPath);
                for (const file of sourceFiles) {
                    const srcFile = path.join(fullPath, file);
                    const destFile = path.join(targetPath, file);
                    try {
                        // If file exists, overwrite? Or skip? 
                        // Let's overwrite since it's likely the same file or a better version
                        if (fs.existsSync(destFile)) {
                            fs.unlinkSync(destFile);
                        }
                        fs.renameSync(srcFile, destFile);
                    } catch (e) {
                        console.error(`Failed to move ${file} from ${dirName} to ${userId}:`, e);
                    }
                }
                // Try to remove the now-empty source directory
                try {
                    fs.rmdirSync(fullPath);
                    console.log(`[DONE] Merged and removed ${dirName}`);
                } catch (e) {
                    console.error(`[WARN] Could not remove source dir ${dirName} (maybe not empty?):`, e);
                }

            } else {
                console.log(`[MOVE] Renaming ${dirName} -> ${userId}`);
                fs.renameSync(fullPath, targetPath);
            }

        } catch (error) {
            console.error(`[ERR] Error processing ${dirName}:`, error);
        }
    }
}

main();
