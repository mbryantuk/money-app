// server/database.js
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const DBNAME = './finance.db';
const db = new sqlite3.Database(DBNAME);

// Enable Foreign Keys
db.get("PRAGMA foreign_keys = ON");

db.serialize(() => {
    // --- 1. Identity & Access Management (IAM) ---

    // Users: Global list of people
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        is_sysadmin INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Households: The "Tenants"
    db.run(`CREATE TABLE IF NOT EXISTS households (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Membership: Links Users to Households with a Role
    db.run(`CREATE TABLE IF NOT EXISTS household_members (
        user_id INTEGER NOT NULL,
        household_id INTEGER NOT NULL,
        role TEXT CHECK(role IN ('Admin', 'User', 'Viewer')) NOT NULL DEFAULT 'User',
        PRIMARY KEY (user_id, household_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE
    )`);

    // --- 2. Finance Data (Scoped by Household) ---

// --- 4. Family Management ---
    
db.run(`CREATE TABLE IF NOT EXISTS family_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    household_id INTEGER NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    dob TEXT, -- Format: YYYY-MM-DD
    relationship TEXT,
    is_resident INTEGER DEFAULT 1, -- 1 = Inside, 0 = Outside
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE
)`);
// --- 5. Insurance Management ---

db.run(`CREATE TABLE IF NOT EXISTS insurance_policies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    household_id INTEGER NOT NULL,
    company_name TEXT NOT NULL,
    policy_number TEXT,
    total_cost REAL DEFAULT 0, -- Annual or full term cost
    monthly_cost REAL DEFAULT 0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE
)`);

db.run(`CREATE TABLE IF NOT EXISTS policy_attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    policy_id INTEGER NOT NULL,
    file_name TEXT NOT NULL, -- Original name (e.g. "policy.pdf")
    stored_name TEXT NOT NULL, -- System name (e.g. "12345-policy.pdf")
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (policy_id) REFERENCES insurance_policies(id) ON DELETE CASCADE
)`);
    // Example: Monthly Balances (Updated to include household_id)
    db.run(`CREATE TABLE IF NOT EXISTS monthly_balances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        household_id INTEGER NOT NULL,
        month TEXT NOT NULL,
        amount REAL DEFAULT 0,
        salary REAL DEFAULT 0,
        notes TEXT,
        UNIQUE(household_id, month),
        FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE
    )`);

    // --- 3. Seed Default Sysadmin (Change password in production!) ---
    const createSysAdmin = async () => {
        const hash = await bcrypt.hash('admin123', 10);
        db.run(`INSERT OR IGNORE INTO users (username, password_hash, is_sysadmin) VALUES (?, ?, 1)`, ['sysadmin', hash]);
    };
    createSysAdmin();
});

module.exports = db;