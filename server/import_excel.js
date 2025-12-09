const XLSX = require('xlsx');
const fs = require('fs');

// --- CONFIGURATION ---
const FILE_PATH = './Money2.0.xlsx'; // Ensure this matches your filename

function extractAllSheets(filePath) {
    const workbook = XLSX.readFile(filePath);
    const summary = [];

    console.log(`Found ${workbook.SheetNames.length} sheets. Processing...`);

    // 1. Loop through EVERY sheet in the workbook
    workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        
        // Convert sheet to grid (Array of Arrays) to scan spatially
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
        
        // Extract data for this specific sheet
        const sheetFinancials = scanSheetForValues(data);

        // Only add to summary if we found at least one value (skips empty/irrelevant sheets)
        if (sheetFinancials.paid !== null || sheetFinancials.balance !== null) {
            summary.push({
                Sheet: sheetName,
                Paid: sheetFinancials.paid,
                Balance: sheetFinancials.balance
            });
        }
    });

    return summary;
}

function scanSheetForValues(grid) {
    let result = { paid: null, balance: null };

    // Regex to find the labels
    const paidPattern = /(?:paid|payment|amount\s*paid)/i;
    // We strictly look for "Balance" to avoid grabbing "Balance Transfer" or "Opening Balance" if labelled differently
    const balancePattern = /(?:balance|closing\s*balance)/i; 

    // Scan every cell
    for (let r = 0; r < grid.length; r++) {
        const row = grid[r];
        
        for (let c = 0; c < row.length; c++) {
            let cellValue = String(row[c]).trim();
            if (!cellValue) continue;

            // --- FIND PAID ---
            // We check result.paid === null to grab the FIRST occurrence (usually the summary at the top)
            if (result.paid === null && paidPattern.test(cellValue)) {
                const val = findNeighborValue(row, c);
                if (val !== null) result.paid = val;
            }

            // --- FIND BALANCE ---
            if (result.balance === null && balancePattern.test(cellValue)) {
                const val = findNeighborValue(row, c);
                if (val !== null) result.balance = val;
            }
        }
        
        // Optimization: Stop scanning this sheet if we found both values
        if (result.paid !== null && result.balance !== null) break;
    }

    return result;
}

// Helper: Looks for a number in the next 1-2 cells to the right
function findNeighborValue(row, colIndex) {
    for (let offset = 1; offset <= 2; offset++) {
        let potentialValue = row[colIndex + offset];
        
        if (potentialValue) {
            // Remove currency symbols (£, $, etc) and commas
            let cleanVal = String(potentialValue).replace(/[^0-9.-]/g, '');
            
            // Validate if it is a number
            if (!isNaN(parseFloat(cleanVal)) && cleanVal.length > 0) {
                return parseFloat(cleanVal);
            }
        }
    }
    return null;
}

// --- EXECUTION ---
try {
    const report = extractAllSheets(FILE_PATH);
    
    console.log("\n--- Financial Summary by Sheet ---");
    console.table(report); // Prints a nice table to the console

} catch (error) {
    console.error("Error:", error.message);
}