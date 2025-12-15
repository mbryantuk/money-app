const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

// Import Routes
const coreRoutes = require('./routes/core');
const financeRoutes = require('./routes/finance');
const lifestyleRoutes = require('./routes/lifestyle');
const adminRoutes = require('./routes/admin');
const backupRoutes = require('./routes/backups');
const aiRoutes = require('./routes/ai');

const app = express();
const PORT = 4001;

app.use(cors());
app.use(bodyParser.json());

// --- MOUNT ROUTES ---
app.use('/api', coreRoutes);      // Budget, Expenses, Settings
app.use('/api', financeRoutes);   // Credit Cards, Savings, Mortgage, Dashboard
app.use('/api', lifestyleRoutes); // Meals, Birthdays, Christmas, Sandbox
app.use('/api', adminRoutes);     // Admin Table View
app.use('/api', backupRoutes);    // Backup Manager (Restored)
app.use('/api', aiRoutes);        // AI Integration

// --- STATIC FILES ---
app.use(express.static(path.join(__dirname, '../client/dist')));
app.get(/.*/, (req, res) => res.sendFile(path.join(__dirname, '../client/dist', 'index.html')));

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));