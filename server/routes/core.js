const express = require('express');
const router = express.Router();
const db = require('../database');

// Get Data for Month
router.get('/data', (req, res) => {
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

// Update Balance/Salary
router.post('/balance', (req, res) => {
    const { month, amount } = req.body;
    db.run(`INSERT INTO monthly_balances (month, amount) VALUES (?, ?) ON CONFLICT(month) DO UPDATE SET amount=excluded.amount`, [month, amount], () => res.json({ success: true }));
});
router.post('/salary', (req, res) => {
    const { month, amount } = req.body;
    db.run(`INSERT INTO monthly_balances (month, salary) VALUES (?, ?) ON CONFLICT(month) DO UPDATE SET salary=excluded.salary`, [month, amount], () => res.json({ success: true }));
});

// Expenses
router.post('/expenses', (req, res) => { const { name, amount, category, who, month } = req.body; db.run("INSERT INTO expenses (name, amount, category, who, month, paid) VALUES (?, ?, ?, ?, ?, 0)", [name, amount, category, who, month], function() { res.json({ id: this.lastID }); });});
router.post('/expenses/:id/toggle', (req, res) => { 
    const { paid } = req.body;
    const paidAt = paid ? new Date().toISOString() : null; 
    db.run("UPDATE expenses SET paid = ?, paid_at = ? WHERE id = ?", [paid ? 1 : 0, paidAt, req.params.id], () => res.json({ success: true }));
});
router.put('/expenses/:id', (req, res) => { const { name, amount, category, who } = req.body; db.run("UPDATE expenses SET name = ?, amount = ?, category = ?, who = ? WHERE id = ?", [name, amount, category, who, req.params.id], () => res.json({ success: true }));});
router.delete('/expenses/:id', (req, res) => db.run("DELETE FROM expenses WHERE id=?", [req.params.id], () => res.json({ success: true })));

// Month Initialization
router.post('/month/init', (req, res) => {
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
router.delete('/month', (req, res) => {
    const { month } = req.query;
    db.serialize(() => { db.run("DELETE FROM expenses WHERE month = ?", [month]); db.run("DELETE FROM monthly_balances WHERE month = ?", [month]); });
    res.json({ success: true });
});

// Settings & Templates
router.get('/settings', (req, res) => { db.all("SELECT * FROM settings", (err, rows) => { const settings = {}; if (rows) rows.forEach(r => settings[r.key] = r.value); res.json(settings); });});
router.post('/settings', (req, res) => { const { key, value } = req.body; db.run("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", [key, value], () => res.json({ success: true }));});
router.post('/settings/rename', (req, res) => {
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
router.get('/templates', (req, res) => db.all("SELECT * FROM expense_templates", (err, rows) => res.json(rows || [])));
router.post('/templates', (req, res) => { const { name, amount, category, who } = req.body; db.run("INSERT INTO expense_templates (name, amount, category, who) VALUES (?, ?, ?, ?)", [name, amount, category, who], function() { res.json({ id: this.lastID }); });});
router.put('/templates/:id', (req, res) => { const { name, amount, category, who } = req.body; db.run("UPDATE expense_templates SET name=?, amount=?, category=?, who=? WHERE id=?", [name, amount, category, who, req.params.id], () => res.json({ success: true }));});
router.delete('/templates/:id', (req, res) => db.run("DELETE FROM expense_templates WHERE id=?", [req.params.id], () => res.json({ success: true })));

module.exports = router;