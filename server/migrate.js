const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./finance.db');

// 1. Your Lists
const categories = [
    'Housing', 'Utilities', 'Food', 'Insurance', 'Subscription', 
    'Mobile', 'Savings', 'Spending', 'Medical', 'Tax', 
    'Pets', 'Health', 'General', 'Family', 'Francesca'
];

const people = ['Joint', 'f1', 'f2', 's', 'Matt'];

// 2. Your Master Bill List (The "Exact Match" Data)
const templates = [
    { name: "Mortgage", amount: -1268.67, category: "Housing", who: "Joint" },
    { name: "Council Tax", amount: -225.0, category: "Tax", who: "Joint" },
    { name: "Gas/Electric", amount: -155.0, category: "Utilities", who: "Joint" },
    { name: "Water Bill 1", amount: -13.0, category: "Utilities", who: "Joint" },
    { name: "Water Bill 2", amount: -31.5, category: "Utilities", who: "Joint" },
    { name: "Window Clean", amount: -10.0, category: "Housing", who: "Joint" },
    { name: "Help to Buy Loan", amount: -127.0, category: "Housing", who: "Joint" },
    { name: "Greenbelt Charge", amount: -7.6, category: "Housing", who: "Joint" },
    { name: "Boiler Cover", amount: -12.0, category: "Housing", who: "Joint" },
    
    // Insurance
    { name: "Life Insurance (Aviva)", amount: -37.0, category: "Insurance", who: "Joint" },
    { name: "House Insurance (Tesco)", amount: -39.0, category: "Insurance", who: "Joint" },
    { name: "Car Insurance (LV)", amount: -31.0, category: "Insurance", who: "Joint" },
    { name: "Dishwasher Cover", amount: -5.0, category: "Insurance", who: "Joint" },
    { name: "Pet Insurance", amount: -50.0, category: "Insurance", who: "s" },

    // Francesca
    { name: "Francesca Personal", amount: -800.0, category: "Francesca", who: "f1" },
    { name: "Food & Petrol", amount: -900.0, category: "Food", who: "f1" },
    { name: "Child Benefit Repay", amount: -80.0, category: "Tax", who: "f1" },
    { name: "Credit Card", amount: -20.0, category: "Francesca", who: "f1" },
    { name: "Tesco Mobile", amount: -28.0, category: "Mobile", who: "f2" },
    { name: "Gym Membership", amount: -33.0, category: "Health", who: "f2" },

    // Subscriptions
    { name: "Spotify", amount: -20.0, category: "Subscription", who: "Joint" },
    { name: "Amazon Prime", amount: -8.99, category: "Subscription", who: "Joint" },
    { name: "Zoom", amount: -18.0, category: "Subscription", who: "Joint" },
    { name: "HP Ink", amount: -1.5, category: "Subscription", who: "Joint" },
    { name: "Mobile (Joint)", amount: -11.0, category: "Mobile", who: "Joint" },
    { name: "TV Licence", amount: -15.0, category: "Utilities", who: "Joint" },

    // Savings & Matt
    { name: "Rumpus Food", amount: -55.0, category: "Pets", who: "s" },
    { name: "Matt Allowance", amount: -100.0, category: "Spending", who: "Matt" },
    { name: "Service Fund", amount: -33.0, category: "Savings", who: "Joint" },
    { name: "Lunch Savings", amount: -20.0, category: "Savings", who: "Joint" },
    { name: "Dental Plan", amount: -20.0, category: "Health", who: "Joint" },
    { name: "Week Fund", amount: -100.0, category: "General", who: "Joint" },
    { name: "Pocket Money", amount: -20.0, category: "Family", who: "Joint" }
];

db.serialize(() => {
    console.log("⚙️  Configuring Settings...");

    // 1. Insert Categories & People (Upsert logic)
    const settings = [
        { key: 'categories', value: JSON.stringify(categories) },
        { key: 'people', value: JSON.stringify(people) },
        { key: 'default_salary', value: '5346.82' } // Your Feb balance as default
    ];

    const settingStmt = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value");
    settings.forEach(s => settingStmt.run(s.key, s.value));
    settingStmt.finalize();

    // 2. Insert Templates (Clear old ones first to avoid duplicates)
    console.log("📜  Populating Master Bill List...");
    db.run("DELETE FROM expense_templates");
    
    const tmplStmt = db.prepare("INSERT INTO expense_templates (name, amount, category, who) VALUES (?, ?, ?, ?)");
    templates.forEach(t => {
        tmplStmt.run(t.name, t.amount, t.category, t.who);
    });
    tmplStmt.finalize();

    console.log("✅  Done! Your settings and 33 templates are saved.");
});