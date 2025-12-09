<script setup>
import { ref, computed, onMounted, nextTick, watch, onUnmounted } from 'vue';
import axios from 'axios';
import Chart from 'chart.js/auto';
import { useTheme } from 'vuetify';

const API_URL = 'http://localhost:4001/api';
const theme = useTheme();
const isDark = computed(() => theme.global.current.value.dark);

const financialYearStart = ref(new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1);
const data = ref({ totalIncome: 0, totalExpenses: 0, categoryBreakdown: [], monthlyTrend: [], categoryTrend: [] });
const mortgage = ref({ soldPrice: 0, h2b: { balance: 0 }, mortgages: [] });
const savingsTotal = ref(0);
const currentBalance = ref(0);

// Chart Refs
const salaryChartCanvas = ref(null);
const categoryChartCanvas = ref(null);
let salaryChartInstance = null;
let categoryChartInstance = null;

const fyString = computed(() => `April ${financialYearStart.value} - March ${financialYearStart.value + 1}`);

const totalNetWorth = computed(() => {
    const mortgageDebt = mortgage.value.mortgages.reduce((a, m) => a + Number(m.balance), 0);
    const equity = (mortgage.value.soldPrice || 0) - (mortgage.value.h2b.balance || 0) - mortgageDebt;
    return equity + savingsTotal.value + currentBalance.value;
});

const fetchAll = async () => {
    try {
        const dRes = await axios.get(`${API_URL}/dashboard`, { params: { year: financialYearStart.value } });
        data.value = dRes.data;
        
        // Fetch supplemental data for Net Worth
        const mRes = await axios.get(`${API_URL}/mortgage`);
        mortgage.value = mRes.data;
        const sRes = await axios.get(`${API_URL}/savings/structure`);
        savingsTotal.value = sRes.data.reduce((acc, a) => acc + a.total, 0);
        // We just grab current month balance for a rough estimate
        const bRes = await axios.get(`${API_URL}/data`, { params: { month: new Date().toISOString().slice(0,7) }});
        currentBalance.value = bRes.data.balance || 0;

        renderCharts();
    } catch(e) { console.error(e); }
};

const renderCharts = async () => {
    await nextTick();
    if (!data.value.monthlyTrend) return;

    if (salaryChartCanvas.value) {
        const labels = data.value.monthlyTrend.map(d => new Date(d.month+'-01').toLocaleDateString('default', {month:'short'}));
        const incomeData = data.value.monthlyTrend.map(d => d.income_val || 0);

        if (salaryChartInstance) salaryChartInstance.destroy();
        salaryChartInstance = new Chart(salaryChartCanvas.value, {
            type: 'line',
            data: { labels, datasets: [{ label: 'Salary', data: incomeData, borderColor: '#4CAF50', tension: 0.3, fill: true, backgroundColor: 'rgba(76, 175, 80, 0.1)', borderWidth: 3 }] },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { min: 0, max: 10000, grid: { color: isDark.value ? '#424242' : '#e0e0e0' } }, x: { grid: { display: false } } } }
        });
    }

    if (categoryChartCanvas.value) {
        const trendData = data.value.categoryTrend;
        const trendMonths = [...new Set(trendData.map(d => d.month))].sort();
        const trendCategories = [...new Set(trendData.map(d => d.category))];
        const labels = trendMonths.map(m => new Date(m+'-01').toLocaleDateString('default', {month:'short'}));
        const colors = ['#EF5350', '#AB47BC', '#5C6BC0', '#29B6F6', '#26A69A', '#9CCC65', '#FFCA28', '#FFA726', '#8D6E63', '#78909C'];
        
        const datasets = trendCategories.map((cat, i) => ({
            label: cat, backgroundColor: colors[i % colors.length],
            data: trendMonths.map(m => (trendData.find(d => d.month === m && d.category === cat) || {}).total || 0)
        }));

        if (categoryChartInstance) categoryChartInstance.destroy();
        categoryChartInstance = new Chart(categoryChartCanvas.value, {
            type: 'bar',
            data: { labels, datasets },
            options: { responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true, grid: { color: isDark.value ? '#424242' : '#e0e0e0' } } } }
        });
    }
};

watch(financialYearStart, fetchAll);
onMounted(fetchAll);
onUnmounted(() => { if(salaryChartInstance) salaryChartInstance.destroy(); if(categoryChartInstance) categoryChartInstance.destroy(); });
</script>

<template>
    <div>
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
                </div>
                <v-icon icon="mdi-chart-line-variant" size="64" class="opacity-20"></v-icon>
            </div>
        </v-card>

        <v-row class="mb-6">
            <v-col cols="12" md="6">
                <v-card class="rounded-lg h-100 pa-4" elevation="2">
                    <div class="text-h6 font-weight-bold mb-4">Salary Tracking</div>
                    <div style="height: 300px;"><canvas ref="salaryChartCanvas"></canvas></div>
                </v-card>
            </v-col>
            <v-col cols="12" md="6">
                <v-card class="rounded-lg h-100 pa-4" elevation="2">
                    <div class="text-h6 font-weight-bold mb-4">Category Trends</div>
                    <div style="height: 300px;"><canvas ref="categoryChartCanvas"></canvas></div>
                </v-card>
            </v-col>
        </v-row>
    </div>
</template>