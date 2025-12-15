const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/admin/data', (req, res) => {
    db.all("SELECT month, salary, amount as balance FROM monthly_balances ORDER BY month DESC", (err, rows) => {
        res.json(rows || []);
    });
});

const ALLOWED_TABLES = ['expenses', 'monthly_balances', 'settings', 'expense_templates', 'savings_accounts', 'savings_pots', 'sandbox_expenses', 'sandbox_profiles', 'christmas_list', 'credit_cards', 'cc_transactions', 'meals', 'meal_plan', 'birthdays'];

router.get('/admin/table/:name', (req, res) => {
    if (!ALLOWED_TABLES.includes(req.params.name)) return res.status(403).json({ error: "Invalid table" });
    const limit = req.params.name === 'expenses' ? 'ORDER BY id DESC LIMIT 500' : '';
    db.all(`SELECT * FROM ${req.params.name} ${limit}`, (err, rows) => res.json(rows || []));
});

router.post('/admin/table/:name', (req, res) => {
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

router.put('/admin/table/:name/:id', (req, res) => {
    if (!ALLOWED_TABLES.includes(req.params.name)) return res.status(403).json({ error: "Invalid table" });
    const cols = Object.keys(req.body).map(c => `${c} = ?`).join(',');
    const vals = [...Object.values(req.body), req.params.id];
    const idCol = req.params.name === 'settings' ? 'key' : 'id';
    db.run(`UPDATE ${req.params.name} SET ${cols} WHERE ${idCol} = ?`, vals, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

router.delete('/admin/table/:name/:id', (req, res) => {
    if (!ALLOWED_TABLES.includes(req.params.name)) return res.status(403).json({ error: "Invalid table" });
    const idCol = req.params.name === 'settings' ? 'key' : 'id';
    db.run(`DELETE FROM ${req.params.name} WHERE ${idCol} = ?`, [req.params.id], (err) => {
        res.json({ success: true });
    });
});

module.exports = router;