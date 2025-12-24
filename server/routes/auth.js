// server/routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../database');
const { SECRET_KEY, authenticateToken } = require('../middleware/auth');

// Register a new User
router.post('/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run(`INSERT INTO users (username, password_hash) VALUES (?, ?)`, 
            [username, hashedPassword], 
            function(err) {
                if (err) return res.status(400).json({ error: "Username already exists" });
                res.json({ id: this.lastID, username });
            }
        );
    } catch (e) {
        res.status(500).send();
    }
});

// Login
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.get(`SELECT * FROM users WHERE username = ?`, [username], async (err, user) => {
        if (err || !user) return res.status(400).send('User not found');

        if (await bcrypt.compare(password, user.password_hash)) {
            // Create Token
            const token = jwt.sign({ id: user.id, username: user.username, is_sysadmin: user.is_sysadmin }, SECRET_KEY);
            res.json({ token });
        } else {
            res.send('Not Allowed');
        }
    });
});

// Create a Household (and make creator Admin)
router.post('/households', authenticateToken, (req, res) => {
    const { name } = req.body;
    db.serialize(() => {
        db.run(`INSERT INTO households (name) VALUES (?)`, [name], function(err) {
            if (err) return res.status(500).send(err);
            const householdId = this.lastID;
            
            // Add creator as Admin
            db.run(`INSERT INTO household_members (user_id, household_id, role) VALUES (?, ?, 'Admin')`,
                [req.user.id, householdId],
                (err) => {
                    if (err) return res.status(500).send(err);
                    res.json({ id: householdId, name });
                }
            );
        });
    });
});

// Get My Households
router.get('/households', authenticateToken, (req, res) => {
    const sql = req.user.is_sysadmin 
        ? `SELECT * FROM households`
        : `SELECT h.*, hm.role FROM households h 
           JOIN household_members hm ON h.id = hm.household_id 
           WHERE hm.user_id = ?`;
           
    const params = req.user.is_sysadmin ? [] : [req.user.id];

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).send(err);
        res.json(rows);
    });
});

module.exports = router;