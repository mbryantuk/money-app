<script setup>
import { ref, computed, onMounted, nextTick, watch, onUnmounted } from 'vue';
import axios from 'axios';
import Chart from 'chart.js/auto';
import { useTheme } from 'vuetify';

const API_URL = 'http://localhost:4001/api';
const theme = useTheme();
const isDark = computed(() => theme.global.current.value.dark);

const financialYearStart = ref(new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1);
const data = ref({ totalIncome: 0, totalExpenses: 0, categoryBreakdown: [], monthlyTrend: [], categoryTrend: [], whoBreakdown: [], biggestExpenses: [] });
const mortgage = ref({ soldPrice: 0, h2b: { balance: 0 }, mortgages: [] });
const savingsTotal = ref(0);
const currentBalance = ref(0);

// Chart Refs
const salaryChartCanvas = ref(null);
const categoryChartCanvas = ref(null);
const whoChartCanvas = ref(null);
let salaryChartInstance = null;
let categoryChartInstance = null;
let whoChartInstance = null;

const fyString = computed(() => `April ${financialYearStart.value} - March ${financialYearStart.value + 1}`);

const totalNetWorth = computed(() => {
    const mortgageDebt = mortgage.value.mortgages.reduce((a, m) => a + Number(m.balance), 0);
    const equity = (mortgage.value.soldPrice || 0) - (mortgage.value.h2b.balance || 0) - mortgageDebt;
    return equity + savingsTotal.value + currentBalance.value;
});

const sortedCategoryBreakdown = computed(() => {
  return [...(data.value.categoryBreakdown || [])].sort((a, b) => b.total - a.total);
});

const fetchAll = async () => {
    try {
        const dRes = await axios.get(`${API_URL}/dashboard`, { params: { year: financialYearStart.value } });
        data.value = dRes.data;
        
        const mRes = await axios.get(`${API_URL}/mortgage`);
        mortgage.value = mRes.data;
        const sRes = await axios.get(`${API_URL}/savings/structure`);
        savingsTotal.value = sRes.data.reduce((acc, a) => acc + a.total, 0);
        const bRes = await axios.get(`${API_URL}/data`, { params: { month: new Date().toISOString().slice(0,7) }});
        currentBalance.value = bRes.data.balance || 0;

        renderCharts();
    } catch(e) { console.error(e); }
};

const renderCharts = async () => {
    await nextTick();
    if (!data.value.monthlyTrend) return;

    // --- 1. SALARY CHART (Fixed 0-10k scale) ---
    if (salaryChartCanvas.value) {
        const labels = [];
        const incomeData = [];
        for(let i=0; i<12; i++) {
            const d = new Date(financialYearStart.value, 3 + i, 1);
            const mStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
            labels.push(d.toLocaleDateString('default', { month: 'short' }));
            
            const found = data.value.monthlyTrend.find(x => x.month === mStr);
            incomeData.push(found ? found.income_val : 0);
        }

        if (salaryChartInstance) salaryChartInstance.destroy();
        salaryChartInstance = new Chart(salaryChartCanvas.value, {
            type: 'line',
            data: { labels, datasets: [{ label: 'Salary', data: incomeData, borderColor: '#4CAF50', tension: 0.3, fill: true, backgroundColor: 'rgba(76, 175, 80, 0.1)', borderWidth: 3 }] },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { min: 0, max: 10000, grid: { color: isDark.value ? '#424242' : '#e0e0e0' } }, x: { grid: { display: false } } } }
        });
    }

    // --- 2. CATEGORY TRENDS (Fixed Empty Graph Issue) ---
    if (categoryChartCanvas.value) {
        const trendData = data.value.categoryTrend || [];
        const uniqueCats = [...new Set(trendData.map(d => d.category))];
        
        const labels = [];
        const monthKeys = [];
        for(let i=0; i<12; i++) {
            const d = new Date(financialYearStart.value, 3 + i, 1);
            const mStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
            monthKeys.push(mStr);
            labels.push(d.toLocaleDateString('default', { month: 'short' }));
        }

        const colors = ['#EF5350', '#AB47BC', '#5C6BC0', '#29B6F6', '#26A69A', '#9CCC65', '#FFCA28', '#FFA726', '#8D6E63', '#78909C'];
        
        const datasets = uniqueCats.map((cat, i) => ({
            label: cat, 
            backgroundColor: colors[i % colors.length],
            data: monthKeys.map(mKey => {
                const found = trendData.find(d => d.month === mKey && d.category === cat);
                return found ? found.total : 0;
            })
        }));

        if (categoryChartInstance) categoryChartInstance.destroy();
        categoryChartInstance = new Chart(categoryChartCanvas.value, {
            type: 'bar',
            data: { labels, datasets },
            options: { responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true, grid: { color: isDark.value ? '#424242' : '#e0e0e0' } } } }
        });
    }

    // --- 3. WHO SPENT WHAT (Pie Chart) ---
    if (whoChartCanvas.value && data.value.whoBreakdown) {
        const whoData = data.value.whoBreakdown;
        const labels = whoData.map(d => d.who || 'Joint');
        const amounts = whoData.map(d => d.total);
        const bgColors = labels.map(l => ({ 'Joint': '#FF9800', 'f1': '#2196F3', 'f2': '#00BCD4', 's': '#4CAF50', 'Matt': '#673AB7' }[l] || '#9E9E9E'));

        if (whoChartInstance) whoChartInstance.destroy();
        whoChartInstance = new Chart(whoChartCanvas.value, {
            type: 'doughnut',
            data: { labels, datasets: [{ data: amounts, backgroundColor: bgColors, borderWidth: 0 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
        });
    }
};

watch(financialYearStart, fetchAll);
onMounted(fetchAll);
onUnmounted(() => { 
    if(salaryChartInstance) salaryChartInstance.destroy(); 
    if(categoryChartInstance) categoryChartInstance.destroy(); 
    if(whoChartInstance) whoChartInstance.destroy(); 
});
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
            <v-col cols="12" md="8">
                <v-card class="rounded-lg h-100 pa-4" elevation="2">
                    <div class="text-h6 font-weight-bold mb-4">Salary Tracking</div>
                    <div style="height: 300px;"><canvas ref="salaryChartCanvas"></canvas></div>
                </v-card>
            </v-col>
            <v-col cols="12" md="4">
                <v-card class="rounded-lg h-100 pa-4" elevation="2">
                    <div class="text-h6 font-weight-bold mb-4">Spending Split</div>
                    <div style="height: 300px;"><canvas ref="whoChartCanvas"></canvas></div>
                </v-card>
            </v-col>
        </v-row>

        <v-row class="mb-6">
            <v-col cols="12">
                <v-card class="rounded-lg h-100 pa-4" elevation="2">
                    <div class="text-h6 font-weight-bold mb-4">Category Trends</div>
                    <div style="height: 300px;"><canvas ref="categoryChartCanvas"></canvas></div>
                </v-card>
            </v-col>
        </v-row>

        <v-row>
            <v-col cols="12" md="4">
                <v-card class="rounded-lg h-100 pa-4" elevation="2">
                    <div class="text-h6 font-weight-bold mb-4">Yearly Overview</div>
                    <div class="d-flex justify-space-between mb-2">
                        <span>Total Income</span>
                        <span class="font-weight-bold text-green">+£{{ data.totalIncome.toLocaleString() }}</span>
                    </div>
                    <v-progress-linear :model-value="100" color="green-lighten-2" height="8" rounded></v-progress-linear>
                    <div class="d-flex justify-space-between mt-6 mb-2">
                        <span>Total Expenses</span>
                        <span class="font-weight-bold text-red">£{{ data.totalExpenses.toLocaleString() }}</span>
                    </div>
                    <v-progress-linear :model-value="100" color="red-lighten-2" height="8" rounded></v-progress-linear>
                    <div class="mt-6 pa-4 rounded text-center" :class="isDark ? 'bg-grey-darken-3' : 'bg-grey-lighten-4'">
                        <div class="text-caption text-medium-emphasis">Savings Rate</div>
                        <div class="text-h5 font-weight-bold" :class="data.totalIncome > data.totalExpenses ? 'text-green' : 'text-red'">
                            {{ data.totalIncome > 0 ? Math.round(((data.totalIncome - data.totalExpenses) / data.totalIncome) * 100) : 0 }}%
                        </div>
                    </div>
                </v-card>
            </v-col>
            <v-col cols="12" md="4">
                <v-card class="rounded-lg h-100 pa-4" elevation="2">
                    <div class="text-h6 font-weight-bold mb-4">Spending by Category</div>
                    <div v-if="data.categoryBreakdown.length === 0" class="text-center text-medium-emphasis py-8">No data for this year</div>
                    <div v-else class="d-flex flex-column gap-3" style="max-height: 300px; overflow-y: auto;">
                        <div v-for="cat in sortedCategoryBreakdown" :key="cat.category" class="mb-3">
                            <div class="d-flex justify-space-between mb-1">
                                <span class="text-body-2 font-weight-medium">{{ cat.category }}</span>
                                <span class="text-body-2 font-weight-bold">£{{ cat.total.toLocaleString() }}</span>
                            </div>
                            <v-progress-linear :model-value="(cat.total / data.totalExpenses) * 100" color="primary" height="6" rounded></v-progress-linear>
                        </div>
                    </div>
                </v-card>
            </v-col>
            <v-col cols="12" md="4">
                <v-card class="rounded-lg h-100 pa-4" elevation="2">
                    <div class="text-h6 font-weight-bold mb-4">Biggest Spenders</div>
                    <v-list density="compact" class="pa-0">
                        <v-list-item v-for="(item, i) in data.biggestExpenses" :key="i" class="px-0 border-b">
                            <v-list-item-title class="font-weight-bold">{{ item.name }}</v-list-item-title>
                            <v-list-item-subtitle class="text-caption">{{ item.month }} • {{ item.category }}</v-list-item-subtitle>
                            <template v-slot:append>
                                <span class="text-red font-weight-bold">£{{ item.amount.toFixed(2) }}</span>
                            </template>
                        </v-list-item>
                    </v-list>
                    <div v-if="data.biggestExpenses.length === 0" class="text-center text-medium-emphasis mt-4">No data</div>
                </v-card>
            </v-col>
        </v-row>
    </div>
</template>