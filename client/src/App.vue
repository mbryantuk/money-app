<script setup>
// ... existing imports
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
import ReportsTab from './components/ReportsTab.vue'; // [!code ++]

// ... rest of script
</script>

<template>
  <v-app>
    <v-navigation-drawer 
      v-model="drawer" 
      :temporary="mobile"
      :permanent="!mobile"
      color="surface"
    >
      <v-divider></v-divider>
      <v-list nav density="compact" class="mt-2" v-model:opened="openList">
        <v-list-item prepend-icon="mdi-view-dashboard-outline" title="Dashboard" value="dashboard" @click="selectTab('dashboard')" :active="tab === 'dashboard'" color="primary" rounded="xl"></v-list-item>
        <v-list-item prepend-icon="mdi-wallet-outline" title="Budget" value="budget" @click="selectTab('budget')" :active="tab === 'budget'" color="primary" rounded="xl"></v-list-item>
        <v-list-item prepend-icon="mdi-piggy-bank-outline" title="Savings" value="savings" @click="selectTab('savings')" :active="tab === 'savings'" color="primary" rounded="xl"></v-list-item>
        <v-list-item prepend-icon="mdi-home-city-outline" title="Mortgage" value="mortgage" @click="selectTab('mortgage')" :active="tab === 'mortgage'" color="primary" rounded="xl"></v-list-item>
        <v-list-item prepend-icon="mdi-gift-outline" title="Christmas" value="christmas" @click="selectTab('christmas')" :active="tab === 'christmas'" color="primary" rounded="xl"></v-list-item>
        <v-list-item prepend-icon="mdi-test-tube" title="Sandbox" value="sandbox" @click="selectTab('sandbox')" :active="tab === 'sandbox'" color="primary" rounded="xl"></v-list-item>
        
        <v-list-group value="reports_group"> <template v-slot:activator="{ props }"> <v-list-item v-bind="props" prepend-icon="mdi-chart-box-outline" title="Reports" rounded="xl"></v-list-item> </template> <v-list-item prepend-icon="mdi-chart-line" title="Salary Tracker" value="reports" @click="selectTab('reports')" :active="tab === 'reports'" color="primary" rounded="xl"></v-list-item> </v-list-group> <v-list-group value="admin_group">
          <template v-slot:activator="{ props }">
            <v-list-item v-bind="props" prepend-icon="mdi-shield-account-outline" title="Admin" rounded="xl"></v-list-item>
          </template>
          <v-list-item prepend-icon="mdi-cash-multiple" title="Salary" value="admin" @click="selectTab('admin')" :active="tab === 'admin'" color="primary" rounded="xl"></v-list-item>
        </v-list-group>

        <v-list-item prepend-icon="mdi-cog-outline" title="Settings" value="settings" @click="selectTab('settings')" :active="tab === 'settings'" color="primary" rounded="xl"></v-list-item>
      </v-list>
    </v-navigation-drawer>

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
        <ReportsTab v-if="tab === 'reports'" /> <SandboxTab v-if="tab === 'sandbox'" 
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

    </v-app>
</template>