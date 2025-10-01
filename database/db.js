const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'juridisch_leercentrum.db');
const db = new sqlite3.Database(dbPath);

// Initialize database
const initSQL = fs.readFileSync(path.join(__dirname, 'init.sql'), 'utf8');
db.exec(initSQL, (err) => {
    if (err) {
        console.error('Error initializing database:', err);
    } else {
        console.log('✅ Database initialized successfully');
    }
});

module.exports = db;