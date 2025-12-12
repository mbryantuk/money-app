import { createRouter, createWebHistory } from 'vue-router';

// Lazy load components to speed up initial load
const routes = [
  { path: '/', name: 'dashboard', component: () => import('../components/DashboardTab.vue') },
  { path: '/budget', name: 'budget', component: () => import('../components/BudgetTab.vue') },
  { path: '/savings', name: 'savings', component: () => import('../components/SavingsTab.vue') },
  { path: '/mortgage', name: 'mortgage', component: () => import('../components/MortgageTab.vue') },
  { path: '/christmas', name: 'christmas', component: () => import('../components/ChristmasTab.vue') },
  { path: '/sandbox', name: 'sandbox', component: () => import('../components/SandboxTab.vue') },
  { path: '/admin', name: 'admin', component: () => import('../components/AdminTab.vue') },
  { path: '/settings', name: 'settings', component: () => import('../components/SettingsTab.vue') },
  { path: '/reports', name: 'reports', component: () => import('../components/ReportsTab.vue') },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;