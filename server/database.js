const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./finance.db');

db.serialize(() => {
    // 1. Core Tables
    // Note: We use 'amount' for the balance to maintain compatibility with your existing data
    db.run(`CREATE TABLE IF NOT EXISTS monthly_balances (month TEXT PRIMARY KEY, amount REAL DEFAULT 0, salary REAL DEFAULT 0)`);
    
    // 2. Migration: Safely add 'salary' column
    // We provide a callback function (err) => { ... } to handle the error if the column already exists.
    db.run("ALTER TABLE monthly_balances ADD COLUMN salary REAL DEFAULT 0", (err) => {
        if (err && !err.message.includes("duplicate column name")) {
            console.error("Migration Error:", err.message);
        }
    });

    db.run(`CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        amount REAL,
        paid INTEGER DEFAULT 0,
        category TEXT,
        who TEXT, 
        month TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS savings (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, amount REAL)`);

    db.run(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`);

    db.run(`CREATE TABLE IF NOT EXISTS expense_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        amount REAL,
        category TEXT,
        who TEXT
    )`);

    // Seed Settings
    const seedSettings = [
        { key: 'default_salary', value: '2500' },
        { key: 'categories', value: JSON.stringify(['Housing', 'Utilities', 'Food', 'Insurance', 'Subscription', 'Mobile', 'Savings', 'Spending', 'Medical', 'Tax']) },
        { key: 'people', value: JSON.stringify(['Joint', 'f1', 'f2', 's', 'Matt']) }
    ];

    const stmt = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
    seedSettings.forEach(setting => {
        stmt.run(setting.key, setting.value);
    });
    stmt.finalize();
});

module.exports = db;