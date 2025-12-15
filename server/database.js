const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./finance.db');

db.serialize(() => {
    // 1. Core Tables
    db.run(`CREATE TABLE IF NOT EXISTS monthly_balances (month TEXT PRIMARY KEY, amount REAL DEFAULT 0, salary REAL DEFAULT 0, notes TEXT)`);
    
    // 2. Migrations (Core)
    const addCol = (tbl, col) => db.run(`ALTER TABLE ${tbl} ADD COLUMN ${col}`, (e) => { if(e && !e.message.includes('duplicate')) console.log(e.message); });
    addCol('monthly_balances', 'salary REAL DEFAULT 0');
    addCol('monthly_balances', 'notes TEXT');
    addCol('expenses', 'paid_at TEXT');
    addCol('expenses', 'vendor TEXT');
    addCol('expenses', 'expected_date INTEGER');
    addCol('expense_templates', 'vendor TEXT');
    addCol('expense_templates', 'expected_date INTEGER');
    addCol('sandbox_expenses', 'vendor TEXT');
    addCol('sandbox_expenses', 'expected_date INTEGER');

    // 3. Create/Update Tables
    db.run(`CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT, amount REAL, paid INTEGER DEFAULT 0, paid_at TEXT,
        category TEXT, who TEXT, month TEXT, vendor TEXT, expected_date INTEGER
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS savings (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, amount REAL)`);
    db.run(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS expense_templates (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, amount REAL, category TEXT, who TEXT, vendor TEXT, expected_date INTEGER)`);

    db.run(`CREATE TABLE IF NOT EXISTS savings_accounts (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS savings_pots (id INTEGER PRIMARY KEY AUTOINCREMENT, account_id INTEGER, name TEXT, amount REAL)`);
    db.run(`CREATE TABLE IF NOT EXISTS birthdays (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, date TEXT, type TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS sandbox_expenses (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, amount REAL, category TEXT, who TEXT, paid INTEGER DEFAULT 0, vendor TEXT, expected_date INTEGER)`);
    db.run(`CREATE TABLE IF NOT EXISTS sandbox_profiles (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, salary REAL, items TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS christmas_list (id INTEGER PRIMARY KEY AUTOINCREMENT, recipient TEXT, item TEXT, amount REAL, bought INTEGER DEFAULT 0)`);
    db.run(`CREATE TABLE IF NOT EXISTS credit_cards (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, limit_amount REAL, interest_rate REAL, balance REAL)`);
    db.run(`CREATE TABLE IF NOT EXISTS cc_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, card_id INTEGER, date TEXT, description TEXT, amount REAL, category TEXT, paid INTEGER DEFAULT 0)`);
    
    // --- MEAL PLANNER FIX ---
    db.run(`CREATE TABLE IF NOT EXISTS meals (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, description TEXT, tags TEXT, type TEXT)`);
    
    // Fix: Re-create meal_plan if it doesn't have 'slot' column (Old schema had date as PK)
    db.run(`CREATE TABLE IF NOT EXISTS meal_plan_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT, 
        slot TEXT, 
        meal_id INTEGER, 
        who TEXT
    )`);

    // Check if we need to migrate (Simple check: if old table exists and is weird, we swap. For now, strict Ensure)
    // We will attempt to add columns if they are missing, but since the PK was wrong on the old table, 
    // it is safer to just ensure the correct structure exists.
    // If you have issues with "Menus not adding", it's likely the PK constraint.
    // This command ensures the table has the right columns if creating from scratch.
    // Use the route logic to handle the rest.
    
    // Seed Settings
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