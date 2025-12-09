<script setup>
import { ref, computed, onMounted, watch } from 'vue';
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
const tab = ref('budget');
const snackbar = ref(false);
const snackbarText = ref('');

// DATA STATE
const currentMonth = ref(new Date().toISOString().slice(0, 7));
const currentBalance = ref(0);
const salary = ref(0);
const expenses = ref([]);
const savingsAccounts = ref([]); 

// DASHBOARD STATE
const dashboardData = ref({ totalIncome: 0, totalExpenses: 0, categoryBreakdown: [], monthlyTrend: [] });
const financialYearStart = ref(new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1); // Auto-detect current FY

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
  { key: 'status', label: 'Status', width: '80px', align: 'center', sortable: true },
  { key: 'who', label: 'Who', width: '100px', align: 'left', sortable: true },
  { key: 'name', label: 'Bill Name', width: '', align: 'left', sortable: true },
  { key: 'amount', label: 'Amount', width: '120px', align: 'right', sortable: true },
  { key: 'category', label: 'Category', width: '140px', align: 'left', sortable: false },
  { key: 'actions', label: 'Edit', width: '80px', align: 'end', sortable: false }
];
const expenseColumns = ref([...defaultColumns]);

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

// --- API ACTIONS ---
const fetchAll = async () => {
  await fetchSettings();
  await fetchData();
  await fetchSavings();
  await fetchMortgage();
  await fetchDashboard();
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
    if (res.data.default_salary) defaultSalary.value = parseFloat(res.data.default_salary);
    if (res.data.categories) availableCategories.value = JSON.parse(res.data.categories);
    if (res.data.people) availablePeople.value = JSON.parse(res.data.people);
    else availablePeople.value = people;
    if (availableCategories.value.length === 0) availableCategories.value = categories;

    // Load Column Order
    if (res.data.column_order) {
        expenseColumns.value = JSON.parse(res.data.column_order);
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

// --- WATCHERS ---
watch(currentMonth, fetchData);
watch(financialYearStart, fetchDashboard);

// Auto-calculate H2B Balance when Price or % changes
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

onMounted(fetchAll);
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
        <v-list-item prepend-icon="mdi-wallet-outline" title="Budget" value="budget" @click="tab = 'budget'" :active="tab === 'budget'" color="primary" rounded="xl"></v-list-item>
        <v-list-item prepend-icon="mdi-piggy-bank-outline" title="Savings" value="savings" @click="tab = 'savings'" :active="tab === 'savings'" color="primary" rounded="xl"></v-list-item>
        <v-list-item prepend-icon="mdi-home-city-outline" title="Mortgage" value="mortgage" @click="tab = 'mortgage'" :active="tab === 'mortgage'" color="primary" rounded="xl"></v-list-item>
        <v-list-item prepend-icon="mdi-view-dashboard-outline" title="Dashboard" value="dashboard" @click="tab = 'dashboard'" :active="tab === 'dashboard'" color="primary" rounded="xl"></v-list-item>
        <v-list-item prepend-icon="mdi-cog-outline" title="Settings" value="settings" @click="tab = 'settings'" :active="tab === 'settings'" color="primary" rounded="xl"></v-list-item>
      </v-list>
    </v-navigation-drawer>

    <v-app-bar elevation="1" color="surface">
      <v-app-bar-nav-icon @click="drawer = !drawer"></v-app-bar-nav-icon>
      <v-app-bar-title class="font-weight-bold text-primary">
        {{ tab.charAt(0).toUpperCase() + tab.slice(1) }}
      </v-app-bar-title>
      <v-spacer></v-spacer>
      <v-btn :icon="isDark ? 'mdi-weather-sunny' : 'mdi-weather-night'" @click="toggleTheme" color="medium-emphasis"></v-btn>
    </v-app-bar>

    <v-main :class="{ 'bg-grey-lighten-4': !isDark }">
      <v-container class="py-6" fluid style="max-width: 1400px;">

        <div v-if="tab === 'budget'">
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
                                <th 
                                    :style="{ width: col.width, cursor: 'move' }" 
                                    :class="['text-subtitle-2', 'py-4', 'font-weight-bold', 'text-' + col.align]"
                                    @click="col.sortable ? sortBy(col.key) : null"
                                >
                                    <div class="d-flex align-center" :class="{ 'justify-end': col.align === 'right' || col.align === 'end', 'justify-center': col.align === 'center' }">
                                        {{ col.label }}
                                        <v-icon size="small" v-if="col.sortable && sortKey === col.key" class="ml-1">{{ sortOrder === 1 ? 'mdi-arrow-up' : 'mdi-arrow-down' }}</v-icon>
                                    </div>
                                </th>
                            </template>
                        </draggable>
                    </thead>
                    
                    <tbody>
                        <tr v-for="expense in sortedExpenses" :key="expense.id" :class="{'bg-green-lighten-5': expense.paid && !isDark, 'text-medium-emphasis': expense.paid, 'bg-amber-lighten-5': editingId === expense.id && !isDark}" style="transition: background-color 0.2s;">
                            <td v-for="col in expenseColumns" :key="col.key" :class="'text-' + col.align">
                                
                                <template v-if="col.key === 'status'">
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
                <v-text-field v-model="newAccountName" density="compact" variant="solo" label="New Bank Account Name" hide-details class="mr-2" style="max-width: 300px;"></v-text-field>
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
                        
                        <v-list density="compact" class="pa-0">
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
                        <v-card-actions>
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
                            <div class="bg-surface pa-6 flex-grow-1">
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
                                    <tr class="bg-grey-lighten-4">
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
                    <v-card class="rounded-lg pa-4 mb-4 bg-surface" elevation="2">
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

        <div v-else-if="tab === 'dashboard'">
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

                        <div class="mt-6 pa-4 bg-grey-lighten-4 rounded text-center">
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
                                <v-progress-linear 
                                    :model-value="(cat.total / dashboardData.totalExpenses) * 100" 
                                    color="primary" 
                                    height="6" 
                                    rounded
                                ></v-progress-linear>
                            </div>
                        </div>
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
                      <tr class="bg-background">
                        <th>Name</th>
                        <th>Amount</th>
                        <th>Who</th>
                        <th>Category</th>
                        <th class="text-end">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr class="bg-background">
                        <td><v-text-field v-model="templateForm.name" density="compact" hide-details placeholder="New Default Bill"></v-text-field></td>
                        <td><v-text-field v-model.number="templateForm.amount" type="number" density="compact" hide-details placeholder="-0.00"></v-text-field></td>
                        <td><v-select v-model="templateForm.who" :items="availablePeople" density="compact" hide-details placeholder="Who"></v-select></td>
                        <td><v-select v-model="templateForm.category" :items="availableCategories" density="compact" hide-details placeholder="Cat"></v-select></td>
                        <td class="text-end"><v-btn size="small" color="primary" @click="addTemplate">Add</v-btn></td>
                      </tr>
                      <tr v-for="t in templates" :key="t.id">
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
</style>