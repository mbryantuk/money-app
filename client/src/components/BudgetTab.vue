<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import axios from 'axios';
import draggable from 'vuedraggable';
import { useTheme } from 'vuetify';

const props = defineProps({
  month: String,
  people: Array,
  categories: Array,
  defaultSalary: Number,
  payDay: { type: Number, default: 19 } 
});
const emit = defineEmits(['update:month', 'notify']);
const API_URL = '/api';
const theme = useTheme();
const isDark = computed(() => theme.global.current.value.dark);

// LOCAL STATE
const balance = ref(0);
const salary = ref(0);
const expenses = ref([]);
const selectedExpenses = ref([]);
const search = ref(''); 

// Standardized Columns
const columns = ref([
  { key: 'select', label: '', width: '40px', align: 'center', sortable: false },
  { key: 'status', label: 'Paid', width: '60px', align: 'center', sortable: true },
  { key: 'who', label: 'Who', width: '110px', align: 'left', sortable: true },
  { key: 'name', label: 'Bill Name', width: '', align: 'left', sortable: true },
  { key: 'amount', label: 'Amount', width: '120px', align: 'right', sortable: true },
  { key: 'category', label: 'Category', width: '140px', align: 'left', sortable: false },
]);
const sortKey = ref('paid');
const sortOrder = ref(1);
const newExpense = ref({ name: '', amount: '', who: 'Joint', category: 'Housing' });

// --- PAY DATE CALCULATION ---
const getPayDate = (year, month) => {
    let d = new Date(year, month, props.payDay); 
    const day = d.getDay(); 
    if (day === 0) d.setDate(d.getDate() - 2); 
    else if (day === 6) d.setDate(d.getDate() - 1); 
    return d.getDate();
};

const formattedMonth = computed(() => {
    if (!props.month) return { main: '', range: '', days: 0 };
    const [y, m] = props.month.split('-').map(Number);
    const startDayVal = getPayDate(y, m - 1); 
    const startDate = new Date(y, m - 1, startDayVal);
    const endDayVal = getPayDate(y, m);
    const endDate = new Date(y, m, endDayVal); 
    const diffTime = Math.abs(endDate - startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    const startMonthName = startDate.toLocaleString('default', { month: 'short' });
    const endMonthName = endDate.toLocaleString('default', { month: 'short' });
    const mainMonthName = startDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    return {
        main: mainMonthName,
        range: `${startMonthName} ${startDayVal} - ${endMonthName} ${endDayVal - 1}`,
        days: diffDays
    };
});

// COMPUTED
const totalExpenses = computed(() => expenses.value.reduce((acc, item) => acc + Number(item.amount), 0));
const paidExpenses = computed(() => expenses.value.filter(item => item.paid).reduce((acc, item) => acc + Number(item.amount), 0));
const leftToPay = computed(() => expenses.value.filter(item => !item.paid).reduce((acc, item) => acc + Number(item.amount), 0));

// Logic: Balance - Expenses = Projected (Assumes positive inputs)
const projectedBalance = computed(() => Number(balance.value) - Number(leftToPay.value));

const progressPercentage = computed(() => totalExpenses.value === 0 ? 0 : Math.round((Math.abs(paidExpenses.value) / Math.abs(totalExpenses.value)) * 100));
const selectedTotal = computed(() => expenses.value.filter(item => selectedExpenses.value.includes(item.id)).reduce((sum, item) => sum + Number(item.amount), 0));
const breakdownByWho = computed(() => {
    const g = {};
    expenses.value.forEach(i => { if(!i.paid) g[i.who||'Joint'] = (g[i.who||'Joint'] || 0) + i.amount; });
    return g;
});

const filteredExpenses = computed(() => {
    let items = expenses.value;
    if (search.value) {
        const s = search.value.toLowerCase();
        items = items.filter(i => (i.name && i.name.toLowerCase().includes(s)) || (i.who && i.who.toLowerCase().includes(s)) || (i.category && i.category.toLowerCase().includes(s)));
    }
    return [...items].sort((a, b) => {
        let vA = a[sortKey.value], vB = b[sortKey.value];
        if (typeof vA === 'string') { vA = vA.toLowerCase(); vB = vB.toLowerCase(); }
        return (vA < vB ? -1 : vA > vB ? 1 : 0) * sortOrder.value;
    });
});

// ACTIONS
const fetchData = async () => {
    const res = await axios.get(`${API_URL}/data`, { params: { month: props.month } });
    balance.value = parseFloat(res.data.balance) || 0;
    salary.value = parseFloat(res.data.salary) || props.defaultSalary;
    
    // FORCE POSITIVE AMOUNTS ON LOAD
    expenses.value = (res.data.expenses || []).map(e => ({
        ...e,
        amount: Math.abs(parseFloat(e.amount))
    }));
    
    selectedExpenses.value = [];
};

const updateBalance = async () => { await axios.post(`${API_URL}/balance`, { month: props.month, amount: Number(balance.value) }); emit('notify', 'Balance Saved'); };
const updateSalary = async () => { await axios.post(`${API_URL}/salary`, { month: props.month, amount: Number(salary.value) }); emit('notify', 'Salary Logged'); };

const changeMonth = (offset) => {
    const [y, m] = props.month.split('-').map(Number);
    const d = new Date(y, m - 1 + offset, 1);
    emit('update:month', `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
};

const initMonth = async (source) => {
    if(!confirm("Initialize month?")) return;
    const [y, m] = props.month.split('-').map(Number);
    const pd = new Date(y, m - 2, 1);
    await axios.post(`${API_URL}/month/init`, { month: props.month, source, previousMonth: `${pd.getFullYear()}-${String(pd.getMonth()+1).padStart(2,'0')}` });
    fetchData();
};

const resetMonth = async () => { if(confirm("Delete ALL data?")) { await axios.delete(`${API_URL}/month`, { params: { month: props.month } }); fetchData(); } };

const addExpense = async () => {
    if(!newExpense.value.name || !newExpense.value.amount) return;
    await axios.post(`${API_URL}/expenses`, { ...newExpense.value, month: props.month, amount: Math.abs(parseFloat(newExpense.value.amount)) });
    newExpense.value.name = ''; newExpense.value.amount = ''; 
    fetchData();
};

const togglePaid = async (item) => {
    item.paid = !item.paid;
    item.paid_at = item.paid ? new Date().toISOString() : null;
    await axios.post(`${API_URL}/expenses/${item.id}/toggle`, { paid: item.paid });
};

// Spreadsheet Auto-save
const updateItem = async (item) => {
    try {
        await axios.put(`${API_URL}/expenses/${item.id}`, item);
    } catch (e) {
        emit('notify', 'Error saving item', 'error');
    }
};

const deleteSelected = async () => {
    if(!selectedExpenses.value.length) return;
    if(!confirm(`Delete ${selectedExpenses.value.length} items?`)) return;
    try {
        await Promise.all(selectedExpenses.value.map(id => axios.delete(`${API_URL}/expenses/${id}`)));
        selectedExpenses.value = []; fetchData(); emit('notify', 'Items deleted');
    } catch (e) { console.error(e); }
};

const sortBy = (key) => { if(sortKey.value === key) sortOrder.value *= -1; else { sortKey.value = key; sortOrder.value = 1; } };

// --- HELPERS ---
const getStringHue = (str) => { let hash = 0; if(!str) return 0; for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash); return Math.abs(hash % 360); };
const getRowStyle = (ex) => {
    const style = { transition: 'background-color 0.2s ease' };
    const hue = getStringHue(ex.who || 'Joint');
    if (isDark.value) { style.backgroundColor = `hsl(${hue}, 50%, 15%, 0.5)`; } 
    else { style.backgroundColor = `hsl(${hue}, 70%, 96%, 0.6)`; }
    if (ex.paid) { style.opacity = 0.6; }
    return style;
};
const getChipColor = (who) => `hsl(${getStringHue(who || 'Joint')}, 70%, 40%)`;
const formatDateTime = (iso) => iso ? new Date(iso).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '';

watch(() => props.month, fetchData);
onMounted(fetchData);
</script>

<template>
    <div>
        <v-card class="mb-6 rounded-xl mx-auto text-center" elevation="2" max-width="600">
            <div class="d-flex align-center justify-space-between pa-2">
                <div style="width: 40px"></div>
                <div class="d-flex align-center">
                    <v-btn icon="mdi-chevron-left" @click="changeMonth(-1)" variant="text" size="large" color="primary"></v-btn>
                    <div>
                        <h2 class="text-h5 font-weight-bold text-primary mb-0" style="line-height: 1.2">{{ formattedMonth.main }}</h2>
                        <div class="text-caption text-medium-emphasis font-weight-bold">{{ formattedMonth.range }} ({{ formattedMonth.days }} Days)</div>
                    </div>
                    <v-btn icon="mdi-chevron-right" @click="changeMonth(1)" variant="text" size="large" color="primary"></v-btn>
                </div>
                <div style="width: 40px"><v-btn v-if="expenses.length" icon="mdi-delete-sweep-outline" color="red-lighten-1" variant="text" @click="resetMonth"></v-btn></div>
            </div>
            <v-alert v-if="formattedMonth.days >= 33" density="compact" type="warning" variant="tonal" class="ma-2 text-caption font-weight-bold" icon="mdi-clock-alert-outline">
                Long Month! {{ formattedMonth.days }} days between paydays.
            </v-alert>
        </v-card>

        <v-alert v-if="!expenses.length" type="info" variant="tonal" class="mb-6 rounded-lg">
            No transactions. <v-btn color="primary" class="ml-4" @click="initMonth('template')">Use Master List</v-btn>
            <v-btn variant="outlined" class="ml-2" @click="initMonth('previous')">Copy Last Month</v-btn>
        </v-alert>

        <div v-else>
            <v-row class="mb-4">
                <v-col cols="12" sm="3">
                    <v-card class="h-100 rounded-lg pa-4 text-center">
                        <div class="text-caption text-uppercase font-weight-bold text-medium-emphasis">Salary</div>
                        <v-text-field v-model.number="salary" prefix="£" variant="plain" density="compact" class="text-h5 font-weight-bold centered-input mt-0" @keydown.enter="updateSalary" @blur="updateSalary" inputmode="decimal" hide-details></v-text-field>
                    </v-card>
                </v-col>
                <v-col cols="12" sm="3">
                    <v-card class="h-100 rounded-lg pa-4 text-center" :color="balance < 0 ? 'red-lighten-5' : undefined">
                        <div class="text-caption text-uppercase font-weight-bold text-medium-emphasis">Current Balance</div>
                        <v-text-field v-model.number="balance" prefix="£" variant="plain" density="compact" class="text-h5 font-weight-black centered-input mt-0" @keydown.enter="updateBalance" @blur="updateBalance" inputmode="decimal" hide-details></v-text-field>
                    </v-card>
                </v-col>
                <v-col cols="12" sm="3">
                    <v-card class="h-100 rounded-lg pa-4 text-center" :color="projectedBalance < 0 ? 'red-lighten-5' : undefined">
                        <div class="text-caption text-uppercase font-weight-bold text-medium-emphasis">Projected Left</div>
                        <div class="text-h5 font-weight-black mt-2">£{{ projectedBalance.toFixed(2) }}</div>
                        <v-progress-linear v-model="progressPercentage" height="6" rounded class="mt-2" striped :color="projectedBalance < 0 ? 'red' : 'green'"></v-progress-linear>
                    </v-card>
                </v-col>
                <v-col cols="12" sm="3">
                    <v-card class="h-100 rounded-lg pa-4">
                        <div class="text-caption text-uppercase font-weight-bold text-medium-emphasis mb-2">Unpaid Total</div>
                        <div v-for="(amt, p) in breakdownByWho" :key="p" class="d-flex justify-space-between border-b py-1">
                            <span class="text-caption font-weight-bold" :style="{ color: getChipColor(p) }">{{p}}</span>
                            <span class="text-caption font-monospace">£{{amt.toFixed(2)}}</span>
                        </div>
                    </v-card>
                </v-col>
            </v-row>

            <v-card class="rounded-lg" elevation="3">
                <v-card-text class="pa-4 bg-surface">
                    <v-row dense align="center">
                        <v-col cols="3"><v-select v-model="newExpense.who" :items="people" density="compact" variant="outlined" hide-details label="Who" bg-color="surface"></v-select></v-col>
                        <v-col cols="3"><v-text-field v-model="newExpense.name" density="compact" variant="outlined" hide-details label="Bill Name" bg-color="surface"></v-text-field></v-col>
                        <v-col cols="2"><v-text-field v-model="newExpense.amount" type="number" prefix="£" density="compact" variant="outlined" hide-details label="Amount" inputmode="decimal" bg-color="surface"></v-text-field></v-col>
                        <v-col cols="2"><v-select v-model="newExpense.category" :items="categories" density="compact" variant="outlined" hide-details label="Category" bg-color="surface"></v-select></v-col>
                        <v-col cols="2"><v-btn block color="primary" @click="addExpense" height="40" variant="flat">Add</v-btn></v-col>
                    </v-row>
                </v-card-text>
                
                <div class="d-flex justify-end px-4 py-2 border-t">
                    <v-text-field v-model="search" prepend-inner-icon="mdi-magnify" label="Search" single-line hide-details density="compact" variant="plain" style="max-width: 200px"></v-text-field>
                </div>
                
                <v-divider></v-divider>
                
                <v-table hover density="comfortable">
                    <thead>
                        <draggable v-model="columns" tag="tr" item-key="key" handle=".drag-handle">
                            <template #item="{ element: col }">
                                <th :class="'text-'+col.align" :style="{width: col.width}" class="resizable-header text-caption text-uppercase">
                                    <div class="d-flex align-center" :class="{'justify-end': col.align==='right', 'justify-center': col.align==='center'}">
                                        <v-icon size="x-small" class="drag-handle cursor-move mr-1 text-disabled">mdi-drag</v-icon>
                                        <span class="cursor-pointer" @click="col.sortable && sortBy(col.key)">
                                            {{ col.label }} <v-icon v-if="sortKey === col.key" size="x-small">{{ sortOrder === 1 ? 'mdi-arrow-up' : 'mdi-arrow-down' }}</v-icon>
                                        </span>
                                    </div>
                                </th>
                            </template>
                        </draggable>
                    </thead>
                    <tbody>
                        <tr v-for="ex in filteredExpenses" :key="ex.id" :style="getRowStyle(ex)">
                            <td v-for="col in columns" :key="col.key" :class="'text-'+col.align" class="pa-1">
                                <v-checkbox-btn v-if="col.key === 'select'" v-model="selectedExpenses" :value="ex.id" density="compact" hide-details class="ma-0"></v-checkbox-btn>
                                
                                <div v-else-if="col.key === 'status'" class="d-flex justify-center">
                                    <v-tooltip v-if="ex.paid && ex.paid_at" location="top" :text="'Paid: ' + formatDateTime(ex.paid_at)">
                                        <template v-slot:activator="{ props }"><v-btn v-bind="props" icon="mdi-check-circle" color="green" variant="text" size="small" density="compact" @click="togglePaid(ex)"></v-btn></template>
                                    </v-tooltip>
                                    <v-btn v-else icon="mdi-circle-outline" color="grey" variant="text" size="small" density="compact" @click="togglePaid(ex)"></v-btn>
                                </div>
                                
                                <div v-else-if="col.key === 'who'">
                                    <v-select v-model="ex.who" :items="people" density="compact" variant="plain" hide-details class="text-caption font-weight-bold text-uppercase" @update:model-value="updateItem(ex)"></v-select>
                                </div>
                                
                                <div v-else-if="col.key === 'name'">
                                    <v-text-field v-model="ex.name" density="compact" variant="plain" hide-details single-line @change="updateItem(ex)"></v-text-field>
                                </div>
                                
                                <div v-else-if="col.key === 'amount'">
                                    <v-text-field v-model.number="ex.amount" prefix="£" density="compact" variant="plain" hide-details single-line type="number" class="font-monospace font-weight-bold text-right" @change="updateItem(ex)"></v-text-field>
                                </div>
                                
                                <div v-else-if="col.key === 'category'">
                                    <v-select v-model="ex.category" :items="categories" density="compact" variant="plain" hide-details class="text-caption" @update:model-value="updateItem(ex)"></v-select>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </v-table>
            </v-card>

            <v-card v-if="selectedExpenses.length" class="position-fixed bottom-0 left-0 right-0 ma-6 pa-3 rounded-pill bg-inverse-surface d-flex align-center justify-center" style="z-index: 100; max-width: 500px; margin: 0 auto 20px auto !important;">
                <span class="font-weight-bold mr-4">{{selectedExpenses.length}} Selected</span>
                <span class="text-h6 font-weight-black mr-4">£{{selectedTotal.toFixed(2)}}</span>
                <v-btn icon="mdi-delete" color="error" variant="text" class="mr-2" @click="deleteSelected"></v-btn>
                <v-btn icon="mdi-close" size="small" variant="text" @click="selectedExpenses = []"></v-btn>
            </v-card>
        </div>
    </div>
</template>

<style scoped>
.centered-input :deep(input) { text-align: center; }
.font-monospace { font-family: 'Roboto Mono', monospace; }
.cursor-move { cursor: move; }
.resizable-header { resize: horizontal; overflow: hidden; min-width: 50px; }

:deep(.v-field--variant-plain .v-field__overlay) { display: none; }
:deep(.v-field--variant-plain:hover .v-field__overlay) { display: block; opacity: 0.05; }
</style>