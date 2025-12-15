const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/ai/models', (req, res) => {
    db.get("SELECT value FROM settings WHERE key = 'ollama_url'", async (err, row) => {
        if (err || !row) return res.status(500).json({ error: "Ollama URL not configured" });
        try {
            const response = await fetch(`${row.value}/api/tags`);
            if (!response.ok) throw new Error("Failed to connect to Ollama");
            const data = await response.json();
            res.json(data.models || []);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });
});

router.post('/ai/generate', async (req, res) => {
    const { type, params } = req.body;
    const requestType = type || 'budget'; 
    const month = params?.month;
    const year = params?.year || (new Date()).getFullYear();

    const keysToFetch = [
        'ollama_url', 'ollama_model', 'default_salary', 'pay_day',
        'prompt_budget', 'prompt_savings', 'prompt_credit_cards', 'prompt_dashboard',
        'prompt_meals', 'prompt_birthdays', 'prompt_christmas', 'prompt_sandbox', 'prompt_mortgage'
    ];
    
    const placeholders = keysToFetch.map(() => '?').join(',');
    db.all(`SELECT key, value FROM settings WHERE key IN (${placeholders})`, keysToFetch, (err, rows) => {
        if (err) return res.status(500).json({ error: "DB Error" });
        
        const settings = {};
        rows.forEach(r => settings[r.key] = r.value);
        
        const OLLAMA_URL = settings.ollama_url;
        const MODEL = settings.ollama_model || 'llama3';
        const PAY_DAY = parseInt(settings.pay_day) || 25;

        if (!OLLAMA_URL) return res.json({ success: false, error: "Ollama URL not configured in Settings." });

        const formatPrompt = (template, data) => template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] || `[${key}]`);

        const callOllama = async (promptText) => {
            try {
                // Base instruction for currency
                let finalPrompt = promptText.includes("British Pounds") ? promptText : promptText + "\n\nKeep the tone helpful and objective. Use British Pounds (£).";
                
                const response = await fetch(`${OLLAMA_URL}/api/generate`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model: MODEL, prompt: finalPrompt, stream: false })
                });
                if (!response.ok) throw new Error(`Ollama responded with ${response.status}`);
                const data = await response.json();
                res.json({ success: true, response: data.response });
            } catch (aiError) { res.json({ success: false, error: "Failed to connect to Ollama. " + aiError.message }); }
        };

        if (requestType === 'budget') {
             if (!month) return res.status(400).json({ error: "Month required for budget summary" });
             
             db.get("SELECT amount as balance, salary FROM monthly_balances WHERE month = ?", [month], (err, balanceRow) => {
                const income = balanceRow ? (balanceRow.salary || settings.default_salary || 0) : 0;
                const currentBalance = balanceRow ? balanceRow.balance : 0;
                
                db.all("SELECT name, amount, category, paid FROM expenses WHERE month = ?", [month], (err, expenses) => {
                    const totalExpenses = expenses.reduce((sum, ex) => sum + Math.abs(ex.amount), 0);
                    const unpaid = expenses.filter(e => !e.paid);
                    
                    // --- DATE & CONTEXT CALCULATION ---
                    const today = new Date();
                    const currentDay = today.getDate();
                    const currentDateString = today.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                    
                    // Determine if we are "in" this budget month
                    // (Simplification: assuming budget month string 'YYYY-MM' matches calendar month)
                    const [bYear, bMonth] = month.split('-').map(Number);
                    const isCurrentMonth = today.getFullYear() === bYear && (today.getMonth() + 1) === bMonth;
                    
                    let timeContext = `Today is ${currentDateString}.`;
                    if (isCurrentMonth) {
                        let daysLeft = PAY_DAY - currentDay;
                        if (daysLeft < 0) daysLeft += 30; // Rough calc for next month
                        timeContext += ` We are in the active budget month. Roughly ${daysLeft} days until Pay Day (${PAY_DAY}th).`;
                    } else if (today < new Date(bYear, bMonth - 1, 1)) {
                        timeContext += " This is a future budget.";
                    } else {
                        timeContext += " This is a past budget.";
                    }

                    const categories = {};
                    expenses.forEach(ex => {
                        const cat = ex.category || 'Uncategorized';
                        if (!categories[cat]) categories[cat] = 0;
                        categories[cat] += Math.abs(ex.amount);
                    });
                    
                    const unpaidText = unpaid.length > 0 ? unpaid.map(e => `- ${e.name}: £${Math.abs(e.amount).toFixed(2)}`).join('\n') : "All bills paid!";
                    const categoryText = Object.entries(categories).sort(([,a], [,b]) => b - a).map(([k,v]) => `- ${k}: £${v.toFixed(2)}`).join('\n');
                    const topExpenses = [...expenses].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).slice(0, 10).map(e => `- ${e.name}: £${Math.abs(e.amount).toFixed(2)} (${e.category})`).join('\n');
                    
                    // Default Prompt with added context variables
                    const template = settings.prompt_budget || `Act as a financial advisor. Analyze this budget for {{month}}.\n\n**Context:** {{date_context}}\n\n**Status:** Income: £{{income}}, Expenses: £{{expenses}}, Current Balance: £{{balance}}\n\n**UNPAID BILLS (Future/Pending):**\nThese items have NOT yet been paid/deducted:\n{{unpaid_text}}\n\n**Spending Breakdown:**\n{{category_text}}\n\n**Largest Expenses:**\n{{top_expenses}}\n\nProvide a summary focusing on upcoming obligations and month outlook based on the date.`;
                    
                    callOllama(formatPrompt(template, { 
                        month, 
                        income: income, 
                        expenses: totalExpenses.toFixed(2), 
                        balance: currentBalance, 
                        unpaid_text: unpaidText, 
                        category_text: categoryText, 
                        top_expenses: topExpenses,
                        date_context: timeContext // New Variable
                    }));
                });
            });
        } else if (requestType === 'savings') {
            const query = `SELECT a.name as account_name, p.name as pot_name, p.amount FROM savings_accounts a LEFT JOIN savings_pots p ON a.id = p.account_id`;
            db.all(query, (err, rows) => {
                let totalSaved = 0;
                let text = "";
                const accounts = {};
                rows.forEach(r => {
                    if (!accounts[r.account_name]) accounts[r.account_name] = [];
                    if (r.pot_name) { accounts[r.account_name].push(`${r.pot_name}: £${r.amount}`); totalSaved += r.amount; }
                });
                for (const [acc, pots] of Object.entries(accounts)) text += `### ${acc}\n` + (pots.length ? pots.join('\n') : "Empty") + "\n\n";
                const template = settings.prompt_savings || `Act as a financial advisor. Analyze my savings.\n\n**Total Saved:** £{{total_saved}}\n\n**Breakdown:**\n{{breakdown}}\n\nProvide a summary of my savings distribution.`;
                callOllama(formatPrompt(template, { total_saved: totalSaved.toFixed(2), breakdown: text }));
            });
        } else if (requestType === 'credit_cards') {
            db.all("SELECT * FROM credit_cards", (err, cards) => {
                let totalDebt = 0;
                const cardText = cards.map(c => { totalDebt += (c.balance || 0); return `- ${c.name}: Balance £${c.balance || 0} (Limit: £${c.limit_amount}, Rate: ${c.interest_rate}%)`; }).join('\n');
                const template = settings.prompt_credit_cards || `Act as a debt advisor. Analyze my credit cards.\n\n**Total Debt:** £{{total_debt}}\n\n**Cards:**\n{{cards_text}}\n\nProvide a summary of my debt situation and outlook.`;
                callOllama(formatPrompt(template, { total_debt: totalDebt.toFixed(2), cards_text: cardText }));
            });
        } else if (requestType === 'dashboard') {
            const startYear = year; const months = [];
            for (let i = 0; i < 12; i++) { const d = new Date(startYear, 3 + i, 1); months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); }
            const placeholders = months.map(() => '?').join(',');
            db.get(`SELECT sum(salary) as income FROM monthly_balances WHERE month IN (${placeholders})`, months, (err, incRow) => {
                db.get(`SELECT ABS(sum(amount)) as expenses FROM expenses WHERE month IN (${placeholders})`, months, (err, expRow) => {
                    const template = settings.prompt_dashboard || `Act as a financial advisor. Review year-to-date for tax year starting {{year}}.\n\n**Total Income:** £{{income}}\n**Total Expenses:** £{{expenses}}\n\nIs the user living within their means? Provide a brief outlook.`;
                    callOllama(formatPrompt(template, { year: startYear, income: incRow ? incRow.income : 0, expenses: expRow ? expRow.expenses : 0 }));
                });
            });
        } else if (requestType === 'meals') {
             const today = new Date().toISOString().slice(0, 10);
             const nextWeek = new Date(); nextWeek.setDate(nextWeek.getDate() + 7);
             db.all(`SELECT p.date, m.name, m.type FROM meal_plan p LEFT JOIN meals m ON p.meal_id = m.id WHERE p.date BETWEEN ? AND ? ORDER BY p.date ASC`, [today, nextWeek.toISOString().slice(0, 10)], (err, rows) => {
                const mealsList = (rows || []).map(r => `${r.date}: ${r.name} (${r.type || 'Dinner'})`).join('\n');
                const template = settings.prompt_meals || `Act as a nutritionist and budget planner. Review the meal plan for the next 7 days.\n\n**Meals:**\n{{meals_list}}\n\nProvide a summary of the nutritional balance and any suggestions for cost-effective ingredients.`;
                callOllama(formatPrompt(template, { meals_list: mealsList || 'No meals planned.' }));
             });
        } else if (requestType === 'birthdays') {
            db.all("SELECT * FROM birthdays ORDER BY date ASC", (err, rows) => {
                const upcoming = (rows || []).slice(0, 5).map(p => `- ${p.name} (${p.type}): ${p.date}`).join('\n');
                const template = settings.prompt_birthdays || `Act as a personal assistant. Review upcoming birthdays.\n\n**Upcoming:**\n{{upcoming_list}}\n\nSuggest gift ideas or reminder timelines for these people.`;
                callOllama(formatPrompt(template, { upcoming_list: upcoming || 'None soon.' }));
            });
        } else if (requestType === 'christmas') {
            db.all("SELECT * FROM christmas_list", (err, rows) => {
                const total = rows.reduce((acc, r) => acc + (r.amount || 0), 0);
                const spent = rows.filter(r => r.bought).reduce((acc, r) => acc + (r.amount || 0), 0);
                const itemsList = rows.map(r => `- ${r.recipient}: ${r.item} (£${r.amount}) [${r.bought ? 'BOUGHT' : 'TO BUY'}]`).join('\n');
                const template = settings.prompt_christmas || `Act as a holiday planner. Analyze my Christmas shopping list.\n\n**Status:** Spent £{{spent}} of £{{total}}.\n\n**Items:**\n{{items_list}}\n\nProvide a summary of progress and budgeting advice.`;
                callOllama(formatPrompt(template, { spent, total, items_list: itemsList }));
            });
        } else if (requestType === 'sandbox') {
             db.all("SELECT * FROM sandbox_expenses", (err, rows) => {
                 db.get("SELECT value FROM settings WHERE key = 'default_salary'", (err, row) => {
                     const salary = row ? row.value : 0;
                     const total = rows.reduce((acc, r) => acc + (r.amount || 0), 0);
                     const list = rows.map(r => `- ${r.name}: £${r.amount}`).join('\n');
                     const template = settings.prompt_sandbox || `Act as a financial analyst. Review this hypothetical budget scenario.\n\n**Income:** £{{salary}}\n**Expenses:** £{{total_expenses}}\n**Balance:** £{{balance}}\n\n**Expenses:**\n{{expense_list}}\n\nProvide feedback on the feasibility of this scenario.`;
                     callOllama(formatPrompt(template, { salary, total_expenses: total, balance: salary - total, expense_list: list }));
                 });
             });
        } else if (requestType === 'mortgage') {
             db.get("SELECT value FROM settings WHERE key = 'mortgage_data'", (err, row) => {
                const data = row ? JSON.parse(row.value) : { soldPrice: 0, mortgages: [] };
                const equity = data.soldPrice - (data.mortgages || []).reduce((acc, m) => acc + m.balance, 0);
                const list = (data.mortgages || []).map(m => `- ${m.name}: £${m.balance} @ ${m.rate}%`).join('\n');
                const template = settings.prompt_mortgage || `Act as a mortgage advisor. Review my current mortgage details.\n\n**Property Value:** £{{value}}\n**Mortgages:**\n{{mortgage_list}}\n\n**Equity:** £{{equity}}\n\nProvide an analysis of the LTV and potential overpayment benefits.`;
                callOllama(formatPrompt(template, { value: data.soldPrice, mortgage_list: list, equity }));
             });
        } else {
            callOllama(`The user is looking at the "${requestType}" page. Provide a friendly financial tip regarding "${requestType}".`);
        }
    });
});

module.exports = router;