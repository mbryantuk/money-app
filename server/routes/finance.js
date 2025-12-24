// server/routes/finance.js
const express = require('express');
const router = express.Router();
const db = require('../database');
const { requireRole } = require('../middleware/auth');

// --- Monthly Balances ---

router.get('/monthly-balances', (req, res) => {
    db.all("SELECT * FROM monthly_balances WHERE household_id = ? ORDER BY month DESC", [req.householdId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

router.post('/monthly-balances', requireRole('User'), (req, res) => {
    const { month, amount, notes } = req.body;
    db.run(
        "INSERT INTO monthly_balances (household_id, month, amount, notes) VALUES (?, ?, ?, ?)",
        [req.householdId, month, amount, notes],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID });
        }
    );
});

router.delete('/monthly-balances/:id', requireRole('Admin'), (req, res) => {
    db.run("DELETE FROM monthly_balances WHERE id = ? AND household_id = ?", [req.params.id, req.householdId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ deleted: this.changes });
    });
});

// --- Income ---

router.get('/income', (req, res) => {
    db.all("SELECT * FROM income WHERE household_id = ?", [req.householdId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

router.post('/income', requireRole('User'), (req, res) => {
    const { name, amount, day, type } = req.body;
    db.run(
        "INSERT INTO income (household_id, name, amount, day, type) VALUES (?, ?, ?, ?, ?)",
        [req.householdId, name, amount, day, type],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID });
        }
    );
});

router.delete('/income/:id', requireRole('Admin'), (req, res) => {
    db.run("DELETE FROM income WHERE id = ? AND household_id = ?", [req.params.id, req.householdId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ deleted: this.changes });
    });
});

// --- Savings ---

router.get('/savings', (req, res) => {
    db.all("SELECT * FROM savings WHERE household_id = ?", [req.householdId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

router.post('/savings', requireRole('User'), (req, res) => {
    const { name, amount, goal, bank } = req.body;
    db.run(
        "INSERT INTO savings (household_id, name, amount, goal, bank) VALUES (?, ?, ?, ?, ?)",
        [req.householdId, name, amount, goal, bank],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID });
        }
    );
});

router.put('/savings/:id', requireRole('User'), (req, res) => {
    const { name, amount, goal, bank } = req.body;
    db.run(
        "UPDATE savings SET name = ?, amount = ?, goal = ?, bank = ? WHERE id = ? AND household_id = ?",
        [name, amount, goal, bank, req.params.id, req.householdId],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ updated: this.changes });
        }
    );
});

router.delete('/savings/:id', requireRole('Admin'), (req, res) => {
    db.run("DELETE FROM savings WHERE id = ? AND household_id = ?", [req.params.id, req.householdId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ deleted: this.changes });
    });
});

// --- Pot Transfers ---

router.get('/pot-transfers', (req, res) => {
    db.all("SELECT * FROM pot_transfers WHERE household_id = ?", [req.householdId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

router.post('/pot-transfers', requireRole('User'), (req, res) => {
    const { date, from_pot, to_pot, amount, notes } = req.body;
    db.run(
        "INSERT INTO pot_transfers (household_id, date, from_pot, to_pot, amount, notes) VALUES (?, ?, ?, ?, ?, ?)",
        [req.householdId, date, from_pot, to_pot, amount, notes],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID });
        }
    );
});

router.delete('/pot-transfers/:id', requireRole('Admin'), (req, res) => {
    db.run("DELETE FROM pot_transfers WHERE id = ? AND household_id = ?", [req.params.id, req.householdId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ deleted: this.changes });
    });
});

// --- Credit Cards ---

router.get('/credit-cards', (req, res) => {
    db.all("SELECT * FROM credit_cards WHERE household_id = ?", [req.householdId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

router.post('/credit-cards', requireRole('User'), (req, res) => {
    const { name, balance, limit_amount, apr } = req.body;
    db.run(
        "INSERT INTO credit_cards (household_id, name, balance, limit_amount, apr) VALUES (?, ?, ?, ?, ?)",
        [req.householdId, name, balance, limit_amount, apr],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID });
        }
    );
});

router.put('/credit-cards/:id', requireRole('User'), (req, res) => {
    const { name, balance, limit_amount, apr } = req.body;
    db.run(
        "UPDATE credit_cards SET name = ?, balance = ?, limit_amount = ?, apr = ? WHERE id = ? AND household_id = ?",
        [name, balance, limit_amount, apr, req.params.id, req.householdId],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ updated: this.changes });
        }
    );
});

router.delete('/credit-cards/:id', requireRole('Admin'), (req, res) => {
    db.run("DELETE FROM credit_cards WHERE id = ? AND household_id = ?", [req.params.id, req.householdId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ deleted: this.changes });
    });
});

// --- Withdrawals ---

router.get('/withdrawals', (req, res) => {
    db.all("SELECT * FROM withdrawals WHERE household_id = ? ORDER BY date DESC", [req.householdId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

router.post('/withdrawals', requireRole('User'), (req, res) => {
    const { date, amount, description } = req.body;
    db.run(
        "INSERT INTO withdrawals (household_id, date, amount, description) VALUES (?, ?, ?, ?)",
        [req.householdId, date, amount, description],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID });
        }
    );
});

router.delete('/withdrawals/:id', requireRole('Admin'), (req, res) => {
    db.run("DELETE FROM withdrawals WHERE id = ? AND household_id = ?", [req.params.id, req.householdId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ deleted: this.changes });
    });
});

// --- Mortgage ---

router.get('/mortgage', (req, res) => {
    db.all("SELECT * FROM mortgage_balance WHERE household_id = ? ORDER BY month DESC", [req.householdId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

router.post('/mortgage', requireRole('User'), (req, res) => {
    const { month, balance } = req.body;
    db.run(
        "INSERT INTO mortgage_balance (household_id, month, balance) VALUES (?, ?, ?)",
        [req.householdId, month, balance],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID });
        }
    );
});

module.exports = router;