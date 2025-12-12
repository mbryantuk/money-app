<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import axios from 'axios';
import draggable from 'vuedraggable';

const props = defineProps(['view']);
const emit = defineEmits(['notify']);
const API_URL = '/api';

// --- GENERIC TABLE STATE ---
const rawData = ref([]);
const search = ref('');
const dialog = ref(false);
const editedItem = ref({});
const editedId = ref(null);
const isNew = ref(false);

const schemas = {
    expenses: [
        { title: 'ID', key: 'id', align: 'start', readonly: true },
        { title: 'Month', key: 'month', type: 'text' },
        { title: 'Name', key: 'name', type: 'text' },
        { title: 'Amount', key: 'amount', type: 'number' },
        { title: 'Category', key: 'category', type: 'text' },
        { title: 'Who', key: 'who', type: 'text' },
        { title: 'Paid', key: 'paid', type: 'boolean' },
    ],
    expense_templates: [
        { title: 'ID', key: 'id', readonly: true },
        { title: 'Name', key: 'name', type: 'text' },
        { title: 'Default Amount', key: 'amount', type: 'number' },
        { title: 'Category', key: 'category', type: 'text' },
        { title: 'Who', key: 'who', type: 'text' },
    ],
    settings: [
        { title: 'Key', key: 'key', type: 'text', readonly: true },
        { title: 'Value', key: 'value', type: 'text' },
    ],
    savings_accounts: [
        { title: 'ID', key: 'id', readonly: true },
        { title: 'Account Name', key: 'name', type: 'text' },
    ],
    savings_pots: [
        { title: 'ID', key: 'id', readonly: true },
        { title: 'Account ID', key: 'account_id', type: 'number' },
        { title: 'Pot Name', key: 'name', type: 'text' },
        { title: 'Amount', key: 'amount', type: 'number' },
    ],
    christmas_list: [
        { title: 'ID', key: 'id', readonly: true },
        { title: 'Recipient', key: 'recipient', type: 'text' },
        { title: 'Item', key: 'item', type: 'text' },
        { title: 'Amount', key: 'amount', type: 'number' },
        { title: 'Bought', key: 'bought', type: 'boolean' },
    ],
    sandbox_expenses: [
        { title: 'ID', key: 'id', readonly: true },
        { title: 'Name', key: 'name', type: 'text' },
        { title: 'Amount', key: 'amount', type: 'number' },
        { title: 'Category', key: 'category', type: 'text' },
        { title: 'Who', key: 'who', type: 'text' },
    ],
    credit_cards: [
        { title: 'ID', key: 'id', readonly: true },
        { title: 'Name', key: 'name', type: 'text' },
        { title: 'Limit', key: 'limit_amount', type: 'number' },
        { title: 'APR %', key: 'interest_rate', type: 'number' },
        { title: 'Balance', key: 'balance', type: 'number' },
    ],
    cc_transactions: [
        { title: 'ID', key: 'id', readonly: true },
        { title: 'Card ID', key: 'card_id', type: 'number', readonly: true },
        { title: 'Date', key: 'date', type: 'text' },
        { title: 'Desc', key: 'description', type: 'text' },
        { title: 'Amount', key: 'amount', type: 'number' },
        { title: 'Paid', key: 'paid', type: 'boolean' },
    ],
};

const tableMap = {
    'admin_expenses': 'expenses',
    'admin_templates': 'expense_templates',
    'admin_settings': 'settings',
    'admin_savings_accounts': 'savings_accounts',
    'admin_savings_pots': 'savings_pots',
    'admin_christmas_list': 'christmas_list',
    'admin_sandbox_expenses': 'sandbox_expenses',
    'admin_credit_cards': 'credit_cards',
    'admin_cc_transactions': 'cc_transactions'
};

// --- SALARY TAB STATE (Preserved) ---
const salaryRows = ref([]);
const selectedSalaryRows = ref([]);
const editingId = ref(null);
const editForm = ref({});
const salarySearch = ref('');
const currentYear = new Date().getFullYear();
const years = Array.from({length: 10}, (_, i) => currentYear - 5 + i);
const monthsList = [
    { name: 'January', value: '01' }, { name: 'February', value: '02' }, { name: 'March', value: '03' },
    { name: 'April', value: '04' }, { name: 'May', value: '05' }, { name: 'June', value: '06' },
    { name: 'July', value: '07' }, { name: 'August', value: '08' }, { name: 'September', value: '09' },
    { name: 'October', value: '10' }, { name: 'November', value: '11' }, { name: 'December', value: '12' }
];
const newEntry = ref({ year: currentYear, month: '01', salary: '', balance: '' });
const salaryColumns = ref([
    { key: 'select', label: '', width: '50px', align: 'center', sortable: false },
    { key: 'month', label: 'Month', align: 'left', width: '', sortable: true },
    { key: 'salary', label: 'Salary', align: 'right', width: '150px', sortable: true },
    { key: 'balance', label: 'Balance', align: 'right', width: '150px', sortable: true },
    { key: 'actions', label: '', align: 'end', width: '60px', sortable: false }
]);
const sortKey = ref('month');
const sortOrder = ref(-1);

// --- SALARY ACTIONS ---
const fetchSalaryData = async () => {
    const res = await axios.get(`${API_URL}/admin/data`);
    salaryRows.value = res.data || [];
    selectedSalaryRows.value = [];
};

const addSalaryEntry = async () => {
    const monthStr = `${newEntry.value.year}-${newEntry.value.month}`;
    if (salaryRows.value.some(r => r.month === monthStr)) { alert(`Entry for ${monthStr} already exists!`); return; }
    if (newEntry.value.salary) await axios.post(`${API_URL}/salary`, { month: monthStr, amount: Number(newEntry.value.salary) });
    if (newEntry.value.balance) await axios.post(`${API_URL}/balance`, { month: monthStr, amount: Number(newEntry.value.balance) });
    if (!newEntry.value.salary && !newEntry.value.balance) await axios.post(`${API_URL}/salary`, { month: monthStr, amount: 0 });
    
    newEntry.value.salary = ''; newEntry.value.balance = '';
    fetchSalaryData();
    emit('notify', 'Entry Added');
};

const saveSalaryRow = async () => {
    await axios.post(`${API_URL}/salary`, { month: editForm.value.month, amount: Number(editForm.value.salary) });
    await axios.post(`${API_URL}/balance`, { month: editForm.value.month, amount: Number(editForm.value.balance) });
    editingId.value = null; 
    fetchSalaryData();
    emit('notify', 'Data Saved');
};

const deleteSalarySelected = async () => {
    if(!selectedSalaryRows.value.length) return;
    if(!confirm(`Delete ${selectedSalaryRows.value.length} months?`)) return;
    try {
        await Promise.all(selectedSalaryRows.value.map(m => axios.delete(`${API_URL}/month`, { params: { month: m } })));
        fetchSalaryData();
        emit('notify', 'Months deleted');
    } catch (e) { console.error(e); }
};

const startEdit = (item) => { editingId.value = item.month; editForm.value = { ...item }; };
const filteredSalaryRows = computed(() => {
    let items = salaryRows.value;
    if (salarySearch.value) items = items.filter(r => r.month.includes(salarySearch.value));
    return [...items].sort((a, b) => {
        let vA = a[sortKey.value], vB = b[sortKey.value];
        if (typeof vA === 'string') { vA = vA.toLowerCase(); vB = vB.toLowerCase(); }
        return (vA < vB ? -1 : vA > vB ? 1 : 0) * sortOrder.value;
    });
});
const sortBy = (key) => { if(sortKey.value === key) sortOrder.value *= -1; else { sortKey.value = key; sortOrder.value = 1; } };

const missingMonths = computed(() => {
    if (!salaryRows.value.length) return [];
    const existing = new Set(salaryRows.value.map(r => r.month));
    const sorted = [...existing].sort(); 
    const startStr = sorted[0];
    const endStr = sorted[sorted.length - 1];
    if (!startStr || !endStr) return [];
    const missing = [];
    let [sy, sm] = startStr.split('-').map(Number);
    let curr = new Date(sy, sm - 1, 1);
    let [ey, em] = endStr.split('-').map(Number);
    const last = new Date(ey, em - 1, 1);
    while(curr < last) {
        curr.setMonth(curr.getMonth() + 1);
        if (curr >= last) break;
        const y = curr.getFullYear();
        const m = String(curr.getMonth() + 1).padStart(2, '0');
        const mStr = `${y}-${m}`;
        if (!existing.has(mStr)) missing.push(mStr);
    }
    return missing;
});
const quickAddMonth = async (mStr) => {
    if (!confirm(`Create empty record for ${mStr}?`)) return;
    await axios.post(`${API_URL}/salary`, { month: mStr, amount: 0 });
    fetchSalaryData();
    emit('notify', `Created ${mStr}`);
};

// --- GENERIC ACTIONS ---
const activeTable = computed(() => tableMap[props.view]);

const loadGenericData = async () => {
    if (!activeTable.value) return;
    try {
        const res = await axios.get(`${API_URL}/admin/table/${activeTable.value}`);
        rawData.value = res.data;
    } catch (e) { console.error(e); emit('notify', 'Error loading data', 'error'); }
};

const saveGenericItem = async () => {
    const table = activeTable.value;
    const payload = { ...editedItem.value };
    try {
        if (isNew.value) {
            if (table !== 'settings') delete payload.id; 
            await axios.post(`${API_URL}/admin/table/${table}`, payload);
        } else {
            const id = editedId.value; 
            if (table !== 'settings') delete payload.id;
            await axios.put(`${API_URL}/admin/table/${table}/${id}`, payload);
        }
        dialog.value = false;
        loadGenericData();
        emit('notify', 'Saved successfully');
    } catch (e) { console.error(e); emit('notify', 'Failed to save', 'error'); }
};

const deleteGenericItem = async (item) => {
    if (!confirm('Delete this item?')) return;
    const table = activeTable.value;
    const id = table === 'settings' ? item.key : item.id;
    try {
        await axios.delete(`${API_URL}/admin/table/${table}/${id}`);
        loadGenericData();
        emit('notify', 'Item deleted');
    } catch (e) { emit('notify', 'Delete failed', 'error'); }
};

const openEdit = (item) => {
    isNew.value = false;
    editedItem.value = { ...item };
    editedId.value = (activeTable.value === 'settings') ? item.key : item.id;
    dialog.value = true;
};
const openNew = () => { isNew.value = true; editedItem.value = {}; dialog.value = true; };

const currentHeaders = computed(() => {
    const s = schemas[activeTable.value];
    if (!s) return [];
    const h = s.map(f => ({ title: f.title, key: f.key, sortable: true }));
    h.push({ title: 'Actions', key: 'actions', sortable: false, align: 'end' });
    return h;
});
const currentFields = computed(() => schemas[activeTable.value] || []);

// --- WATCHER ---
watch(() => props.view, (newVal) => {
    // FIX: Check for 'admin_salary' instead of 'salary'
    if (newVal === 'admin_salary') fetchSalaryData();
    else loadGenericData();
}, { immediate: true });

onMounted(() => {
    if (props.view === 'admin_salary') fetchSalaryData();
    else loadGenericData();
});
</script>

<template>
    <div v-if="view === 'admin_salary'">
        <v-alert icon="mdi-shield-account" title="Data Admin" variant="tonal" color="blue-grey" class="mb-6">
            Review, add, or delete historical monthly records.
        </v-alert>

        <v-alert v-if="missingMonths.length" type="warning" variant="tonal" class="mb-6 border-s-lg border-warning">
            <div class="font-weight-bold mb-2">Missing Records Detected</div>
            <div class="text-caption mb-2">The following months exist between your start and end dates but have no data. Click to add them:</div>
            <div class="d-flex flex-wrap gap-2">
                <v-chip v-for="m in missingMonths" :key="m" color="warning" size="small" @click="quickAddMonth(m)" class="font-weight-bold cursor-pointer">
                    {{ m }} <v-icon end icon="mdi-plus-circle" size="small"></v-icon>
                </v-chip>
            </div>
        </v-alert>

        <v-card class="mb-6 pa-4 border-s-lg border-success" elevation="2">
            <div class="text-subtitle-1 font-weight-bold mb-2">Add New Month</div>
            <v-row dense align="center">
                <v-col cols="12" sm="2"><v-select v-model="newEntry.year" :items="years" density="compact" variant="outlined" hide-details label="Year"></v-select></v-col>
                <v-col cols="12" sm="3"><v-select v-model="newEntry.month" :items="monthsList" item-title="name" item-value="value" density="compact" variant="outlined" hide-details label="Month"></v-select></v-col>
                <v-col cols="12" sm="3"><v-text-field v-model="newEntry.salary" label="Salary" prefix="£" type="number" density="compact" variant="outlined" hide-details></v-text-field></v-col>
                <v-col cols="12" sm="3"><v-text-field v-model="newEntry.balance" label="Balance" prefix="£" type="number" density="compact" variant="outlined" hide-details></v-text-field></v-col>
                <v-col cols="12" sm="1"><v-btn block color="success" height="40" @click="addSalaryEntry">Add</v-btn></v-col>
            </v-row>
        </v-card>

        <v-card>
            <div class="d-flex justify-end px-4 py-2">
                <v-text-field v-model="salarySearch" label="Search Month" density="compact" variant="plain" hide-details prepend-inner-icon="mdi-magnify" style="max-width: 200px"></v-text-field>
            </div>
            <v-divider></v-divider>
            <v-table hover density="comfortable">
                <thead>
                    <draggable v-model="salaryColumns" tag="tr" item-key="key" handle=".drag-handle">
                        <template #item="{ element: col }">
                            <th :class="'text-'+col.align" :style="{width: col.width}">
                                <div class="d-flex align-center" :class="{'justify-end': col.align==='right', 'justify-center': col.align==='center'}">
                                    <v-icon size="small" class="drag-handle cursor-move mr-1">mdi-drag</v-icon>
                                    <span class="cursor-pointer" @click="col.sortable && sortBy(col.key)">{{ col.label }}<v-icon v-if="sortKey === col.key" size="x-small">{{ sortOrder === 1 ? 'mdi-arrow-up' : 'mdi-arrow-down' }}</v-icon></span>
                                </div>
                            </th>
                        </template>
                    </draggable>
                </thead>
                <tbody>
                    <tr v-for="item in filteredSalaryRows" :key="item.month" :class="{'bg-blue-grey-lighten-5': editingId===item.month}">
                        <td v-for="col in salaryColumns" :key="col.key" :class="'text-'+col.align">
                            <v-checkbox-btn v-if="col.key === 'select'" v-model="selectedSalaryRows" :value="item.month" density="compact" hide-details></v-checkbox-btn>
                            <div v-else-if="col.key === 'month'" class="font-weight-bold">{{ item.month }}</div>
                            <div v-else-if="col.key === 'salary'">
                                <v-text-field v-if="editingId===item.month" v-model.number="editForm.salary" prefix="£" density="compact" variant="outlined" hide-details type="number"></v-text-field>
                                <span v-else>£{{ item.salary ? item.salary.toFixed(2) : '0.00' }}</span>
                            </div>
                            <div v-else-if="col.key === 'balance'">
                                <v-text-field v-if="editingId===item.month" v-model.number="editForm.balance" prefix="£" density="compact" variant="outlined" hide-details type="number"></v-text-field>
                                <span v-else :class="item.balance < 0 ? 'text-red' : 'text-green'">£{{ item.balance ? item.balance.toFixed(2) : '0.00' }}</span>
                            </div>
                            <div v-else-if="col.key === 'actions'">
                                <div v-if="editingId===item.month"><v-btn icon="mdi-check" color="green" size="small" variant="text" @click="saveSalaryRow"></v-btn><v-btn icon="mdi-close" color="red" size="small" variant="text" @click="editingId=null"></v-btn></div>
                                <v-btn v-else icon="mdi-pencil" color="grey" variant="text" size="small" @click="startEdit(item)"></v-btn>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </v-table>
        </v-card>
        <v-card v-if="selectedSalaryRows.length" class="position-fixed bottom-0 left-0 right-0 ma-6 pa-3 rounded-pill bg-inverse-surface d-flex align-center justify-center" style="z-index: 100; max-width: 400px; margin: 0 auto 20px auto !important;">
            <span class="font-weight-bold mr-4">{{selectedSalaryRows.length}} Selected</span>
            <v-btn icon="mdi-delete" color="error" variant="text" class="mr-2" @click="deleteSalarySelected"></v-btn>
            <v-btn icon="mdi-close" size="small" variant="text" @click="selectedSalaryRows = []"></v-btn>
        </v-card>
    </div>

    <div v-else class="h-100 d-flex flex-column">
        <v-toolbar density="compact" color="transparent" class="mb-2">
            <v-toolbar-title class="text-h6 font-weight-bold text-uppercase text-grey-darken-1">
                Database: {{ activeTable }}
            </v-toolbar-title>
            <v-spacer></v-spacer>
            <v-text-field v-model="search" density="compact" variant="outlined" hide-details prepend-inner-icon="mdi-magnify" placeholder="Search..." style="max-width: 250px" class="mr-3"></v-text-field>
            <v-btn color="primary" prepend-icon="mdi-plus" @click="openNew">Add Item</v-btn>
        </v-toolbar>

        <v-card class="flex-grow-1" elevation="2">
            <v-data-table :headers="currentHeaders" :items="rawData" :search="search" density="compact" hover fixed-header>
                <template v-slot:item.paid="{ item }"><v-icon :color="item.paid?'success':'grey'">{{item.paid?'mdi-check-circle':'mdi-circle-outline'}}</v-icon></template>
                <template v-slot:item.bought="{ item }"><v-icon :color="item.bought?'success':'grey'">{{item.bought?'mdi-check-circle':'mdi-circle-outline'}}</v-icon></template>
                <template v-slot:item.actions="{ item }">
                    <v-btn icon="mdi-pencil" size="x-small" variant="text" color="blue" @click="openEdit(item)"></v-btn>
                    <v-btn icon="mdi-delete" size="x-small" variant="text" color="red" @click="deleteGenericItem(item)"></v-btn>
                </template>
            </v-data-table>
        </v-card>

        <v-dialog v-model="dialog" max-width="500px">
            <v-card>
                <v-card-title class="bg-primary text-white">{{ isNew ? 'New Record' : 'Edit Record' }}</v-card-title>
                <v-card-text class="pt-4">
                    <v-row dense>
                        <v-col cols="12" v-for="field in currentFields" :key="field.key">
                            <v-switch v-if="field.type === 'boolean'" v-model="editedItem[field.key]" :label="field.title" color="primary" hide-details :true-value="1" :false-value="0"></v-switch>
                            <v-text-field v-else-if="field.readonly && !isNew" v-model="editedItem[field.key]" :label="field.title" readonly variant="filled" density="compact"></v-text-field>
                            <v-text-field v-else v-model="editedItem[field.key]" :label="field.title" :type="field.type === 'number' ? 'number' : 'text'" variant="outlined" density="compact"></v-text-field>
                        </v-col>
                    </v-row>
                </v-card-text>
                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn variant="text" @click="dialog = false">Cancel</v-btn>
                    <v-btn color="primary" variant="elevated" @click="saveGenericItem">Save</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
</template>

<style scoped>
.cursor-move { cursor: move; }
</style>