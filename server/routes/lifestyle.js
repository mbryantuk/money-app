const express = require('express');
const router = express.Router();
const db = require('../database');
const { requireRole } = require('../middleware/auth');

// --- Christmas List ---

router.get('/christmas', (req, res) => {
    db.all("SELECT * FROM christmas_list WHERE household_id = ?", [req.householdId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

router.post('/christmas', requireRole('User'), (req, res) => {
    const { item, cost, person, bought } = req.body;
    // Default bought to 0 (false) if not provided
    const isBought = bought ? 1 : 0;
    
    db.run(
        "INSERT INTO christmas_list (household_id, item, cost, person, bought) VALUES (?, ?, ?, ?, ?)",
        [req.householdId, item, cost, person, isBought],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID });
        }
    );
});

router.put('/christmas/:id', requireRole('User'), (req, res) => {
    const { item, cost, person, bought } = req.body;
    const isBought = bought ? 1 : 0;

    db.run(
        "UPDATE christmas_list SET item = ?, cost = ?, person = ?, bought = ? WHERE id = ? AND household_id = ?",
        [item, cost, person, isBought, req.params.id, req.householdId],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ updated: this.changes });
        }
    );
});

router.delete('/christmas/:id', requireRole('User'), (req, res) => {
    db.run("DELETE FROM christmas_list WHERE id = ? AND household_id = ?", [req.params.id, req.householdId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ deleted: this.changes });
    });
});

// --- Birthdays ---

router.get('/birthdays', (req, res) => {
    db.all("SELECT * FROM birthdays WHERE household_id = ? ORDER BY date ASC", [req.householdId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

router.post('/birthdays', requireRole('User'), (req, res) => {
    const { name, date } = req.body;
    db.run(
        "INSERT INTO birthdays (household_id, name, date) VALUES (?, ?, ?)",
        [req.householdId, name, date],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID });
        }
    );
});

router.delete('/birthdays/:id', requireRole('User'), (req, res) => {
    db.run("DELETE FROM birthdays WHERE id = ? AND household_id = ?", [req.params.id, req.householdId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ deleted: this.changes });
    });
});

// --- Meals ---

router.get('/meals', (req, res) => {
    db.all("SELECT * FROM meals WHERE household_id = ?", [req.householdId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

router.post('/meals', requireRole('User'), (req, res) => {
    const { day, meal_type, description } = req.body;
    db.run(
        "INSERT INTO meals (household_id, day, meal_type, description) VALUES (?, ?, ?, ?)",
        [req.householdId, day, meal_type, description],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID });
        }
    );
});

router.put('/meals/:id', requireRole('User'), (req, res) => {
    const { day, meal_type, description } = req.body;
    db.run(
        "UPDATE meals SET day = ?, meal_type = ?, description = ? WHERE id = ? AND household_id = ?",
        [day, meal_type, description, req.params.id, req.householdId],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ updated: this.changes });
        }
    );
});

router.delete('/meals/:id', requireRole('User'), (req, res) => {
    db.run("DELETE FROM meals WHERE id = ? AND household_id = ?", [req.params.id, req.householdId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ deleted: this.changes });
    });
});

module.exports = router;