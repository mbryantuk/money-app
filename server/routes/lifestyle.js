const express = require('express');
const router = express.Router();
const db = require('../database');

// --- BIRTHDAYS ---
router.get('/birthdays', (req, res) => db.all("SELECT * FROM birthdays ORDER BY date ASC", (err, rows) => res.json(rows || [])));
router.post('/birthdays', (req, res) => { const { name, date, type } = req.body; db.run("INSERT INTO birthdays (name, date, type) VALUES (?, ?, ?)", [name, date, type], function() { res.json({ id: this.lastID }); });});
router.put('/birthdays/:id', (req, res) => { const { name, date, type } = req.body; db.run("UPDATE birthdays SET name=?, date=?, type=? WHERE id=?", [name, date, type, req.params.id], () => res.json({ success: true }));});
// Fixed: Removed extra '}'
router.delete('/birthdays/:id', (req, res) => db.run("DELETE FROM birthdays WHERE id=?", [req.params.id], () => res.json({ success: true })));

// --- MEAL PLANNER ---
// 1. Library
router.get('/meals', (req, res) => db.all("SELECT * FROM meals ORDER BY name ASC", (err, rows) => { 
    const meals = rows ? rows.map(m => ({ ...m, tags: JSON.parse(m.tags || '[]') })) : []; 
    res.json(meals); 
}));

router.post('/meals', (req, res) => { 
    const { name, description, tags, type } = req.body; 
    db.run("INSERT INTO meals (name, description, tags, type) VALUES (?, ?, ?, ?)", 
        [name, description, JSON.stringify(tags || []), type], 
        function(err) { 
            if (err) return res.status(500).json({ error: err.message }); 
            res.json({ id: this.lastID, success: true }); 
        }
    );
});

router.put('/meals/:id', (req, res) => { 
    const { name, description, tags, type } = req.body; 
    db.run("UPDATE meals SET name = ?, description = ?, tags = ?, type = ? WHERE id = ?", 
        [name, description, JSON.stringify(tags || []), type, req.params.id], 
        (err) => { 
            if (err) return res.status(500).json({ error: err.message }); 
            res.json({ success: true }); 
        }
    );
});

router.delete('/meals/:id', (req, res) => { 
    db.serialize(() => { 
        db.run("DELETE FROM meal_plan WHERE meal_id = ?", [req.params.id]); 
        db.run("DELETE FROM meals WHERE id = ?", [req.params.id]); 
    }); 
    res.json({ success: true });
});

// 2. Plan (The Schedule)
router.get('/meal-plan', (req, res) => { 
    const { start, end } = req.query; 
    const sql = `
        SELECT p.id, p.date, p.slot, p.meal_id, p.who, m.name, m.description, m.tags, m.type 
        FROM meal_plan p 
        LEFT JOIN meals m ON p.meal_id = m.id 
        WHERE p.date BETWEEN ? AND ?
    `; 
    db.all(sql, [start, end], (err, rows) => { 
        if (err) {
            if (err.message.includes('no such column')) return res.json([]); 
            return res.status(500).json({ error: err.message });
        }
        const plan = rows ? rows.map(r => ({ ...r, tags: JSON.parse(r.tags || '[]'), who: JSON.parse(r.who || '[]') })) : []; 
        res.json(plan); 
    });
});

router.post('/meal-plan', (req, res) => { 
    const { date, slot, meal_id, who } = req.body; 
    
    db.run("INSERT INTO meal_plan (date, slot, meal_id, who) VALUES (?, ?, ?, ?)", 
        [date, slot, meal_id, JSON.stringify(who || [])], 
        function(err) {
            if (err) {
                if (err.message.includes('no column') || err.message.includes('constraint')) {
                     db.serialize(() => {
                         db.run("DROP TABLE IF EXISTS meal_plan");
                         db.run(`CREATE TABLE meal_plan (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT, slot TEXT, meal_id INTEGER, who TEXT)`);
                         db.run("INSERT INTO meal_plan (date, slot, meal_id, who) VALUES (?, ?, ?, ?)", [date, slot, meal_id, JSON.stringify(who || [])], function() {
                             res.json({ success: true, id: this.lastID, note: "Schema upgraded" });
                         });
                     });
                } else {
                    res.status(500).json({ error: err.message });
                }
            } else {
                res.json({ success: true, id: this.lastID });
            }
        }
    );
});

router.delete('/meal-plan/:id', (req, res) => { 
    db.run("DELETE FROM meal_plan WHERE id = ?", [req.params.id], () => res.json({ success: true }));
});

// --- CHRISTMAS ---
router.get('/christmas', (req, res) => db.all("SELECT * FROM christmas_list", (err, rows) => res.json(rows || [])));
router.post('/christmas', (req, res) => { const { recipient, item, amount } = req.body; db.run("INSERT INTO christmas_list (recipient, item, amount, bought) VALUES (?, ?, ?, 0)", [recipient, item, amount], function() { res.json({ id: this.lastID }); });});
router.put('/christmas/:id', (req, res) => { const { recipient, item, amount } = req.body; db.run("UPDATE christmas_list SET recipient=?, item=?, amount=? WHERE id=?", [recipient, item, amount, req.params.id], () => res.json({ success: true }));});
router.post('/christmas/:id/toggle', (req, res) => { const { bought } = req.body; db.run("UPDATE christmas_list SET bought=? WHERE id=?", [bought ? 1 : 0, req.params.id], () => res.json({ success: true }));});
// Fixed: Removed extra '}'
router.delete('/christmas/:id', (req, res) => db.run("DELETE FROM christmas_list WHERE id=?", [req.params.id], () => res.json({ success: true })));

// --- SANDBOX ---
router.get('/sandbox', (req, res) => db.all("SELECT * FROM sandbox_expenses", (err, rows) => res.json(rows || [])));
router.post('/sandbox', (req, res) => { 
    const { name, amount, category, who, vendor, expected_date } = req.body; 
    db.run("INSERT INTO sandbox_expenses (name, amount, category, who, vendor, expected_date, paid) VALUES (?, ?, ?, ?, ?, ?, 0)", 
    [name, amount, category, who, vendor, expected_date], function() { res.json({ id: this.lastID }); });
});
router.put('/sandbox/:id', (req, res) => { 
    const { name, amount, category, who, vendor, expected_date } = req.body; 
    db.run("UPDATE sandbox_expenses SET name=?, amount=?, category=?, who=?, vendor=?, expected_date=? WHERE id=?", 
    [name, amount, category, who, vendor, expected_date, req.params.id], () => res.json({ success: true }));
});
// Fixed: Removed extra '}'
router.delete('/sandbox/:id', (req, res) => db.run("DELETE FROM sandbox_expenses WHERE id=?", [req.params.id], () => res.json({ success: true })));
router.post('/sandbox/clear', (req, res) => db.run("DELETE FROM sandbox_expenses", () => res.json({ success: true })));
router.post('/sandbox/import', (req, res) => { 
    db.all("SELECT name, amount, category, who, vendor, expected_date FROM expenses WHERE month = ?", [req.body.month], (err, rows) => { 
        if(!rows) return res.json({ success: true }); 
        const stmt = db.prepare("INSERT INTO sandbox_expenses (name, amount, category, who, vendor, expected_date, paid) VALUES (?, ?, ?, ?, ?, ?, 0)"); 
        rows.forEach(r => stmt.run(r.name, r.amount, r.category, r.who, r.vendor, r.expected_date)); 
        stmt.finalize(() => res.json({ success: true })); 
    });
});
router.get('/sandbox/profiles', (req, res) => db.all("SELECT id, name, salary FROM sandbox_profiles", (err, rows) => res.json(rows || [])));
router.post('/sandbox/profiles', (req, res) => { const { name, salary, expenses } = req.body; db.run("INSERT INTO sandbox_profiles (name, salary, items) VALUES (?, ?, ?)", [name, salary, JSON.stringify(expenses)], function() { res.json({ id: this.lastID }); });});
// Fixed: Removed extra '}'
router.delete('/sandbox/profiles/:id', (req, res) => db.run("DELETE FROM sandbox_profiles WHERE id = ?", [req.params.id], () => res.json({ success: true })));
router.post('/sandbox/profiles/:id/load', (req, res) => { 
    db.get("SELECT * FROM sandbox_profiles WHERE id = ?", [req.params.id], (err, row) => { 
        if(!row) return res.status(404).json({error: "Profile not found"}); 
        db.serialize(() => { 
            db.run("DELETE FROM sandbox_expenses"); 
            const stmt = db.prepare("INSERT INTO sandbox_expenses (name, amount, category, who, vendor, expected_date, paid) VALUES (?, ?, ?, ?, ?, ?, 0)"); 
            JSON.parse(row.items || '[]').forEach(r => stmt.run(r.name, r.amount, r.category, r.who, r.vendor, r.expected_date)); 
            stmt.finalize(() => res.json({ success: true, salary: row.salary })); 
        }); 
    });
});

module.exports = router;