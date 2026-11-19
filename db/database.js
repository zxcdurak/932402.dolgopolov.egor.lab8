const path = require("node:path");
const fs = require("node:fs");
const Database = require("better-sqlite3");

const file = process.env.DB_PATH || path.join(__dirname, "..", "data", "contacts.db");
if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });

const db = new Database(file);
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS contacts (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    phone     TEXT,
    email     TEXT,
    notes     TEXT
  )
`);

module.exports = db;
