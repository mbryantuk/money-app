const express = require('express');
const router = express.Router();
const db = require('../database');
const path = require('path');
const fs = require('fs');

const BACKUP_DIR = path.join(__dirname, '../backups');
// Ensure backup directory exists on startup
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR);

// Get list of backups and config
router.get('/backups', (req, res) => {
    fs.readdir(BACKUP_DIR, (err, files) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const fileList = files
            .filter(f => f.endsWith('.db'))
            .map(f => {
                const stats = fs.statSync(path.join(BACKUP_DIR, f));
                return { name: f, created: stats.mtime, size: stats.size };
            })
            .sort((a, b) => b.created - a.created);

        db.get("SELECT value FROM settings WHERE key = 'backup_config'", (err, row) => {
            const config = row ? JSON.parse(row.value) : { frequency: 'never', time: '02:00' };
            res.json({ files: fileList, config });
        });
    });
});

// Save Backup Schedule
router.post('/backups/config', (req, res) => {
    const config = req.body;
    db.run("INSERT INTO settings (key, value) VALUES ('backup_config', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", 
        [JSON.stringify(config)], 
        () => res.json({ success: true })
    );
});

// Create Manual Backup
router.post('/backups/create', (req, res) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.db`;
    const source = path.join(__dirname, '../finance.db');
    const dest = path.join(BACKUP_DIR, filename);
    
    fs.copyFile(source, dest, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, filename });
    });
});

// Delete Backup
router.delete('/backups/:filename', (req, res) => {
    const filePath = path.join(BACKUP_DIR, req.params.filename);
    if (fs.existsSync(filePath)) {
        fs.unlink(filePath, (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
    } else {
        res.status(404).json({ error: "File not found" });
    }
});

// Restore Backup
router.post('/backups/:filename/restore', (req, res) => {
    const source = path.join(BACKUP_DIR, req.params.filename);
    const dest = path.join(__dirname, '../finance.db');
    
    if (fs.existsSync(source)) {
        fs.copyFile(source, dest, (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
    } else {
        res.status(404).json({ error: "File not found" });
    }
});

module.exports = router;