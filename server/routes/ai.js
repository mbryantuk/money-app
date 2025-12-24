const express = require('express');
const router = express.Router();
const db = require('../database');
const axios = require('axios');

// Helper to wrap db queries in promises
const query = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

// Get Available AI Models (Assuming Ollama is a global system service)
router.get('/models', async (req, res) => {
    // We can store the URL in a system_settings table, or env var. 
    // Defaulting to standard Ollama port.
    const ollamaUrl = process.env.OLLAMA_URL || 'http://host.docker.internal:11434';
    
    try {
        const response = await axios.get(`${ollamaUrl}/api/tags`);
        res.json(response.data);
    } catch (error) {
        console.error("AI Service Error:", error.message);
        res.status(500).json({ error: "Could not connect to AI service" });
    }
});

// Generate Summary
router.post('/summary', async (req, res) => {
    const { model } = req.body;
    const householdId = req.householdId; // Injected by middleware

    try {
        // 1. Fetch Household Financial Data
        // We run these in parallel for speed
        const [
            balances,
            income,
            expenses, // Assuming you have an expenses/withdrawals table
            savings,
            creditCards
        ] = await Promise.all([
            query("SELECT month, amount, salary FROM monthly_balances WHERE household_id = ? ORDER BY month DESC LIMIT 6", [householdId]),
            query("SELECT name, amount, type FROM income WHERE household_id = ?", [householdId]),
            query("SELECT description, amount, date FROM withdrawals WHERE household_id = ? ORDER BY date DESC LIMIT 10", [householdId]),
            query("SELECT name, amount, goal FROM savings WHERE household_id = ?", [householdId]),
            query("SELECT name, balance, limit_amount FROM credit_cards WHERE household_id = ?", [householdId])
        ]);

        // 2. Construct Prompt
        const promptData = {
            recentBalances: balances,
            monthlyIncome: income,
            recentExpenses: expenses,
            savingsPots: savings,
            creditCardDebts: creditCards
        };

        const systemPrompt = `You are a helpful financial assistant for a household. 
        Analyze the following JSON financial data and provide a concise summary, 
        highlighting spending trends, savings progress, and any areas of concern. 
        Keep the tone professional but encouraging.`;

        const ollamaUrl = process.env.OLLAMA_URL || 'http://host.docker.internal:11434';

        // 3. Call AI Service
        const response = await axios.post(`${ollamaUrl}/api/generate`, {
            model: model || "llama3", // Default model
            prompt: `Data: ${JSON.stringify(promptData)}\n\n${systemPrompt}`,
            stream: false
        });

        res.json({ response: response.data.response });

    } catch (err) {
        console.error("Summary Generation Error:", err);
        res.status(500).json({ error: "Failed to generate summary: " + err.message });
    }
});

module.exports = router;