const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./finance.db');

db.serialize(() => {
    console.log("🏦 Setting up Savings Architecture...");

    // 1. Create Accounts Table (e.g., "Chase", "Barclays")
    db.run(`CREATE TABLE IF NOT EXISTS savings_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT
    )`);

    // 2. Create Pots Table (e.g., "Holiday", "Car") linked to an Account
    db.run(`CREATE TABLE IF NOT EXISTS savings_pots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER,
        name TEXT,
        amount REAL DEFAULT 0,
        FOREIGN KEY(account_id) REFERENCES savings_accounts(id) ON DELETE CASCADE
    )`);

    console.log("✅ Savings tables created.");
});