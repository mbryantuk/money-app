const express = require('express');
const router = express.Router();
const db = require('../database');

// Helper to wrap db queries in promises
const query = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

// Get Dashboard Data (Aggregated)
router.get('/data', async (req, res) => {
    const month = req.query.month; // Format: "YYYY-MM"
    const householdId = req.householdId;

    if (!month) {
        return res.status(400).json({ error: "Month parameter is required" });
    }

    try {
        // Run queries in parallel for performance
        const [
            balanceData,
            incomeData,
            expenseData,
            savingsData
        ] = await Promise.all([
            // 1. Monthly Balance
            query("SELECT * FROM monthly_balances WHERE household_id = ? AND month = ?", [householdId, month]),
            
            // 2. Income for this month (Assuming you might want to filter by date if you have dates in income, otherwise get all)
            // If income is recurring/static:
            query("SELECT * FROM income WHERE household_id = ?", [householdId]),
            
            // 3. Expenses/Withdrawals for this month
            query("SELECT * FROM withdrawals WHERE household_id = ? AND strftime('%Y-%m', date) = ?", [householdId, month]),

            // 4. Savings totals
            query("SELECT * FROM savings WHERE household_id = ?", [householdId])
        ]);

        const response = {
            balance: balanceData[0] || { amount: 0, salary: 0, notes: '' },
            income: incomeData,
            expenses: expenseData,
            savings: savingsData
        };

        res.json(response);

    } catch (err) {
        console.error("Dashboard Data Error:", err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;