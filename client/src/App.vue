<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useTheme, useDisplay } from 'vuetify';
import { useRouter, useRoute } from 'vue-router';
import { useRegisterSW } from 'virtual:pwa-register/vue';
import { useSettingsStore } from './stores/settings';
import TheCalculator from './components/TheCalculator.vue';

const theme = useTheme();
const { mobile } = useDisplay();
const router = useRouter();
const route = useRoute();
const settingsStore = useSettingsStore();

// UI State
const drawer = ref(!mobile.value);
const openList = ref([]);
const showCalculator = ref(false);
const snackbar = ref(false);
const snackbarText = ref('');

// Computed
const isDark = computed(() => theme.global.current.value.dark);
const activeTab = computed(() => route.name || 'dashboard');

// Actions
const toggleTheme = () => theme.global.name.value = isDark.value ? 'light' : 'dark';
const showMsg = (text) => { snackbarText.value = text; snackbar.value = true; };

// Navigation
const navigateTo = (name) => {
  router.push({ name });
  if (mobile.value) drawer.value = false;
};

// PWA Auto-Update
useRegisterSW({
  onRegistered(r) { r && setInterval(() => { r.update(); }, 60 * 60 * 1000); }
});

// Initialization
onMounted(() => {
  settingsStore.fetchSettings();
  // Open drawer based on screen size
  if (mobile.value) drawer.value = false;
});

watch(mobile, (isMobile) => {
  drawer.value = !isMobile;
});
</script>

<template>
  <v-app>
    <v-navigation-drawer v-model="drawer" :temporary="mobile" :permanent="!mobile" color="surface">
      <div class="pa-4">
        <h2 class="text-h6 font-weight-bold text-primary d-flex align-center">
          <v-icon icon="mdi-bank" class="mr-2"></v-icon> Money 2.0
        </h2>
      </div>
      <v-divider></v-divider>
      <v-list nav density="compact" class="mt-2" v-model:opened="openList">
        <v-list-item prepend-icon="mdi-view-dashboard-outline" title="Dashboard" @click="navigateTo('dashboard')" :active="activeTab === 'dashboard'" color="primary" rounded="xl"></v-list-item>
        <v-list-item prepend-icon="mdi-wallet-outline" title="Budget" @click="navigateTo('budget')" :active="activeTab === 'budget'" color="primary" rounded="xl"></v-list-item>
        <v-list-item prepend-icon="mdi-piggy-bank-outline" title="Savings" @click="navigateTo('savings')" :active="activeTab === 'savings'" color="primary" rounded="xl"></v-list-item>
        <v-list-item prepend-icon="mdi-home-city-outline" title="Mortgage" @click="navigateTo('mortgage')" :active="activeTab === 'mortgage'" color="primary" rounded="xl"></v-list-item>
        <v-list-item prepend-icon="mdi-gift-outline" title="Christmas" @click="navigateTo('christmas')" :active="activeTab === 'christmas'" color="primary" rounded="xl"></v-list-item>
        <v-list-item prepend-icon="mdi-test-tube" title="Sandbox" @click="navigateTo('sandbox')" :active="activeTab === 'sandbox'" color="primary" rounded="xl"></v-list-item>
        
        <v-list-group value="reports_group">
          <template v-slot:activator="{ props }">
            <v-list-item v-bind="props" prepend-icon="mdi-chart-box-outline" title="Reports" rounded="xl"></v-list-item>
          </template>
          <v-list-item prepend-icon="mdi-chart-line" title="Salary Tracker" @click="navigateTo('reports')" :active="activeTab === 'reports'" color="primary" rounded="xl"></v-list-item>
        </v-list-group>

        <v-list-group value="admin_group">
          <template v-slot:activator="{ props }">
            <v-list-item v-bind="props" prepend-icon="mdi-shield-account-outline" title="Admin" rounded="xl"></v-list-item>
          </template>
          <v-list-item prepend-icon="mdi-cash-multiple" title="Salary" @click="navigateTo('admin')" :active="activeTab === 'admin'" color="primary" rounded="xl"></v-list-item>
        </v-list-group>

        <v-list-item prepend-icon="mdi-cog-outline" title="Settings" @click="navigateTo('settings')" :active="activeTab === 'settings'" color="primary" rounded="xl"></v-list-item>
      </v-list>
    </v-navigation-drawer>

    <v-app-bar elevation="1" color="surface">
      <v-app-bar-nav-icon v-if="!mobile" @click="drawer = !drawer"></v-app-bar-nav-icon>
      
      <v-app-bar-title class="font-weight-bold text-primary">{{ String(activeTab).charAt(0).toUpperCase() + String(activeTab).slice(1) }}</v-app-bar-title>
      <v-spacer></v-spacer>
      <v-btn :icon="showCalculator ? 'mdi-calculator' : 'mdi-calculator-variant-outline'" @click="showCalculator = !showCalculator" :color="showCalculator ? 'primary' : 'medium-emphasis'" class="mr-2"></v-btn>
      <v-btn :icon="isDark ? 'mdi-weather-sunny' : 'mdi-weather-night'" @click="toggleTheme" color="medium-emphasis"></v-btn>
    </v-app-bar>

    <TheCalculator v-model:show="showCalculator" @notify="showMsg" />

    <v-main :class="isDark ? 'bg-grey-darken-4' : 'bg-grey-lighten-4'">
      <v-container class="py-6" fluid style="max-width: 1400px;">
        <router-view @notify="showMsg"></router-view>
      </v-container>
    </v-main>

    <v-bottom-navigation v-if="mobile" :model-value="activeTab" color="primary" grow>
      <v-btn value="dashboard" @click="navigateTo('dashboard')">
        <v-icon>mdi-view-dashboard-outline</v-icon>
        <span>Dash</span>
      </v-btn>
      <v-btn value="budget" @click="navigateTo('budget')">
        <v-icon>mdi-wallet-outline</v-icon>
        <span>Budget</span>
      </v-btn>
      <v-btn value="savings" @click="navigateTo('savings')">
        <v-icon>mdi-piggy-bank-outline</v-icon>
        <span>Save</span>
      </v-btn>
      <v-btn @click="drawer = !drawer">
        <v-icon>mdi-menu</v-icon>
        <span>Menu</span>
      </v-btn>
    </v-bottom-navigation>

    <v-snackbar v-model="snackbar" timeout="2000" color="success" location="bottom right" :style="{ bottom: mobile ? '60px' : '0' }">
      {{ snackbarText }}
      <template v-slot:actions><v-btn color="white" variant="text" @click="snackbar = false">Close</v-btn></template>
    </v-snackbar>
  </v-app>
</template>