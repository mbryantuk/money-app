const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const db = require('./database');
const path = require('path');

const app = express();
const PORT = 4001;

app.use(cors());
app.use(bodyParser.json());

// --- INIT TABLES ---
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS sandbox_expenses (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, amount REAL, category TEXT, who TEXT, paid INTEGER DEFAULT 0)`);
    db.run(`CREATE TABLE IF NOT EXISTS sandbox_profiles (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, salary REAL, items TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS christmas_list (id INTEGER PRIMARY KEY AUTOINCREMENT, recipient TEXT, item TEXT, amount REAL, bought INTEGER DEFAULT 0)`);
    // --- CREDIT CARDS ---
    db.run(`CREATE TABLE IF NOT EXISTS credit_cards (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, limit_amount REAL, interest_rate REAL, balance REAL)`);
    db.run(`CREATE TABLE IF NOT EXISTS cc_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, card_id INTEGER, date TEXT, description TEXT, amount REAL, category TEXT, paid INTEGER DEFAULT 0)`);
    // --- MEAL PLANNER ---
    db.run(`CREATE TABLE IF NOT EXISTS meals (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, description TEXT, tags TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS meal_plan (date TEXT PRIMARY KEY, meal_id INTEGER)`);
});

// --- DATA ENDPOINTS ---
app.get('/api/data', (req, res) => {
    const month = req.query.month; 
    const response = {};
    db.get("SELECT amount as balance, salary FROM monthly_balances WHERE month = ?", [month], (err, row) => {
        if (!row) { response.balance = 0; response.salary = 0; fetchRest(response); } 
        else { response.balance = row.balance; response.salary = row.salary || 0; fetchRest(response); }
    });
    function fetchRest(response) {
        db.all("SELECT * FROM expenses WHERE month = ?", [month], (err, rows) => {
            response.expenses = rows || [];
            db.all("SELECT * FROM savings", (err, pots) => {
                response.savings = pots || [];
                res.json(response);
            });
        });
    }
});

app.post('/api/balance', (req, res) => {
    const { month, amount } = req.body;
    db.run(`INSERT INTO monthly_balances (month, amount) VALUES (?, ?) ON CONFLICT(month) DO UPDATE SET amount=excluded.amount`, [month, amount], () => res.json({ success: true }));
});

app.post('/api/salary', (req, res) => {
    const { month, amount } = req.body;
    db.run(`INSERT INTO monthly_balances (month, salary) VALUES (?, ?) ON CONFLICT(month) DO UPDATE SET salary=excluded.salary`, [month, amount], () => res.json({ success: true }));
});

// --- MEAL PLANNER ENDPOINTS ---
app.get('/api/meals', (req, res) => {
    db.all("SELECT * FROM meals ORDER BY name ASC", (err, rows) => {
        const meals = rows ? rows.map(m => ({ ...m, tags: JSON.parse(m.tags || '[]') })) : [];
        res.json(meals);
    });
});

app.post('/api/meals', (req, res) => {
    const { name, description, tags } = req.body;
    db.run("INSERT INTO meals (name, description, tags) VALUES (?, ?, ?)", 
        [name, description, JSON.stringify(tags || [])], 
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, success: true });
        }
    );
});

app.put('/api/meals/:id', (req, res) => {
    const { name, description, tags } = req.body;
    db.run("UPDATE meals SET name = ?, description = ?, tags = ? WHERE id = ?", 
        [name, description, JSON.stringify(tags || []), req.params.id], 
        (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        }
    );
});

app.delete('/api/meals/:id', (req, res) => {
    db.serialize(() => {
        db.run("DELETE FROM meal_plan WHERE meal_id = ?", [req.params.id]);
        db.run("DELETE FROM meals WHERE id = ?", [req.params.id]);
    });
    res.json({ success: true });
});

app.get('/api/meal-plan', (req, res) => {
    const { start, end } = req.query;
    const sql = `
        SELECT p.date, p.meal_id, m.name, m.description, m.tags 
        FROM meal_plan p 
        LEFT JOIN meals m ON p.meal_id = m.id 
        WHERE p.date BETWEEN ? AND ?
    `;
    db.all(sql, [start, end], (err, rows) => {
        const plan = rows ? rows.map(r => ({ ...r, tags: JSON.parse(r.tags || '[]') })) : [];
        res.json(plan);
    });
});

app.post('/api/meal-plan', (req, res) => {
    const { date, meal_id } = req.body;
    db.run("INSERT INTO meal_plan (date, meal_id) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET meal_id=excluded.meal_id", 
        [date, meal_id], 
        () => res.json({ success: true })
    );
});

app.delete('/api/meal-plan', (req, res) => {
    const { date } = req.query;
    db.run("DELETE FROM meal_plan WHERE date = ?", [date], () => res.json({ success: true }));
});

// --- CREDIT CARDS ENDPOINTS ---
app.get('/api/credit-cards', (req, res) => {
    db.all("SELECT * FROM credit_cards", (err, rows) => res.json(rows || []));
});

app.post('/api/credit-cards', (req, res) => {
    const { name, limit_amount, interest_rate, balance } = req.body;
    db.run("INSERT INTO credit_cards (name, limit_amount, interest_rate, balance) VALUES (?, ?, ?, ?)", 
        [name, limit_amount, interest_rate, balance || 0], 
        function() { res.json({ id: this.lastID }); }
    );
});

app.put('/api/credit-cards/:id', (req, res) => {
    const { name, limit_amount, interest_rate, balance } = req.body;
    db.run("UPDATE credit_cards SET name=?, limit_amount=?, interest_rate=?, balance=? WHERE id=?", 
        [name, limit_amount, interest_rate, balance, req.params.id], 
        () => res.json({ success: true })
    );
});

app.delete('/api/credit-cards/:id', (req, res) => {
    db.serialize(() => {
        db.run("DELETE FROM cc_transactions WHERE card_id = ?", [req.params.id]);
        db.run("DELETE FROM credit_cards WHERE id = ?", [req.params.id]);
    });
    res.json({ success: true });
});

app.get('/api/credit-cards/:id/transactions', (req, res) => {
    db.all("SELECT * FROM cc_transactions WHERE card_id = ? AND paid = 0 ORDER BY date DESC", [req.params.id], (err, rows) => res.json(rows || []));
});

app.post('/api/credit-cards/:id/transactions', (req, res) => {
    const { date, description, amount, category } = req.body;
    db.run("INSERT INTO cc_transactions (card_id, date, description, amount, category, paid) VALUES (?, ?, ?, ?, ?, 0)", 
        [req.params.id, date, description, amount, category], 
        function() { res.json({ id: this.lastID }); }
    );
});

// Edit Transaction
app.put('/api/cc_transactions/:id', (req, res) => {
    const { date, description, amount, category } = req.body;
    db.run("UPDATE cc_transactions SET date = ?, description = ?, amount = ?, category = ? WHERE id = ?", 
        [date, description, amount, category, req.params.id], 
        () => res.json({ success: true })
    );
});

// Toggle Paid Status
app.post('/api/cc_transactions/:id/toggle', (req, res) => {
    const { paid } = req.body;
    db.run("UPDATE cc_transactions SET paid = ? WHERE id = ?", [paid ? 1 : 0, req.params.id], () => res.json({ success: true }));
});

// "Pay" endpoint: Clears transactions and updates balance
app.post('/api/credit-cards/:id/pay', (req, res) => {
    const { clearBalance } = req.body; 
    db.serialize(() => {
        db.run("DELETE FROM cc_transactions WHERE card_id = ?", [req.params.id]);
        if (clearBalance) {
            db.run("UPDATE credit_cards SET balance = 0 WHERE id = ?", [req.params.id]);
        }
    });
    res.json({ success: true });
});


// --- ADMIN ENDPOINTS ---
app.get('/api/admin/data', (req, res) => {
    db.all("SELECT month, salary, amount as balance FROM monthly_balances ORDER BY month DESC", (err, rows) => {
        res.json(rows || []);
    });
});

const ALLOWED_TABLES = ['expenses', 'monthly_balances', 'settings', 'expense_templates', 'savings_accounts', 'savings_pots', 'sandbox_expenses', 'sandbox_profiles', 'christmas_list', 'credit_cards', 'cc_transactions', 'meals', 'meal_plan'];

app.get('/api/admin/table/:name', (req, res) => {
    if (!ALLOWED_TABLES.includes(req.params.name)) return res.status(403).json({ error: "Invalid table" });
    const limit = req.params.name === 'expenses' ? 'ORDER BY id DESC LIMIT 500' : '';
    db.all(`SELECT * FROM ${req.params.name} ${limit}`, (err, rows) => res.json(rows || []));
});

app.post('/api/admin/table/:name', (req, res) => {
    if (!ALLOWED_TABLES.includes(req.params.name)) return res.status(403).json({ error: "Invalid table" });
    const cols = Object.keys(req.body);
    const vals = Object.values(req.body);
    const placeholders = cols.map(() => '?').join(',');
    const sql = `INSERT INTO ${req.params.name} (${cols.join(',')}) VALUES (${placeholders})`;
    db.run(sql, vals, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, success: true });
    });
});

app.put('/api/admin/table/:name/:id', (req, res) => {
    if (!ALLOWED_TABLES.includes(req.params.name)) return res.status(403).json({ error: "Invalid table" });
    const cols = Object.keys(req.body).map(c => `${c} = ?`).join(',');
    const vals = [...Object.values(req.body), req.params.id];
    const idCol = req.params.name === 'settings' ? 'key' : 'id';
    db.run(`UPDATE ${req.params.name} SET ${cols} WHERE ${idCol} = ?`, vals, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.delete('/api/admin/table/:name/:id', (req, res) => {
    if (!ALLOWED_TABLES.includes(req.params.name)) return res.status(403).json({ error: "Invalid table" });
    const idCol = req.params.name === 'settings' ? 'key' : 'id';
    db.run(`DELETE FROM ${req.params.name} WHERE ${idCol} = ?`, [req.params.id], (err) => {
        res.json({ success: true });
    });
});

// --- SETTINGS ---
app.get('/api/settings', (req, res) => {
    db.all("SELECT * FROM settings", (err, rows) => {
        const settings = {};
        if (rows) rows.forEach(r => settings[r.key] = r.value);
        res.json(settings);
    });
});
app.post('/api/settings', (req, res) => {
    const { key, value } = req.body;
    db.run("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", [key, value], () => res.json({ success: true }));
});
app.post('/api/settings/rename', (req, res) => {
    const { type, oldName, newName } = req.body; 
    db.serialize(() => {
        db.get("SELECT value FROM settings WHERE key = ?", [type], (err, row) => {
            if (row) {
                let list = JSON.parse(row.value);
                const idx = list.indexOf(oldName);
                if (idx !== -1) {
                    list[idx] = newName;
                    db.run("UPDATE settings SET value = ? WHERE key = ?", [JSON.stringify(list), type]);
                }
            }
        });
        const col = type === 'people' ? 'who' : 'category';
        db.run(`UPDATE expenses SET ${col} = ? WHERE ${col} = ?`, [newName, oldName]);
        db.run(`UPDATE expense_templates SET ${col} = ? WHERE ${col} = ?`, [newName, oldName]);
    });
    res.json({ success: true });
});

// --- TEMPLATES ---
app.get('/api/templates', (req, res) => db.all("SELECT * FROM expense_templates", (err, rows) => res.json(rows || [])));
app.post('/api/templates', (req, res) => { const { name, amount, category, who } = req.body; db.run("INSERT INTO expense_templates (name, amount, category, who) VALUES (?, ?, ?, ?)", [name, amount, category, who], function() { res.json({ id: this.lastID }); });});
app.put('/api/templates/:id', (req, res) => { const { name, amount, category, who } = req.body; db.run("UPDATE expense_templates SET name=?, amount=?, category=?, who=? WHERE id=?", [name, amount, category, who, req.params.id], () => res.json({ success: true }));});
app.delete('/api/templates/:id', (req, res) => db.run("DELETE FROM expense_templates WHERE id=?", [req.params.id], () => res.json({ success: true })));

// --- EXPENSES ---
app.post('/api/expenses', (req, res) => { const { name, amount, category, who, month } = req.body; db.run("INSERT INTO expenses (name, amount, category, who, month, paid) VALUES (?, ?, ?, ?, ?, 0)", [name, amount, category, who, month], function() { res.json({ id: this.lastID }); });});

// Toggle Paid Status & Timestamp
app.post('/api/expenses/:id/toggle', (req, res) => { 
    const { paid } = req.body;
    const paidAt = paid ? new Date().toISOString() : null; 
    db.run("UPDATE expenses SET paid = ?, paid_at = ? WHERE id = ?", [paid ? 1 : 0, paidAt, req.params.id], () => res.json({ success: true }));
});

app.put('/api/expenses/:id', (req, res) => { const { name, amount, category, who } = req.body; db.run("UPDATE expenses SET name = ?, amount = ?, category = ?, who = ? WHERE id = ?", [name, amount, category, who, req.params.id], () => res.json({ success: true }));});

app.delete('/api/expenses/:id', (req, res) => db.run("DELETE FROM expenses WHERE id=?", [req.params.id], () => res.json({ success: true })));

// --- MONTH MGMT ---
app.post('/api/month/init', (req, res) => {
    const { month, source, previousMonth } = req.body;
    db.get("SELECT value FROM settings WHERE key = 'default_salary'", (err, setting) => {
        const val = setting ? parseFloat(setting.value) : 0;
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
    db.serialize(() => { db.run("DELETE FROM expenses WHERE month = ?", [month]); db.run("DELETE FROM monthly_balances WHERE month = ?", [month]); });
    res.json({ success: true });
});

// --- MORTGAGE ---
app.get('/api/mortgage', (req, res) => {
    db.get("SELECT value FROM settings WHERE key = 'mortgage_data'", (err, row) => {
        const defaultData = { soldPrice: 0, h2b: { balance: 0, percentage: 0 }, mortgages: [] };
        res.json(row ? JSON.parse(row.value) : defaultData);
    });
});
app.post('/api/mortgage', (req, res) => {
    db.run("INSERT INTO settings (key, value) VALUES ('mortgage_data', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", [JSON.stringify(req.body)], () => res.json({ success: true }));
});

// --- DASHBOARD ---
app.get('/api/dashboard', (req, res) => {
    const startYear = parseInt(req.query.year);
    if (!startYear) return res.status(400).json({ error: "Year required" });

    const months = [];
    for (let i = 0; i < 12; i++) {
        const d = new Date(startYear, 3 + i, 1); 
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        months.push(`${y}-${m}`);
    }
    const placeholders = months.map(() => '?').join(',');
    
    const response = {
        totalIncome: 0, totalExpenses: 0, categoryBreakdown: [], monthlyTrend: [], categoryTrend: [],
        whoBreakdown: [], biggestExpenses: [] 
    };

    // 1. Income (Sum)
    db.get(`SELECT sum(salary) as total FROM monthly_balances WHERE month IN (${placeholders})`, months, (err, row) => {
        response.totalIncome = row ? row.total : 0;

        // 2. Category Breakdown (ABS Sum)
        db.all(`SELECT category, ABS(sum(amount)) as total FROM expenses WHERE month IN (${placeholders}) GROUP BY category`, months, (err, rows) => {
            response.categoryBreakdown = rows || [];
            response.totalExpenses = response.categoryBreakdown.reduce((sum, item) => sum + item.total, 0);

            // 3. Monthly Trend (ABS Sum for Expenses)
            const sqlTrend = `
                SELECT 
                    e.month, 
                    ABS(SUM(e.amount)) as expense_total, 
                    (SELECT salary FROM monthly_balances WHERE month = e.month) as income_val 
                FROM expenses e 
                WHERE e.month IN (${placeholders}) 
                GROUP BY e.month 
                ORDER BY e.month ASC
            `;
            
            db.all(sqlTrend, months, (err, rows) => {
                response.monthlyTrend = rows || [];

                // 4. Category Trend (ABS Sum)
                const sqlCatTrend = `
                    SELECT month, category, ABS(SUM(amount)) as total 
                    FROM expenses 
                    WHERE month IN (${placeholders}) 
                    GROUP BY month, category 
                    ORDER BY month ASC
                `;
                
                db.all(sqlCatTrend, months, (err, catRows) => {
                    response.categoryTrend = catRows || [];

                    // 5. Who Spent What (ABS Sum)
                    const sqlWho = `SELECT who, ABS(SUM(amount)) as total FROM expenses WHERE month IN (${placeholders}) GROUP BY who ORDER BY total DESC`;
                    db.all(sqlWho, months, (err, whoRows) => {
                        response.whoBreakdown = whoRows || [];

                        // 6. Biggest Expenses (ABS Amount & Sort)
                        const sqlBig = `
                            SELECT name, ABS(amount) as amount, month, category 
                            FROM expenses 
                            WHERE month IN (${placeholders}) 
                            ORDER BY ABS(amount) DESC 
                            LIMIT 5
                        `;
                        db.all(sqlBig, months, (err, bigRows) => {
                            response.biggestExpenses = bigRows || [];
                            res.json(response);
                        });
                    });
                });
            });
        });
    });
});

// --- SAVINGS ---
app.get('/api/savings/structure', (req, res) => {
    const query = `SELECT a.id as account_id, a.name as account_name, p.id as pot_id, p.name as pot_name, p.amount as pot_amount FROM savings_accounts a LEFT JOIN savings_pots p ON a.id = p.account_id`;
    db.all(query, (err, rows) => {
        const accountsMap = new Map();
        if(rows) {
            rows.forEach(row => {
                if (!accountsMap.has(row.account_id)) accountsMap.set(row.account_id, { id: row.account_id, name: row.account_name, total: 0, pots: [] });
                if (row.pot_id) { 
                    const acc = accountsMap.get(row.account_id);
                    acc.pots.push({ id: row.pot_id, name: row.pot_name, amount: row.pot_amount });
                    acc.total += row.pot_amount;
                }
            });
        }
        res.json(Array.from(accountsMap.values()));
    });
});
app.post('/api/savings/accounts', (req, res) => { db.run("INSERT INTO savings_accounts (name) VALUES (?)", [req.body.name], function() { res.json({ id: this.lastID }); });});
app.delete('/api/savings/accounts/:id', (req, res) => { db.serialize(() => { db.run("DELETE FROM savings_pots WHERE account_id = ?", [req.params.id]); db.run("DELETE FROM savings_accounts WHERE id = ?", [req.params.id]); }); res.json({ success: true });});
app.post('/api/savings/pots', (req, res) => { const { accountId, name, amount } = req.body; db.run("INSERT INTO savings_pots (account_id, name, amount) VALUES (?, ?, ?)", [accountId, name, amount || 0], function() { res.json({ id: this.lastID }); });});
app.put('/api/savings/pots/:id', (req, res) => { const { name, amount } = req.body; db.run("UPDATE savings_pots SET name = ?, amount = ? WHERE id = ?", [name, amount, req.params.id], () => res.json({ success: true }));});
app.delete('/api/savings/pots/:id', (req, res) => { db.run("DELETE FROM savings_pots WHERE id = ?", [req.params.id], () => res.json({ success: true }));});

// --- SANDBOX & CHRISTMAS ---
app.get('/api/sandbox', (req, res) => db.all("SELECT * FROM sandbox_expenses", (err, rows) => res.json(rows || [])));
app.post('/api/sandbox', (req, res) => { const { name, amount, category, who } = req.body; db.run("INSERT INTO sandbox_expenses (name, amount, category, who, paid) VALUES (?, ?, ?, ?, 0)", [name, amount, category, who], function() { res.json({ id: this.lastID }); });});
app.put('/api/sandbox/:id', (req, res) => { const { name, amount, category, who } = req.body; db.run("UPDATE sandbox_expenses SET name=?, amount=?, category=?, who=? WHERE id=?", [name, amount, category, who, req.params.id], () => res.json({ success: true }));});
app.delete('/api/sandbox/:id', (req, res) => db.run("DELETE FROM sandbox_expenses WHERE id=?", [req.params.id], () => res.json({ success: true })));
app.post('/api/sandbox/clear', (req, res) => db.run("DELETE FROM sandbox_expenses", () => res.json({ success: true })));
app.post('/api/sandbox/import', (req, res) => { 
    db.all("SELECT name, amount, category, who FROM expenses WHERE month = ?", [req.body.month], (err, rows) => {
        if(!rows) return res.json({ success: true });
        const stmt = db.prepare("INSERT INTO sandbox_expenses (name, amount, category, who, paid) VALUES (?, ?, ?, ?, 0)");
        rows.forEach(r => stmt.run(r.name, r.amount, r.category, r.who));
        stmt.finalize(() => res.json({ success: true }));
    });
});
app.get('/api/sandbox/profiles', (req, res) => db.all("SELECT id, name, salary FROM sandbox_profiles", (err, rows) => res.json(rows || [])));
app.post('/api/sandbox/profiles', (req, res) => { const { name, salary, expenses } = req.body; db.run("INSERT INTO sandbox_profiles (name, salary, items) VALUES (?, ?, ?)", [name, salary, JSON.stringify(expenses)], function() { res.json({ id: this.lastID }); });});
app.delete('/api/sandbox/profiles/:id', (req, res) => db.run("DELETE FROM sandbox_profiles WHERE id = ?", [req.params.id], () => res.json({ success: true })));
app.post('/api/sandbox/profiles/:id/load', (req, res) => {
    db.get("SELECT * FROM sandbox_profiles WHERE id = ?", [req.params.id], (err, row) => {
        if(!row) return res.status(404).json({error: "Profile not found"});
        db.serialize(() => {
            db.run("DELETE FROM sandbox_expenses"); 
            const stmt = db.prepare("INSERT INTO sandbox_expenses (name, amount, category, who, paid) VALUES (?, ?, ?, ?, 0)");
            JSON.parse(row.items || '[]').forEach(r => stmt.run(r.name, r.amount, r.category, r.who));
            stmt.finalize(() => res.json({ success: true, salary: row.salary }));
        });
    });
});

app.get('/api/christmas', (req, res) => db.all("SELECT * FROM christmas_list", (err, rows) => res.json(rows || [])));
app.post('/api/christmas', (req, res) => { const { recipient, item, amount } = req.body; db.run("INSERT INTO christmas_list (recipient, item, amount, bought) VALUES (?, ?, ?, 0)", [recipient, item, amount], function() { res.json({ id: this.lastID }); });});
app.put('/api/christmas/:id', (req, res) => { const { recipient, item, amount } = req.body; db.run("UPDATE christmas_list SET recipient=?, item=?, amount=? WHERE id=?", [recipient, item, amount, req.params.id], () => res.json({ success: true }));});
app.post('/api/christmas/:id/toggle', (req, res) => { const { bought } = req.body; db.run("UPDATE christmas_list SET bought=? WHERE id=?", [bought ? 1 : 0, req.params.id], () => res.json({ success: true }));});
app.delete('/api/christmas/:id', (req, res) => db.run("DELETE FROM christmas_list WHERE id=?", [req.params.id], () => res.json({ success: true })));

app.use(express.static(path.join(__dirname, '../client/dist')));
app.get(/.*/, (req, res) => res.sendFile(path.join(__dirname, '../client/dist', 'index.html')));
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));