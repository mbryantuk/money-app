const express = require('express');
const router = express.Router();
const db = require('../database');

// --- DATA ENDPOINTS ---
router.get('/data', (req, res) => {
    const month = req.query.month; 
    const response = {};
    db.get("SELECT amount as balance, salary, notes FROM monthly_balances WHERE month = ?", [month], (err, row) => {
        if (!row) { response.balance = 0; response.salary = 0; response.notes = ''; fetchRest(response); } 
        else { response.balance = row.balance; response.salary = row.salary || 0; response.notes = row.notes || ''; fetchRest(response); }
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

router.post('/balance', (req, res) => {
    const { month, amount } = req.body;
    db.run(`INSERT INTO monthly_balances (month, amount) VALUES (?, ?) ON CONFLICT(month) DO UPDATE SET amount=excluded.amount`, [month, amount], () => res.json({ success: true }));
});

router.post('/salary', (req, res) => {
    const { month, amount } = req.body;
    db.run(`INSERT INTO monthly_balances (month, salary) VALUES (?, ?) ON CONFLICT(month) DO UPDATE SET salary=excluded.salary`, [month, amount], () => res.json({ success: true }));
});

router.post('/month/notes', (req, res) => {
    const { month, notes } = req.body;
    db.run(`INSERT INTO monthly_balances (month, notes) VALUES (?, ?) ON CONFLICT(month) DO UPDATE SET notes=excluded.notes`, [month, notes], () => res.json({ success: true }));
});

// --- SYNC (Undo/Redo) ---
router.post('/month/sync', (req, res) => {
    const { month, balance, salary, expenses } = req.body;
    db.serialize(() => {
        db.run("INSERT INTO monthly_balances (month, amount, salary) VALUES (?, ?, ?) ON CONFLICT(month) DO UPDATE SET amount=excluded.amount, salary=excluded.salary", [month, balance, salary]);
        db.run("DELETE FROM expenses WHERE month = ?", [month], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            if (expenses && expenses.length > 0) {
                const stmt = db.prepare("INSERT INTO expenses (id, name, amount, paid, paid_at, category, who, month, vendor, expected_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                expenses.forEach(e => stmt.run(e.id, e.name, e.amount, e.paid ? 1 : 0, e.paid_at, e.category, e.who, month, e.vendor, e.expected_date));
                stmt.finalize(() => res.json({ success: true }));
            } else {
                res.json({ success: true });
            }
        });
    });
});

// --- EXPENSES ---
router.post('/expenses', (req, res) => { 
    const { name, amount, category, who, month, vendor, expected_date } = req.body; 
    db.run("INSERT INTO expenses (name, amount, category, who, month, vendor, expected_date, paid) VALUES (?, ?, ?, ?, ?, ?, ?, 0)", 
    [name, amount, category, who, month, vendor || '', expected_date || null], function() { res.json({ id: this.lastID }); });
});

router.post('/expenses/:id/toggle', (req, res) => { 
    const { paid } = req.body;
    const paidAt = paid ? new Date().toISOString() : null; 
    db.run("UPDATE expenses SET paid = ?, paid_at = ? WHERE id = ?", [paid ? 1 : 0, paidAt, req.params.id], () => res.json({ success: true }));
});

router.put('/expenses/:id', (req, res) => { 
    const { name, amount, category, who, vendor, expected_date } = req.body; 
    db.run("UPDATE expenses SET name = ?, amount = ?, category = ?, who = ?, vendor = ?, expected_date = ? WHERE id = ?", 
    [name, amount, category, who, vendor, expected_date, req.params.id], () => res.json({ success: true }));
});

router.delete('/expenses/:id', (req, res) => db.run("DELETE FROM expenses WHERE id=?", [req.params.id], () => res.json({ success: true })));

// --- MONTH MGMT ---
router.post('/month/init', (req, res) => {
    const { month, source, previousMonth } = req.body;
    db.get("SELECT value FROM settings WHERE key = 'default_salary'", (err, setting) => {
        const val = setting ? parseFloat(setting.value) : 0;
        db.run("INSERT OR IGNORE INTO monthly_balances (month, amount, salary) VALUES (?, ?, ?)", [month, 0, val]);
    });
    
    // Copy vendor and expected_date
    let query = source === 'template' 
        ? "SELECT name, amount, category, who, vendor, expected_date FROM expense_templates" 
        : `SELECT name, amount, category, who, vendor, expected_date FROM expenses WHERE month = '${previousMonth}'`;
        
    db.all(query, (err, rows) => {
        if (!rows || rows.length === 0) return res.json({ success: true, count: 0 });
        const stmt = db.prepare("INSERT INTO expenses (name, amount, category, who, month, vendor, expected_date, paid) VALUES (?, ?, ?, ?, ?, ?, ?, 0)");
        rows.forEach(item => stmt.run(item.name, item.amount, item.category, item.who, month, item.vendor, item.expected_date));
        stmt.finalize(() => res.json({ success: true, count: rows.length }));
    });
});

router.delete('/month', (req, res) => {
    const { month } = req.query;
    db.serialize(() => { db.run("DELETE FROM expenses WHERE month = ?", [month]); db.run("DELETE FROM monthly_balances WHERE month = ?", [month]); });
    res.json({ success: true });
});

// --- SETTINGS & TEMPLATES ---
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

router.post('/templates', (req, res) => { 
    const { name, amount, category, who, vendor, expected_date } = req.body; 
    db.run("INSERT INTO expense_templates (name, amount, category, who, vendor, expected_date) VALUES (?, ?, ?, ?, ?, ?)", 
    [name, amount, category, who, vendor, expected_date], function() { res.json({ id: this.lastID }); });
});

router.put('/templates/:id', (req, res) => { 
    const { name, amount, category, who, vendor, expected_date } = req.body; 
    db.run("UPDATE expense_templates SET name=?, amount=?, category=?, who=?, vendor=?, expected_date=? WHERE id=?", 
    [name, amount, category, who, vendor, expected_date, req.params.id], () => res.json({ success: true }));
});

router.delete('/templates/:id', (req, res) => db.run("DELETE FROM expense_templates WHERE id=?", [req.params.id], () => res.json({ success: true })));

module.exports = router;