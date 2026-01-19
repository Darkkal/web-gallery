const fs = require('fs');

try {
    const Database = require('better-sqlite3');
    const db = new Database('sqlite.db');

    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    let output = 'Tables: ' + JSON.stringify(tables.map(t => t.name)) + '\n';

    const repairRuns = tables.find(t => t.name === 'repair_runs');
    if (repairRuns) {
        output += 'repair_runs table EXISTS\n';
        const columns = db.prepare("PRAGMA table_info(repair_runs)").all();
        output += 'Columns: ' + JSON.stringify(columns.map(c => c.name)) + '\n';
    } else {
        output += 'repair_runs table MISSING\n';
    }

    fs.writeFileSync('db-check-output.txt', output);
} catch (e) {
    fs.writeFileSync('db-check-error.txt', 'Error: ' + e.message + '\nStack: ' + e.stack);
}
