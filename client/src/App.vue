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
  import TemplatesTab from './components/TemplatesTab.vue'; 
  import ReportsTab from './components/ReportsTab.vue';
  import CreditCardsTab from './components/CreditCardsTab.vue';
  import MealsTab from './components/MealsTab.vue';
  import BirthdaysTab from './components/BirthdaysTab.vue'; 
  import AiSummaryTab from './components/AiSummaryTab.vue'; 
  import BackupManager from './components/BackupManager.vue'; // IMPORTED

  // --- STATE MANAGEMENT ---
  const theme = useTheme();
  const { mobile } = useDisplay();
  
  // Navigation & Layout
  const drawer = ref(!mobile.value);
  const openList = ref([]); 
  const tab = ref('dashboard');
  
  // Calculator State
  const showCalculator = ref(false);
  const calcDisplay = ref('0');
  const calcPos = ref({ x: 20, y: 300 }); 
  const isDraggingCalc = ref(false);
  const calcDragOffset = ref({ x: 0, y: 0 });

  // SAVINGS WIDGET STATE
  const showSavings = ref(false);
  const savingsAccounts = ref([]);
  const savingsPos = ref({ x: 340, y: 100 });
  const isDraggingSavings = ref(false);
  const savingsDragOffset = ref({ x: 0, y: 0 });

  // AI POPUP STATE
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
  
  // AI Settings State
  const ollamaUrl = ref('');
  const ollamaModel = ref('');
  const aiPrompts = ref({
    budget: '',
    dashboard: '',
    savings: '',
    credit_cards: '',
    meals: '',
    birthdays: '',
    christmas: '',
    sandbox: '',
    mortgage: ''
  });

  // Notification Snackbar
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
  
  // --- SAVINGS LOGIC ---
  const toggleSavings = async () => {
      if (!showSavings.value) {
          try {
            const res = await axios.get('/api/savings/structure');
            savingsAccounts.value = res.data;
          } catch(e) { console.error(e); }
      }
      showSavings.value = !showSavings.value;
  };
  
  const updatePot = async (pot) => {
      try {
          await axios.put(`/api/savings/pots/${pot.id}`, pot);
      } catch (e) { showMsg('Error saving pot', 'error'); }
  };

  // Dragging Logic 
  const startDragSavings = (e) => {
      if(e.target.closest('.no-drag')) return; 
      isDraggingSavings.value = true;
      savingsDragOffset.value = { x: e.clientX - savingsPos.value.x, y: e.clientY - savingsPos.value.y };
      window.addEventListener('mousemove', onDragSavings);
      window.addEventListener('mouseup', stopDragSavings);
  };
  const onDragSavings = (e) => {
      if (!isDraggingSavings.value) return;
      savingsPos.value = { x: e.clientX - savingsDragOffset.value.x, y: e.clientY - savingsDragOffset.value.y };
  };
  const stopDragSavings = () => {
      isDraggingSavings.value = false;
      window.removeEventListener('mousemove', onDragSavings);
      window.removeEventListener('mouseup', stopDragSavings);
  };

  // --- AI LOGIC ---
  const isAiAvailable = computed(() => {
    return ['dashboard', 'budget', 'savings', 'credit_cards', 'mortgage', 'meals', 'birthdays', 'christmas', 'sandbox'].includes(tab.value);
  });

  const generateAiSummary = async () => {
    showAiDialog.value = true;
    aiLoading.value = true;
    aiResponse.value = '';
    aiError.value = '';

    let type = 'general';
    let params = {};

    if (tab.value === 'budget') {
        type = 'budget';
        params = { month: currentMonth.value };
    } else if (tab.value === 'dashboard') {
        type = 'dashboard';
        params = { year: parseInt(currentMonth.value.split('-')[0]) };
    } else if (tab.value === 'savings') {
        type = 'savings';
    } else if (tab.value === 'credit_cards') {
        type = 'credit_cards';
    } else if (tab.value === 'meals') {
        type = 'meals';
    } else if (tab.value === 'birthdays') {
        type = 'birthdays';
    } else if (tab.value === 'christmas') {
        type = 'christmas';
    } else if (tab.value === 'sandbox') {
        type = 'sandbox';
    } else if (tab.value === 'mortgage') {
        type = 'mortgage';
    } else {
        type = tab.value; 
    }

    try {
        const res = await axios.post('/api/ai/generate', { type, params });
        if (res.data.success) {
            aiResponse.value = res.data.response;
        } else {
            aiError.value = res.data.error || 'Unknown AI Error';
        }
    } catch (e) {
        console.error(e);
        aiError.value = 'Failed to connect to AI server.';
    } finally {
        aiLoading.value = false;
    }
  };

  const startDragAi = (e) => {
      if(e.target.closest('.no-drag')) return; 
      isDraggingAi.value = true;
      aiDragOffset.value = { x: e.clientX - aiPos.value.x, y: e.clientY - aiPos.value.y };
      window.addEventListener('mousemove', onDragAi);
      window.addEventListener('mouseup', stopDragAi);
  };
  const onDragAi = (e) => {
      if (!isDraggingAi.value) return;
      aiPos.value = { x: e.clientX - aiDragOffset.value.x, y: e.clientY - aiDragOffset.value.y };
  };
  const stopDragAi = () => {
      isDraggingAi.value = false;
      window.removeEventListener('mousemove', onDragAi);
      window.removeEventListener('mouseup', stopDragAi);
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

  const startDragCalc = (e) => {
    if(e.target.closest('.no-drag')) return;
    isDraggingCalc.value = true;
    calcDragOffset.value = { x: e.clientX - calcPos.value.x, y: e.clientY - calcPos.value.y };
    window.addEventListener('mousemove', onDragCalc);
    window.addEventListener('mouseup', stopDragCalc);
  };
  const onDragCalc = (e) => {
    if (!isDraggingCalc.value) return;
    calcPos.value = { x: e.clientX - calcDragOffset.value.x, y: e.clientY - calcDragOffset.value.y };
  };
  const stopDragCalc = () => {
    isDraggingCalc.value = false;
    window.removeEventListener('mousemove', onDragCalc);
    window.removeEventListener('mouseup', stopDragCalc);
  };

  const popOutCalculator = () => {
    const w = window.open("", "Calculator", "width=320,height=480,resizable=yes");
    if(!w) return showMsg("Pop-up blocked!", "error");
    
    const content = `
      <html><head><title>Money Calc</title>
      <style>
        body{font-family:-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; display:flex;flex-direction:column;height:100vh;margin:0;padding:10px;background:#121212;box-sizing:border-box; color: white;} 
        input{width:100%;font-size:32px;text-align:right;padding:15px;margin-bottom:15px;border-radius:8px;border:1px solid #333;background:#1e1e1e;color:white;box-sizing:border-box;} 
        .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;flex:1;} 
        button{font-size:24px;border-radius:8px;border:none;cursor:pointer;background:#2d2d2d;color:white;transition:0.1s;} 
        button:active{background:#404040;} 
        .primary{background:#1976D2;}
        .primary:active{background:#1565C0;}
        .danger{background:#CF6679;color:#000;}
      </style>
      </head><body>
      <input type="text" id="display" readonly value="0">
      <div class="grid">
        <button onclick="app('7')">7</button><button onclick="app('8')">8</button><button onclick="app('9')">9</button><button class="primary" onclick="app('/')">÷</button>
        <button onclick="app('4')">4</button><button onclick="app('5')">5</button><button onclick="app('6')">6</button><button class="primary" onclick="app('*')">×</button>
        <button onclick="app('1')">1</button><button onclick="app('2')">2</button><button onclick="app('3')">3</button><button class="primary" onclick="app('-')">-</button>
        <button class="danger" onclick="clr()">C</button><button onclick="app('0')">0</button><button onclick="app('.')">.</button><button class="primary" onclick="app('+')">+</button>
        <button class="primary" style="grid-column:span 4" onclick="res()">=</button>
      </div>
      <script>
        let d = document.getElementById('display');
        function app(v){ if(d.value==='0' && !['/','*','-','+'].includes(v)) d.value=v; else d.value+=v; }
        function clr(){ d.value='0'; }
        function res(){ try{d.value=eval(d.value)}catch(e){d.value='Err'} }
        document.addEventListener('keydown', (e) => {
            const k = e.key;
            if(/[0-9.+\\-*/]/.test(k)) app(k);
            if(k==='Enter'||k==='=') res();
            if(k==='Backspace') d.value = d.value.slice(0,-1)||'0';
            if(k.toLowerCase()==='c') clr();
        });
      <\/script></body></html>
    `;
    w.document.write(content);
    showCalculator.value = false;
  };
  
  // --- API & LIFECYCLE ---
  const fetchSettings = async () => {
    try {
      const [settingsRes, templatesRes, birthdaysRes] = await Promise.all([
        axios.get('/api/settings'),
        axios.get('/api/templates'),
        axios.get('/api/birthdays') 
      ]);
      const settings = settingsRes.data || {};
      
      if (settings.people) availablePeople.value = JSON.parse(settings.people);
      if (settings.family_members) familyMembers.value = JSON.parse(settings.family_members);
      if (settings.categories) availableCategories.value = JSON.parse(settings.categories);
      
      defaultSalary.value = parseFloat(settings.default_salary) || 0;
      payDay.value = parseInt(settings.pay_day) || 1;
      ollamaUrl.value = settings.ollama_url || '';
      ollamaModel.value = settings.ollama_model || '';

      // Load prompts
      aiPrompts.value = {
        budget: settings.prompt_budget || '',
        dashboard: settings.prompt_dashboard || '',
        savings: settings.prompt_savings || '',
        credit_cards: settings.prompt_credit_cards || '',
        meals: settings.prompt_meals || '',
        birthdays: settings.prompt_birthdays || '',
        christmas: settings.prompt_christmas || '',
        sandbox: settings.prompt_sandbox || '',
        mortgage: settings.prompt_mortgage || ''
      };

      templates.value = templatesRes.data || [];
      birthdays.value = birthdaysRes.data || []; 
  
      const now = new Date();
      if (now.getDate() < payDay.value) { now.setMonth(now.getMonth() - 1); }
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
    stopDragCalc(); 
    stopDragSavings();
    stopDragAi();
  });
  </script>
  
  <template>
    <v-app>
      <v-navigation-drawer v-model="drawer" :temporary="mobile" color="surface">
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
  
          <v-list-group value="settings_group">
            <template v-slot:activator="{ props }">
              <v-list-item v-bind="props" prepend-icon="mdi-cog-outline" title="Settings" rounded="xl"></v-list-item>
            </template>
            <v-list-item prepend-icon="mdi-tune" title="General Settings" value="settings" @click="selectTab('settings')" :active="tab === 'settings'" color="primary" rounded="xl"></v-list-item>
            <v-list-item prepend-icon="mdi-playlist-star" title="Master Bill List" value="templates" @click="selectTab('templates')" :active="tab === 'templates'" color="primary" rounded="xl"></v-list-item>
          </v-list-group>
        </v-list>
      </v-navigation-drawer>
  
      <v-app-bar color="surface" density="compact" flat border>
        <v-app-bar-nav-icon @click="drawer = !drawer"></v-app-bar-nav-icon>
        <v-app-bar-title class="text-primary font-weight-bold text-uppercase">{{ tab.replace('admin_', '') }}</v-app-bar-title>
        <v-spacer></v-spacer>
        
        <v-btn icon color="primary" :variant="showSavings ? 'tonal' : 'text'" @click="toggleSavings" title="Savings"><v-icon>mdi-piggy-bank</v-icon></v-btn>
        
        <v-btn 
            v-if="isAiAvailable"
            icon 
            color="primary" 
            :variant="showAiDialog ? 'tonal' : 'text'" 
            @click="generateAiSummary" 
            title="AI Summary"
        >
            <v-icon>mdi-robot-outline</v-icon>
        </v-btn>

        <v-btn icon color="primary" :variant="showCalculator ? 'tonal' : 'text'" @click="showCalculator = !showCalculator" title="Calculator"><v-icon>mdi-calculator</v-icon></v-btn>
        
        <v-btn icon color="primary" @click="toggleTheme"><v-icon>{{ isDark ? 'mdi-weather-sunny' : 'mdi-weather-night' }}</v-icon></v-btn>
      </v-app-bar>
  
      <v-main :class="isDark ? 'bg-grey-darken-4' : 'bg-grey-lighten-4'">
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
              :prompts="aiPrompts" 
              @notify="showMsg" 
              @refresh="fetchSettings" 
          />

          <TemplatesTab 
              v-if="tab === 'templates'" 
              :people="availablePeople"
              :categories="availableCategories"
              :templates="templates"
              @notify="showMsg"
              @refresh="fetchSettings"
          />
        </v-container>
      </v-main>
      
      <v-card 
          v-if="showSavings" 
          class="position-fixed rounded-lg border" 
          style="z-index: 9998; width: 300px; max-height: 500px; overflow: hidden; display: flex; flex-direction: column;"
          :style="{ left: savingsPos.x + 'px', top: savingsPos.y + 'px' }"
          elevation="12"
      >
          <div class="bg-primary text-white d-flex align-center justify-space-between pa-2 cursor-move" @mousedown="startDragSavings">
              <span class="text-subtitle-2 font-weight-bold ml-2"><v-icon size="small" class="mr-1">mdi-piggy-bank</v-icon> Savings</span>
              <v-btn icon="mdi-close" variant="text" density="compact" size="small" color="white" @click="showSavings = false"></v-btn>
          </div>
          
          <div class="overflow-y-auto pa-0 flex-grow-1 bg-surface">
              <v-expansion-panels variant="accordion">
                  <v-expansion-panel v-for="acc in savingsAccounts" :key="acc.id">
                      <v-expansion-panel-title class="py-1 min-height-40">
                          {{ acc.name }} 
                          <template v-slot:actions="{ expanded }">
                              <span class="text-caption font-weight-bold mr-2">£{{ acc.total.toFixed(0) }}</span>
                              <v-icon :icon="expanded ? 'mdi-chevron-up' : 'mdi-chevron-down'"></v-icon>
                          </template>
                      </v-expansion-panel-title>
                      <v-expansion-panel-text class="pa-0">
                          <v-list density="compact" class="pa-0">
                              <v-list-item v-for="pot in acc.pots" :key="pot.id" class="border-b pl-2 pr-2 no-drag">
                                  <div class="d-flex align-center justify-space-between width-100">
                                      <span class="text-caption text-truncate mr-2" style="max-width: 100px" :title="pot.name">{{ pot.name }}</span>
                                      <v-text-field 
                                          :model-value="pot.amount" 
                                          @update:model-value="v => { pot.amount = Number(v); updatePot(pot) }"
                                          type="number" 
                                          prefix="£" 
                                          density="compact" 
                                          variant="plain" 
                                          hide-details 
                                          class="text-right text-caption font-weight-bold" 
                                          style="width: 80px"
                                      ></v-text-field>
                                  </div>
                              </v-list-item>
                          </v-list>
                      </v-expansion-panel-text>
                  </v-expansion-panel>
              </v-expansion-panels>
          </div>
      </v-card>

      <v-card 
        v-if="showCalculator" 
        width="300" 
        elevation="12" 
        border
        class="position-fixed rounded-lg"
        style="z-index: 9999;"
        :style="{ left: calcPos.x + 'px', top: calcPos.y + 'px' }"
      >
        <v-card-title class="bg-primary text-white d-flex justify-space-between align-center py-2 text-subtitle-1 cursor-move" @mousedown="startDragCalc">
          Calculator 
          <div>
            <v-btn icon="mdi-open-in-new" variant="text" density="compact" color="white" @click="popOutCalculator" class="mr-1" title="Pop out"></v-btn>
            <v-btn icon="mdi-close" variant="text" density="compact" color="white" @click="showCalculator = false"></v-btn>
          </div>
        </v-card-title>
        <v-card-text class="pa-2 bg-surface">
          <v-text-field v-model="calcDisplay" variant="outlined" hide-details class="text-right mb-2 text-h5 font-weight-bold" readonly bg-color="surface"></v-text-field>
          <v-row dense>
            <v-col cols="3" v-for="btn in ['7','8','9','/', '4','5','6','*', '1','2','3','-', 'C','0','.','+']" :key="btn">
              <v-btn block height="45" :color="['C'].includes(btn) ? 'error' : ['/','*','-','+'].includes(btn) ? 'secondary' : undefined" variant="flat" class="text-h6 no-drag" @click="btn === 'C' ? calcClear() : calcAppend(btn)">{{ btn }}</v-btn>
            </v-col>
            <v-col cols="12"><v-btn block color="primary" height="45" class="text-h6 no-drag" @click="calcResult">=</v-btn></v-col>
          </v-row>
        </v-card-text>
      </v-card>

      <v-card
        v-if="showAiDialog"
        class="position-fixed rounded-lg border"
        style="z-index: 9999; width: 500px; max-height: 600px; display: flex; flex-direction: column;"
        :style="{ left: aiPos.x + 'px', top: aiPos.y + 'px' }"
        elevation="12"
      >
        <v-card-title class="bg-primary text-white d-flex align-center justify-space-between cursor-move" @mousedown="startDragAi">
            <span>AI Insight: {{ tab.toUpperCase().replace('_', ' ') }}</span>
            <v-btn icon="mdi-close" variant="text" color="white" @click="showAiDialog = false"></v-btn>
        </v-card-title>
        
        <v-card-text class="pa-4 flex-grow-1 overflow-y-auto no-drag" style="min-height: 200px">
            <div v-if="aiLoading" class="d-flex flex-column align-center justify-center py-8">
                <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
                <div class="mt-4 text-caption text-grey">Analyzing data...</div>
            </div>
            <div v-else-if="aiError" class="text-center text-error py-4">
                <v-icon color="error" size="large" class="mb-2">mdi-alert-circle</v-icon>
                <div>{{ aiError }}</div>
            </div>
            <div v-else style="white-space: pre-wrap; line-height: 1.6">{{ aiResponse }}</div>
        </v-card-text>
      </v-card>

      <v-snackbar v-model="snackbar" :color="snackbarColor" timeout="3000" location="bottom right">
        {{ snackbarText }}
        <template v-slot:actions><v-btn variant="text" @click="snackbar = false">Close</v-btn></template>
      </v-snackbar>
    </v-app>
  </template>

<style scoped>
.cursor-move { cursor: move; }
.min-height-40 { min-height: 40px; }
.no-drag { cursor: text; }
</style>