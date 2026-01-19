const Database = require('better-sqlite3');
const db = new Database('sqlite.db');

const sql = `
CREATE TABLE IF NOT EXISTS repair_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT DEFAULT 'twitter',
    start_time INTEGER NOT NULL, // timestamp
    end_time INTEGER, // timestamp
    status TEXT NOT NULL,
    files_checked INTEGER DEFAULT 0,
    files_repaired INTEGER DEFAULT 0,
    errors INTEGER DEFAULT 0,
    current_path TEXT
);
`;

try {
    db.prepare(sql).run();
    console.log('Successfully created repair_runs table');
    const fs = require('fs');
    fs.writeFileSync('create-table.log', 'Success');
} catch (e) {
    console.error('Failed to create table:', e);
    const fs = require('fs');
    fs.writeFileSync('create-table.log', 'Error: ' + e.message);
}
