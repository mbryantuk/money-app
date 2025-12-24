const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const archiver = require('archiver'); // You might need to npm install archiver if not present

// Middleware: Strict check for System Administrator
const requireSysadmin = (req, res, next) => {
    if (req.user && req.user.is_sysadmin) {
        next();
    } else {
        res.status(403).json({ error: "Access Denied: Only System Administrators can perform global backups." });
    }
};

router.use(requireSysadmin);

// Create a Backup (Zips the SQLite file)
router.get('/create', (req, res) => {
    const dbPath = path.resolve('./finance.db');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `backup-${timestamp}.zip`;

    res.attachment(backupName);

    const archive = archiver('zip', {
        zlib: { level: 9 } // Sets the compression level.
    });

    archive.on('error', function(err) {
        res.status(500).send({ error: err.message });
    });

    // Pipe archive data to the response
    archive.pipe(res);

    // Append the database file
    archive.file(dbPath, { name: 'finance.db' });

    // Finalize the archive (ie we are done appending files but streams have to finish yet)
    archive.finalize();
});

// List Backups (If you are storing them locally in a folder)
// If you don't store them and just stream download above, you might not need this.
router.get('/list', (req, res) => {
    // This assumes you might have a 'backups' folder. 
    // If you implemented the stream download above, this might be redundant unless you save to disk first.
    const backupDir = path.resolve('./backups');
    
    if (!fs.existsSync(backupDir)){
        return res.json([]);
    }

    fs.readdir(backupDir, (err, files) => {
        if (err) return res.status(500).json({ error: err.message });
        const zipFiles = files.filter(file => file.endsWith('.zip'));
        res.json(zipFiles);
    });
});

module.exports = router;