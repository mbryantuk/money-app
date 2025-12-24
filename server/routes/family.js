// server/routes/family.js
const express = require('express');
const router = express.Router();
const db = require('../database');
const { requireRole } = require('../middleware/auth');

// Get all Family Members for this Household
router.get('/', (req, res) => {
    const sql = `SELECT * FROM family_members WHERE household_id = ? ORDER BY is_resident DESC, first_name ASC`;
    
    db.all(sql, [req.householdId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

// Add a Family Member
router.post('/', requireRole('User'), (req, res) => {
    const { first_name, last_name, dob, relationship, is_resident } = req.body;
    
    // Default is_resident to 1 (True) if not provided
    const residentValue = is_resident === false || is_resident === 0 ? 0 : 1;

    const sql = `INSERT INTO family_members (household_id, first_name, last_name, dob, relationship, is_resident) 
                 VALUES (?, ?, ?, ?, ?, ?)`;

    db.run(sql, [req.householdId, first_name, last_name, dob, relationship, residentValue], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID });
    });
});

// Update a Family Member
router.put('/:id', requireRole('User'), (req, res) => {
    const { first_name, last_name, dob, relationship, is_resident } = req.body;
    
    const residentValue = is_resident === false || is_resident === 0 ? 0 : 1;

    const sql = `UPDATE family_members 
                 SET first_name = ?, last_name = ?, dob = ?, relationship = ?, is_resident = ? 
                 WHERE id = ? AND household_id = ?`;

    db.run(sql, [first_name, last_name, dob, relationship, residentValue, req.params.id, req.householdId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ updated: this.changes });
    });
});

// Delete a Family Member
router.delete('/:id', requireRole('Admin'), (req, res) => {
    const sql = `DELETE FROM family_members WHERE id = ? AND household_id = ?`;
    
    db.run(sql, [req.params.id, req.householdId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ deleted: this.changes });
    });
});

module.exports = router;