<script setup>
  import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
  import axios from 'axios';
  import { useTheme, useDisplay } from 'vuetify';
  import { useRegisterSW } from 'virtual:pwa-register/vue';
  import { generateTheme } from './utils/materialTheme'; // <--- Import Generator
  
  // COMPONENTS
  import DashboardTab from './components/DashboardTab.vue';
  import BudgetTab from './components/BudgetTab.vue';
  import SavingsTab from './components/SavingsTab.vue';
  import MortgageTab from './components/MortgageTab.vue';
  import ChristmasTab from './components/ChristmasTab.vue';
  import SandboxTab from './components/SandboxTab.vue';
  import AdminTab from './components/AdminTab.vue';
  import SettingsTab from './components/SettingsTab.vue';
  import TemplatesTab from './components/TemplatesTab.vue'; 
  import ReportsTab from './components/ReportsTab.vue';
  import CreditCardsTab from './components/CreditCardsTab.vue';
  import MealsTab from './components/MealsTab.vue';
  import BirthdaysTab from './components/BirthdaysTab.vue'; 
  import AiSummaryTab from './components/AiSummaryTab.vue'; 
  import BackupManager from './components/BackupManager.vue';

  // --- STATE MANAGEMENT ---
  const theme = useTheme();
  const { mobile } = useDisplay();
  
  // Navigation & Layout
  const drawer = ref(!mobile.value);
  const openList = ref([]); 
  const tab = ref('dashboard');
  
  // Theme State
  const primaryColor = ref('#1976D2'); // Default Seed Color

  // Calculator, Savings, AI State
  const showCalculator = ref(false);
  const calcDisplay = ref('0');
  const calcPos = ref({ x: 20, y: 300 }); 
  const isDraggingCalc = ref(false);
  const calcDragOffset = ref({ x: 0, y: 0 });

  const showSavings = ref(false);
  const savingsAccounts = ref([]);
  const savingsPos = ref({ x: 340, y: 100 });
  const isDraggingSavings = ref(false);
  const savingsDragOffset = ref({ x: 0, y: 0 });

  const showAiDialog = ref(false);
  const aiLoading = ref(false);
  const aiResponse = ref('');
  const aiError = ref('');
  const aiPos = ref({ x: 50, y: 120 }); 
  const isDraggingAi = ref(false);
  const aiDragOffset = ref({ x: 0, y: 0 });
  
  // Data State
  const currentMonth = ref(new Date().toISOString().slice(0, 7));
  const availablePeople = ref([]); 
  const familyMembers = ref([]);   
  const availableCategories = ref([]);
  const defaultSalary = ref(0);
  const payDay = ref(1);
  const templates = ref([]);
  const birthdays = ref([]);
  
  // AI Settings
  const ollamaUrl = ref('');
  const ollamaModel = ref('');
  const aiPrompts = ref({ budget: '', dashboard: '', savings: '', credit_cards: '', meals: '', birthdays: '', christmas: '', sandbox: '', mortgage: '' });

  const snackbar = ref(false);
  const snackbarText = ref('');
  const snackbarColor = ref('success');
  
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

  // --- MATERIAL YOU THEME ENGINE ---
  const updateThemeColor = (color) => {
      primaryColor.value = color;
      
      try {
          // Generate full palette from seed color
          const { light, dark } = generateTheme(color);

          // Apply to Light Theme
          theme.themes.value.myCustomTheme.colors = {
              ...theme.themes.value.myCustomTheme.colors,
              ...light
          };

          // Apply to Dark Theme
          theme.themes.value.dark.colors = {
              ...theme.themes.value.dark.colors,
              ...dark
          };
      } catch (e) {
          console.error("Theme generation failed", e);
          // Fallback to simple primary override
          theme.themes.value.myCustomTheme.colors.primary = color;
          theme.themes.value.dark.colors.primary = color;
      }
  };
  
  // ... [Keep existing Savings Logic] ...
  const toggleSavings = async () => { if (!showSavings.value) { try { const res = await axios.get('/api/savings/structure'); savingsAccounts.value = res.data; } catch(e) { console.error(e); } } showSavings.value = !showSavings.value; };
  const updatePot = async (pot) => { try { await axios.put(`/api/savings/pots/${pot.id}`, pot); } catch (e) { showMsg('Error saving pot', 'error'); } };
  const startDragSavings = (e) => { if(e.target.closest('.no-drag')) return; isDraggingSavings.value = true; savingsDragOffset.value = { x: e.clientX - savingsPos.value.x, y: e.clientY - savingsPos.value.y }; window.addEventListener('mousemove', onDragSavings); window.addEventListener('mouseup', stopDragSavings); };
  const onDragSavings = (e) => { if (!isDraggingSavings.value) return; savingsPos.value = { x: e.clientX - savingsDragOffset.value.x, y: e.clientY - savingsDragOffset.value.y }; };
  const stopDragSavings = () => { isDraggingSavings.value = false; window.removeEventListener('mousemove', onDragSavings); window.removeEventListener('mouseup', stopDragSavings); };

  // ... [Keep existing AI Logic] ...
  const isAiAvailable = computed(() => ['dashboard', 'budget', 'savings', 'credit_cards', 'mortgage', 'meals', 'birthdays', 'christmas', 'sandbox'].includes(tab.value));
  const generateAiSummary = async () => { showAiDialog.value = true; aiLoading.value = true; aiResponse.value = ''; aiError.value = ''; let type = tab.value === 'dashboard' ? 'dashboard' : tab.value === 'budget' ? 'budget' : tab.value; let params = tab.value === 'budget' ? { month: currentMonth.value } : tab.value === 'dashboard' ? { year: parseInt(currentMonth.value.split('-')[0]) } : {}; try { const res = await axios.post('/api/ai/generate', { type, params }); if (res.data.success) aiResponse.value = res.data.response; else aiError.value = res.data.error; } catch (e) { aiError.value = 'Failed to connect.'; } finally { aiLoading.value = false; } };
  const startDragAi = (e) => { if(e.target.closest('.no-drag')) return; isDraggingAi.value = true; aiDragOffset.value = { x: e.clientX - aiPos.value.x, y: e.clientY - aiPos.value.y }; window.addEventListener('mousemove', onDragAi); window.addEventListener('mouseup', stopDragAi); };
  const onDragAi = (e) => { if (!isDraggingAi.value) return; aiPos.value = { x: e.clientX - aiDragOffset.value.x, y: e.clientY - aiDragOffset.value.y }; };
  const stopDragAi = () => { isDraggingAi.value = false; window.removeEventListener('mousemove', onDragAi); window.removeEventListener('mouseup', stopDragAi); };

  // ... [Keep existing Calculator Logic] ...
  const calcAppend = (char) => { if (calcDisplay.value === '0' && !['.', '+', '-', '*', '/'].includes(char)) calcDisplay.value = char; else calcDisplay.value += char; };
  const calcClear = () => { calcDisplay.value = '0'; };
  const calcResult = () => { try { calcDisplay.value = eval(calcDisplay.value).toString(); } catch (e) { calcDisplay.value = 'Error'; } };
  const handleKeydown = (e) => { if (!showCalculator.value) return; if (document.activeElement?.tagName === 'INPUT') return; const key = e.key; if (/^[0-9.+\-*/]$/.test(key)) { e.preventDefault(); calcAppend(key); } else if (key === 'Enter' || key === '=') { e.preventDefault(); calcResult(); } else if (key === 'Backspace') { e.preventDefault(); calcDisplay.value = calcDisplay.value.slice(0, -1) || '0'; } else if (key.toLowerCase() === 'c') { e.preventDefault(); calcClear(); } else if (key === 'Escape') { e.preventDefault(); showCalculator.value = false; } };
  const startDragCalc = (e) => { if(e.target.closest('.no-drag')) return; isDraggingCalc.value = true; calcDragOffset.value = { x: e.clientX - calcPos.value.x, y: e.clientY - calcPos.value.y }; window.addEventListener('mousemove', onDragCalc); window.addEventListener('mouseup', stopDragCalc); };
  const onDragCalc = (e) => { if (!isDraggingCalc.value) return; calcPos.value = { x: e.clientX - calcDragOffset.value.x, y: e.clientY - calcDragOffset.value.y }; };
  const stopDragCalc = () => { isDraggingCalc.value = false; window.removeEventListener('mousemove', onDragCalc); window.removeEventListener('mouseup', stopDragCalc); };
  
  // --- API & LIFECYCLE ---
  const fetchSettings = async () => {
    try {
      const [settingsRes, templatesRes, birthdaysRes] = await Promise.all([ axios.get('/api/settings'), axios.get('/api/templates'), axios.get('/api/birthdays') ]);
      const settings = settingsRes.data || {};
      
      if (settings.people) availablePeople.value = JSON.parse(settings.people);
      if (settings.family_members) familyMembers.value = JSON.parse(settings.family_members);
      if (settings.categories) availableCategories.value = JSON.parse(settings.categories);
      
      defaultSalary.value = parseFloat(settings.default_salary) || 0;
      payDay.value = parseInt(settings.pay_day) || 1;
      ollamaUrl.value = settings.ollama_url || '';
      ollamaModel.value = settings.ollama_model || '';

      aiPrompts.value = {
        budget: settings.prompt_budget || '', dashboard: settings.prompt_dashboard || '', savings: settings.prompt_savings || '', credit_cards: settings.prompt_credit_cards || '', meals: settings.prompt_meals || '', birthdays: settings.prompt_birthdays || '', christmas: settings.prompt_christmas || '', sandbox: settings.prompt_sandbox || '', mortgage: settings.prompt_mortgage || ''
      };

      // Load Theme Color
      if (settings.theme_color) {
          updateThemeColor(settings.theme_color);
      } else {
          // Initialize default if not set
          updateThemeColor(primaryColor.value);
      }

      templates.value = templatesRes.data || [];
      birthdays.value = birthdaysRes.data || []; 
  
      const now = new Date();
      if (now.getDate() < payDay.value) now.setMonth(now.getMonth() - 1);
      currentMonth.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
    } catch (err) { console.error("Error loading settings:", err); showMsg("Failed to load settings", "error"); }
  };
  
  useRegisterSW({ onRegistered(r) { r && setInterval(() => { r.update() }, 60 * 60 * 1000); } });
  
  onMounted(() => {
    fetchSettings();
    window.addEventListener('keydown', handleKeydown);
  });
  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown);
    stopDragCalc(); stopDragSavings(); stopDragAi();
  });
  </script>
  
  <template>
    <v-app>
      <v-navigation-drawer v-model="drawer" :temporary="mobile" color="surface-container">
        <div class="d-flex justify-center py-6 align-center">
          <v-icon size="36" color="primary" class="mr-2">mdi-wallet-bifold</v-icon>
          <span class="text-h6 font-weight-bold text-on-surface">Money App</span>
        </div>
        
        <v-list nav density="comfortable" class="px-2" v-model:opened="openList">
          <v-list-item prepend-icon="mdi-view-dashboard-outline" title="Dashboard" value="dashboard" @click="selectTab('dashboard')" :active="tab === 'dashboard'" color="primary" rounded="xl"></v-list-item>
          <v-list-item prepend-icon="mdi-wallet-outline" title="Budget" value="budget" @click="selectTab('budget')" :active="tab === 'budget'" color="primary" rounded="xl"></v-list-item>
          <v-list-item prepend-icon="mdi-piggy-bank-outline" title="Savings" value="savings" @click="selectTab('savings')" :active="tab === 'savings'" color="primary" rounded="xl"></v-list-item>
          <v-list-item prepend-icon="mdi-credit-card-outline" title="Credit Cards" value="credit_cards" @click="selectTab('credit_cards')" :active="tab === 'credit_cards'" color="primary" rounded="xl"></v-list-item>
          <v-list-item prepend-icon="mdi-home-city-outline" title="Mortgage" value="mortgage" @click="selectTab('mortgage')" :active="tab === 'mortgage'" color="primary" rounded="xl"></v-list-item>
          
          <v-divider class="my-2"></v-divider>
          
          <v-list-item prepend-icon="mdi-food-fork-drink" title="Meals" value="meals" @click="selectTab('meals')" :active="tab === 'meals'" color="primary" rounded="xl"></v-list-item>
          <v-list-item prepend-icon="mdi-cake-variant-outline" title="Birthdays" value="birthdays" @click="selectTab('birthdays')" :active="tab === 'birthdays'" color="primary" rounded="xl"></v-list-item>
          <v-list-item prepend-icon="mdi-gift-outline" title="Christmas" value="christmas" @click="selectTab('christmas')" :active="tab === 'christmas'" color="primary" rounded="xl"></v-list-item>
          <v-list-item prepend-icon="mdi-test-tube" title="Sandbox" value="sandbox" @click="selectTab('sandbox')" :active="tab === 'sandbox'" color="primary" rounded="xl"></v-list-item>
          
          <v-list-group value="reports_group">
            <template v-slot:activator="{ props }">
              <v-list-item v-bind="props" prepend-icon="mdi-chart-box-outline" title="Reports" rounded="xl"></v-list-item>
            </template>
            <v-list-item prepend-icon="mdi-chart-line" title="Salary Tracker" value="reports" @click="selectTab('reports')" :active="tab === 'reports'" color="primary" rounded="xl"></v-list-item>
            <v-list-item prepend-icon="mdi-robot-outline" title="AI Summary" value="ai_summary" @click="selectTab('ai_summary')" :active="tab === 'ai_summary'" color="primary" rounded="xl"></v-list-item>
          </v-list-group>
  
          <v-list-group value="admin_group">
            <template v-slot:activator="{ props }">
              <v-list-item v-bind="props" prepend-icon="mdi-shield-account-outline" title="Admin" rounded="xl"></v-list-item>
            </template>
            <v-list-item prepend-icon="mdi-database" title="Backups" value="admin_backups" @click="selectTab('admin_backups')" :active="tab === 'admin_backups'" color="primary" rounded="xl"></v-list-item>
            <v-list-item prepend-icon="mdi-cog" title="Settings" value="settings" @click="selectTab('settings')" :active="tab === 'settings'" color="primary" rounded="xl"></v-list-item>
            <v-list-item prepend-icon="mdi-playlist-star" title="Templates" value="templates" @click="selectTab('templates')" :active="tab === 'templates'" color="primary" rounded="xl"></v-list-item>
            
            <v-list-item prepend-icon="mdi-table" title="Data Tables" value="admin_tables" @click="selectTab('admin_expenses')" :active="tab.startsWith('admin_') && tab !== 'admin_backups'" color="primary" rounded="xl"></v-list-item>
          </v-list-group>
        </v-list>
      </v-navigation-drawer>
  
      <v-app-bar color="surface" density="compact" flat border class="px-2">
        <v-app-bar-nav-icon @click="drawer = !drawer"></v-app-bar-nav-icon>
        <v-app-bar-title class="text-primary font-weight-bold text-uppercase text-body-1">{{ tab.replace('admin_', '') }}</v-app-bar-title>
        <v-spacer></v-spacer>
        <v-btn icon color="primary" @click="toggleSavings"><v-icon>mdi-piggy-bank</v-icon></v-btn>
        <v-btn v-if="isAiAvailable" icon color="primary" @click="generateAiSummary"><v-icon>mdi-robot-outline</v-icon></v-btn>
        <v-btn icon color="primary" @click="showCalculator = !showCalculator"><v-icon>mdi-calculator</v-icon></v-btn>
        <v-btn icon color="primary" @click="toggleTheme"><v-icon>{{ isDark ? 'mdi-weather-sunny' : 'mdi-weather-night' }}</v-icon></v-btn>
      </v-app-bar>
  
      <v-main class="bg-background">
        <v-container class="py-6" fluid>
          <DashboardTab v-if="tab === 'dashboard'" />
          <BudgetTab v-if="tab === 'budget' && currentMonth" v-model:month="currentMonth" :people="availablePeople" :categories="availableCategories" :default-salary="defaultSalary" :pay-day="payDay" :birthdays="birthdays" @notify="showMsg" />
          <SavingsTab v-if="tab === 'savings'" @notify="showMsg" />
          <CreditCardsTab v-if="tab === 'credit_cards'" @notify="showMsg" />
          <MortgageTab v-if="tab === 'mortgage'" @notify="showMsg" />
          <MealsTab v-if="tab === 'meals'" :people="familyMembers" @notify="showMsg" />
          <BirthdaysTab v-if="tab === 'birthdays'" @notify="showMsg" /> <ChristmasTab v-if="tab === 'christmas'" @notify="showMsg" />
          <ReportsTab v-if="tab === 'reports'" /> 
          <AiSummaryTab v-if="tab === 'ai_summary'" :current-month="currentMonth" @notify="showMsg" />
          <SandboxTab v-if="tab === 'sandbox'" :people="availablePeople" :categories="availableCategories" :current-month="currentMonth" @notify="showMsg" />
          <AdminTab v-if="tab.startsWith('admin_') && tab !== 'admin_backups'" :view="tab" @notify="showMsg" />
          <BackupManager v-if="tab === 'admin_backups'" @notify="showMsg" />
          
          <SettingsTab 
              v-if="tab === 'settings'" 
              v-model:people="availablePeople" 
              v-model:family="familyMembers"
              v-model:categories="availableCategories" 
              v-model:default-salary="defaultSalary" 
              v-model:pay-day="payDay" 
              v-model:ollama-url="ollamaUrl"
              v-model:ollama-model="ollamaModel"
              :primary-color="primaryColor"
              @update:primary-color="updateThemeColor"
              :prompts="aiPrompts" 
              @notify="showMsg" 
              @refresh="fetchSettings" 
          />
          <TemplatesTab v-if="tab === 'templates'" :people="availablePeople" :categories="availableCategories" :templates="templates" @notify="showMsg" @refresh="fetchSettings" />
        </v-container>
      </v-main>
      
      <v-card v-if="showSavings" class="position-fixed rounded-xl" style="z-index: 9998; width: 300px; max-height: 500px; right: 20px; top: 80px;" elevation="4">
          <div class="bg-primary-container text-on-primary-container d-flex align-center justify-space-between pa-3 cursor-move" @mousedown="startDragSavings">
              <span class="text-subtitle-2 font-weight-bold">Savings</span><v-btn icon="mdi-close" variant="text" size="small" @click="showSavings = false"></v-btn>
          </div>
          <div class="overflow-y-auto bg-surface pa-0"><v-list><v-list-item v-for="acc in savingsAccounts" :key="acc.id"><v-list-item-title class="text-caption font-weight-bold">{{ acc.name }}</v-list-item-title><div v-for="pot in acc.pots" :key="pot.id" class="d-flex justify-space-between px-2 py-1 text-caption"><span>{{pot.name}}</span><span class="font-weight-bold">£{{pot.amount}}</span></div></v-list-item></v-list></div>
      </v-card>

      <v-card v-if="showCalculator" width="300" elevation="4" class="position-fixed rounded-xl" style="z-index: 9999;" :style="{ left: calcPos.x + 'px', top: calcPos.y + 'px' }">
        <v-card-title class="bg-primary-container text-on-primary-container d-flex justify-space-between align-center py-2 text-subtitle-1 cursor-move" @mousedown="startDragCalc">Calc <v-btn icon="mdi-close" variant="text" size="small" @click="showCalculator = false"></v-btn></v-card-title>
        <v-card-text class="pa-2 bg-surface"><v-text-field v-model="calcDisplay" variant="outlined" density="compact" hide-details class="text-right mb-2 text-h5"></v-text-field><v-row dense><v-col cols="3" v-for="btn in ['7','8','9','/', '4','5','6','*', '1','2','3','-', 'C','0','.','+']" :key="btn"><v-btn block :color="['C'].includes(btn)?'error-container':['/','*','-','+'].includes(btn)?'secondary-container':undefined" @click="btn==='C'?calcClear():calcAppend(btn)">{{btn}}</v-btn></v-col><v-col cols="12"><v-btn block color="primary" @click="calcResult">=</v-btn></v-col></v-row></v-card-text>
      </v-card>

      <v-dialog v-model="showAiDialog" max-width="500">
        <v-card class="rounded-xl">
            <v-card-title class="bg-tertiary-container text-on-tertiary-container">AI Insight</v-card-title>
            <v-card-text class="pa-4 bg-surface">
                <div v-if="aiLoading" class="text-center pa-4"><v-progress-circular indeterminate color="primary"></v-progress-circular></div>
                <div v-else>{{ aiResponse || aiError }}</div>
            </v-card-text>
            <v-card-actions class="bg-surface"><v-spacer></v-spacer><v-btn color="primary" @click="showAiDialog=false">Close</v-btn></v-card-actions>
        </v-card>
      </v-dialog>

      <v-snackbar v-model="snackbar" :color="snackbarColor" location="bottom right">{{ snackbarText }}</v-snackbar>
    </v-app>
  </template>

  <style scoped>
  .cursor-move { cursor: move; }
  /* Material You style tweaks */
  .v-list-item--active { background-color: rgb(var(--v-theme-secondary-container)) !important; color: rgb(var(--v-theme-on-secondary-container)) !important; }
  </style>