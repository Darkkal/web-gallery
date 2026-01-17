
import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
    console.log('Cleaning up duplicate pixiv_illust_tags...');

    // SQLite specific query to keep only 1 of duplicates
    await db.run(sql`
        DELETE FROM pixiv_illust_tags 
        WHERE rowid NOT IN (
            SELECT min(rowid) 
            FROM pixiv_illust_tags 
            GROUP BY illust_id, tag_id
        )
    `);

    console.log('Done.');
}

main().catch(console.error);
