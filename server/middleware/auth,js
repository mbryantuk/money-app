// server/middleware/auth.js
const jwt = require('jsonwebtoken');
const db = require('../database');

const SECRET_KEY = process.env.JWT_SECRET || 'your-secret-key-change-this';

// 1. Verify Token: Ensures user is logged in
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (token == null) return res.sendStatus(401);

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user; // Attach user info to request
        next();
    });
};

// 2. Verify Household Access: Ensures user belongs to the household
const requireHousehold = (req, res, next) => {
    const user = req.user;
    // Client must send 'X-Household-ID' header
    const householdId = req.headers['x-household-id']; 

    if (!householdId) {
        return res.status(400).json({ error: "X-Household-ID header required" });
    }

    // Sysadmin bypass
    if (user.is_sysadmin) {
        req.householdId = householdId;
        req.userRole = 'Admin'; // Treat sysadmin as Admin
        return next();
    }

    db.get(
        `SELECT role FROM household_members WHERE user_id = ? AND household_id = ?`,
        [user.id, householdId],
        (err, row) => {
            if (err) return res.status(500).send("Database error");
            if (!row) return res.status(403).send("Access denied to this household");

            req.householdId = householdId;
            req.userRole = row.role;
            next();
        }
    );
};

// 3. Helper to check specific roles (e.g. only Admins can delete)
const requireRole = (role) => {
    return (req, res, next) => {
        if (req.userRole === role || req.userRole === 'Admin') { // Admin always passes
            next();
        } else {
            res.status(403).send("Insufficient permissions");
        }
    };
};

module.exports = { authenticateToken, requireHousehold, requireRole, SECRET_KEY };