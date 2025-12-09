const XLSX = require('xlsx');
const db = require('./database');
const path = require('path');

// --- CONFIGURATION ---
const FILE_PATH = path.join(__dirname, 'Money2.0.xlsx');

function runImport() {
    try {
        console.log("📂 Reading Excel file...");
        const workbook = XLSX.readFile(FILE_PATH);
        const updates = [];

        console.log(`✅ Found ${workbook.SheetNames.length} sheets. Processing...`);

        // 1. Extract data from all sheets
        workbook.SheetNames.forEach(sheetName => {
            const dateStr = parseSheetDate(sheetName);
            if (!dateStr) {
                console.log(`⚠️ Skipping sheet "${sheetName}" (Could not parse date)`);
                return;
            }

            const sheet = workbook.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
            
            const extracted = scanSheetForValues(data);

            if (extracted.paid !== null || extracted.balance !== null) {
                updates.push({
                    month: dateStr, // Now using YYYY-MM-DD format
                    salary: extracted.paid || 0,
                    amount: extracted.balance || 0
                });
            }
        });

        console.log(`📊 Extracted data for ${updates.length} months.`);

        // 2. Update Database
        db.serialize(() => {
            const stmt = db.prepare(`
                INSERT INTO monthly_balances (month, salary, amount) 
                VALUES (?, ?, ?) 
                ON CONFLICT(month) DO UPDATE SET 
                    salary = excluded.salary,
                    amount = excluded.amount
            `);

            let completed = 0;
            updates.forEach(row => {
                stmt.run(row.month, row.salary, row.amount, (err) => {
                    if (err) console.error(`❌ Error updating ${row.month}:`, err.message);
                });
                completed++;
            });

            stmt.finalize(() => {
                console.log(`🚀 Database updated with ${completed} records!`);
            });
        });

    } catch (error) {
        console.error("❌ Fatal Error:", error.message);
    }
}

// --- HELPER: Parse messy sheet names into YYYY-MM-DD ---
function parseSheetDate(sheetName) {
    const name = sheetName.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    
    const months = {
        jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
        jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
        sept: '09', aprl: '04' // common typos
    };

    // Extract Month
    const monthMatch = name.match(/^([a-z]+)/);
    if (!monthMatch) return null;
    
    const monthStr = monthMatch[1].substring(0, 3);
    const monthNum = months[monthStr];
    if (!monthNum) return null;

    // Extract Year
    let yearPart = name.replace(monthMatch[1], '');
    let year = '2024'; // Default fallback

    if (yearPart.length === 4) year = yearPart;
    else if (yearPart.length === 2) year = '20' + yearPart;
    else if (yearPart === '202') year = '2020'; // Fix specific typo
    else {
        // Handle specific sheets with no year based on your file list
        if (name.includes('june') || name.includes('sept') || name.includes('dec')) year = '2022';
        else if (name.includes('july')) year = '2024';
    }

    return `${year}-${monthNum}`;
}

function scanSheetForValues(grid) {
    let result = { paid: null, balance: null };

    // Regex patterns
    const paidPattern = /(?:paid|payment|amount\s*paid)/i;
    const balancePattern = /(?:balance|closing\s*balance|total\s*due)/i; 

    for (let r = 0; r < grid.length; r++) {
        const row = grid[r];
        for (let c = 0; c < row.length; c++) {
            let cellValue = String(row[c]).trim();
            if (!cellValue) continue;

            if (result.paid === null && paidPattern.test(cellValue)) {
                const val = findNeighborValue(row, c);
                if (val !== null) result.paid = val;
            }

            if (result.balance === null && balancePattern.test(cellValue)) {
                const val = findNeighborValue(row, c);
                if (val !== null) result.balance = val;
            }
        }
        if (result.paid !== null && result.balance !== null) break;
    }
    return result;
}

function findNeighborValue(row, colIndex) {
    for (let offset = 1; offset <= 2; offset++) {
        let potentialValue = row[colIndex + offset];
        if (potentialValue) {
            let cleanVal = String(potentialValue).replace(/[^0-9.-]/g, '');
            if (!isNaN(parseFloat(cleanVal)) && cleanVal.length > 0) {
                return parseFloat(cleanVal);
            }
        }
    }
    return null;
}

runImport();