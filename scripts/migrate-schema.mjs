import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'sqlite.db');
const db = new Database(dbPath);

console.log('Applying schema changes...');

// Create scrape_history table
db.exec(`
  CREATE TABLE IF NOT EXISTS scrape_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER NOT NULL,
    start_time INTEGER NOT NULL,
    end_time INTEGER,
    status TEXT NOT NULL,
    files_downloaded INTEGER DEFAULT 0,
    bytes_downloaded INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    average_speed INTEGER DEFAULT 0,
    FOREIGN KEY (source_id) REFERENCES sources(id)
  );
`);

console.log('✓ Created scrape_history table');

// Remove lastScrapedAt column from sources table if it exists
try {
    // SQLite doesn't support DROP COLUMN directly, so we need to recreate the table
    // First, check if the column exists
    const tableInfo = db.prepare("PRAGMA table_info(sources)").all();
    const hasLastScrapedAt = tableInfo.some((col) => col.name === 'last_scraped_at');

    if (hasLastScrapedAt) {
        console.log('Removing last_scraped_at column from sources table...');

        // Create new table without last_scraped_at
        db.exec(`
      CREATE TABLE sources_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL,
        type TEXT DEFAULT 'unknown',
        name TEXT,
        created_at INTEGER
      );
    `);

        // Copy data
        db.exec(`
      INSERT INTO sources_new (id, url, type, name, created_at)
      SELECT id, url, type, name, created_at FROM sources;
    `);

        // Drop old table
        db.exec('DROP TABLE sources;');

        // Rename new table
        db.exec('ALTER TABLE sources_new RENAME TO sources;');

        console.log('✓ Removed last_scraped_at column from sources table');
    } else {
        console.log('✓ sources table already up to date (no last_scraped_at column)');
    }
} catch (error) {
    console.error('Error updating sources table:', error);
    console.log('This might be okay if the column was already removed.');
}

db.close();
console.log('\n✅ Database schema updated successfully!');
