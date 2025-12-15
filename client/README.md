# Money App 💰

A comprehensive, self-hosted personal finance and lifestyle management application. Built with privacy in mind, this app runs entirely locally using SQLite and optional local AI integration.

## ✨ Features

### 📊 Finance
* **Dashboard:** High-level overview of income, expenses, and trends over the year.
* **Budgeting:** Detailed monthly budget tracking.
    * Copy previous months or import from a "Master Bill List".
    * Track "Unpaid" vs "Paid" status.
    * Undo/Redo functionality for budget edits.
* **Savings Pots:** Virtual "pots" to visualize savings goals within your accounts.
* **Credit Cards:** Track card balances, interest rates (APR), and itemize transactions to ensure you have enough to pay off the bill.
* **Mortgage:** Track property value, equity, and LTV ratios.
* **Scenario Sandbox:** A "What-If" calculator to test financial scenarios without affecting your actual data.

### 🧬 Lifestyle
* **Meal Planner:** Weekly meal scheduling with a recipe database.
* **Gift Lists:** Track Christmas shopping budgets and general Birthday reminders.

### 🤖 AI Assistance
* **Local AI Integration:** Connects to a local [Ollama](https://ollama.com/) instance.
* **Smart Insights:** Get summaries, advice, and financial health checks on your Budget, Dashboard, and Savings.
* **Privacy Focused:** No financial data is sent to the cloud; everything runs on your local network.

### ⚙️ System
* **Material You Design:** Modern UI with customizable dynamic color themes.
* **Backup Manager:** Create, restore, and schedule backups of your database.
* **PWA Support:** Installable on mobile devices.

---

## 🛠️ Tech Stack

* **Frontend:** Vue.js 3, Vite, Vuetify (Material Design 3), SortableJS.
* **Backend:** Node.js, Express.
* **Database:** SQLite (Stored locally as `finance.db`).
* **Containerization:** Docker & Docker Compose.

---

## 🚀 Getting Started

### Option 1: Docker (Recommended)

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/yourusername/money-app.git](https://github.com/yourusername/money-app.git)
    cd money-app
    ```

2.  **Run with Docker Compose:**
    ```bash
    docker-compose up -d --build
    ```

3.  **Access the App:**
    Open your browser and navigate to `http://localhost:4001` (or the port defined in your compose file).

### Option 2: Manual Installation (Development)

**Prerequisites:** Node.js (v18+) and NPM.

**1. Setup the Backend:**
```bash
cd server
npm install
# Initialize the database and start the server
node server.js

