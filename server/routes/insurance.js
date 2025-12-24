const express = require('express');
const router = express.Router();
const db = require('../database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requireRole } = require('../middleware/auth');

// --- File Upload Configuration ---
const uploadDir = path.join(__dirname, '../../uploads/insurance');

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Create unique filename: timestamp-random-originalName
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

// --- Policies ---

// Get All Policies (including attachments)
router.get('/', (req, res) => {
    const sql = `
        SELECT p.*, 
               json_group_array(json_object('id', a.id, 'file_name', a.file_name)) as attachments
        FROM insurance_policies p
        LEFT JOIN policy_attachments a ON p.id = a.policy_id
        WHERE p.household_id = ?
        GROUP BY p.id
        ORDER BY p.company_name ASC
    `;

    db.all(sql, [req.householdId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        // Parse the JSON string returned by SQLite for attachments
        const results = rows.map(row => ({
            ...row,
            attachments: JSON.parse(row.attachments).filter(a => a.id !== null)
        }));
        
        res.json({ data: results });
    });
});

// Add Policy
router.post('/', requireRole('User'), (req, res) => {
    const { company_name, policy_number, total_cost, monthly_cost, notes } = req.body;
    
    const sql = `INSERT INTO insurance_policies (household_id, company_name, policy_number, total_cost, monthly_cost, notes) 
                 VALUES (?, ?, ?, ?, ?, ?)`;

    db.run(sql, [req.householdId, company_name, policy_number, total_cost, monthly_cost, notes], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID });
    });
});

// Update Policy
router.put('/:id', requireRole('User'), (req, res) => {
    const { company_name, policy_number, total_cost, monthly_cost, notes } = req.body;

    const sql = `UPDATE insurance_policies 
                 SET company_name = ?, policy_number = ?, total_cost = ?, monthly_cost = ?, notes = ?
                 WHERE id = ? AND household_id = ?`;

    db.run(sql, [company_name, policy_number, total_cost, monthly_cost, notes, req.params.id, req.householdId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ updated: this.changes });
    });
});

// Delete Policy (Cascades to delete DB records of attachments, but currently leaves files on disk)
router.delete('/:id', requireRole('Admin'), (req, res) => {
    // Ideally, you would query attachments first and delete files from disk here.
    const sql = `DELETE FROM insurance_policies WHERE id = ? AND household_id = ?`;
    
    db.run(sql, [req.params.id, req.householdId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ deleted: this.changes });
    });
});

// --- Attachments ---

// Upload Attachment for a Policy
router.post('/:id/attachments', requireRole('User'), upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).send('No file uploaded.');

    const policyId = req.params.id;
    
    // Verify policy belongs to household first
    db.get("SELECT id FROM insurance_policies WHERE id = ? AND household_id = ?", [policyId, req.householdId], (err, row) => {
        if (err || !row) {
            // Delete uploaded file if policy not found/access denied
            fs.unlinkSync(req.file.path); 
            return res.status(403).json({ error: "Access denied or policy not found" });
        }

        const sql = `INSERT INTO policy_attachments (policy_id, file_name, stored_name) VALUES (?, ?, ?)`;
        db.run(sql, [policyId, req.file.originalname, req.file.filename], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, file_name: req.file.originalname });
        });
    });
});

// Download Attachment
router.get('/attachments/:attachmentId/download', (req, res) => {
    const sql = `
        SELECT a.stored_name, a.file_name 
        FROM policy_attachments a
        JOIN insurance_policies p ON a.policy_id = p.id
        WHERE a.id = ? AND p.household_id = ?
    `;

    db.get(sql, [req.params.attachmentId, req.householdId], (err, row) => {
        if (err || !row) return res.status(404).send("File not found");

        const filePath = path.join(uploadDir, row.stored_name);
        res.download(filePath, row.file_name);
    });
});

// Delete Attachment
router.delete('/attachments/:attachmentId', requireRole('User'), (req, res) => {
    const sqlSelect = `
        SELECT a.stored_name 
        FROM policy_attachments a
        JOIN insurance_policies p ON a.policy_id = p.id
        WHERE a.id = ? AND p.household_id = ?
    `;

    db.get(sqlSelect, [req.params.attachmentId, req.householdId], (err, row) => {
        if (err || !row) return res.status(404).json({ error: "Attachment not found" });

        // Delete from Disk
        const filePath = path.join(uploadDir, row.stored_name);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // Delete from DB
        db.run("DELETE FROM policy_attachments WHERE id = ?", [req.params.attachmentId], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ deleted: this.changes });
        });
    });
});

module.exports = router;