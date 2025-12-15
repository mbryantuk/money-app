const express = require('express');
const router = express.Router();
const db = require('../database');

// Credit Cards
router.get('/credit-cards', (req, res) => db.all("SELECT * FROM credit_cards", (err, rows) => res.json(rows || [])));
router.post('/credit-cards', (req, res) => { const { name, limit_amount, interest_rate, balance } = req.body; db.run("INSERT INTO credit_cards (name, limit_amount, interest_rate, balance) VALUES (?, ?, ?, ?)", [name, limit_amount, interest_rate, balance || 0], function() { res.json({ id: this.lastID }); });});
router.put('/credit-cards/:id', (req, res) => { const { name, limit_amount, interest_rate, balance } = req.body; db.run("UPDATE credit_cards SET name=?, limit_amount=?, interest_rate=?, balance=? WHERE id=?", [name, limit_amount, interest_rate, balance, req.params.id], () => res.json({ success: true }));});
router.delete('/credit-cards/:id', (req, res) => { db.serialize(() => { db.run("DELETE FROM cc_transactions WHERE card_id = ?", [req.params.id]); db.run("DELETE FROM credit_cards WHERE id = ?", [req.params.id]); }); res.json({ success: true });});
router.get('/credit-cards/:id/transactions', (req, res) => db.all("SELECT * FROM cc_transactions WHERE card_id = ? AND paid = 0 ORDER BY date DESC", [req.params.id], (err, rows) => res.json(rows || [])));
router.post('/credit-cards/:id/transactions', (req, res) => { const { date, description, amount, category } = req.body; db.run("INSERT INTO cc_transactions (card_id, date, description, amount, category, paid) VALUES (?, ?, ?, ?, ?, 0)", [req.params.id, date, description, amount, category], function() { res.json({ id: this.lastID }); });});
router.put('/cc_transactions/:id', (req, res) => { const { date, description, amount, category } = req.body; db.run("UPDATE cc_transactions SET date = ?, description = ?, amount = ?, category = ? WHERE id = ?", [date, description, amount, category, req.params.id], () => res.json({ success: true }));});
router.post('/cc_transactions/:id/toggle', (req, res) => { const { paid } = req.body; db.run("UPDATE cc_transactions SET paid = ? WHERE id = ?", [paid ? 1 : 0, req.params.id], () => res.json({ success: true }));});
router.post('/credit-cards/:id/pay', (req, res) => { const { clearBalance } = req.body; db.serialize(() => { db.run("DELETE FROM cc_transactions WHERE card_id = ?", [req.params.id]); if (clearBalance) db.run("UPDATE credit_cards SET balance = 0 WHERE id = ?", [req.params.id]); }); res.json({ success: true });});

// Savings
router.get('/savings/structure', (req, res) => {
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
router.post('/savings/accounts', (req, res) => { db.run("INSERT INTO savings_accounts (name) VALUES (?)", [req.body.name], function() { res.json({ id: this.lastID }); });});
router.delete('/savings/accounts/:id', (req, res) => { db.serialize(() => { db.run("DELETE FROM savings_pots WHERE account_id = ?", [req.params.id]); db.run("DELETE FROM savings_accounts WHERE id = ?", [req.params.id]); }); res.json({ success: true });});
router.post('/savings/pots', (req, res) => { const { accountId, name, amount } = req.body; db.run("INSERT INTO savings_pots (account_id, name, amount) VALUES (?, ?, ?)", [accountId, name, amount || 0], function() { res.json({ id: this.lastID }); });});
router.put('/savings/pots/:id', (req, res) => { const { name, amount } = req.body; db.run("UPDATE savings_pots SET name = ?, amount = ? WHERE id = ?", [name, amount, req.params.id], () => res.json({ success: true }));});
router.delete('/savings/pots/:id', (req, res) => { db.run("DELETE FROM savings_pots WHERE id = ?", [req.params.id], () => res.json({ success: true }));});

// Mortgage
router.get('/mortgage', (req, res) => {
    db.get("SELECT value FROM settings WHERE key = 'mortgage_data'", (err, row) => {
        const defaultData = { soldPrice: 0, h2b: { balance: 0, percentage: 0 }, mortgages: [] };
        res.json(row ? JSON.parse(row.value) : defaultData);
    });
});
router.post('/mortgage', (req, res) => {
    db.run("INSERT INTO settings (key, value) VALUES ('mortgage_data', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", [JSON.stringify(req.body)], () => res.json({ success: true }));
});

// Dashboard
router.get('/dashboard', (req, res) => {
    const startYear = parseInt(req.query.year);
    if (!startYear) return res.status(400).json({ error: "Year required" });
    const months = [];
    for (let i = 0; i < 12; i++) {
        const d = new Date(startYear, 3 + i, 1); 
        months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    const placeholders = months.map(() => '?').join(',');
    const response = { totalIncome: 0, totalExpenses: 0, categoryBreakdown: [], monthlyTrend: [], categoryTrend: [], whoBreakdown: [], biggestExpenses: [] };

    db.get(`SELECT sum(salary) as total FROM monthly_balances WHERE month IN (${placeholders})`, months, (err, row) => {
        response.totalIncome = row ? row.total : 0;
        db.all(`SELECT category, ABS(sum(amount)) as total FROM expenses WHERE month IN (${placeholders}) GROUP BY category`, months, (err, rows) => {
            response.categoryBreakdown = rows || [];
            response.totalExpenses = response.categoryBreakdown.reduce((sum, item) => sum + item.total, 0);
            const sqlTrend = `SELECT e.month, ABS(SUM(e.amount)) as expense_total, (SELECT salary FROM monthly_balances WHERE month = e.month) as income_val FROM expenses e WHERE e.month IN (${placeholders}) GROUP BY e.month ORDER BY e.month ASC`;
            db.all(sqlTrend, months, (err, rows) => {
                response.monthlyTrend = rows || [];
                db.all(`SELECT month, category, ABS(SUM(amount)) as total FROM expenses WHERE month IN (${placeholders}) GROUP BY month, category ORDER BY month ASC`, months, (err, catRows) => {
                    response.categoryTrend = catRows || [];
                    db.all(`SELECT who, ABS(SUM(amount)) as total FROM expenses WHERE month IN (${placeholders}) GROUP BY who ORDER BY total DESC`, months, (err, whoRows) => {
                        response.whoBreakdown = whoRows || [];
                        db.all(`SELECT name, ABS(amount) as amount, month, category FROM expenses WHERE month IN (${placeholders}) ORDER BY ABS(amount) DESC LIMIT 5`, months, (err, bigRows) => {
                            response.biggestExpenses = bigRows || [];
                            res.json(response);
                        });
                    });
                });
            });
        });
    });
});

module.exports = router;