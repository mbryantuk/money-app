const db = require('./database'); // Uses your existing connection

console.log("Checking database...");

db.serialize(() => {
    // 1. Check Monthly Balances (The data we just imported)
    db.all("SELECT * FROM monthly_balances ORDER BY month DESC", (err, rows) => {
        if (err) {
            console.error("Error reading balances:", err.message);
        } else {
            console.log("\n--- Monthly Balances (Top 20) ---");
            console.table(rows.slice(0, 20)); // Shows a nice table in the terminal
        }
    });

    // 2. Check Settings (Optional, just to ensure DB is healthy)
    db.all("SELECT * FROM settings", (err, rows) => {
        if (err) console.error(err);
        else {
            console.log("\n--- Settings ---");
            console.table(rows);
        }
    });
});