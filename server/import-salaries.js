const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const XLSX = require('xlsx');

// --- CONFIGURATION ---
// This now looks for an 'imports' folder inside the current directory (server/)
const SOURCE_DIR = path.join(__dirname, 'imports'); 
const DB_PATH = path.join(__dirname, 'finance.db');

// --- HELPERS ---

const db = new sqlite3.Database(DB_PATH);

// Helper: Convert filename like "Sept2014.xlsx" -> "2014-09"
function parseDateFromFilename(filename) {
    const name = filename.toLowerCase().replace('.xlsx', '');
    const monthMap = {
        'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'may': '05', 'jun': '06',
        'jul': '07', 'aug': '08', 'sep': '09', 'sept': '09', 'oct': '10', 'nov': '11', 'dec': '12'
    };

    const match = name.match(/([a-z]+)[^0-9]*(\d{2,4})/);
    if (match) {
        let monthStr = match[1];
        let yearStr = match[2];

        // Match month name to number
        for (const [m, num] of Object.entries(monthMap)) {
            if (monthStr.startsWith(m)) {
                monthStr = num;
                break;
            }
        }

        // Fix 2-digit years (e.g., "14" -> "2014")
        if (yearStr.length === 2) yearStr = '20' + yearStr;

        if (!isNaN(monthStr) && !isNaN(yearStr)) {
            return `${yearStr}-${monthStr}`;
        }
    }
    return null;
}

// Helper: Scan spreadsheet rows for "Paid" and get the value next to it
function findSalaryInSheet(sheet) {
    // Read sheet as an array of arrays
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        if (!row) continue;
        
        for (let c = 0; c < row.length; c++) {
            const cellValue = row[c];
            // Check if cell is "Paid" (case-insensitive)
            if (typeof cellValue === 'string' && cellValue.trim().toLowerCase() === 'paid') {
                // Return the value in the next column
                const salary = row[c + 1];
                // Ensure it looks like a number
                if (typeof salary === 'number') {
                    return salary;
                }
            }
        }
    }
    return null;
}

function processFile(filePath, filename) {
    const monthKey = parseDateFromFilename(filename);
    
    // 1. Only process files with valid dates
    if (!monthKey) {
        // console.log(`[SKIP] No date found in: ${filename}`);
        return;
    }

    try {
        const workbook = XLSX.readFile(filePath);
        // Assume data is on the first sheet (usually "Analysis" or "Sheet1")
        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];

        // 2. Extract Salary
        const salary = findSalaryInSheet(sheet);

        if (salary) {
            // 3. Output to Window (Console)
            console.log(`FOUND: ${monthKey} | Salary: £${salary} | File: ${filename}`);

            // 4. Load into DB
            db.serialize(() => {
                const sql = `
                    INSERT INTO monthly_balances (month, salary) 
                    VALUES (?, ?) 
                    ON CONFLICT(month) DO UPDATE SET salary=excluded.salary
                `;
                db.run(sql, [monthKey, salary], (err) => {
                    if (err) console.error(`   Error saving to DB: ${err.message}`);
                    else console.log(`   -> Saved to database.`);
                });
            });
        } else {
            console.log(`[WARN] Date found (${monthKey}) but no 'Paid' value in: ${filename}`);
        }

    } catch (err) {
        console.error(`[ERROR] Could not read file ${filename}:`, err.message);
    }
}

// --- MAIN EXECUTION ---

console.log(`--- Starting Salary Import from: ${SOURCE_DIR} ---`);

if (!fs.existsSync(SOURCE_DIR)) {
    console.error(`Error: Directory not found: ${SOURCE_DIR}`);
    console.error("Please create a folder named 'imports' inside the 'server' directory and place your files there.");
    process.exit(1);
}

fs.readdir(SOURCE_DIR, (err, files) => {
    if (err) {
        console.error(`Error reading directory ${SOURCE_DIR}:`, err);
        return;
    }

    // Filter out temp files
    const excelFiles = files.filter(f => f.endsWith('.xlsx') && !f.startsWith('~'));

    if (excelFiles.length === 0) {
        console.log("No .xlsx files found in imports folder.");
        return;
    }

    db.serialize(() => {
        excelFiles.forEach(file => {
            processFile(path.join(SOURCE_DIR, file), file);
        });
    });

    // Close DB connection gracefully after queue finishes
    setTimeout(() => {
        db.close((err) => {
            if (err) console.error(err.message);
            else console.log('--- Finished. Database connection closed. ---');
        });
    }, 2000); 
});