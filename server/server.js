require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');

// --- 1. Import Middleware ---
const { authenticateToken, requireHousehold } = require('./middleware/auth');

// --- 2. Import Route Files ---
const authRoutes = require('./routes/auth');
const financeRoutes = require('./routes/finance');
const lifestyleRoutes = require('./routes/lifestyle');
const familyRoutes = require('./routes/family');
const coreRoutes = require('./routes/core');
const aiRoutes = require('./routes/ai');
const adminRoutes = require('./routes/admin');
const backupRoutes = require('./routes/backups');
const insuranceRoutes = require('./routes/insurance');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../client/dist')));

// --- 3. Public Routes (No Login Required) ---
app.use('/auth', authRoutes);
// --- Documentation ---
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
console.log('📄 Swagger Docs available at http://localhost:3000/api-docs');
// --- 4. System Routes (Login Required, No Household Required) ---
// These are for the Sysadmin to manage the server/database globally
app.use('/api/admin', authenticateToken, adminRoutes);
app.use('/api/backups', authenticateToken, backupRoutes);

// --- 5. App Routes (Login + Household Required) ---
// These handles all the user data. They must pass the 'X-Household-ID' header.

// Mount Finance, Lifestyle, and Core directly on /api to keep URLs clean 
// (e.g. /api/income, /api/birthdays, /api/data)
app.use('/api', authenticateToken, requireHousehold, financeRoutes);
app.use('/api', authenticateToken, requireHousehold, lifestyleRoutes);
app.use('/api/core', authenticateToken, requireHousehold, coreRoutes); // This will result in /api/core/data (or just /api/data if mapped to root)

// Mount specific features on sub-paths
app.use('/api/family', authenticateToken, requireHousehold, familyRoutes);
app.use('/api/ai', authenticateToken, requireHousehold, aiRoutes);
app.use('/api/insurance', authenticateToken, requireHousehold, insuranceRoutes);
// --- 6. Frontend Handling (SPA) ---
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});


app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});