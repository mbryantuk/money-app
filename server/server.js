const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const db = require('./database');
const path = require('path');

const app = express();
const PORT = 4001;

app.use(cors());
app.use(bodyParser.json());

// --- 1. DATA ENDPOINTS ---

app.get('/api/data', (req, res) => {
    const month = req.query.month; 
    const response = {};

    // We select 'amount' from DB but send it as 'balance' to Frontend
    db.get("SELECT amount as balance, salary FROM monthly_balances WHERE month = ?", [month], (err, row) => {
        if (!row) {
            db.get("SELECT value FROM settings WHERE key = 'default_salary'", (err, setting) => {
                const def = setting ? parseFloat(setting.value) : 0;
                response.balance = 0; // Start fresh month with 0 balance (or default if you prefer)
                response.salary = def; 
                fetchRest(response);
            });
        } else {
            response.balance = row.balance;
            response.salary = row.salary;
            fetchRest(response);
        }
    });

    function fetchRest(response) {
        db.all("SELECT * FROM expenses WHERE month = ?", [month], (err, rows) => {
            response.expenses = rows || [];
            db.all("SELECT * FROM savings", (err, pots) => {
                response.savings = pots;
                res.json(response);
            });
        });
    }
});

// --- 2. BALANCE & SALARY ENDPOINTS ---

app.post('/api/balance', (req, res) => {
    const { month, amount } = req.body;
    // Map Frontend 'balance' -> Database 'amount'
    db.run(`INSERT INTO monthly_balances (month, amount) VALUES (?, ?) 
            ON CONFLICT(month) DO UPDATE SET amount=excluded.amount`, 
            [month, amount], () => res.json({ success: true }));
});

app.post('/api/salary', (req, res) => {
    const { month, amount } = req.body;
    db.run(`INSERT INTO monthly_balances (month, salary) VALUES (?, ?) 
            ON CONFLICT(month) DO UPDATE SET salary=excluded.salary`, 
            [month, amount], () => res.json({ success: true }));
});

// --- 3. SETTINGS & TEMPLATES ---

app.get('/api/settings', (req, res) => {
    db.all("SELECT * FROM settings", (err, rows) => {
        const settings = {};
        rows.forEach(r => settings[r.key] = r.value);
        res.json(settings);
    });
});

app.post('/api/settings', (req, res) => {
    const { key, value } = req.body;
    db.run("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", [key, value], () => res.json({ success: true }));
});

app.get('/api/templates', (req, res) => db.all("SELECT * FROM expense_templates", (err, rows) => res.json(rows || [])));

app.post('/api/templates', (req, res) => {
    const { name, amount, category, who } = req.body;
    db.run("INSERT INTO expense_templates (name, amount, category, who) VALUES (?, ?, ?, ?)", [name, amount, category, who], function() { res.json({ id: this.lastID }); });
});

app.put('/api/templates/:id', (req, res) => {
    const { name, amount, category, who } = req.body;
    db.run("UPDATE expense_templates SET name=?, amount=?, category=?, who=? WHERE id=?", [name, amount, category, who, req.params.id], () => res.json({ success: true }));
});

app.delete('/api/templates/:id', (req, res) => db.run("DELETE FROM expense_templates WHERE id=?", [req.params.id], () => res.json({ success: true })));

// --- 4. EXPENSES ---

app.post('/api/expenses', (req, res) => {
    const { name, amount, category, who, month } = req.body;
    db.run("INSERT INTO expenses (name, amount, category, who, month, paid) VALUES (?, ?, ?, ?, ?, 0)", [name, amount, category, who, month], function() { res.json({ id: this.lastID }); });
});

app.post('/api/expenses/:id/toggle', (req, res) => {
    const { paid } = req.body;
    db.run("UPDATE expenses SET paid = ? WHERE id = ?", [paid ? 1 : 0, req.params.id], () => res.json({ success: true }));
});

app.put('/api/expenses/:id', (req, res) => {
    const { name, amount, category, who } = req.body;
    db.run("UPDATE expenses SET name = ?, amount = ?, category = ?, who = ? WHERE id = ?", [name, amount, category, who, req.params.id], () => res.json({ success: true }));
});

// --- 5. MONTH MGMT ---

app.post('/api/month/init', (req, res) => {
    const { month, source, previousMonth } = req.body;
    
    db.get("SELECT value FROM settings WHERE key = 'default_salary'", (err, setting) => {
        const val = setting ? parseFloat(setting.value) : 0;
        // Init with amount=0 (Current Balance) and salary=Default
        db.run("INSERT OR IGNORE INTO monthly_balances (month, amount, salary) VALUES (?, ?, ?)", [month, 0, val]);
    });

    let query = source === 'template' ? "SELECT name, amount, category, who FROM expense_templates" : `SELECT name, amount, category, who FROM expenses WHERE month = '${previousMonth}'`;
    
    db.all(query, (err, rows) => {
        if (!rows || rows.length === 0) return res.json({ success: true, count: 0 });
        const stmt = db.prepare("INSERT INTO expenses (name, amount, category, who, month, paid) VALUES (?, ?, ?, ?, ?, 0)");
        rows.forEach(item => stmt.run(item.name, item.amount, item.category, item.who, month));
        stmt.finalize(() => res.json({ success: true, count: rows.length }));
    });
});

app.delete('/api/month', (req, res) => {
    const { month } = req.query;
    db.serialize(() => {
        db.run("DELETE FROM expenses WHERE month = ?", [month]);
        db.run("DELETE FROM monthly_balances WHERE month = ?", [month]);
    });
    res.json({ success: true });
});
// GLOBAL RENAME (Updates Settings list + All History)
app.post('/api/settings/rename', (req, res) => {
    const { type, oldName, newName } = req.body; // type = 'people' or 'categories'
    
    if (!oldName || !newName) return res.status(400).json({ error: "Names required" });

    db.serialize(() => {
        // 1. Update the Settings List (JSON Array)
        db.get("SELECT value FROM settings WHERE key = ?", [type], (err, row) => {
            if (row) {
                let list = JSON.parse(row.value);
                // Replace the string in the array
                const idx = list.indexOf(oldName);
                if (idx !== -1) {
                    list[idx] = newName;
                    db.run("UPDATE settings SET value = ? WHERE key = ?", [JSON.stringify(list), type]);
                }
            }
        });

        // 2. Update Expenses Table (Historical Data)
        const col = type === 'people' ? 'who' : 'category';
        // USE SAFE PARAMETERIZED QUERY
        const sql1 = `UPDATE expenses SET ${col} = ? WHERE ${col} = ?`;
        db.run(sql1, [newName, oldName]);

        // 3. Update Templates (Master List)
        const sql2 = `UPDATE expense_templates SET ${col} = ? WHERE ${col} = ?`;
        db.run(sql2, [newName, oldName]);
    });

    res.json({ success: true });
});
// --- 6. SAVINGS ACCOUNTS & POTS ---

// Get All Accounts with their Pots attached
app.get('/api/savings/structure', (req, res) => {
    const query = `
        SELECT 
            a.id as account_id, a.name as account_name,
            p.id as pot_id, p.name as pot_name, p.amount as pot_amount
        FROM savings_accounts a
        LEFT JOIN savings_pots p ON a.id = p.account_id
    `;

    db.all(query, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        // Group flat SQL rows into nested JSON: [{ id, name, pots: [] }]
        const accountsMap = new Map();
        
        rows.forEach(row => {
            if (!accountsMap.has(row.account_id)) {
                accountsMap.set(row.account_id, {
                    id: row.account_id,
                    name: row.account_name,
                    total: 0,
                    pots: []
                });
            }
            if (row.pot_id) { // If account has pots
                const acc = accountsMap.get(row.account_id);
                acc.pots.push({ id: row.pot_id, name: row.pot_name, amount: row.pot_amount });
                acc.total += row.pot_amount;
            }
        });

        res.json(Array.from(accountsMap.values()));
    });
});

// Create Account
app.post('/api/savings/accounts', (req, res) => {
    db.run("INSERT INTO savings_accounts (name) VALUES (?)", [req.body.name], function() {
        res.json({ id: this.lastID });
    });
});

// Delete Account (and cascade delete pots)
app.delete('/api/savings/accounts/:id', (req, res) => {
    db.serialize(() => {
        db.run("DELETE FROM savings_pots WHERE account_id = ?", [req.params.id]);
        db.run("DELETE FROM savings_accounts WHERE id = ?", [req.params.id]);
    });
    res.json({ success: true });
});
// ... existing settings endpoints ...

// --- MORTGAGE ENDPOINTS ---

app.get('/api/mortgage', (req, res) => {
    db.get("SELECT value FROM settings WHERE key = 'mortgage_data'", (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        // Return saved data or a default structure if nothing exists
        const defaultData = {
            soldPrice: 460000,
            h2b: { balance: 92000, percentage: 20 },
            mortgages: [
                { id: 1, name: 'Main Mortgage', balance: 151455.79, rate: 3.45, term: 20 },
                { id: 2, name: 'Extra Borrowing', balance: 80139.80, rate: 4.15, term: 15 }
            ]
        };
        res.json(row ? JSON.parse(row.value) : defaultData);
    });
});

app.post('/api/mortgage', (req, res) => {
    const data = JSON.stringify(req.body);
    db.run("INSERT INTO settings (key, value) VALUES ('mortgage_data', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", [data], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// ... rest of your code ...
// Add Pot
app.post('/api/savings/pots', (req, res) => {
    const { accountId, name, amount } = req.body;
    db.run("INSERT INTO savings_pots (account_id, name, amount) VALUES (?, ?, ?)", [accountId, name, amount || 0], function() {
        res.json({ id: this.lastID });
    });
});

// Update Pot (Name/Amount)
app.put('/api/savings/pots/:id', (req, res) => {
    const { name, amount } = req.body;
    db.run("UPDATE savings_pots SET name = ?, amount = ? WHERE id = ?", [name, amount, req.params.id], () => res.json({ success: true }));
});

// Delete Pot
app.delete('/api/savings/pots/:id', (req, res) => {
    db.run("DELETE FROM savings_pots WHERE id = ?", [req.params.id], () => res.json({ success: true }));
});

// --- SERVE ---
app.use(express.static(path.join(__dirname, '../client/dist')));
app.get(/.*/, (req, res) => res.sendFile(path.join(__dirname, '../client/dist', 'index.html')));

// --- DASHBOARD ENDPOINT ---
app.get('/api/dashboard', (req, res) => {
    const startYear = parseInt(req.query.year);
    if (!startYear) return res.status(400).json({ error: "Year required" });

    // 1. Generate list of months (e.g., "2025-04", "2025-05"...)
    const months = [];
    for (let i = 0; i < 12; i++) {
        const d = new Date(startYear, 3 + i, 1); // 3 = April
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        months.push(`${y}-${m}`);
    }
    const placeholders = months.map(() => '?').join(',');
    
    const response = {
        totalIncome: 0,
        totalExpenses: 0,
        categoryBreakdown: [],
        monthlyTrend: []
    };

    // 2. Fetch Data Sequentially (Nested to guarantee order)
    
    // Step A: Get Total Income
    db.get(`SELECT sum(salary) as total FROM monthly_balances WHERE month IN (${placeholders})`, months, (err, row) => {
        if (err) console.error("Income Error:", err);
        response.totalIncome = row ? row.total : 0;

        // Step B: Get Expenses Breakdown
        db.all(`SELECT category, sum(amount) as total FROM expenses WHERE month IN (${placeholders}) GROUP BY category`, months, (err, rows) => {
            if (err) console.error("Breakdown Error:", err);
            response.categoryBreakdown = rows || [];
            
            // Calculate Total Expenses from the breakdown
            response.totalExpenses = response.categoryBreakdown.reduce((sum, item) => sum + item.total, 0);

            // Step C: Get Monthly Trend & Send Response
            const sql = `
                SELECT 
                    e.month, 
                    SUM(e.amount) as expense_total,
                    (SELECT salary FROM monthly_balances WHERE month = e.month) as income_val
                FROM expenses e
                WHERE e.month IN (${placeholders})
                GROUP BY e.month
                ORDER BY e.month ASC
            `;

            db.all(sql, months, (err, rows) => {
                if (err) console.error("Trend Error:", err);
                response.monthlyTrend = rows || [];
                
                // FINAL SEND
                res.json(response);
            });
        });
    });
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));