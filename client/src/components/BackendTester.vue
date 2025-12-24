<template>
    <div class="tester-container">
      <h1>Backend Verification Harness</h1>
  
      <div class="card">
        <h2>1. Authentication</h2>
        <div v-if="!token">
          <div class="form-inline">
            <input v-model="auth.username" placeholder="Username" />
            <input v-model="auth.password" type="password" placeholder="Password" />
            <button @click="register">Register</button>
            <button @click="login">Login</button>
          </div>
        </div>
        <div v-else class="success">
          <p>✅ <strong>Logged in as:</strong> {{ auth.username }}</p>
          <button @click="logout">Logout</button>
        </div>
      </div>
  
      <div class="card" v-if="token">
        <h2>2. Household Selection</h2>
        <div v-if="!activeHousehold">
          <div class="list">
            <div v-for="h in households" :key="h.id" class="item">
              <span>{{ h.name }} ({{ h.role || 'SysAdmin' }})</span>
              <button @click="selectHousehold(h)">Select</button>
            </div>
          </div>
          <div class="form-inline">
            <input v-model="newHouseholdName" placeholder="New Household Name" />
            <button @click="createHousehold">Create New</button>
          </div>
        </div>
        <div v-else class="success">
          <p>✅ <strong>Active Household:</strong> {{ activeHousehold.name }} (ID: {{ activeHousehold.id }})</p>
          <button @click="activeHousehold = null">Switch Household</button>
        </div>
      </div>
  
      <div class="card" v-if="token && activeHousehold">
        <h2>3. Data Test</h2>
        
        <div class="tabs">
          <button @click="activeTab = 'family'" :class="{ active: activeTab === 'family'}">Family</button>
          <button @click="activeTab = 'insurance'" :class="{ active: activeTab === 'insurance'}">Insurance</button>
          <button @click="activeTab = 'finance'" :class="{ active: activeTab === 'finance'}">Finance</button>
        </div>
  
        <div v-if="activeTab === 'family'" class="tab-content">
          <h3>Family Members</h3>
          <button @click="fetchFamily">Refresh List</button>
          <ul>
            <li v-for="m in familyMembers" :key="m.id">
              {{ m.first_name }} ({{ m.relationship }}) - {{ m.is_resident ? 'Resident' : 'Outside' }}
            </li>
          </ul>
          <div class="form-box">
            <h4>Add Member</h4>
            <div class="form-inline">
              <input v-model="newFamily.first_name" placeholder="Name" />
              <input v-model="newFamily.relationship" placeholder="Relationship" />
              <label><input type="checkbox" v-model="newFamily.is_resident" /> Lives Here</label>
              <button @click="addFamily">Add</button>
            </div>
          </div>
        </div>
  
        <div v-if="activeTab === 'insurance'" class="tab-content">
          <h3>Insurance Policies</h3>
          <button @click="fetchInsurance">Refresh List</button>
          <ul>
            <li v-for="p in policies" :key="p.id">
              <strong>{{ p.company_name }}</strong> ({{ p.policy_number }}) - £{{ p.monthly_cost }}/mo
              <div v-if="p.attachments && p.attachments.length > 0" style="margin-left:20px; font-size: 0.9em; color: #666;">
                 📎 {{ p.attachments.length }} file(s)
              </div>
            </li>
          </ul>
          <div class="form-box">
            <h4>Add Policy</h4>
            <div class="form-inline">
              <input v-model="newPolicy.company_name" placeholder="Company" />
              <input v-model="newPolicy.policy_number" placeholder="Policy #" />
              <input v-model.number="newPolicy.monthly_cost" placeholder="Monthly Cost" />
              <button @click="addPolicy">Add</button>
            </div>
          </div>
        </div>
  
        <div v-if="activeTab === 'finance'" class="tab-content">
          <h3>Monthly Balances</h3>
          <button @click="fetchFinance">Refresh List</button>
          <ul>
            <li v-for="b in balances" :key="b.id">
              {{ b.month }}: £{{ b.amount }} ({{ b.notes }})
            </li>
          </ul>
          <div class="form-box">
            <h4>Add Balance</h4>
            <div class="form-inline">
              <input v-model="newBalance.month" placeholder="YYYY-MM" />
              <input v-model.number="newBalance.amount" placeholder="Amount" />
              <input v-model="newBalance.notes" placeholder="Notes" />
              <button @click="addBalance">Add</button>
            </div>
          </div>
        </div>
  
        <div class="logs">
          <h4>Last Server Response:</h4>
          <pre>{{ lastResponse }}</pre>
        </div>
      </div>
    </div>
  </template>
  
  <script setup>
  import { ref } from 'vue';
  
  const API_URL = 'http://localhost:3000'; 
  
  // State
  const auth = ref({ username: '', password: '' });
  const token = ref(localStorage.getItem('jwt_token') || '');
  const households = ref([]);
  const activeHousehold = ref(null);
  const activeTab = ref('family');
  const lastResponse = ref({});
  
  // Data State
  const familyMembers = ref([]);
  const policies = ref([]);
  const balances = ref([]);
  
  const newHouseholdName = ref('');
  const newFamily = ref({ first_name: '', relationship: '', is_resident: true });
  const newPolicy = ref({ company_name: '', policy_number: '', monthly_cost: 0 });
  const newBalance = ref({ month: '2023-01', amount: 0, notes: 'Initial Balance' });
  
  // --- API HELPER ---
  const apiCall = async (endpoint, method = 'GET', body = null) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token.value) headers['Authorization'] = `Bearer ${token.value}`;
    if (activeHousehold.value) headers['X-Household-ID'] = activeHousehold.value.id;
  
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : null
      });
      const data = await res.json();
      lastResponse.value = data;
      return data;
    } catch (err) {
      lastResponse.value = err.message;
      console.error(err);
    }
  };
  
  // --- ACTIONS ---
  
  const register = async () => {
    await apiCall('/auth/register', 'POST', auth.value);
    alert('Registered! Now try logging in.');
  };
  
  const login = async () => {
    const data = await apiCall('/auth/login', 'POST', auth.value);
    if (data.token) {
      token.value = data.token;
      localStorage.setItem('jwt_token', data.token);
      fetchHouseholds();
    }
  };
  
  const logout = () => {
    token.value = '';
    activeHousehold.value = null;
    localStorage.removeItem('jwt_token');
  };
  
  const fetchHouseholds = async () => {
    const data = await apiCall('/auth/households');
    households.value = data;
  };
  
  const createHousehold = async () => {
    if (!newHouseholdName.value) return;
    await apiCall('/auth/households', 'POST', { name: newHouseholdName.value });
    newHouseholdName.value = '';
    fetchHouseholds();
  };
  
  const selectHousehold = (h) => {
    activeHousehold.value = h;
    // Reset data lists
    familyMembers.value = [];
    policies.value = [];
    balances.value = [];
  };
  
  // Data Actions
  const fetchFamily = async () => {
    const data = await apiCall('/api/family');
    if (data.data) familyMembers.value = data.data;
  };
  
  const addFamily = async () => {
    await apiCall('/api/family', 'POST', newFamily.value);
    fetchFamily();
  };
  
  const fetchInsurance = async () => {
    const data = await apiCall('/api/insurance');
    if (data.data) policies.value = data.data;
  };
  
  const addPolicy = async () => {
    await apiCall('/api/insurance', 'POST', newPolicy.value);
    fetchInsurance();
  };
  
  const fetchFinance = async () => {
    const data = await apiCall('/api/monthly-balances');
    if (data.data) balances.value = data.data;
  };
  
  const addBalance = async () => {
    await apiCall('/api/monthly-balances', 'POST', newBalance.value);
    fetchFinance();
  };
  
  // Initial load
  if (token.value) fetchHouseholds();
  
  </script>
  
  <style scoped>
  .tester-container { max-width: 800px; margin: 0 auto; font-family: sans-serif; color: #333; }
  .card { border: 1px solid #ccc; padding: 20px; margin-bottom: 20px; border-radius: 8px; background: #f9f9f9; }
  .success { color: green; }
  .form-inline { display: flex; gap: 10px; margin-top: 10px; flex-wrap: wrap; }
  .form-box { margin-top: 15px; padding: 10px; background: #eee; border-radius: 4px; }
  input { padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
  button { padding: 8px 16px; cursor: pointer; background: #007bff; color: white; border: none; border-radius: 4px; }
  button:hover { background: #0056b3; }
  .list .item { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #eee; }
  .tabs { display: flex; gap: 10px; margin-bottom: 15px; border-bottom: 2px solid #ddd; padding-bottom: 10px; }
  .tabs button { background: none; color: #333; border-radius: 0; }
  .tabs button.active { font-weight: bold; border-bottom: 2px solid #007bff; color: #007bff; }
  .logs { margin-top: 20px; background: #333; color: #0f0; padding: 10px; border-radius: 4px; overflow-x: auto; max-height: 200px; }
  ul { padding-left: 20px; }
  li { margin-bottom: 5px; }
  </style>