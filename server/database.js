const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./finance.db');

db.serialize(() => {
    // --- CORE TABLES ---
    db.run(`CREATE TABLE IF NOT EXISTS monthly_balances (month TEXT PRIMARY KEY, amount REAL DEFAULT 0, salary REAL DEFAULT 0, notes TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS expenses (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, amount REAL, paid INTEGER DEFAULT 0, paid_at TEXT, category TEXT, who TEXT, month TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS savings (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, amount REAL)`);
    db.run(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS expense_templates (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, amount REAL, category TEXT, who TEXT)`);

    // --- SAVINGS POTS ---
    db.run(`CREATE TABLE IF NOT EXISTS savings_accounts (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS savings_pots (id INTEGER PRIMARY KEY AUTOINCREMENT, account_id INTEGER, name TEXT, amount REAL)`);

    // --- LIFESTYLE & FEATURES ---
    db.run(`CREATE TABLE IF NOT EXISTS birthdays (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, date TEXT, type TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS sandbox_expenses (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, amount REAL, category TEXT, who TEXT, paid INTEGER DEFAULT 0)`);
    db.run(`CREATE TABLE IF NOT EXISTS sandbox_profiles (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, salary REAL, items TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS christmas_list (id INTEGER PRIMARY KEY AUTOINCREMENT, recipient TEXT, item TEXT, amount REAL, bought INTEGER DEFAULT 0)`);
    
    // --- CREDIT CARDS ---
    db.run(`CREATE TABLE IF NOT EXISTS credit_cards (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, limit_amount REAL, interest_rate REAL, balance REAL)`);
    db.run(`CREATE TABLE IF NOT EXISTS cc_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, card_id INTEGER, date TEXT, description TEXT, amount REAL, category TEXT, paid INTEGER DEFAULT 0)`);
    
    // --- MEAL PLANNER ---
    db.run(`CREATE TABLE IF NOT EXISTS meals (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, description TEXT, tags TEXT, type TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS meal_plan (date TEXT PRIMARY KEY, meal_id INTEGER)`);

    // --- MIGRATIONS ---
    // Handle adding columns to existing tables safely
    const addColumn = (table, col) => {
        db.run(`ALTER TABLE ${table} ADD COLUMN ${col}`, (err) => {
            if (err && !err.message.includes("duplicate column name")) console.error(`Migration Error (${table}):`, err.message);
        });
    };

    addColumn("monthly_balances", "salary REAL DEFAULT 0");
    addColumn("monthly_balances", "notes TEXT");
    addColumn("expenses", "paid_at TEXT");
    addColumn("meals", "type TEXT");

    // --- SEED DATA ---
    const seedSettings = [
        { key: 'default_salary', value: '2500' },
        { key: 'categories', value: JSON.stringify(['Housing', 'Utilities', 'Food', 'Insurance', 'Subscription', 'Mobile', 'Savings', 'Spending', 'Medical', 'Tax']) },
        { key: 'people', value: JSON.stringify(['Joint', 'f1', 'f2', 's', 'Matt']) }
    ];

    const stmt = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
    seedSettings.forEach(setting => stmt.run(setting.key, setting.value));
    stmt.finalize();
});

module.exports = db;