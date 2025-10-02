// database/db.js
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// 1) Pak pad uit env of val terug op ./data/jlc.sqlite3
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'data', 'jlc.sqlite3');

// 2) Zorg dat de map bestaat
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

// 3) Open database
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ SQLite open error:', err.message);
  } else {
    console.log('✅ SQLite geopend op:', DB_PATH);
  }
});

// 4) Maak tabellen aan (zonder droppen) — alleen als ze nog niet bestaan
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'student',
      student_number TEXT UNIQUE,
      openai_api_key TEXT,
      is_active INTEGER DEFAULT 1,
      last_login DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS legal_cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      evidence TEXT,
      difficulty_level INTEGER DEFAULT 1,
      category TEXT DEFAULT 'algemeen',
      created_by INTEGER,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS user_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      case_id INTEGER NOT NULL,
      status TEXT NOT NULL,                   -- 'started' | 'completed' | 'failed'
      score INTEGER DEFAULT 0,
      time_spent INTEGER DEFAULT 0,           -- seconden
      conversation_log TEXT DEFAULT '[]',     -- JSON string
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(case_id) REFERENCES legal_cases(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      achievement_type TEXT NOT NULL,
      achievement_name TEXT NOT NULL,
      description TEXT,
      earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, achievement_type),      -- voorkom dubbele badges
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  console.log('🧱 Tabellen gecontroleerd/aangemaakt (IF NOT EXISTS).');
});

module.exports = db;
