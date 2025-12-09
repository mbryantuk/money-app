<script setup>
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';
import { useTheme } from 'vuetify';

// COMPONENTS
import DashboardTab from './components/DashboardTab.vue';
import BudgetTab from './components/BudgetTab.vue';
import SavingsTab from './components/SavingsTab.vue';
import MortgageTab from './components/MortgageTab.vue';
import ChristmasTab from './components/ChristmasTab.vue';
import SandboxTab from './components/SandboxTab.vue';
import SettingsTab from './components/SettingsTab.vue';

// CONFIG
const API_URL = 'http://localhost:4001/api';
const theme = useTheme();

// UI STATE
const drawer = ref(true);
const tab = ref('dashboard');
const showCalculator = ref(false);
const snackbar = ref(false);
const snackbarText = ref('');

// GLOBAL DATA STATE
const currentMonth = ref(''); // Will be computed on mount
const defaultSalary = ref(0);
const availableCategories = ref([]);
const availablePeople = ref([]);
const templates = ref([]);

// CALCULATOR STATE
const calcDisplay = ref('0');
let calcCurrent = '', calcPrevious = '', calcOperation = null;
const calcResetNext = ref(false);

// --- THEME ---
const isDark = computed(() => theme.global.current.value.dark);
const toggleTheme = () => theme.global.name.value = isDark.value ? 'myCustomTheme' : 'dark';

// --- FINANCIAL MONTH LOGIC ---
const getPayDate = (year, month) => {
    // 20th or the working day before
    let d = new Date(year, month, 20);
    const day = d.getDay(); 
    if (day === 0) d.setDate(18); // Sun -> Fri
    else if (day === 6) d.setDate(19); // Sat -> Fri
    else if (day === 1) d.setDate(17); // Mon -> Fri (Working Day *Before* 20th)
    else d.setDate(19); // Tue-Fri -> 19th
    return d.getDate();
};

const determineCurrentFinancialMonth = () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth(); // 0-11
    const d = today.getDate();

    // The user names the month based on the START date.
    // e.g. Nov 19 -> Dec 18 is "November"
    
    const payDayThisMonth = getPayDate(y, m);

    if (d < payDayThisMonth) {
        // Before payday? We are still in previous month's budget.
        // e.g. Nov 10th (payday 19th) -> We are in October budget? 
        // Wait, User said "Nov 19 to Dec 18" is "Nov".
        // So "Oct 19 to Nov 18" is "Oct".
        // So on Nov 10th, we are in "Oct".
        const prevDate = new Date(y, m - 1, 1);
        currentMonth.value = prevDate.toISOString().slice(0, 7);
    } else {
        // After payday? We are in current month's budget.
        // e.g. Nov 20th -> "Nov".
        currentMonth.value = new Date(y, m, 1).toISOString().slice(0, 7);
    }
};

// --- GLOBAL FETCH ---
const fetchSettings = async () => {
  try {
    const res = await axios.get(`${API_URL}/settings`);
    if (res.data.default_salary) defaultSalary.value = parseFloat(res.data.default_salary);
    
    if (res.data.categories) availableCategories.value = JSON.parse(res.data.categories);
    else availableCategories.value = ['Housing', 'Utilities', 'Food', 'Insurance', 'Subscription', 'Mobile', 'Savings', 'Spending', 'Medical', 'Tax'];

    if (res.data.people) availablePeople.value = JSON.parse(res.data.people);
    else availablePeople.value = ['Joint', 'f1', 'f2', 's', 'Matt'];

    const tRes = await axios.get(`${API_URL}/templates`);
    templates.value = tRes.data || [];
  } catch (e) { console.error("Settings Error", e); }
};

// --- HELPER ---
const showMsg = (text) => {
    snackbarText.value = text;
    snackbar.value = true;
};

// --- CALCULATOR LOGIC ---
const calcAppend = (num) => {
  if (calcDisplay.value === '0' || calcResetNext.value) { calcDisplay.value = String(num); calcResetNext.value = false; } 
  else { calcDisplay.value += String(num); }
};
const calcSetOp = (op) => {
  if (calcOperation !== null) calcCompute();
  calcPrevious = calcDisplay.value; calcOperation = op; calcResetNext.value = true;
};
const calcCompute = () => {
  const prev = parseFloat(calcPrevious); const current = parseFloat(calcDisplay.value);
  if (isNaN(prev) || isNaN(current)) return;
  const map = { '+': prev + current, '-': prev - current, '*': prev * current, '/': prev / current };
  calcDisplay.value = String(map[calcOperation] || 0);
  calcOperation = null; calcResetNext.value = true;
};
const calcClear = () => { calcDisplay.value = '0'; calcPrevious = ''; calcOperation = null; };
const copyToClipboard = () => { navigator.clipboard.writeText(calcDisplay.value); showMsg('Copied'); };

onMounted(() => {
    determineCurrentFinancialMonth();
    fetchSettings();
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
      <v-app-bar-title class="font-weight-bold text-primary">{{ tab.charAt(0).toUpperCase() + tab.slice(1) }}</v-app-bar-title>
      <v-spacer></v-spacer>
      <v-btn :icon="showCalculator ? 'mdi-calculator' : 'mdi-calculator-variant-outline'" @click="showCalculator = !showCalculator" :color="showCalculator ? 'primary' : 'medium-emphasis'" class="mr-2"></v-btn>
      <v-btn :icon="isDark ? 'mdi-weather-sunny' : 'mdi-weather-night'" @click="toggleTheme" color="medium-emphasis"></v-btn>
    </v-app-bar>

    <v-card v-if="showCalculator" elevation="8" class="calculator-card rounded-lg" :class="isDark ? 'bg-grey-darken-3' : 'bg-white'" width="260">
        <v-card-title class="d-flex justify-space-between align-center py-2 px-3 bg-primary text-white">
            <span class="text-caption font-weight-bold">Quick Calc</span>
            <v-icon size="small" @click="showCalculator = false">mdi-close</v-icon>
        </v-card-title>
        <div class="d-flex justify-space-between align-center pa-2 border-b mb-2">
            <v-btn icon="mdi-content-copy" size="x-small" variant="text" @click="copyToClipboard"></v-btn>
            <div class="text-h5 font-monospace text-end flex-grow-1">{{ calcDisplay }}</div>
        </div>
        <div class="pa-2">
            <v-row dense>
                <v-col cols="3"><v-btn block size="small" variant="tonal" @click="calcClear" color="error">C</v-btn></v-col>
                <v-col cols="3"><v-btn block size="small" variant="tonal" @click="calcSetOp('/')">/</v-btn></v-col>
                <v-col cols="3"><v-btn block size="small" variant="tonal" @click="calcSetOp('*')">x</v-btn></v-col>
                <v-col cols="3"><v-btn block size="small" variant="tonal" @click="calcSetOp('-')">-</v-btn></v-col>
                <v-col cols="3" v-for="n in [7,8,9]" :key="n"><v-btn block size="small" variant="text" @click="calcAppend(n)">{{n}}</v-btn></v-col>
                <v-col cols="3"><v-btn block size="small" variant="tonal" @click="calcSetOp('+')" class="h-100">+</v-btn></v-col>
                <v-col cols="3" v-for="n in [4,5,6]" :key="n"><v-btn block size="small" variant="text" @click="calcAppend(n)">{{n}}</v-btn></v-col>
                <v-col cols="3"></v-col>
                <v-col cols="3" v-for="n in [1,2,3]" :key="n"><v-btn block size="small" variant="text" @click="calcAppend(n)">{{n}}</v-btn></v-col>
                <v-col cols="3" style="margin-top: -38px"><v-btn block size="small" color="primary" @click="calcCompute" class="h-100">=</v-btn></v-col>
                <v-col cols="6"><v-btn block size="small" variant="text" @click="calcAppend(0)">0</v-btn></v-col>
                <v-col cols="3"><v-btn block size="small" variant="text" @click="calcAppend('.')">.</v-btn></v-col>
            </v-row>
        </div>
    </v-card>

    <v-main :class="isDark ? 'bg-grey-darken-4' : 'bg-grey-lighten-4'">
      <v-container class="py-6" fluid style="max-width: 1400px;">
        
        <DashboardTab v-if="tab === 'dashboard'" />

        <BudgetTab v-if="tab === 'budget' && currentMonth" 
            v-model:month="currentMonth"
            :people="availablePeople"
            :categories="availableCategories"
            :default-salary="defaultSalary"
            @notify="showMsg"
        />

        <SavingsTab v-if="tab === 'savings'" @notify="showMsg" />

        <MortgageTab v-if="tab === 'mortgage'" @notify="showMsg" />

        <ChristmasTab v-if="tab === 'christmas'" @notify="showMsg" />

        <SandboxTab v-if="tab === 'sandbox'" 
            :people="availablePeople" 
            :categories="availableCategories" 
            :current-month="currentMonth"
            @notify="showMsg"
        />

        <SettingsTab v-if="tab === 'settings'" 
            v-model:people="availablePeople"
            v-model:categories="availableCategories"
            v-model:default-salary="defaultSalary"
            :templates="templates"
            @notify="showMsg"
            @refresh="fetchSettings"
        />

      </v-container>
    </v-main>

    <v-snackbar v-model="snackbar" timeout="2000" color="success" location="bottom right">{{ snackbarText }}<template v-slot:actions><v-btn color="white" variant="text" @click="snackbar = false">Close</v-btn></template></v-snackbar>
  </v-app>
</template>

<style scoped>
.calculator-card { position: fixed; top: 70px; right: 20px; z-index: 2000; }
.font-monospace { font-family: 'Roboto Mono', monospace; }
</style>