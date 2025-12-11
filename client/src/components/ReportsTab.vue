<script setup>
import { ref, onMounted, computed } from 'vue';
import axios from 'axios';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'vue-chartjs';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const API_URL = '/api';
const rawData = ref([]);
const loading = ref(true);

// Chart Configuration
const chartOptions = ref({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (context) => `Salary: £${context.parsed.y.toFixed(2)}`
      }
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      grid: { color: '#e0e0e0' }
    },
    x: {
      grid: { display: false }
    }
  }
});

// Fetch Data
const fetchData = async () => {
  try {
    // We can reuse the admin endpoint since it returns all monthly history
    const res = await axios.get(`${API_URL}/admin/data`);
    
    // Sort data by date (ascending) so the line moves left-to-right correctly
    rawData.value = (res.data || []).sort((a, b) => a.month.localeCompare(b.month));
  } catch (err) {
    console.error("Failed to load report data", err);
  } finally {
    loading.value = false;
  }
};

// Transform Data for Chart
const chartData = computed(() => {
  return {
    labels: rawData.value.map(d => d.month), // X-Axis: Months
    datasets: [
      {
        label: 'Monthly Salary',
        backgroundColor: 'rgba(76, 175, 80, 0.2)', // Green fill
        borderColor: '#4CAF50', // Green line
        pointBackgroundColor: '#fff',
        pointBorderColor: '#4CAF50',
        pointHoverBackgroundColor: '#4CAF50',
        pointBorderWidth: 2,
        fill: true,
        tension: 0.4, // Smooth curves
        data: rawData.value.map(d => d.salary || 0) // Y-Axis: Salaries
      }
    ]
  };
});

const averageSalary = computed(() => {
  if (!rawData.value.length) return 0;
  const total = rawData.value.reduce((sum, item) => sum + (item.salary || 0), 0);
  return total / rawData.value.length;
});

const maxSalary = computed(() => {
  if (!rawData.value.length) return 0;
  return Math.max(...rawData.value.map(d => d.salary || 0));
});

onMounted(fetchData);
</script>

<template>
  <v-container>
    <v-row class="mb-4">
      <v-col cols="12">
        <h2 class="text-h5 font-weight-bold text-blue-grey-darken-3">Financial Reports</h2>
      </v-col>
    </v-row>

    <v-row class="mb-6">
      <v-col cols="12" md="4">
        <v-card class="mx-auto" color="green-lighten-5" elevation="2">
          <v-card-item>
            <div>
              <div class="text-overline mb-1">Highest Salary</div>
              <div class="text-h4 font-weight-bold text-green-darken-2">£{{ maxSalary.toFixed(0) }}</div>
            </div>
          </v-card-item>
        </v-card>
      </v-col>
      <v-col cols="12" md="4">
        <v-card class="mx-auto" color="blue-lighten-5" elevation="2">
          <v-card-item>
            <div>
              <div class="text-overline mb-1">Average Salary</div>
              <div class="text-h4 font-weight-bold text-blue-darken-2">£{{ averageSalary.toFixed(0) }}</div>
            </div>
          </v-card-item>
        </v-card>
      </v-col>
      <v-col cols="12" md="4">
        <v-card class="mx-auto" color="grey-lighten-4" elevation="2">
          <v-card-item>
            <div>
              <div class="text-overline mb-1">Records Tracked</div>
              <div class="text-h4 font-weight-bold text-grey-darken-3">{{ rawData.length }}</div>
            </div>
          </v-card-item>
        </v-card>
      </v-col>
    </v-row>

    <v-card class="pa-4" elevation="3">
      <v-card-title class="text-subtitle-1 text-uppercase font-weight-bold text-grey-darken-1 mb-4">
        Salary History Trend
      </v-card-title>
      <div style="height: 400px; position: relative;">
        <Line v-if="!loading && rawData.length" :data="chartData" :options="chartOptions" />
        <div v-else class="d-flex justify-center align-center h-100 text-grey">
          {{ loading ? 'Loading data...' : 'No data available to plot.' }}
        </div>
      </div>
    </v-card>
  </v-container>
</template>