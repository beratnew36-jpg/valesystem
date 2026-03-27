const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./vale.db");

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id TEXT PRIMARY KEY,
      plate TEXT,
      location TEXT,
      status TEXT,
      checkin_time TEXT,
      checkout_time TEXT
    )
  `);
});

module.exports = db;