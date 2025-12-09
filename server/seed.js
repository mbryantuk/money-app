const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./finance.db');

// Helper to get Year-Month string (e.g., "2025-12")
function getMonthString(offset) {
    const d = new Date();
    d.setMonth(d.getMonth() + offset);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
}

const months = [
    getMonthString(-1), // Last Month
    getMonthString(0),  // This Month
    getMonthString(1)   // Next Month
];

// 📋 THE EXACT MATCH LIST (Source: Feb 2025 Sheet)
const standardBills = [
    { name: "Mortgage", amount: -1268.67, category: "House", who: "Joint" },
    { name: "LifeInsurance/aviva", amount: -37.0, category: "Insurance", who: "Joint" },
    { name: "HouseInsurance - Tesco", amount: -39.0, category: "Insurance", who: "Joint" },
    { name: "TvLicence", amount: -15.0, category: "HouseBill", who: "Joint" },
    { name: "Gas/Electric", amount: -155.0, category: "HouseBill", who: "Joint" },
    { name: "pet insur", amount: -50.0, category: "Insurance", who: "s" },
    { name: "spotoify", amount: -20.0, category: "Subscription", who: "Joint" },
    { name: "rumpus food", amount: -55.0, category: "Savings", who: "s" },
    { name: "amazon", amount: -8.99, category: "Subscription", who: "Joint" },
    { name: "council tax", amount: -225.0, category: "HouseBill", who: "Joint" },
    { name: "water", amount: -13.0, category: "HouseBill", who: "Joint" },
    { name: "window clean", amount: -10.0, category: "HouseBill", who: "Joint" },
    { name: "water", amount: -31.5, category: "HouseBill", who: "Joint" },
    { name: "hp", amount: -1.5, category: "Subscription", who: "Joint" },
    { name: "DISHWASHER", amount: -5.0, category: "Insurance", who: "Joint" },
    { name: "money for month", amount: -800.0, category: "Francesca", who: "f1" },
    { name: "tesco mobiles", amount: -28.0, category: "Mobile", who: "f2" },
    { name: "credit card", amount: -20.0, category: "Francesca", who: "f1" },
    { name: "food petrol", amount: -900.0, category: "Food", who: "f1" },
    { name: "phone", amount: -11.0, category: "Mobile", who: "Joint" },
    { name: "greenbelt", amount: -7.6, category: "HouseBill", who: "Joint" },
    { name: "car insurance lv", amount: -31.0, category: "Insurance", who: "Joint" },
    { name: "child benefit shit", amount: -80.0, category: "Francesca", who: "f1" },
    { name: "zoom", amount: -18.0, category: "HouseBill", who: "Joint" },
    { name: "gym", amount: -33.0, category: "Francesca", who: "f2" },
    { name: "boiler", amount: -12.0, category: "HouseBill", who: "Joint" },
    { name: "service", amount: -33.0, category: "Savings", who: "Joint" },
    { name: "matt", amount: -100.0, category: "Spending", who: "Joint" },
    { name: "pocket money", amount: -20.0, category: "Medical", who: "Joint" },
    { name: "help to by", amount: -127.0, category: "House", who: "Joint" },
    { name: "lunch", amount: -20.0, category: "Savings", who: "Joint" },
    { name: "dental", amount: -20.0, category: "Francesca", who: "Joint" },
    { name: "week fund", amount: -100.0, category: "General", who: "Joint" },
];

db.serialize(() => {
    console.log("🗑️  Clearing old data...");
    db.run("DROP TABLE IF EXISTS expenses");
    db.run("DROP TABLE IF EXISTS monthly_balances");
    db.run("DROP TABLE IF EXISTS savings");

    console.log("🏗️  Creating new tables...");
    db.run(`CREATE TABLE IF NOT EXISTS monthly_balances (month TEXT PRIMARY KEY, amount REAL DEFAULT 0)`);
    
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

    const stmt = db.prepare("INSERT INTO expenses (name, amount, category, who, month, paid) VALUES (?, ?, ?, ?, ?, 0)");
    const balanceStmt = db.prepare("INSERT INTO monthly_balances (month, amount) VALUES (?, ?)");

    months.forEach(month => {
        console.log(`📅 Inserting ${standardBills.length} bills for: ${month}`);
        
        standardBills.forEach(bill => {
            stmt.run(bill.name, bill.amount, bill.category, bill.who, month);
        });
        
        // Exact Balance from 'Paid' column in sheet
        balanceStmt.run(month, 5346.82); 
    });

    stmt.finalize();
    balanceStmt.finalize(() => {
        console.log("✅ Database reset with EXACT spreadsheet values!");
    });
});