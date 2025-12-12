<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
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
import ReportsTab from './components/ReportsTab.vue';
import CreditCardsTab from './components/CreditCardsTab.vue';

// --- STATE MANAGEMENT ---
const theme = useTheme();
const { mobile } = useDisplay();

// Navigation & Layout
const drawer = ref(null);
const openList = ref(['admin_group']); 
const tab = ref('dashboard');

// Calculator State
const showCalculator = ref(false);
const calcDisplay = ref('0');

// Data State
const currentMonth = ref(new Date().toISOString().slice(0, 7));
const availablePeople = ref([]);
const availableCategories = ref([]);
const defaultSalary = ref(0);
const payDay = ref(1);
const templates = ref([]);

// Notification Snackbar
const snackbar = ref(false);
const snackbarText = ref('');
const snackbarColor = ref('success');

// Computed
const isDark = computed(() => theme.global.current.value.dark);

// --- ACTIONS ---

const selectTab = (newTab) => {
  tab.value = newTab;
  if (mobile.value) drawer.value = false;
};

const showMsg = (msg, color = 'success') => {
  snackbarText.value = msg;
  snackbarColor.value = color;
  snackbar.value = true;
};

const toggleTheme = () => {
  theme.global.name.value = isDark.value ? 'myCustomTheme' : 'dark';
};

// --- CALCULATOR LOGIC ---
const calcAppend = (char) => {
  if (calcDisplay.value === '0' && !['.', '+', '-', '*', '/'].includes(char)) {
    calcDisplay.value = char;
  } else {
    calcDisplay.value += char;
  }
};
const calcClear = () => { calcDisplay.value = '0'; };
const calcResult = () => {
  try {
    // eslint-disable-next-line no-eval
    calcDisplay.value = eval(calcDisplay.value).toString();
  } catch (e) { calcDisplay.value = 'Error'; }
};
const handleKeydown = (e) => {
  if (!showCalculator.value) return;
  const activeTag = document.activeElement ? document.activeElement.tagName : '';
  if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;
  const key = e.key;
  if (/^[0-9.+\-*/]$/.test(key)) { e.preventDefault(); calcAppend(key); }
  else if (key === 'Enter' || key === '=') { e.preventDefault(); calcResult(); }
  else if (key === 'Backspace') { e.preventDefault(); calcDisplay.value = calcDisplay.value.toString().slice(0, -1) || '0'; }
  else if (key.toLowerCase() === 'c') { e.preventDefault(); calcClear(); }
  else if (key === 'Escape') { e.preventDefault(); showCalculator.value = false; }
};

// --- API & LIFECYCLE ---
const fetchSettings = async () => {
  try {
    const [settingsRes, templatesRes] = await Promise.all([
      axios.get('/api/settings'),
      axios.get('/api/templates')
    ]);
    const settings = settingsRes.data || {};
    if (settings.people) availablePeople.value = JSON.parse(settings.people);
    if (settings.categories) availableCategories.value = JSON.parse(settings.categories);
    defaultSalary.value = parseFloat(settings.default_salary) || 0;
    payDay.value = parseInt(settings.pay_day) || 1;
    templates.value = templatesRes.data || [];

    // [!code ++] Auto-set Month based on Pay Cycle
    const now = new Date();
    
    // If today is BEFORE payday, we are in the cycle that started LAST month
    if (now.getDate() < payDay.value) {
      now.setMonth(now.getMonth() - 1);
    }
    // If today is ON or AFTER payday, we are in the cycle that started THIS month (no change)

    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    currentMonth.value = `${y}-${m}`;

  } catch (err) {
    console.error("Error loading settings:", err);
    showMsg("Failed to load application settings", "error");
  }
};

useRegisterSW({ onRegistered(r) { r && setInterval(() => { r.update() }, 60 * 60 * 1000); } });

onMounted(() => {
  fetchSettings();
  window.addEventListener('keydown', handleKeydown);
});
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <v-app>
    <v-navigation-drawer v-model="drawer" :temporary="mobile" :permanent="!mobile" color="surface">
      <div class="d-flex justify-center py-4">
        <img src="/logo.svg" alt="Logo" width="48" height="48" />
        <span class="text-h6 ml-3 align-self-center text-primary font-weight-bold">Money</span>
      </div>
      <v-divider></v-divider>

      <v-list nav density="compact" class="mt-2" v-model:opened="openList">
        <v-list-item prepend-icon="mdi-view-dashboard-outline" title="Dashboard" value="dashboard" @click="selectTab('dashboard')" :active="tab === 'dashboard'" color="primary" rounded="xl"></v-list-item>
        <v-list-item prepend-icon="mdi-wallet-outline" title="Budget" value="budget" @click="selectTab('budget')" :active="tab === 'budget'" color="primary" rounded="xl"></v-list-item>
        <v-list-item prepend-icon="mdi-piggy-bank-outline" title="Savings" value="savings" @click="selectTab('savings')" :active="tab === 'savings'" color="primary" rounded="xl"></v-list-item>
        <v-list-item prepend-icon="mdi-credit-card-outline" title="Credit Cards" value="credit_cards" @click="selectTab('credit_cards')" :active="tab === 'credit_cards'" color="primary" rounded="xl"></v-list-item>
        <v-list-item prepend-icon="mdi-home-city-outline" title="Mortgage" value="mortgage" @click="selectTab('mortgage')" :active="tab === 'mortgage'" color="primary" rounded="xl"></v-list-item>
        <v-list-item prepend-icon="mdi-gift-outline" title="Christmas" value="christmas" @click="selectTab('christmas')" :active="tab === 'christmas'" color="primary" rounded="xl"></v-list-item>
        <v-list-item prepend-icon="mdi-test-tube" title="Sandbox" value="sandbox" @click="selectTab('sandbox')" :active="tab === 'sandbox'" color="primary" rounded="xl"></v-list-item>
        
        <v-list-group value="reports_group">
          <template v-slot:activator="{ props }">
            <v-list-item v-bind="props" prepend-icon="mdi-chart-box-outline" title="Reports" rounded="xl"></v-list-item>
          </template>
          <v-list-item prepend-icon="mdi-chart-line" title="Salary Tracker" value="reports" @click="selectTab('reports')" :active="tab === 'reports'" color="primary" rounded="xl"></v-list-item>
        </v-list-group>

        <v-list-group value="admin_group">
          <template v-slot:activator="{ props }">
            <v-list-item v-bind="props" prepend-icon="mdi-shield-account-outline" title="Admin" rounded="xl"></v-list-item>
          </template>
          
          <v-list-item prepend-icon="mdi-calendar-month" title="Salary Data" value="admin_salary" @click="selectTab('admin_salary')" :active="tab === 'admin_salary'" color="primary" rounded="xl"></v-list-item>
          <v-list-item prepend-icon="mdi-cash-multiple" title="Recent Expenses" value="admin_expenses" @click="selectTab('admin_expenses')" :active="tab === 'admin_expenses'" color="primary" rounded="xl"></v-list-item>
          <v-list-item prepend-icon="mdi-file-document-outline" title="Templates" value="admin_templates" @click="selectTab('admin_templates')" :active="tab === 'admin_templates'" color="primary" rounded="xl"></v-list-item>
          <v-list-item prepend-icon="mdi-cog" title="Global Settings" value="admin_settings" @click="selectTab('admin_settings')" :active="tab === 'admin_settings'" color="primary" rounded="xl"></v-list-item>
          <v-list-item prepend-icon="mdi-bank" title="Savings Accounts" value="admin_savings_accounts" @click="selectTab('admin_savings_accounts')" :active="tab === 'admin_savings_accounts'" color="primary" rounded="xl"></v-list-item>
          <v-list-item prepend-icon="mdi-piggy-bank" title="Savings Pots" value="admin_savings_pots" @click="selectTab('admin_savings_pots')" :active="tab === 'admin_savings_pots'" color="primary" rounded="xl"></v-list-item>
          <v-list-item prepend-icon="mdi-credit-card-settings-outline" title="Cards DB" value="admin_credit_cards" @click="selectTab('admin_credit_cards')" :active="tab === 'admin_credit_cards'" color="primary" rounded="xl"></v-list-item>
          <v-list-item prepend-icon="mdi-receipt-text-outline" title="Card Trans." value="admin_cc_transactions" @click="selectTab('admin_cc_transactions')" :active="tab === 'admin_cc_transactions'" color="primary" rounded="xl"></v-list-item>
          <v-list-item prepend-icon="mdi-pine-tree" title="Christmas List" value="admin_christmas_list" @click="selectTab('admin_christmas_list')" :active="tab === 'admin_christmas_list'" color="primary" rounded="xl"></v-list-item>
          <v-list-item prepend-icon="mdi-test-tube" title="Sandbox Data" value="admin_sandbox_expenses" @click="selectTab('admin_sandbox_expenses')" :active="tab === 'admin_sandbox_expenses'" color="primary" rounded="xl"></v-list-item>
        </v-list-group>

        <v-list-item prepend-icon="mdi-cog-outline" title="Settings" value="settings" @click="selectTab('settings')" :active="tab === 'settings'" color="primary" rounded="xl"></v-list-item>
      </v-list>
    </v-navigation-drawer>

    <v-app-bar color="surface" density="compact" flat border>
      <v-app-bar-nav-icon v-if="mobile" @click="drawer = !drawer"></v-app-bar-nav-icon>
      <v-app-bar-title class="text-primary font-weight-bold text-uppercase">{{ tab.replace('admin_', '') }}</v-app-bar-title>
      <v-spacer></v-spacer>
      <v-menu v-model="showCalculator" :close-on-content-click="false" :close-on-click-outside="false" :scrim="false" location="bottom end" offset="10">
        <template v-slot:activator="{ props }">
          <v-btn icon color="primary" v-bind="props" :variant="showCalculator ? 'tonal' : 'text'"><v-icon>mdi-calculator</v-icon></v-btn>
        </template>
        <v-card width="300" elevation="4" border>
          <v-card-title class="bg-primary text-white d-flex justify-space-between align-center py-2 text-subtitle-1">
            Calculator <v-btn icon="mdi-close" variant="text" density="compact" @click="showCalculator = false"></v-btn>
          </v-card-title>
          <v-card-text class="pa-2">
            <v-text-field v-model="calcDisplay" variant="outlined" hide-details class="text-right mb-2 text-h5 font-weight-bold" readonly bg-color="surface"></v-text-field>
            <v-row dense>
              <v-col cols="3" v-for="btn in ['7','8','9','/', '4','5','6','*', '1','2','3','-', 'C','0','.','+']" :key="btn">
                <v-btn block height="45" :color="['C'].includes(btn) ? 'error' : ['/','*','-','+'].includes(btn) ? 'secondary' : undefined" variant="flat" class="text-h6" @click="btn === 'C' ? calcClear() : calcAppend(btn)">{{ btn }}</v-btn>
              </v-col>
              <v-col cols="12"><v-btn block color="primary" height="45" class="text-h6" @click="calcResult">=</v-btn></v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-menu>
      <v-btn icon color="primary" @click="toggleTheme"><v-icon>{{ isDark ? 'mdi-weather-sunny' : 'mdi-weather-night' }}</v-icon></v-btn>
    </v-app-bar>

    <v-main :class="isDark ? 'bg-grey-darken-4' : 'bg-grey-lighten-4'">
      <v-container class="py-6" fluid style="max-width: 1400px;">
        <DashboardTab v-if="tab === 'dashboard'" />
        <BudgetTab v-if="tab === 'budget' && currentMonth" v-model:month="currentMonth" :people="availablePeople" :categories="availableCategories" :default-salary="defaultSalary" :pay-day="payDay" @notify="showMsg" />
        <SavingsTab v-if="tab === 'savings'" @notify="showMsg" />
        <CreditCardsTab v-if="tab === 'credit_cards'" @notify="showMsg" />
        <MortgageTab v-if="tab === 'mortgage'" @notify="showMsg" />
        <ChristmasTab v-if="tab === 'christmas'" @notify="showMsg" />
        <ReportsTab v-if="tab === 'reports'" /> 
        <SandboxTab v-if="tab === 'sandbox'" :people="availablePeople" :categories="availableCategories" :current-month="currentMonth" @notify="showMsg" />
        
        <AdminTab v-if="tab.startsWith('admin_')" :view="tab" @notify="showMsg" />
        
        <SettingsTab v-if="tab === 'settings'" v-model:people="availablePeople" v-model:categories="availableCategories" v-model:default-salary="defaultSalary" v-model:pay-day="payDay" :templates="templates" @notify="showMsg" @refresh="fetchSettings" />
      </v-container>
    </v-main>

    <v-snackbar v-model="snackbar" :color="snackbarColor" timeout="3000" location="bottom right">
      {{ snackbarText }}
      <template v-slot:actions><v-btn variant="text" @click="snackbar = false">Close</v-btn></template>
    </v-snackbar>
  </v-app>
</template>