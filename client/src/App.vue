<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import axios from 'axios';
import { useTheme } from 'vuetify';
import draggable from 'vuedraggable';

// CONFIG
const API_URL = 'http://localhost:4001/api';
const theme = useTheme();

// THEME
const toggleTheme = () => {
  theme.global.name.value = theme.global.current.value.dark ? 'myCustomTheme' : 'dark';
};
const isDark = computed(() => theme.global.current.value.dark);

// UI STATE
const drawer = ref(true);
const tab = ref('dashboard');
const snackbar = ref(false);
const snackbarText = ref('');
const showCalculator = ref(false);

// CALCULATOR STATE
const calcDisplay = ref('0');
let calcCurrent = '';
let calcPrevious = '';
let calcOperation = null;
const calcResetNext = ref(false);

// DATA STATE
const currentMonth = ref(new Date().toISOString().slice(0, 7));
const currentBalance = ref(0);
const salary = ref(0);
const expenses = ref([]);
const savingsAccounts = ref([]); 

// SANDBOX STATE
const sandboxExpenses = ref([]);
const sandboxSalary = ref(0);
const sandboxProfiles = ref([]);
const newProfileName = ref('');
const sandboxSortKey = ref('name');
const sandboxSortOrder = ref(1);
const newSandboxItem = ref({ name: '', amount: '', who: 'Joint', category: 'Spending' });

// CHRISTMAS STATE
const christmasList = ref([]);
const newGift = ref({ recipient: '', item: '', amount: '' });
const christmasSortKey = ref('recipient');
const christmasSortOrder = ref(1);

// DASHBOARD STATE
const dashboardData = ref({ totalIncome: 0, totalExpenses: 0, categoryBreakdown: [], monthlyTrend: [] });
const financialYearStart = ref(new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1);

// MORTGAGE STATE
const mortgageData = ref({
  soldPrice: 0,
  h2b: { balance: 0, percentage: 0 },
  mortgages: []
});

// SETTINGS STATE
const defaultSalary = ref(0);
const availableCategories = ref([]);
const availablePeople = ref([]);
const templates = ref([]);

// --- COLUMNS CONFIGURATION ---
const defaultColumns = [
  { key: 'select', label: '', width: '50px', align: 'center', sortable: false },
  { key: 'status', label: 'Status', width: '60px', align: 'center', sortable: true },
  { key: 'who', label: 'Who', width: '100px', align: 'left', sortable: true },
  { key: 'name', label: 'Bill Name', width: '', align: 'left', sortable: true },
  { key: 'amount', label: 'Amount', width: '120px', align: 'right', sortable: true },
  { key: 'category', label: 'Category', width: '140px', align: 'left', sortable: false },
  { key: 'actions', label: 'Edit', width: '80px', align: 'end', sortable: false }
];
const expenseColumns = ref([...defaultColumns]);

// SELECTION STATE (NEW)
const selectedExpenses = ref([]); // Stores IDs of selected rows

const selectedTotal = computed(() => {
    return expenses.value
        .filter(item => selectedExpenses.value.includes(item.id))
        .reduce((sum, item) => sum + Number(item.amount), 0);
});

// EDITING STATE
const editingId = ref(null);
const editForm = ref({});
const templateForm = ref({});
const renameForm = ref({ type: 'people', oldName: null, newName: '' });
const newAccountName = ref('');

// NEW EXPENSE FORM
const newExpenseName = ref('');
const newExpenseAmount = ref('');
const newExpenseWho = ref('Joint');
const newExpenseCategory = ref('Housing');

// DROPDOWNS
const people = ['Joint', 'f1', 'f2', 's', 'Matt'];
const categories = ['Housing', 'Utilities', 'Food', 'Insurance', 'Subscription', 'Mobile', 'Savings', 'Spending', 'Medical', 'Tax'];

// --- COMPUTED ---
const formattedMonth = computed(() => {
  const [year, month] = currentMonth.value.split('-');
  const date = new Date(year, month - 1);
  return date.toLocaleString('default', { month: 'long', year: 'numeric' });
});

// FINANCIAL MATH
const totalExpenses = computed(() => expenses.value.reduce((acc, item) => acc + Number(item.amount), 0));
const paidExpenses = computed(() => expenses.value.filter(item => item.paid).reduce((acc, item) => acc + Number(item.amount), 0));
const leftToPay = computed(() => expenses.value.filter(item => !item.paid).reduce((acc, item) => acc + Number(item.amount), 0));

const projectedBalance = computed(() => Number(currentBalance.value) + Number(leftToPay.value));

const progressPercentage = computed(() => {
  const total = Math.abs(totalExpenses.value);
  if (total === 0) return 0;
  const paid = Math.abs(paidExpenses.value);
  return Math.round((paid / total) * 100);
});

const totalSavings = computed(() => savingsAccounts.value.reduce((total, acc) => total + acc.total, 0));

const breakdownByWho = computed(() => {
  const groups = {};
  expenses.value.forEach(item => {
    if (!item.paid) {
      const person = item.who || 'Joint';
      if (!groups[person]) groups[person] = 0;
      groups[person] += item.amount;
    }
  });
  return groups;
});

// MORTGAGE COMPUTED
const totalMortgageBalance = computed(() => {
  return mortgageData.value.mortgages.reduce((acc, m) => acc + Number(m.balance || 0), 0);
});

const totalLiabilities = computed(() => {
  return totalMortgageBalance.value + Number(mortgageData.value.h2b.balance || 0);
});

const estimatedEquity = computed(() => {
  return Number(mortgageData.value.soldPrice || 0) - totalLiabilities.value;
});

// SANDBOX COMPUTED
const sandboxTotalExpenses = computed(() => sandboxExpenses.value.reduce((acc, item) => acc + Number(item.amount), 0));
const sandboxRemaining = computed(() => sandboxSalary.value + sandboxTotalExpenses.value); 

const sortedSandboxExpenses = computed(() => {
    return [...sandboxExpenses.value].sort((a, b) => {
        let valA = a[sandboxSortKey.value];
        let valB = b[sandboxSortKey.value];
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return -1 * sandboxSortOrder.value;
        if (valA > valB) return 1 * sandboxSortOrder.value;
        return 0;
    });
});

// CHRISTMAS COMPUTED
const christmasTotalBudget = computed(() => christmasList.value.reduce((acc, item) => acc + Number(item.amount), 0));
const christmasSpent = computed(() => christmasList.value.filter(i => i.bought).reduce((acc, item) => acc + Number(item.amount), 0));
const christmasRemaining = computed(() => christmasTotalBudget.value - christmasSpent.value);

const sortedChristmasList = computed(() => {
    return [...christmasList.value].sort((a, b) => {
        let valA = a[christmasSortKey.value];
        let valB = b[christmasSortKey.value];
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return -1 * christmasSortOrder.value;
        if (valA > valB) return 1 * christmasSortOrder.value;
        return 0;
    });
});

// DASHBOARD COMPUTED
const totalNetWorth = computed(() => {
  return estimatedEquity.value + totalSavings.value + currentBalance.value;
});

const fyString = computed(() => {
  return `April ${financialYearStart.value} - March ${financialYearStart.value + 1}`;
});

const sortedCategoryBreakdown = computed(() => {
  return [...dashboardData.value.categoryBreakdown].sort((a, b) => b.total - a.total);
});

// --- SORTING ---
const sortKey = ref('paid');
const sortOrder = ref(1);

const sortedExpenses = computed(() => {
  return [...expenses.value].sort((a, b) => {
    let valA = a[sortKey.value];
    let valB = b[sortKey.value];
    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();
    if (valA < valB) return -1 * sortOrder.value;
    if (valA > valB) return 1 * sortOrder.value;
    return 0;
  });
});

const sortBy = (key) => {
  if (sortKey.value === key) {
    sortOrder.value *= -1;
  } else {
    sortKey.value = key;
    sortOrder.value = 1;
  }
};

const sortSandbox = (key) => {
    if (sandboxSortKey.value === key) {
        sandboxSortOrder.value *= -1;
    } else {
        sandboxSortKey.value = key;
        sandboxSortOrder.value = 1;
    }
};

const sortChristmas = (key) => {
    if (christmasSortKey.value === key) {
        christmasSortOrder.value *= -1;
    } else {
        christmasSortKey.value = key;
        christmasSortOrder.value = 1;
    }
};

// --- API ACTIONS ---
const fetchAll = async () => {
  await fetchSettings();
  await fetchData();
  await fetchSavings();
  await fetchMortgage();
  await fetchDashboard();
  await fetchSandbox(); 
  await fetchChristmas();
};

const fetchDashboard = async () => {
  try {
    const res = await axios.get(`${API_URL}/dashboard`, { params: { year: financialYearStart.value } });
    dashboardData.value = res.data;
  } catch (e) { console.error("Dashboard Fetch Error", e); }
};

const fetchSettings = async () => {
  try {
    const res = await axios.get(`${API_URL}/settings`);
    if (res.data.default_salary) {
        defaultSalary.value = parseFloat(res.data.default_salary);
        if(sandboxSalary.value === 0) sandboxSalary.value = defaultSalary.value; 
    }
    if (res.data.categories) availableCategories.value = JSON.parse(res.data.categories);
    if (res.data.people) availablePeople.value = JSON.parse(res.data.people);
    else availablePeople.value = people;
    if (availableCategories.value.length === 0) availableCategories.value = categories;

    if (res.data.column_order) {
        let savedCols = JSON.parse(res.data.column_order);
        // Ensure "select" column exists in saved config
        if (!savedCols.find(c => c.key === 'select')) {
             savedCols.unshift({ key: 'select', label: '', width: '50px', align: 'center', sortable: false });
        }
        expenseColumns.value = savedCols;
    }

    const tRes = await axios.get(`${API_URL}/templates`);
    templates.value = tRes.data;
  } catch (e) { console.error("Settings Error", e); }
};

const fetchData = async () => {
  try {
    const res = await axios.get(`${API_URL}/data`, { params: { month: currentMonth.value } });
    currentBalance.value = parseFloat(res.data.balance) || 0;
    salary.value = parseFloat(res.data.salary) || defaultSalary.value;
    expenses.value = res.data.expenses || [];
    // Reset selection on month change
    selectedExpenses.value = [];
  } catch (err) { console.error("Data Error:", err); }
};

const fetchSavings = async () => {
    try {
        const res = await axios.get(`${API_URL}/savings/structure`);
        savingsAccounts.value = res.data;
    } catch (e) { console.error("Savings Fetch Error", e); }
};

const fetchMortgage = async () => {
  try {
    const res = await axios.get(`${API_URL}/mortgage`);
    mortgageData.value = res.data;
  } catch (e) { console.error("Mortgage Fetch Error", e); }
};

// --- SANDBOX ACTIONS ---
const fetchSandbox = async () => {
    try {
        const res = await axios.get(`${API_URL}/sandbox`);
        sandboxExpenses.value = res.data || [];
        fetchSandboxProfiles(); 
    } catch(e) { console.error(e); }
};
const fetchSandboxProfiles = async () => {
    const res = await axios.get(`${API_URL}/sandbox/profiles`);
    sandboxProfiles.value = res.data || [];
};
const addSandboxExpense = async () => {
    if(!newSandboxItem.value.name || !newSandboxItem.value.amount) return;
    await axios.post(`${API_URL}/sandbox`, {
        name: newSandboxItem.value.name,
        amount: parseFloat(newSandboxItem.value.amount),
        category: newSandboxItem.value.category,
        who: newSandboxItem.value.who
    });
    newSandboxItem.value = { name: '', amount: '', who: 'Joint', category: 'Spending' };
    fetchSandbox();
};
const saveSandboxExpense = async () => {
    await axios.put(`${API_URL}/sandbox/${editForm.value.id}`, editForm.value);
    editingId.value = null;
    fetchSandbox();
};
const deleteSandboxExpense = async (id) => {
    await axios.delete(`${API_URL}/sandbox/${id}`);
    fetchSandbox();
};
const clearSandbox = async () => {
    if(confirm("Clear entire sandbox?")) {
        await axios.post(`${API_URL}/sandbox/clear`);
        fetchSandbox();
    }
};
const importSandbox = async () => {
    if(confirm("Overwrite Sandbox with current month's actual budget?")) {
        await axios.post(`${API_URL}/sandbox/clear`);
        await axios.post(`${API_URL}/sandbox/import`, { month: currentMonth.value });
        fetchSandbox();
        sandboxSalary.value = salary.value; 
    }
};
const saveSandboxProfile = async () => {
    if(!newProfileName.value) return;
    await axios.post(`${API_URL}/sandbox/profiles`, {
        name: newProfileName.value,
        salary: sandboxSalary.value,
        expenses: sandboxExpenses.value
    });
    newProfileName.value = '';
    fetchSandboxProfiles();
    showMsg('Scenario Saved');
};
const loadSandboxProfile = async (id) => {
    if(confirm("Load this scenario? Current sandbox data will be replaced.")) {
        const res = await axios.post(`${API_URL}/sandbox/profiles/${id}/load`);
        sandboxSalary.value = res.data.salary;
        fetchSandbox();
        showMsg('Scenario Loaded');
    }
};
const deleteSandboxProfile = async (id) => {
    if(confirm("Delete this saved scenario?")) {
        await axios.delete(`${API_URL}/sandbox/profiles/${id}`);
        fetchSandboxProfiles();
    }
};

// --- CHRISTMAS ACTIONS ---
const fetchChristmas = async () => {
    try {
        const res = await axios.get(`${API_URL}/christmas`);
        christmasList.value = res.data || [];
    } catch(e) { console.error(e); }
};
const addChristmasGift = async () => {
    if(!newGift.value.recipient || !newGift.value.item) return;
    await axios.post(`${API_URL}/christmas`, {
        recipient: newGift.value.recipient,
        item: newGift.value.item,
        amount: parseFloat(newGift.value.amount) || 0
    });
    newGift.value = { recipient: '', item: '', amount: '' };
    fetchChristmas();
};
const toggleChristmasBought = async (gift) => {
    gift.bought = !gift.bought;
    await axios.post(`${API_URL}/christmas/${gift.id}/toggle`, { bought: gift.bought });
};
const saveChristmasGift = async () => {
    await axios.put(`${API_URL}/christmas/${editForm.value.id}`, editForm.value);
    editingId.value = null;
    fetchChristmas();
};
const deleteChristmasGift = async (id) => {
    await axios.delete(`${API_URL}/christmas/${id}`);
    fetchChristmas();
};

// --- CALCULATOR LOGIC ---
const calcAppend = (num) => {
  if (calcDisplay.value === '0' || calcResetNext.value) {
    calcDisplay.value = String(num);
    calcResetNext.value = false;
  } else {
    calcDisplay.value += String(num);
  }
};
const calcSetOp = (op) => {
  if (calcOperation !== null) calcCompute();
  calcPrevious = calcDisplay.value;
  calcOperation = op;
  calcResetNext.value = true;
};
const calcCompute = () => {
  let computation;
  const prev = parseFloat(calcPrevious);
  const current = parseFloat(calcDisplay.value);
  if (isNaN(prev) || isNaN(current)) return;
  
  switch (calcOperation) {
    case '+': computation = prev + current; break;
    case '-': computation = prev - current; break;
    case '*': computation = prev * current; break;
    case '/': computation = prev / current; break;
    default: return;
  }
  
  calcDisplay.value = String(computation);
  calcOperation = null;
  calcResetNext.value = true;
};
const calcClear = () => {
  calcDisplay.value = '0';
  calcPrevious = '';
  calcOperation = null;
};
const copyToClipboard = () => {
    navigator.clipboard.writeText(calcDisplay.value);
    showMsg('Copied to clipboard');
};

const handleKeydown = (e) => {
    if (!showCalculator.value) return;

    if (e.key >= '0' && e.key <= '9') calcAppend(e.key);
    if (e.key === '.') calcAppend('.');
    if (['+', '-', '*', '/'].includes(e.key)) calcSetOp(e.key);
    if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault(); 
        calcCompute();
    }
    if (e.key === 'Escape') calcClear();
    if (e.key === 'Backspace') {
        if(calcDisplay.value.length > 1) {
            calcDisplay.value = calcDisplay.value.slice(0, -1);
        } else {
            calcDisplay.value = '0';
        }
    }
};


// --- WATCHERS ---
watch(currentMonth, fetchData);
watch(financialYearStart, fetchDashboard);

watch(
  [() => mortgageData.value.soldPrice, () => mortgageData.value.h2b.percentage],
  ([price, pct]) => {
    const p = Number(price) || 0;
    const r = Number(pct) || 0;
    mortgageData.value.h2b.balance = parseFloat((p * (r / 100)).toFixed(2));
  }
);

const changeMonth = (offset) => {
  const [year, month] = currentMonth.value.split('-').map(Number);
  const newDate = new Date(year, month - 1 + offset, 1);
  const y = newDate.getFullYear();
  const m = String(newDate.getMonth() + 1).padStart(2, '0');
  currentMonth.value = `${y}-${m}`;
};

const showMsg = (text) => {
    snackbarText.value = text;
    snackbar.value = true;
};

// --- SAVE COLUMN LAYOUT ---
const saveColumnLayout = async () => {
    await axios.post(`${API_URL}/settings`, { 
        key: 'column_order', 
        value: JSON.stringify(expenseColumns.value) 
    });
};

// --- BALANCE UPDATES ---
const updateBalance = async () => {
  const val = Number(currentBalance.value);
  await axios.post(`${API_URL}/balance`, { month: currentMonth.value, amount: val });
  showMsg('Current Balance Saved');
};

const updateSalary = async () => {
  const val = Number(salary.value);
  await axios.post(`${API_URL}/salary`, { month: currentMonth.value, amount: val });
  showMsg('Salary Log Updated');
};

// --- MONTH MANAGEMENT ---
const initMonth = async (source) => {
    const [year, month] = currentMonth.value.split('-').map(Number);
    const prevDate = new Date(year, month - 2, 1);
    const prevY = prevDate.getFullYear();
    const prevM = String(prevDate.getMonth() + 1).padStart(2, '0');
    const previousMonth = `${prevY}-${prevM}`;
    if(confirm(`Copy from ${previousMonth}?`)){ await axios.post(`${API_URL}/month/init`, { month: currentMonth.value, source, previousMonth }); fetchData(); }
};

const resetMonth = async () => {
  if (confirm(`Are you sure you want to delete ALL data for ${formattedMonth.value}?`)) {
    await axios.delete(`${API_URL}/month`, { params: { month: currentMonth.value } });
    fetchData();
    showMsg('Month Reset');
  }
};

// --- TRANSACTIONS ---
const togglePaid = async (expense) => {
  expense.paid = !expense.paid;
  await axios.post(`${API_URL}/expenses/${expense.id}/toggle`, { paid: expense.paid });
};

const startEdit = (item) => { editingId.value = item.id; editForm.value = { ...item }; };

const saveExpense = async () => {
  await axios.put(`${API_URL}/expenses/${editForm.value.id}`, editForm.value);
  editingId.value = null; 
  fetchData(); 
};
const cancelEdit = () => { editingId.value = null; };

const addExpense = async () => {
  if(!newExpenseName.value || !newExpenseAmount.value) return;
  await axios.post(`${API_URL}/expenses`, {
    name: newExpenseName.value,
    amount: parseFloat(newExpenseAmount.value),
    category: newExpenseCategory.value,
    who: newExpenseWho.value,
    month: currentMonth.value
  });
  newExpenseName.value = '';
  newExpenseAmount.value = '';
  fetchData();
};

// --- SAVINGS ACTIONS ---
const addAccount = async () => {
    if (!newAccountName.value) return;
    await axios.post(`${API_URL}/savings/accounts`, { name: newAccountName.value });
    newAccountName.value = '';
    fetchSavings();
};
const deleteAccount = async (id) => {
    if(confirm("Delete this account and all its pots?")) {
        await axios.delete(`${API_URL}/savings/accounts/${id}`);
        fetchSavings();
    }
};
const addPot = async (accountId) => {
    const potName = prompt("Name for new pot:");
    if (!potName) return;
    await axios.post(`${API_URL}/savings/pots`, { accountId, name: potName, amount: 0 });
    fetchSavings();
};
const savePot = async (pot) => {
    await axios.put(`${API_URL}/savings/pots/${pot.id}`, { name: pot.name, amount: parseFloat(pot.amount) });
    editingId.value = null;
    fetchSavings();
};
const deletePot = async (id) => {
    if(confirm("Delete this pot?")) {
        await axios.delete(`${API_URL}/savings/pots/${id}`);
        fetchSavings();
    }
};

// --- MORTGAGE ACTIONS ---
const saveMortgage = async () => {
  try {
    await axios.post(`${API_URL}/mortgage`, mortgageData.value);
    showMsg('Mortgage details saved');
  } catch (e) { console.error("Mortgage Save Error", e); }
};

const addLoan = () => {
  mortgageData.value.mortgages.push({ id: Date.now(), name: 'New Loan', balance: 0, rate: 0, term: 0 });
};

const removeLoan = (index) => {
  if(confirm("Remove this loan?")) {
    mortgageData.value.mortgages.splice(index, 1);
    saveMortgage(); 
  }
};

// --- SETTINGS ---
const saveSetting = async (key, value) => {
  const payload = typeof value === 'object' ? JSON.stringify(value) : value;
  await axios.post(`${API_URL}/settings`, { key, value: payload });
  showMsg('Setting Saved');
};

const performRename = async () => {
  if (!renameForm.value.oldName || !renameForm.value.newName) return;
  if (confirm(`Rename "${renameForm.value.oldName}" to "${renameForm.value.newName}" everywhere? This updates all history.`)) {
    await axios.post(`${API_URL}/settings/rename`, renameForm.value);
    showMsg(`Renamed to ${renameForm.value.newName}`);
    renameForm.value.oldName = null;
    renameForm.value.newName = '';
    fetchAll();
  }
};

const addTemplate = async () => {
  if(!templateForm.value.name) return;
  await axios.post(`${API_URL}/templates`, templateForm.value);
  templateForm.value = {};
  fetchSettings();
};

const saveTemplate = async () => {
  await axios.put(`${API_URL}/templates/${editForm.value.id}`, editForm.value);
  editingId.value = null;
  fetchSettings();
};

const deleteTemplate = async (id) => {
  if(confirm('Delete from master list?')) {
    await axios.delete(`${API_URL}/templates/${id}`);
    fetchSettings();
  }
};

const getChipColor = (who) => {
  const map = { 'Joint': 'orange', 'f1': 'blue', 'f2': 'cyan', 's': 'green', 'Matt': 'deep-purple' };
  return map[who] || 'grey';
};

onMounted(() => {
    fetchAll();
    window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <v-app>
    <v-navigation-drawer v-model="drawer" app color="surface">
      <div class="pa-4">
        <h2 class="text-h6 font-weight-bold text-primary d-flex align-center">
          <v-icon icon="mdi-bank" class="mr-2"></v-icon> Money 2.0
        </h2>
      </div>
      <v-divider></v-divider>
      <v-list nav density="compact" class="mt-2">
        <v-list-item prepend-icon="mdi-view-dashboard-outline" title="Dashboard" value="dashboard" @click="tab = 'dashboard'" :active="tab === 'dashboard'" color="primary" rounded="xl"></v-list-item>
        <v-list-item prepend-icon="mdi-wallet-outline" title="Budget" value="budget" @click="tab = 'budget'" :active="tab === 'budget'" color="primary" rounded="xl"></v-list-item>
        <v-list-item prepend-icon="mdi-piggy-bank-outline" title="Savings" value="savings" @click="tab = 'savings'" :active="tab === 'savings'" color="primary" rounded="xl"></v-list-item>
        <v-list-item prepend-icon="mdi-home-city-outline" title="Mortgage" value="mortgage" @click="tab = 'mortgage'" :active="tab === 'mortgage'" color="primary" rounded="xl"></v-list-item>
        <v-list-item prepend-icon="mdi-gift-outline" title="Christmas" value="christmas" @click="tab = 'christmas'" :active="tab === 'christmas'" color="primary" rounded="xl"></v-list-item>
        <v-list-item prepend-icon="mdi-test-tube" title="Sandbox" value="sandbox" @click="tab = 'sandbox'" :active="tab === 'sandbox'" color="primary" rounded="xl"></v-list-item>
        <v-list-item prepend-icon="mdi-cog-outline" title="Settings" value="settings" @click="tab = 'settings'" :active="tab === 'settings'" color="primary" rounded="xl"></v-list-item>
      </v-list>
    </v-navigation-drawer>

    <v-app-bar elevation="1" color="surface">
      <v-app-bar-nav-icon @click="drawer = !drawer"></v-app-bar-nav-icon>
      <v-app-bar-title class="font-weight-bold text-primary">
        {{ tab.charAt(0).toUpperCase() + tab.slice(1) }}
      </v-app-bar-title>
      <v-spacer></v-spacer>
      <v-btn :icon="showCalculator ? 'mdi-calculator' : 'mdi-calculator-variant-outline'" @click="showCalculator = !showCalculator" :color="showCalculator ? 'primary' : 'medium-emphasis'" class="mr-2" title="Calculator"></v-btn>
      <v-btn :icon="isDark ? 'mdi-weather-sunny' : 'mdi-weather-night'" @click="toggleTheme" color="medium-emphasis"></v-btn>
    </v-app-bar>

    <v-card v-if="showCalculator" elevation="8" class="calculator-card rounded-lg" :class="isDark ? 'bg-grey-darken-3' : 'bg-white'" width="260">
      <v-card-title class="d-flex justify-space-between align-center py-2 px-3 bg-primary text-white">
        <span class="text-caption font-weight-bold">Quick Calc</span>
        <v-icon size="small" @click="showCalculator = false">mdi-close</v-icon>
      </v-card-title>
      <div class="d-flex justify-space-between align-center pa-2 border-b mb-2">
            <v-btn icon="mdi-content-copy" size="x-small" variant="text" color="medium-emphasis" @click="copyToClipboard" title="Copy Result"></v-btn>
            <div class="text-h5 font-monospace text-end flex-grow-1">{{ calcDisplay }}</div>
      </div>
      <div class="pa-2">
        <v-row dense>
          <v-col cols="3"><v-btn block size="small" variant="tonal" @click="calcClear" color="error">C</v-btn></v-col>
          <v-col cols="3"><v-btn block size="small" variant="tonal" @click="calcSetOp('/')">/</v-btn></v-col>
          <v-col cols="3"><v-btn block size="small" variant="tonal" @click="calcSetOp('*')">x</v-btn></v-col>
          <v-col cols="3"><v-btn block size="small" variant="tonal" @click="calcSetOp('-')">-</v-btn></v-col>
          
          <v-col cols="3"><v-btn block size="small" variant="text" @click="calcAppend(7)">7</v-btn></v-col>
          <v-col cols="3"><v-btn block size="small" variant="text" @click="calcAppend(8)">8</v-btn></v-col>
          <v-col cols="3"><v-btn block size="small" variant="text" @click="calcAppend(9)">9</v-btn></v-col>
          <v-col cols="3"><v-btn block size="small" variant="tonal" @click="calcSetOp('+')" class="h-100">+</v-btn></v-col>

          <v-col cols="3"><v-btn block size="small" variant="text" @click="calcAppend(4)">4</v-btn></v-col>
          <v-col cols="3"><v-btn block size="small" variant="text" @click="calcAppend(5)">5</v-btn></v-col>
          <v-col cols="3"><v-btn block size="small" variant="text" @click="calcAppend(6)">6</v-btn></v-col>
          <v-col cols="3"></v-col>

          <v-col cols="3"><v-btn block size="small" variant="text" @click="calcAppend(1)">1</v-btn></v-col>
          <v-col cols="3"><v-btn block size="small" variant="text" @click="calcAppend(2)">2</v-btn></v-col>
          <v-col cols="3"><v-btn block size="small" variant="text" @click="calcAppend(3)">3</v-btn></v-col>
          <v-col cols="3" style="margin-top: -38px"><v-btn block size="small" color="primary" @click="calcCompute" class="h-100">=</v-btn></v-col>

          <v-col cols="6"><v-btn block size="small" variant="text" @click="calcAppend(0)">0</v-btn></v-col>
          <v-col cols="3"><v-btn block size="small" variant="text" @click="calcAppend('.')">.</v-btn></v-col>
        </v-row>
      </div>
    </v-card>

    <v-card 
        v-if="selectedExpenses.length > 0" 
        elevation="6" 
        class="floating-selection-bar rounded-pill px-6 py-3 d-flex align-center" 
        :class="isDark ? 'bg-grey-darken-3' : 'bg-white'"
    >
        <div class="mr-4 text-subtitle-2 font-weight-bold">
            <span class="text-primary">{{ selectedExpenses.length }}</span> Selected
        </div>
        <div class="text-h6 font-weight-black text-primary mr-6">
            £{{ selectedTotal.toFixed(2) }}
        </div>
        <v-btn icon="mdi-close" variant="text" size="small" @click="selectedExpenses = []"></v-btn>
    </v-card>


    <v-main :class="isDark ? 'bg-grey-darken-4' : 'bg-grey-lighten-4'">
      <v-container class="py-6" fluid style="max-width: 1400px;">

        <div v-if="tab === 'dashboard'">
            <div class="d-flex align-center justify-space-between mb-6">
                <h2 class="text-h5 font-weight-bold">Financial Year {{ fyString }}</h2>
                <div class="d-flex align-center">
                    <v-btn icon="mdi-chevron-left" variant="text" @click="financialYearStart--"></v-btn>
                    <span class="font-weight-bold text-h6 mx-2">{{ financialYearStart }}</span>
                    <v-btn icon="mdi-chevron-right" variant="text" @click="financialYearStart++"></v-btn>
                </div>
            </div>

            <v-card class="mb-6 rounded-xl bg-grey-darken-4 text-white pa-6" elevation="4">
                <div class="d-flex align-center justify-space-between">
                    <div>
                        <div class="text-subtitle-1 text-grey-lighten-1">Total Net Worth</div>
                        <div class="text-h3 font-weight-black mt-1">£{{ totalNetWorth.toLocaleString() }}</div>
                        <div class="text-caption text-grey mt-2">
                            Equity (£{{ estimatedEquity.toLocaleString() }}) + 
                            Savings (£{{ totalSavings.toLocaleString() }}) + 
                            Cash (£{{ currentBalance.toLocaleString() }})
                        </div>
                    </div>
                    <v-icon icon="mdi-chart-line-variant" size="64" class="opacity-20"></v-icon>
                </div>
            </v-card>

            <v-row>
                <v-col cols="12" md="6">
                    <v-card class="rounded-lg h-100 pa-4" elevation="2">
                        <div class="text-h6 font-weight-bold mb-4">Yearly Overview</div>
                        <div class="d-flex justify-space-between mb-2">
                            <span>Total Income</span>
                            <span class="font-weight-bold text-green">+£{{ dashboardData.totalIncome.toLocaleString() }}</span>
                        </div>
                        <v-progress-linear :model-value="100" color="green-lighten-2" height="8" rounded></v-progress-linear>
                        <div class="d-flex justify-space-between mt-6 mb-2">
                            <span>Total Expenses</span>
                            <span class="font-weight-bold text-red">-£{{ dashboardData.totalExpenses.toLocaleString() }}</span>
                        </div>
                        <v-progress-linear :model-value="100" color="red-lighten-2" height="8" rounded></v-progress-linear>
                        <div class="mt-6 pa-4 rounded text-center" :class="isDark ? 'bg-grey-darken-3' : 'bg-grey-lighten-4'">
                            <div class="text-caption text-medium-emphasis">Savings Rate</div>
                            <div class="text-h5 font-weight-bold" :class="dashboardData.totalIncome > dashboardData.totalExpenses ? 'text-green' : 'text-red'">
                                {{ dashboardData.totalIncome > 0 ? Math.round(((dashboardData.totalIncome - dashboardData.totalExpenses) / dashboardData.totalIncome) * 100) : 0 }}%
                            </div>
                        </div>
                    </v-card>
                </v-col>
                <v-col cols="12" md="6">
                    <v-card class="rounded-lg h-100 pa-4" elevation="2">
                        <div class="text-h6 font-weight-bold mb-4">Spending by Category</div>
                        <div v-if="dashboardData.categoryBreakdown.length === 0" class="text-center text-medium-emphasis py-8">No data for this year</div>
                        <div v-else class="d-flex flex-column gap-3">
                            <div v-for="cat in sortedCategoryBreakdown" :key="cat.category" class="mb-3">
                                <div class="d-flex justify-space-between mb-1">
                                    <span class="text-body-2 font-weight-medium">{{ cat.category }}</span>
                                    <span class="text-body-2 font-weight-bold">£{{ cat.total.toLocaleString() }}</span>
                                </div>
                                <v-progress-linear :model-value="(cat.total / dashboardData.totalExpenses) * 100" color="primary" height="6" rounded></v-progress-linear>
                            </div>
                        </div>
                    </v-card>
                </v-col>
            </v-row>
        </div>

        <div v-else-if="tab === 'budget'">
            <v-card class="mb-6 rounded-xl mx-auto" elevation="2" max-width="600">
                <div class="d-flex align-center justify-space-between pa-2">
                    <div style="width: 40px"></div>
                    <div class="d-flex align-center">
                        <v-btn icon="mdi-chevron-left" @click="changeMonth(-1)" variant="text" size="large" color="primary"></v-btn>
                        <h2 class="text-h5 font-weight-bold text-primary mx-6 mb-0">{{ formattedMonth }}</h2>
                        <v-btn icon="mdi-chevron-right" @click="changeMonth(1)" variant="text" size="large" color="primary"></v-btn>
                    </div>
                    <div style="width: 40px" class="d-flex justify-end">
                        <v-btn v-if="expenses.length > 0" icon="mdi-delete-sweep-outline" color="red-lighten-1" variant="text" title="Reset Month" @click="resetMonth"></v-btn>
                    </div>
                </div>
            </v-card>

            <v-alert v-if="expenses.length === 0" type="info" variant="tonal" class="mb-6 rounded-lg border-opacity-100" border="start" elevation="2">
                <div class="d-flex align-center justify-space-between">
                    <span>No transactions found.</span>
                    <div>
                        <v-btn color="primary" class="mr-2" @click="initMonth('template')">Use Master List</v-btn>
                        <v-btn variant="outlined" @click="initMonth('previous')">Copy Last Month</v-btn>
                    </div>
                </div>
            </v-alert>

            <div v-else>
                <v-row class="mb-4">
                    <v-col cols="12" sm="6" md="3">
                        <v-card class="h-100 rounded-lg pa-5 text-center d-flex flex-column justify-center" elevation="2">
                            <div class="text-subtitle-1 text-medium-emphasis font-weight-medium mb-2">Starting Salary</div>
                            <v-text-field v-model.number="salary" prefix="£" variant="underlined" class="text-h4 font-weight-bold centered-input text-primary" hide-details type="number" append-inner-icon="mdi-content-save" @click:append-inner="updateSalary" @keydown.enter="updateSalary"></v-text-field>
                        </v-card>
                    </v-col>
                    <v-col cols="12" sm="6" md="3">
                        <v-card class="h-100 rounded-lg pa-5 text-center d-flex flex-column justify-center" elevation="2" :color="currentBalance < 0 ? 'red-lighten-5' : undefined">
                            <div class="text-subtitle-1 text-medium-emphasis font-weight-medium mb-2">Current Balance</div>
                            <v-text-field v-model.number="currentBalance" prefix="£" variant="underlined" class="text-h4 font-weight-black centered-input" :class="currentBalance < 0 ? 'text-red' : 'text-blue-darken-2'" hide-details type="number" append-inner-icon="mdi-content-save" @click:append-inner="updateBalance" @keydown.enter="updateBalance"></v-text-field>
                        </v-card>
                    </v-col>
                    <v-col cols="12" sm="6" md="3">
                        <v-card class="h-100 rounded-lg pa-5 text-center" :color="projectedBalance < 0 ? 'red-lighten-5' : undefined" elevation="2">
                            <div class="text-subtitle-1 text-medium-emphasis font-weight-medium mb-1">Projected End</div>
                            <div class="text-h4 font-weight-black" :class="projectedBalance < 0 ? 'text-red' : 'text-green'">£{{ projectedBalance.toFixed(2) }}</div>
                            <v-progress-linear v-model="progressPercentage" :color="projectedBalance < 0 ? 'red' : 'green'" height="6" rounded class="mt-4" striped></v-progress-linear>
                        </v-card>
                    </v-col>
                    <v-col cols="12" sm="6" md="3">
                        <v-card class="h-100 rounded-lg pa-5" elevation="2">
                            <div class="d-flex align-center mb-2 justify-space-between">
                                <span class="text-subtitle-1 text-medium-emphasis font-weight-bold">Unpaid Split</span>
                                <span v-if="Object.keys(breakdownByWho).length === 0" class="text-green font-weight-bold">All Clear! 🎉</span>
                            </div>
                            <div class="d-flex flex-column gap-1" style="max-height: 100px; overflow-y: auto;">
                                <div v-for="(amount, person) in breakdownByWho" :key="person" class="d-flex justify-space-between align-center py-1 border-b">
                                    <v-chip size="x-small" :color="getChipColor(person)" class="font-weight-bold text-uppercase px-2">{{ person }}</v-chip>
                                    <span class="text-red-darken-1 font-weight-bold font-monospace text-body-2">£{{ amount.toFixed(2) }}</span>
                                </div>
                            </div>
                        </v-card>
                    </v-col>
                </v-row>

                <v-card class="rounded-lg mb-8" elevation="3">
                    <v-card-text class="pa-4 bg-background">
                    <v-row dense align="center">
                        <v-col style="width: 50px; flex: 0 0 auto"></v-col>
                        <template v-for="col in expenseColumns" :key="col.key">
                            
                            <v-col v-if="col.key === 'status'" :style="{ width: col.width, flex: '0 0 auto' }">
                                <v-icon icon="mdi-plus" color="primary" class="ml-4"></v-icon>
                            </v-col>
                            <v-col v-else-if="col.key === 'who'" :style="{ width: col.width, flex: '0 0 auto' }">
                                <v-select v-model="newExpenseWho" :items="availablePeople" density="compact" variant="plain" hide-details placeholder="Who"></v-select>
                            </v-col>
                            <v-col v-else-if="col.key === 'name'" cols="auto" style="flex-grow: 1;">
                                <v-text-field v-model="newExpenseName" label="New Bill Name" density="comfortable" variant="solo" hide-details prepend-inner-icon="mdi-pencil" bg-color="surface"></v-text-field>
                            </v-col>
                            <v-col v-else-if="col.key === 'amount'" :style="{ width: col.width, flex: '0 0 auto' }">
                                <v-text-field v-model.number="newExpenseAmount" type="number" prefix="£" density="comfortable" variant="solo" hide-details bg-color="surface"></v-text-field>
                            </v-col>
                            <v-col v-else-if="col.key === 'category'" :style="{ width: col.width, flex: '0 0 auto' }">
                                <v-select v-model="newExpenseCategory" :items="availableCategories" density="compact" variant="plain" hide-details placeholder="Cat"></v-select>
                            </v-col>
                            <v-col v-else-if="col.key === 'actions'" :style="{ width: col.width, flex: '0 0 auto' }" class="text-end">
                                <v-btn color="primary" block height="48" @click="addExpense" class="text-subtitle-1 font-weight-bold">Add</v-btn>
                            </v-col>
                        </template>
                    </v-row>
                    </v-card-text>
                    <v-divider></v-divider>
                    <v-table hover class="expenses-table">
                    <thead>
                        <draggable v-model="expenseColumns" tag="tr" item-key="key" @end="saveColumnLayout" class="bg-background">
                            <template #item="{ element: col }">
                                <th :style="{ width: col.width, cursor: col.key === 'select' ? 'default' : 'move' }" :class="['text-subtitle-2', 'py-4', 'font-weight-bold', 'text-' + col.align]" @click="col.sortable ? sortBy(col.key) : null">
                                    <div class="d-flex align-center" :class="{ 'justify-end': col.align === 'right' || col.align === 'end', 'justify-center': col.align === 'center' }">
                                        {{ col.label }}
                                        <v-icon size="small" v-if="col.sortable && sortKey === col.key" class="ml-1">{{ sortOrder === 1 ? 'mdi-arrow-up' : 'mdi-arrow-down' }}</v-icon>
                                    </div>
                                </th>
                            </template>
                        </draggable>
                    </thead>
                    <tbody>
                        <tr v-for="expense in sortedExpenses" :key="expense.id" :class="{'bg-green-lighten-5': !isDark && expense.paid, 'text-medium-emphasis': expense.paid, 'bg-amber-lighten-5': !isDark && editingId === expense.id, 'bg-grey-darken-3': isDark && editingId === expense.id}" style="transition: background-color 0.2s;">
                            <td v-for="col in expenseColumns" :key="col.key" :class="'text-' + col.align">
                                <template v-if="col.key === 'select'">
                                    <v-checkbox-btn v-model="selectedExpenses" :value="expense.id" density="compact" hide-details></v-checkbox-btn>
                                </template>
                                <template v-else-if="col.key === 'status'">
                                    <v-btn :color="expense.paid ? 'green' : 'grey-lighten-1'" :icon="expense.paid ? 'mdi-check-bold' : 'mdi-circle-outline'" size="small" :variant="expense.paid ? 'elevated' : 'text'" @click="togglePaid(expense)" elevation="0"></v-btn>
                                </template>
                                <template v-else-if="col.key === 'who'">
                                    <v-select v-if="editingId === expense.id" v-model="editForm.who" :items="availablePeople" density="compact" variant="outlined" hide-details></v-select>
                                    <v-chip v-else :color="getChipColor(expense.who)" size="small" label class="font-weight-bold text-uppercase elevation-1">{{ expense.who || '-' }}</v-chip>
                                </template>
                                <template v-else-if="col.key === 'name'">
                                    <v-text-field v-if="editingId === expense.id" v-model="editForm.name" density="compact" variant="outlined" hide-details></v-text-field>
                                    <span v-else class="text-body-1 font-weight-medium" :class="{'text-decoration-line-through': expense.paid}">{{ expense.name }}</span>
                                </template>
                                <template v-else-if="col.key === 'amount'">
                                    <v-text-field v-if="editingId === expense.id" v-model.number="editForm.amount" type="number" density="compact" variant="outlined" hide-details></v-text-field>
                                    <span v-else class="text-h6 font-weight-bold font-monospace" :class="expense.paid ? 'text-decoration-line-through' : ''">£{{ expense.amount.toFixed(2) }}</span>
                                </template>
                                <template v-else-if="col.key === 'category'">
                                    <v-select v-if="editingId === expense.id" v-model="editForm.category" :items="availableCategories" density="compact" variant="outlined" hide-details></v-select>
                                    <div v-else class="d-flex align-center text-caption text-medium-emphasis"><v-icon icon="mdi-tag-outline" size="small" class="mr-1"></v-icon>{{ expense.category }}</div>
                                </template>
                                <template v-else-if="col.key === 'actions'">
                                    <div v-if="editingId === expense.id" class="d-flex justify-end"><v-btn icon="mdi-check" color="green" size="small" variant="text" @click="saveExpense"></v-btn><v-btn icon="mdi-close" color="red" size="small" variant="text" @click="cancelEdit"></v-btn></div>
                                    <v-btn v-else icon="mdi-pencil" size="x-small" color="grey" variant="text" @click="startEdit(expense)"></v-btn>
                                </template>
                            </td>
                        </tr>
                    </tbody>
                    </v-table>
                </v-card>
            </div>
        </div>

        <div v-else-if="tab === 'sandbox'">
            <v-alert icon="mdi-test-tube" title="Sandbox Mode" variant="tonal" color="deep-purple-accent-2" class="mb-6 rounded-lg">
                This area is isolated from your actual budget. Use it to model scenarios (e.g. "Minimal Viable Budget"). 
                <template v-slot:append>
                    <v-btn color="deep-purple-darken-1" @click="importSandbox" prepend-icon="mdi-import">Clone Current Month</v-btn>
                </template>
            </v-alert>

            <v-card class="mb-6 pa-4 rounded-lg" elevation="2" border>
                <div class="d-flex align-center mb-4">
                    <v-icon icon="mdi-bookmark-outline" color="deep-purple" class="mr-2"></v-icon>
                    <span class="text-subtitle-1 font-weight-bold">Saved Scenarios</span>
                </div>
                <div class="d-flex align-center mb-4">
                    <v-text-field v-model="newProfileName" density="compact" variant="outlined" label="Save current state as..." hide-details class="mr-2" style="max-width: 300px;" bg-color="surface"></v-text-field>
                    <v-btn color="deep-purple" @click="saveSandboxProfile" :disabled="!newProfileName">Save Scenario</v-btn>
                </div>
                <div v-if="sandboxProfiles.length > 0" class="d-flex flex-wrap gap-2">
                    <v-chip v-for="prof in sandboxProfiles" :key="prof.id" color="deep-purple" variant="outlined" class="font-weight-medium" closable close-icon="mdi-delete" @click:close="deleteSandboxProfile(prof.id)">
                        {{ prof.name }} (Salary: £{{ prof.salary }})
                        <template v-slot:append>
                            <v-btn size="x-small" variant="text" icon="mdi-upload" color="deep-purple" class="ml-1" title="Load" @click.stop="loadSandboxProfile(prof.id)"></v-btn>
                        </template>
                    </v-chip>
                </div>
                <div v-else class="text-caption text-medium-emphasis">No saved scenarios yet.</div>
            </v-card>

            <v-row class="mb-4">
                <v-col cols="12" md="6">
                    <v-card class="rounded-lg pa-5 h-100" elevation="2">
                        <div class="text-overline text-medium-emphasis">Hypothetical Income</div>
                        <v-text-field v-model.number="sandboxSalary" prefix="£" variant="underlined" class="text-h4 font-weight-bold" hide-details></v-text-field>
                    </v-card>
                </v-col>
                <v-col cols="12" md="6">
                    <v-card class="rounded-lg pa-5 h-100" :color="sandboxRemaining < 0 ? (isDark ? 'red-darken-4' : 'red-lighten-5') : (isDark ? 'green-darken-4' : 'green-lighten-5')" elevation="2">
                        <div class="text-overline text-medium-emphasis">Hypothetical Balance</div>
                        <div class="text-h4 font-weight-black" :class="sandboxRemaining < 0 ? 'text-red-lighten-1' : 'text-green-lighten-1'">
                            £{{ sandboxRemaining.toFixed(2) }}
                        </div>
                        <div class="text-caption mt-1">Income - Total Sandbox Expenses</div>
                    </v-card>
                </v-col>
            </v-row>

            <v-card class="rounded-lg mb-8" elevation="3" border="top">
                <v-card-text class="pa-4 bg-background">
                    <v-row dense align="center">
                        <v-col cols="12" sm="3"><v-select v-model="newSandboxItem.who" :items="availablePeople" density="compact" variant="solo" hide-details label="Who" bg-color="surface"></v-select></v-col>
                        <v-col cols="12" sm="3"><v-text-field v-model="newSandboxItem.name" label="Item Name" density="compact" variant="solo" hide-details bg-color="surface"></v-text-field></v-col>
                        <v-col cols="12" sm="2"><v-text-field v-model="newSandboxItem.amount" label="Amount" prefix="£" type="number" density="compact" variant="solo" hide-details bg-color="surface"></v-text-field></v-col>
                        <v-col cols="12" sm="2"><v-select v-model="newSandboxItem.category" :items="availableCategories" density="compact" variant="solo" hide-details label="Cat" bg-color="surface"></v-select></v-col>
                        <v-col cols="12" sm="2"><v-btn block color="deep-purple" @click="addSandboxExpense" height="40">Add</v-btn></v-col>
                    </v-row>
                </v-card-text>
                <v-divider></v-divider>

                <v-table hover>
                    <thead>
                        <tr :class="isDark ? 'bg-grey-darken-3' : 'bg-grey-lighten-4'">
                            <th @click="sortSandbox('who')" class="cursor-pointer font-weight-bold">Who <v-icon size="x-small" v-if="sandboxSortKey === 'who'">{{ sandboxSortOrder === 1 ? 'mdi-arrow-up' : 'mdi-arrow-down' }}</v-icon></th>
                            <th @click="sortSandbox('name')" class="cursor-pointer font-weight-bold">Item Name <v-icon size="x-small" v-if="sandboxSortKey === 'name'">{{ sandboxSortOrder === 1 ? 'mdi-arrow-up' : 'mdi-arrow-down' }}</v-icon></th>
                            <th @click="sortSandbox('amount')" class="text-end cursor-pointer font-weight-bold">Amount <v-icon size="x-small" v-if="sandboxSortKey === 'amount'">{{ sandboxSortOrder === 1 ? 'mdi-arrow-up' : 'mdi-arrow-down' }}</v-icon></th>
                            <th @click="sortSandbox('category')" class="cursor-pointer font-weight-bold">Category <v-icon size="x-small" v-if="sandboxSortKey === 'category'">{{ sandboxSortOrder === 1 ? 'mdi-arrow-up' : 'mdi-arrow-down' }}</v-icon></th>
                            <th class="text-end">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="item in sortedSandboxExpenses" :key="item.id" :class="editingId === item.id ? (isDark ? 'bg-grey-darken-3' : 'bg-amber-lighten-5') : ''">
                            
                            <td>
                                <v-select v-if="editingId === item.id" v-model="editForm.who" :items="availablePeople" density="compact" variant="outlined" hide-details></v-select>
                                <v-chip v-else :color="getChipColor(item.who)" size="small" label class="font-weight-bold text-uppercase">{{ item.who || '-' }}</v-chip>
                            </td>

                            <td class="font-weight-medium">
                                <v-text-field v-if="editingId === item.id" v-model="editForm.name" density="compact" variant="outlined" hide-details></v-text-field>
                                <span v-else>{{ item.name }}</span>
                            </td>

                            <td class="text-end font-monospace text-red-lighten-1">
                                <v-text-field v-if="editingId === item.id" v-model.number="editForm.amount" type="number" density="compact" variant="outlined" hide-details></v-text-field>
                                <span v-else>£{{ item.amount.toFixed(2) }}</span>
                            </td>

                            <td>
                                <v-select v-if="editingId === item.id" v-model="editForm.category" :items="availableCategories" density="compact" variant="outlined" hide-details></v-select>
                                <span v-else class="text-caption text-medium-emphasis">{{ item.category }}</span>
                            </td>

                            <td class="text-end" style="min-width: 100px;">
                                <div v-if="editingId === item.id">
                                    <v-btn icon="mdi-check" color="green" size="small" variant="text" @click="saveSandboxExpense"></v-btn>
                                    <v-btn icon="mdi-close" color="red" size="small" variant="text" @click="cancelEdit"></v-btn>
                                </div>
                                <div v-else>
                                    <v-btn icon="mdi-pencil" color="grey" variant="text" size="small" @click="startEdit(item)"></v-btn>
                                    <v-btn icon="mdi-delete" color="grey" variant="text" size="small" @click="deleteSandboxExpense(item.id)"></v-btn>
                                </div>
                            </td>
                        </tr>
                        <tr class="font-weight-bold" :class="isDark ? 'bg-grey-darken-3' : 'bg-grey-lighten-4'">
                            <td colspan="2">TOTAL</td>
                            <td class="text-end text-red-lighten-1">£{{ sandboxTotalExpenses.toFixed(2) }}</td>
                            <td colspan="2"></td>
                        </tr>
                    </tbody>
                </v-table>
                <v-card-actions class="justify-end">
                    <v-btn color="error" variant="text" @click="clearSandbox">Clear All</v-btn>
                </v-card-actions>
            </v-card>
        </div>

        <div v-else-if="tab === 'christmas'">
             <v-row class="mb-6">
                <v-col cols="12" md="6">
                    <v-card class="pa-6 rounded-xl bg-green-darken-3 text-white d-flex align-center justify-space-between" elevation="4">
                        <div>
                            <div class="text-h6 font-weight-medium opacity-80">Total Budget</div>
                            <div class="text-h3 font-weight-black mt-1">£{{ christmasTotalBudget.toLocaleString() }}</div>
                        </div>
                        <v-icon icon="mdi-gift" size="64" class="opacity-30"></v-icon>
                    </v-card>
                </v-col>
                <v-col cols="12" md="6">
                    <v-card class="pa-6 rounded-xl text-white d-flex align-center justify-space-between" :class="christmasRemaining < 0 ? 'bg-red-darken-3' : 'bg-blue-grey-darken-3'" elevation="4">
                        <div>
                            <div class="text-h6 font-weight-medium opacity-80">Remaining to Buy</div>
                            <div class="text-h3 font-weight-black mt-1">£{{ christmasRemaining.toLocaleString() }}</div>
                        </div>
                        <v-icon icon="mdi-cart-outline" size="64" class="opacity-30"></v-icon>
                    </v-card>
                </v-col>
            </v-row>

            <v-card class="rounded-lg mb-8" elevation="3">
                <v-card-text class="pa-4 bg-background">
                    <v-row dense align="center">
                        <v-col cols="12" sm="4"><v-text-field v-model="newGift.recipient" label="Recipient Name" density="compact" variant="solo" hide-details bg-color="surface" prepend-inner-icon="mdi-account"></v-text-field></v-col>
                        <v-col cols="12" sm="4"><v-text-field v-model="newGift.item" label="Gift Idea" density="compact" variant="solo" hide-details bg-color="surface" prepend-inner-icon="mdi-gift-outline"></v-text-field></v-col>
                        <v-col cols="12" sm="2"><v-text-field v-model="newGift.amount" label="Cost" prefix="£" type="number" density="compact" variant="solo" hide-details bg-color="surface"></v-text-field></v-col>
                        <v-col cols="12" sm="2"><v-btn block color="green" @click="addChristmasGift" height="40" class="text-white font-weight-bold">Add Gift</v-btn></v-col>
                    </v-row>
                </v-card-text>
                <v-divider></v-divider>

                <v-table hover>
                    <thead>
                        <tr :class="isDark ? 'bg-grey-darken-3' : 'bg-grey-lighten-4'">
                            <th width="50" class="text-center">Got It?</th>
                            <th @click="sortChristmas('recipient')" class="cursor-pointer font-weight-bold">Recipient <v-icon size="x-small" v-if="christmasSortKey === 'recipient'">{{ christmasSortOrder === 1 ? 'mdi-arrow-up' : 'mdi-arrow-down' }}</v-icon></th>
                            <th @click="sortChristmas('item')" class="cursor-pointer font-weight-bold">Gift Idea <v-icon size="x-small" v-if="christmasSortKey === 'item'">{{ christmasSortOrder === 1 ? 'mdi-arrow-up' : 'mdi-arrow-down' }}</v-icon></th>
                            <th @click="sortChristmas('amount')" class="text-end cursor-pointer font-weight-bold">Amount <v-icon size="x-small" v-if="christmasSortKey === 'amount'">{{ christmasSortOrder === 1 ? 'mdi-arrow-up' : 'mdi-arrow-down' }}</v-icon></th>
                            <th class="text-end">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="gift in sortedChristmasList" :key="gift.id" :class="{'bg-green-lighten-5': !isDark && gift.bought, 'text-medium-emphasis': gift.bought, 'bg-grey-darken-3': isDark && (editingId === gift.id || gift.bought)}">
                            <td class="text-center">
                                <v-checkbox-btn v-model="gift.bought" @change="toggleChristmasBought(gift)" color="green" density="compact" hide-details></v-checkbox-btn>
                            </td>
                            <td class="font-weight-bold">
                                <v-text-field v-if="editingId === gift.id" v-model="editForm.recipient" density="compact" variant="outlined" hide-details></v-text-field>
                                <span v-else>{{ gift.recipient }}</span>
                            </td>
                            <td>
                                <v-text-field v-if="editingId === gift.id" v-model="editForm.item" density="compact" variant="outlined" hide-details></v-text-field>
                                <span v-else>{{ gift.item }}</span>
                            </td>
                            <td class="text-end font-monospace">
                                <v-text-field v-if="editingId === gift.id" v-model.number="editForm.amount" type="number" density="compact" variant="outlined" hide-details></v-text-field>
                                <span v-else>£{{ gift.amount.toFixed(2) }}</span>
                            </td>
                            <td class="text-end">
                                <div v-if="editingId === gift.id">
                                    <v-btn icon="mdi-check" color="green" size="small" variant="text" @click="saveChristmasGift"></v-btn>
                                    <v-btn icon="mdi-close" color="red" size="small" variant="text" @click="cancelEdit"></v-btn>
                                </div>
                                <div v-else>
                                    <v-btn icon="mdi-pencil" color="grey" variant="text" size="small" @click="startEdit(gift)"></v-btn>
                                    <v-btn icon="mdi-delete" color="grey" variant="text" size="small" @click="deleteChristmasGift(gift.id)"></v-btn>
                                </div>
                            </td>
                        </tr>
                        <tr class="font-weight-bold" :class="isDark ? 'bg-grey-darken-3' : 'bg-grey-lighten-4'">
                            <td colspan="3" class="text-end">TOTAL SPENT / BUDGET</td>
                            <td class="text-end">£{{ christmasSpent.toFixed(2) }} / £{{ christmasTotalBudget.toFixed(2) }}</td>
                            <td></td>
                        </tr>
                    </tbody>
                </v-table>
            </v-card>
        </div>

        <div v-else-if="tab === 'savings'">
            <v-row class="mb-6">
                <v-col cols="12">
                    <v-card class="pa-6 rounded-xl bg-primary text-white d-flex align-center justify-space-between" elevation="4">
                        <div>
                            <div class="text-h6 font-weight-medium opacity-80">Total Savings</div>
                            <div class="text-h3 font-weight-black mt-1">£{{ totalSavings.toFixed(2) }}</div>
                        </div>
                        <v-icon icon="mdi-safe" size="64" class="opacity-30"></v-icon>
                    </v-card>
                </v-col>
            </v-row>

            <div class="d-flex align-center mb-4">
                <v-text-field v-model="newAccountName" density="compact" variant="solo" label="New Bank Account Name" hide-details class="mr-2" style="max-width: 300px;" bg-color="surface"></v-text-field>
                <v-btn color="primary" @click="addAccount" prepend-icon="mdi-plus">Add Account</v-btn>
            </div>

            <v-row>
                <v-col v-for="acc in savingsAccounts" :key="acc.id" cols="12" md="6">
                    <v-card class="rounded-lg h-100" elevation="2">
                        <v-card-title class="d-flex align-center justify-space-between bg-background pa-4">
                            <div class="d-flex align-center">
                                <v-icon icon="mdi-bank-outline" class="mr-2" color="primary"></v-icon>
                                <span class="font-weight-bold">{{ acc.name }}</span>
                            </div>
                            <div class="text-subtitle-1 font-weight-black text-green">£{{ acc.total.toFixed(2) }}</div>
                        </v-card-title>
                        <v-divider></v-divider>
                        
                        <v-list density="compact" class="pa-0 bg-background">
                            <v-list-item v-for="pot in acc.pots" :key="pot.id" class="border-b">
                                <template v-slot:prepend><v-icon icon="mdi-piggy-bank-outline" size="small" color="grey"></v-icon></template>
                                
                                <v-list-item-title v-if="editingId !== pot.id" class="font-weight-medium">{{ pot.name }}</v-list-item-title>
                                <v-text-field v-else v-model="editForm.name" density="compact" variant="underlined" hide-details></v-text-field>

                                <template v-slot:append>
                                    <div class="d-flex align-center" style="min-width: 120px; justify-content: flex-end;">
                                        <span v-if="editingId !== pot.id" class="font-weight-bold mr-3">£{{ pot.amount.toFixed(2) }}</span>
                                        <v-text-field v-else v-model.number="editForm.amount" type="number" density="compact" variant="underlined" hide-details class="mr-2" style="width: 80px;"></v-text-field>
                                        
                                        <div v-if="editingId === pot.id"><v-btn icon="mdi-check" size="x-small" variant="text" color="green" @click="savePot(editForm)"></v-btn></div>
                                        <div v-else>
                                            <v-btn icon="mdi-pencil" size="x-small" variant="text" color="grey" @click="startEdit(pot)"></v-btn>
                                            <v-btn icon="mdi-delete" size="x-small" variant="text" color="grey" @click="deletePot(pot.id)"></v-btn>
                                        </div>
                                    </div>
                                </template>
                            </v-list-item>
                            
                            <v-list-item @click="addPot(acc.id)" class="cursor-pointer text-primary">
                                <template v-slot:prepend><v-icon icon="mdi-plus"></v-icon></template>
                                <v-list-item-title class="font-weight-bold">Create New Pot</v-list-item-title>
                            </v-list-item>
                        </v-list>

                        <v-divider></v-divider>
                        <v-card-actions class="bg-background">
                            <v-spacer></v-spacer>
                            <v-btn color="error" variant="text" size="small" @click="deleteAccount(acc.id)">Delete Account</v-btn>
                        </v-card-actions>
                    </v-card>
                </v-col>
            </v-row>
        </div>

        <div v-else-if="tab === 'mortgage'">
            <v-row>
                <v-col cols="12">
                    <v-card class="rounded-xl overflow-hidden" elevation="4">
                        <div class="d-flex flex-column flex-md-row">
                            <div class="bg-blue-grey-darken-4 pa-6 flex-grow-1 text-center d-flex flex-column justify-center">
                                <div class="text-subtitle-1 text-grey-lighten-1 mb-1">Estimated Equity</div>
                                <div class="text-h3 font-weight-black text-green-accent-3">£{{ estimatedEquity.toLocaleString('en-GB', { minimumFractionDigits: 2 }) }}</div>
                            </div>
                            <div class="pa-6 flex-grow-1" :class="isDark ? 'bg-grey-darken-3' : 'bg-surface'">
                                <v-row>
                                    <v-col cols="6">
                                        <div class="text-caption text-medium-emphasis">Sold Price</div>
                                        <v-text-field v-model.number="mortgageData.soldPrice" prefix="£" variant="underlined" density="compact" class="text-h6 font-weight-bold" hide-details @change="saveMortgage"></v-text-field>
                                    </v-col>
                                    <v-col cols="6">
                                        <div class="text-caption text-medium-emphasis text-end">Total Debt</div>
                                        <div class="text-h6 font-weight-bold text-red-lighten-1 text-end mt-2">-£{{ totalLiabilities.toLocaleString() }}</div>
                                    </v-col>
                                </v-row>
                            </div>
                        </div>
                    </v-card>
                </v-col>

                <v-col cols="12" md="8">
                    <v-card class="rounded-lg mb-4" elevation="2" title="Mortgages & Loans">
                        <template v-slot:append>
                            <v-btn icon="mdi-plus" variant="text" color="primary" @click="addLoan"></v-btn>
                        </template>
                        <v-card-text class="pa-0">
                            <v-table>
                                <thead>
                                    <tr :class="isDark ? 'bg-grey-darken-3' : 'bg-grey-lighten-4'">
                                        <th>Loan Name</th>
                                        <th class="text-end">Balance</th>
                                        <th class="text-end" style="width: 100px">Rate %</th>
                                        <th class="text-end" style="width: 100px">Term (Y)</th>
                                        <th style="width: 50px"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="(loan, i) in mortgageData.mortgages" :key="loan.id">
                                        <td class="py-2"><v-text-field v-model="loan.name" variant="plain" density="compact" hide-details></v-text-field></td>
                                        <td class="py-2"><v-text-field v-model.number="loan.balance" prefix="£" type="number" variant="plain" density="compact" hide-details class="text-end font-monospace font-weight-bold"></v-text-field></td>
                                        <td class="py-2"><v-text-field v-model.number="loan.rate" suffix="%" type="number" variant="plain" density="compact" hide-details class="text-end text-caption"></v-text-field></td>
                                        <td class="py-2"><v-text-field v-model.number="loan.term" suffix="Yr" type="number" variant="plain" density="compact" hide-details class="text-end text-caption"></v-text-field></td>
                                        <td><v-btn icon="mdi-delete" color="grey-lighten-1" variant="text" size="x-small" @click="removeLoan(i)"></v-btn></td>
                                    </tr>
                                </tbody>
                            </v-table>
                        </v-card-text>
                    </v-card>

                    <v-card class="rounded-lg border-s-lg border-info" elevation="2">
                        <div class="d-flex align-center justify-space-between pa-4">
                            <div class="d-flex align-center">
                                <v-icon icon="mdi-home-group" color="info" class="mr-3" size="large"></v-icon>
                                <div>
                                    <div class="text-subtitle-1 font-weight-bold">Help to Buy Loan</div>
                                    <div class="text-caption text-medium-emphasis">Government Equity Share</div>
                                </div>
                            </div>
                            <div class="d-flex align-center gap-4">
                                <div style="width: 80px">
                                    <v-text-field v-model.number="mortgageData.h2b.percentage" label="Share %" density="compact" variant="outlined" hide-details suffix="%"></v-text-field>
                                </div>
                                <div style="width: 140px">
                                    <v-text-field v-model.number="mortgageData.h2b.balance" label="Balance" prefix="£" density="compact" variant="outlined" hide-details class="font-weight-bold"></v-text-field>
                                </div>
                            </div>
                        </div>
                    </v-card>
                </v-col>

                <v-col cols="12" md="4">
                    <v-card class="rounded-lg pa-4 mb-4" elevation="2">
                        <div class="text-overline mb-2">Details</div>
                        <div class="d-flex justify-space-between mb-2">
                            <span class="text-body-2">Mortgage Debt</span>
                            <span class="font-weight-bold">£{{ totalMortgageBalance.toLocaleString() }}</span>
                        </div>
                        <div class="d-flex justify-space-between mb-4">
                            <span class="text-body-2">H2B Equity Loan</span>
                            <span class="font-weight-bold">£{{ Number(mortgageData.h2b.balance).toLocaleString() }}</span>
                        </div>
                        <v-divider class="mb-4"></v-divider>
                        <v-btn block color="primary" size="large" @click="saveMortgage" prepend-icon="mdi-content-save">Save Changes</v-btn>
                    </v-card>
                </v-col>
            </v-row>
        </div>

        <div v-else-if="tab === 'settings'">
          <v-row>
            <v-col cols="12" md="4">
              <v-card class="mb-4 rounded-lg pa-4 border-s-lg border-primary" elevation="3">
                <h3 class="text-h6 mb-2 d-flex align-center"><v-icon icon="mdi-pencil-box-multiple-outline" class="mr-2" color="primary"></v-icon> Global Rename</h3>
                <p class="text-caption text-medium-emphasis mb-3">Fix typos or rename people/categories in all past and future records.</p>
                <v-radio-group v-model="renameForm.type" inline density="compact" hide-details class="mb-2">
                    <v-radio label="Person" value="people"></v-radio>
                    <v-radio label="Category" value="categories"></v-radio>
                </v-radio-group>
                <v-select v-model="renameForm.oldName" :items="renameForm.type === 'people' ? availablePeople : availableCategories" label="Find..." density="compact" variant="outlined" bg-color="surface"></v-select>
                <v-text-field v-model="renameForm.newName" label="Replace With..." density="compact" variant="outlined" bg-color="surface"></v-text-field>
                <v-btn block color="primary" :disabled="!renameForm.oldName || !renameForm.newName" @click="performRename">Rename Everywhere</v-btn>
              </v-card>

              <v-card class="mb-4 rounded-lg pa-4" elevation="2">
                <h3 class="text-h6 mb-4">Default Salary</h3>
                <v-text-field v-model="defaultSalary" @change="saveSetting('default_salary', defaultSalary)" prefix="£" label="Monthly Income" variant="outlined"></v-text-field>
              </v-card>

              <v-card class="mb-4 rounded-lg pa-4" elevation="2">
                <h3 class="text-h6 mb-2">Quick Add Lists</h3>
                <v-combobox v-model="availablePeople" chips multiple label="People List" @update:modelValue="saveSetting('people', availablePeople)"></v-combobox>
                <div class="my-2"></div>
                <v-combobox v-model="availableCategories" chips multiple label="Categories List" @update:modelValue="saveSetting('categories', availableCategories)"></v-combobox>
              </v-card>
            </v-col>

            <v-col cols="12" md="8">
              <v-card class="rounded-lg" elevation="2">
                <v-card-title class="bg-primary text-white py-3">Master Bill List</v-card-title>
                <v-card-text class="pa-0">
                  <v-table density="compact" hover>
                    <thead>
                      <tr :class="isDark ? 'bg-grey-darken-3' : 'bg-grey-lighten-4'">
                        <th>Name</th>
                        <th>Amount</th>
                        <th>Who</th>
                        <th>Category</th>
                        <th class="text-end">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr :class="isDark ? 'bg-grey-darken-3' : 'bg-grey-lighten-4'">
                        <td><v-text-field v-model="templateForm.name" density="compact" hide-details placeholder="New Default Bill" bg-color="surface"></v-text-field></td>
                        <td><v-text-field v-model.number="templateForm.amount" type="number" density="compact" hide-details placeholder="-0.00" bg-color="surface"></v-text-field></td>
                        <td><v-select v-model="templateForm.who" :items="availablePeople" density="compact" hide-details placeholder="Who" bg-color="surface"></v-select></td>
                        <td><v-select v-model="templateForm.category" :items="availableCategories" density="compact" hide-details placeholder="Cat" bg-color="surface"></v-select></td>
                        <td class="text-end"><v-btn size="small" color="primary" @click="addTemplate">Add</v-btn></td>
                      </tr>
                      <tr v-for="t in templates" :key="t.id" :class="editingId === t.id ? (isDark ? 'bg-grey-darken-3' : 'bg-amber-lighten-5') : ''">
                        <td>
                          <v-text-field v-if="editingId === t.id" v-model="editForm.name" density="compact" variant="outlined" hide-details></v-text-field>
                          <span v-else>{{ t.name }}</span>
                        </td>
                        <td>
                          <v-text-field v-if="editingId === t.id" v-model.number="editForm.amount" type="number" density="compact" variant="outlined" hide-details></v-text-field>
                          <span v-else class="font-weight-bold font-monospace">£{{ t.amount.toFixed(2) }}</span>
                        </td>
                        <td>
                          <v-select v-if="editingId === t.id" v-model="editForm.who" :items="availablePeople" density="compact" variant="outlined" hide-details></v-select>
                          <v-chip v-else size="x-small" :color="getChipColor(t.who)" label>{{ t.who }}</v-chip>
                        </td>
                        <td>
                          <v-select v-if="editingId === t.id" v-model="editForm.category" :items="availableCategories" density="compact" variant="outlined" hide-details></v-select>
                          <span v-else>{{ t.category }}</span>
                        </td>
                        <td class="text-end" style="min-width: 100px;">
                          <div v-if="editingId === t.id"><v-btn icon="mdi-check" size="x-small" color="green" variant="text" @click="saveTemplate"></v-btn><v-btn icon="mdi-close" size="x-small" color="red" variant="text" @click="cancelEdit"></v-btn></div>
                          <div v-else><v-btn icon="mdi-pencil" size="x-small" color="grey" variant="text" @click="startEdit(t)"></v-btn><v-btn icon="mdi-delete" size="x-small" color="grey" variant="text" @click="deleteTemplate(t.id)"></v-btn></div>
                        </td>
                      </tr>
                    </tbody>
                  </v-table>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </div>

      </v-container>
    </v-main>

    <v-snackbar v-model="snackbar" timeout="2000" color="success" location="bottom right">{{ snackbarText }}<template v-slot:actions><v-btn color="white" variant="text" @click="snackbar = false">Close</v-btn></template></v-snackbar>
  </v-app>
</template>

<style scoped>
.centered-input :deep(input) { text-align: center; }
.font-monospace { font-family: 'Roboto Mono', monospace; letter-spacing: -0.5px; }
.border-b { border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); }
.expenses-table :deep(th) { font-size: 0.9rem !important; }
.cursor-pointer { cursor: pointer; user-select: none; }
.cursor-pointer:hover { background-color: rgba(var(--v-theme-on-surface), 0.05); }

/* Floating Calculator Styles */
.calculator-card {
  position: fixed;
  top: 70px;
  right: 20px;
  z-index: 2000;
}
/* Floating Selection Bar */
.floating-selection-bar {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2000;
}
</style>