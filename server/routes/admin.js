const express = require('express');
const router = express.Router();
const db = require('../database');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { exec } = require('child_process');

const upload = multer({ dest: 'uploads/' });

// Middleware: Strict check for System Administrator
const requireSysadmin = (req, res, next) => {
    if (req.user && req.user.is_sysadmin) {
        next();
    } else {
        res.status(403).json({ error: "Access Denied: System Administrator privileges required." });
    }
};

// Apply Sysadmin check to all routes in this file
router.use(requireSysadmin);

// --- Database Management ---

// Export Database (Full System Backup)
router.get('/export-db', (req, res) => {
    const dbPath = path.resolve('./finance.db');
    res.download(dbPath, 'finance_backup.db', (err) => {
        if (err) console.error("Export error:", err);
    });
});

// Import Database (Full System Restore)
// WARNING: This overwrites all data for all households
router.post('/import-db', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).send('No file uploaded.');

    const targetPath = path.resolve('./finance.db');
    
    // Close existing DB connection before replacing file
    db.close((err) => {
        if (err) return res.status(500).send("Could not close DB connection");

        // Move uploaded file to replace current DB
        fs.rename(req.file.path, targetPath, (err) => {
            if (err) return res.status(500).send("File move failed");

            // Re-open Database
            const newDb = new (require('sqlite3').verbose()).Database(targetPath);
            // Quick check to see if valid
            newDb.get("SELECT name FROM sqlite_master WHERE type='table' AND name='users'", (err, row) => {
                if (err || !row) {
                    return res.status(400).send("Invalid Database File");
                }
                res.send({ message: "Database restored successfully. Please restart the server." });
            });
        });
    });
});

// --- Sandbox / SQL Execution ---

router.post('/sql-execute', (req, res) => {
    const { query } = req.body;
    
    // Safety check: Basic prevention of drop tables if needed, 
    // but Sysadmins usually have full power.
    
    const operation = query.trim().split(' ')[0].toUpperCase();

    if (operation === 'SELECT') {
        db.all(query, [], (err, rows) => {
            if (err) return res.status(400).json({ error: err.message });
            res.json({ results: rows });
        });
    } else {
        db.run(query, [], function(err) {
            if (err) return res.status(400).json({ error: err.message });
            res.json({ 
                message: "Query executed successfully", 
                changes: this.changes, 
                lastID: this.lastID 
            });
        });
    }
});

module.exports = router;