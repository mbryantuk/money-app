<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import axios from 'axios';
import { useTheme, useDisplay } from 'vuetify';
import { useRegisterSW } from 'virtual:pwa-register/vue';

// COMPONENTS
import DashboardTab from './components/DashboardTab.vue';
import BudgetTab from './components/BudgetTab.vue';
import SavingsTab from './components/SavingsTab.vue';
import MortgageTab from './components/MortgageTab.vue';
import ChristmasTab from './components/ChristmasTab.vue';
import SandboxTab from './components/SandboxTab.vue';
import AdminTab from './components/AdminTab.vue';
import SettingsTab from './components/SettingsTab.vue';

// CONFIG
const API_URL = '/api';
const theme = useTheme();
const { mobile } = useDisplay();

// PWA Auto-Update
const intervalMS = 60 * 60 * 1000;
useRegisterSW({
  onRegistered(r) {
    r && setInterval(() => { r.update(); }, intervalMS);
  }
});

// UI STATE
const drawer = ref(!mobile.value); 
const tab = ref('dashboard');
const showCalculator = ref(false);
const snackbar = ref(false);
const snackbarText = ref('');
const openList = ref([]); 

// GLOBAL DATA STATE
const currentMonth = ref(''); 
const defaultSalary = ref(0);
const payDay = ref(19); 
const availableCategories = ref([]);
const availablePeople = ref([]);
const templates = ref([]);

// CALCULATOR STATE
const calcDisplay = ref('0');
let calcCurrent = '', calcPrevious = '', calcOperation = null;
const calcResetNext = ref(false);

// --- THEME ---
const isDark = computed(() => theme.global.current.value.dark);
const toggleTheme = () => theme.global.name.value = isDark.value ? 'light' : 'dark';

// --- NAVIGATION HANDLER ---
// Prevents the "blank screen" by intercepting the 'menu' click
const handleNav = (val) => {
  if (val === 'menu') {
    drawer.value = !drawer.value;
  } else {
    tab.value = val;
  }
};

// Helper to select tab and close drawer on mobile
const selectTab = (val) => {
  tab.value = val;
  if (mobile.value) drawer.value = false;
};

// --- FINANCIAL MONTH LOGIC ---
const getPayDate = (year, month) => {
    let d = new Date(year, month, payDay.value);
    const day = d.getDay(); 
    if (day === 0) d.setDate(d.getDate() - 2); 
    else if (day === 6) d.setDate(d.getDate() - 1); 
    return d.getDate();
};

const determineCurrentFinancialMonth = () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth(); 
    const d = today.getDate();
    
    const payDayThisMonth = getPayDate(y, m);

    if (d < payDayThisMonth) {
        const prevDate = new Date(y, m - 1, 1);
        currentMonth.value = prevDate.toISOString().slice(0, 7);
    } else {
        currentMonth.value = new Date(y, m, 1).toISOString().slice(0, 7);
    }
};

// --- GLOBAL FETCH ---
const fetchSettings = async () => {
  try {
    const res = await axios.get(`${API_URL}/settings`);
    if (res.data.default_salary) defaultSalary.value = parseFloat(res.data.default_salary);
    if (res.data.pay_day) payDay.value = parseInt(res.data.pay_day);
    
    if (res.data.categories) availableCategories.value = JSON.parse(res.data.categories);
    else availableCategories.value = ['Housing', 'Utilities', 'Food', 'Insurance', 'Subscription', 'Mobile', 'Savings', 'Spending', 'Medical', 'Tax'];

    if (res.data.people) availablePeople.value = JSON.parse(res.data.people);
    else availablePeople.value = ['Joint', 'f1', 'f2', 's', 'Matt'];

    const tRes = await axios.get(`${API_URL}/templates`);
    templates.value = tRes.data || [];
    
    determineCurrentFinancialMonth();
  } catch (e) { console.error("Settings Error", e); }
};

const showMsg = (text) => { snackbarText.value = text; snackbar.value = true; };

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

// --- KEYBOARD LISTENER ---
const handleKeydown = (e) => {
    if (!showCalculator.value) return;
    if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

    if (e.key >= '0' && e.key <= '9') calcAppend(Number(e.key));
    if (e.key === '.') calcAppend('.');
    if (['+', '-', '*', '/'].includes(e.key)) calcSetOp(e.key);
    if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); calcCompute(); }
    if (e.key === 'Escape' || e.key.toLowerCase() === 'c') calcClear();
    if (e.key === 'Backspace') {
        calcDisplay.value = calcDisplay.value.slice(0, -1);
        if (calcDisplay.value === '' || calcDisplay.value === '-') calcDisplay.value = '0';
    }
};

onMounted(() => {
    fetchSettings();
    window.addEventListener('keydown', handleKeydown);

    // Parse URL params for Shortcuts
    const params = new URLSearchParams(window.location.search);
    if (params.has('tab')) {
        tab.value = params.get('tab');
        window.history.replaceState({}, document.title, "/");
    }
});

onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown);
});

// Watch mobile state to auto-close/open drawer appropriately
watch(mobile, (isMobile) => {
  drawer.value = !isMobile;
});
</script>

<template>
  <v-app>
    <v-navigation-drawer 
      v-model="drawer" 
      :temporary="mobile"
      :permanent="!mobile"
      color="surface"
    >
      <div class="pa-4">
        <h2 class="text-h6 font-weight-bold text-primary d-flex align-center">
          <v-icon icon="mdi-bank" class="mr-2"></v-icon> Money 2.0
        </h2>
      </div>
      <v-divider></v-divider>
      <v-list nav density="compact" class="mt-2" v-model:opened="openList">
        <v-list-item prepend-icon="mdi-view-dashboard-outline" title="Dashboard" value="dashboard" @click="selectTab('dashboard')" :active="tab === 'dashboard'" color="primary" rounded="xl"></v-list-item>
        <v-list-item prepend-icon="mdi-wallet-outline" title="Budget" value="budget" @click="selectTab('budget')" :active="tab === 'budget'" color="primary" rounded="xl"></v-list-item>
        <v-list-item prepend-icon="mdi-piggy-bank-outline" title="Savings" value="savings" @click="selectTab('savings')" :active="tab === 'savings'" color="primary" rounded="xl"></v-list-item>
        <v-list-item prepend-icon="mdi-home-city-outline" title="Mortgage" value="mortgage" @click="selectTab('mortgage')" :active="tab === 'mortgage'" color="primary" rounded="xl"></v-list-item>
        <v-list-item prepend-icon="mdi-gift-outline" title="Christmas" value="christmas" @click="selectTab('christmas')" :active="tab === 'christmas'" color="primary" rounded="xl"></v-list-item>
        <v-list-item prepend-icon="mdi-test-tube" title="Sandbox" value="sandbox" @click="selectTab('sandbox')" :active="tab === 'sandbox'" color="primary" rounded="xl"></v-list-item>
        
        <v-list-group value="admin_group">
          <template v-slot:activator="{ props }">
            <v-list-item v-bind="props" prepend-icon="mdi-shield-account-outline" title="Admin" rounded="xl"></v-list-item>
          </template>
          <v-list-item prepend-icon="mdi-cash-multiple" title="Salary" value="admin" @click="selectTab('admin')" :active="tab === 'admin'" color="primary" rounded="xl"></v-list-item>
        </v-list-group>

        <v-list-item prepend-icon="mdi-cog-outline" title="Settings" value="settings" @click="selectTab('settings')" :active="tab === 'settings'" color="primary" rounded="xl"></v-list-item>
      </v-list>
    </v-navigation-drawer>

    <v-app-bar elevation="1" color="surface">
      <v-app-bar-nav-icon v-if="!mobile" @click="drawer = !drawer"></v-app-bar-nav-icon>
      
      <v-app-bar-title class="font-weight-bold text-primary">{{ tab.charAt(0).toUpperCase() + tab.slice(1) }}</v-app-bar-title>
      <v-spacer></v-spacer>
      <v-btn :icon="showCalculator ? 'mdi-calculator' : 'mdi-calculator-variant-outline'" @click="showCalculator = !showCalculator" :color="showCalculator ? 'primary' : 'medium-emphasis'" class="mr-2"></v-btn>
      <v-btn :icon="isDark ? 'mdi-weather-sunny' : 'mdi-weather-night'" @click="toggleTheme" color="medium-emphasis"></v-btn>
    </v-app-bar>

    <v-card v-if="showCalculator" elevation="8" class="calculator-card rounded-lg d-flex flex-column" :class="isDark ? 'bg-grey-darken-3' : 'bg-white'">
        <v-card-title class="d-flex justify-space-between align-center py-2 px-3 bg-primary text-white flex-grow-0">
            <span class="text-caption font-weight-bold">Quick Calc</span>
            <v-icon size="small" @click="showCalculator = false">mdi-close</v-icon>
        </v-card-title>
        <div class="d-flex justify-space-between align-center pa-2 border-b mb-2 flex-grow-0">
            <v-btn icon="mdi-content-copy" size="x-small" variant="text" @click="copyToClipboard"></v-btn>
            <div class="text-h4 font-monospace text-end flex-grow-1">{{ calcDisplay }}</div>
        </div>
        <div class="pa-2 flex-grow-1">
            <v-row dense class="h-100">
                <v-col cols="3"><v-btn block size="small" variant="tonal" @click="calcClear" color="error" class="h-100 text-h6">C</v-btn></v-col>
                <v-col cols="3"><v-btn block size="small" variant="tonal" @click="calcSetOp('/')" class="h-100 text-h6">/</v-btn></v-col>
                <v-col cols="3"><v-btn block size="small" variant="tonal" @click="calcSetOp('*')" class="h-100 text-h6">x</v-btn></v-col>
                <v-col cols="3"><v-btn block size="small" variant="tonal" @click="calcSetOp('-')" class="h-100 text-h6">-</v-btn></v-col>
                <v-col cols="3" v-for="n in [7,8,9]" :key="n"><v-btn block size="small" variant="text" @click="calcAppend(n)" class="h-100 text-h6">{{n}}</v-btn></v-col>
                <v-col cols="3"><v-btn block size="small" variant="tonal" @click="calcSetOp('+')" class="h-100 text-h6">+</v-btn></v-col>
                <v-col cols="3" v-for="n in [4,5,6]" :key="n"><v-btn block size="small" variant="text" @click="calcAppend(n)" class="h-100 text-h6">{{n}}</v-btn></v-col>
                <v-col cols="3"><v-btn block size="small" color="primary" @click="calcCompute" class="h-100 text-h6" style="grid-row: span 2">=</v-btn></v-col>
                <v-col cols="3" v-for="n in [1,2,3]" :key="n"><v-btn block size="small" variant="text" @click="calcAppend(n)" class="h-100 text-h6">{{n}}</v-btn></v-col>
                <v-col cols="9" class="d-flex">
                    <v-btn block size="small" variant="text" @click="calcAppend(0)" class="h-100 text-h6 flex-grow-1" style="width: 66%">0</v-btn>
                    <v-btn block size="small" variant="text" @click="calcAppend('.')" class="h-100 text-h6 flex-grow-1" style="width: 33%">.</v-btn>
                </v-col>
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
            :pay-day="payDay" 
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
        <AdminTab v-if="tab === 'admin'" @notify="showMsg" />
        <SettingsTab v-if="tab === 'settings'" 
            v-model:people="availablePeople"
            v-model:categories="availableCategories"
            v-model:default-salary="defaultSalary"
            v-model:pay-day="payDay"
            :templates="templates"
            @notify="showMsg"
            @refresh="fetchSettings"
        />
      </v-container>
    </v-main>

    <v-bottom-navigation 
      v-if="mobile" 
      :model-value="tab" 
      @update:model-value="handleNav"
      color="primary" 
      grow
    >
      <v-btn value="dashboard">
        <v-icon>mdi-view-dashboard-outline</v-icon>
        <span>Dash</span>
      </v-btn>
      <v-btn value="budget">
        <v-icon>mdi-wallet-outline</v-icon>
        <span>Budget</span>
      </v-btn>
      <v-btn value="savings">
        <v-icon>mdi-piggy-bank-outline</v-icon>
        <span>Save</span>
      </v-btn>
      
      <v-btn value="menu">
        <v-icon>mdi-menu</v-icon>
        <span>Menu</span>
      </v-btn>
    </v-bottom-navigation>

    <v-snackbar v-model="snackbar" timeout="2000" color="success" location="bottom right" :style="{ bottom: mobile ? '60px' : '0' }">{{ snackbarText }}<template v-slot:actions><v-btn color="white" variant="text" @click="snackbar = false">Close</v-btn></template></v-snackbar>
  </v-app>
</template>

<style scoped>
.calculator-card { 
    position: fixed; top: 70px; right: 20px; z-index: 2000;
    width: 320px; height: 480px; min-width: 280px; min-height: 400px;
    resize: both; overflow: auto;
}
.font-monospace { font-family: 'Roboto Mono', monospace; }
</style>