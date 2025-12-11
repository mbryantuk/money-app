<script setup>
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';
import draggable from 'vuedraggable';

const emit = defineEmits(['notify']);
const API_URL = '/api';

const rows = ref([]);
const selectedRows = ref([]);
const editingId = ref(null);
const editForm = ref({});
const search = ref('');

// Add Entry State
const currentYear = new Date().getFullYear();
const years = Array.from({length: 10}, (_, i) => currentYear - 5 + i); // 5 years back/forward
const months = [
    { name: 'January', value: '01' }, { name: 'February', value: '02' }, { name: 'March', value: '03' },
    { name: 'April', value: '04' }, { name: 'May', value: '05' }, { name: 'June', value: '06' },
    { name: 'July', value: '07' }, { name: 'August', value: '08' }, { name: 'September', value: '09' },
    { name: 'October', value: '10' }, { name: 'November', value: '11' }, { name: 'December', value: '12' }
];
const newEntry = ref({ year: currentYear, month: '01', salary: '', balance: '' });

// Dynamic Columns
const columns = ref([
    { key: 'select', label: '', width: '50px', align: 'center', sortable: false },
    { key: 'month', label: 'Month', align: 'left', width: '', sortable: true },
    { key: 'salary', label: 'Salary', align: 'right', width: '150px', sortable: true },
    { key: 'balance', label: 'Balance', align: 'right', width: '150px', sortable: true },
    { key: 'actions', label: '', align: 'end', width: '60px', sortable: false }
]);
const sortKey = ref('month');
const sortOrder = ref(-1); // Default newest first

const fetchRows = async () => {
    const res = await axios.get(`${API_URL}/admin/data`);
    rows.value = res.data || [];
    selectedRows.value = [];
};

const addEntry = async () => {
    const monthStr = `${newEntry.value.year}-${newEntry.value.month}`;
    
    // Check for duplicates
    if (rows.value.some(r => r.month === monthStr)) {
        alert(`Entry for ${monthStr} already exists!`);
        return;
    }

    // Create via salary/balance endpoints
    if (newEntry.value.salary) await axios.post(`${API_URL}/salary`, { month: monthStr, amount: Number(newEntry.value.salary) });
    if (newEntry.value.balance) await axios.post(`${API_URL}/balance`, { month: monthStr, amount: Number(newEntry.value.balance) });
    
    // If neither was provided, initialize an empty one
    if (!newEntry.value.salary && !newEntry.value.balance) {
        await axios.post(`${API_URL}/salary`, { month: monthStr, amount: 0 });
    }
    
    // Reset inputs
    newEntry.value.salary = ''; 
    newEntry.value.balance = '';
    
    fetchRows();
    emit('notify', 'Entry Added');
};

const saveRow = async () => {
    await axios.post(`${API_URL}/salary`, { month: editForm.value.month, amount: Number(editForm.value.salary) });
    await axios.post(`${API_URL}/balance`, { month: editForm.value.month, amount: Number(editForm.value.balance) });
    editingId.value = null; 
    fetchRows();
    emit('notify', 'Data Saved');
};

const deleteSelected = async () => {
    if(!selectedRows.value.length) return;
    if(!confirm(`Delete ${selectedRows.value.length} months? This will delete ALL expenses for these months.`)) return;
    
    try {
        await Promise.all(selectedRows.value.map(m => axios.delete(`${API_URL}/month`, { params: { month: m } })));
        fetchRows();
        emit('notify', 'Months deleted');
    } catch (e) { console.error(e); }
};

const startEdit = (item) => { editingId.value = item.month; editForm.value = { ...item }; };
const sortBy = (key) => { if(sortKey.value === key) sortOrder.value *= -1; else { sortKey.value = key; sortOrder.value = 1; } };

const filteredRows = computed(() => {
    let items = rows.value;
    if (search.value) items = items.filter(r => r.month.includes(search.value));
    return [...items].sort((a, b) => {
        let vA = a[sortKey.value], vB = b[sortKey.value];
        if (typeof vA === 'string') { vA = vA.toLowerCase(); vB = vB.toLowerCase(); }
        return (vA < vB ? -1 : vA > vB ? 1 : 0) * sortOrder.value;
    });
});

// --- MISSING MONTHS LOGIC ---
const missingMonths = computed(() => {
    if (!rows.value.length) return [];
    
    const existing = new Set(rows.value.map(r => r.month));
    const sorted = [...existing].sort(); 
    const startStr = sorted[0];
    const endStr = sorted[sorted.length - 1];
    
    if (!startStr || !endStr) return [];

    const missing = [];
    
    // Parse start date safely
    let [sy, sm] = startStr.split('-').map(Number);
    let curr = new Date(sy, sm - 1, 1);
    
    // Parse end date safely
    let [ey, em] = endStr.split('-').map(Number);
    const last = new Date(ey, em - 1, 1);

    while(curr < last) {
        curr.setMonth(curr.getMonth() + 1);
        // If we moved past the last date, stop
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
    fetchRows();
    emit('notify', `Created ${mStr}`);
};

onMounted(fetchRows);
</script>

<template>
    <div>
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
                <v-col cols="12" sm="2">
                    <v-select v-model="newEntry.year" :items="years" density="compact" variant="outlined" hide-details label="Year"></v-select>
                </v-col>
                <v-col cols="12" sm="3">
                    <v-select v-model="newEntry.month" :items="months" item-title="name" item-value="value" density="compact" variant="outlined" hide-details label="Month"></v-select>
                </v-col>
                <v-col cols="12" sm="3">
                    <v-text-field v-model="newEntry.salary" label="Salary" prefix="£" type="number" density="compact" variant="outlined" hide-details inputmode="decimal"></v-text-field>
                </v-col>
                <v-col cols="12" sm="3">
                    <v-text-field v-model="newEntry.balance" label="Balance" prefix="£" type="number" density="compact" variant="outlined" hide-details inputmode="decimal"></v-text-field>
                </v-col>
                <v-col cols="12" sm="1">
                    <v-btn block color="success" height="40" @click="addEntry">Add</v-btn>
                </v-col>
            </v-row>
        </v-card>

        <v-card>
            <div class="d-flex justify-end px-4 py-2">
                <v-text-field v-model="search" label="Search Month" density="compact" variant="plain" hide-details prepend-inner-icon="mdi-magnify" style="max-width: 200px"></v-text-field>
            </div>
            <v-divider></v-divider>
            <v-table hover density="comfortable">
                <thead>
                    <draggable v-model="columns" tag="tr" item-key="key" handle=".drag-handle">
                        <template #item="{ element: col }">
                            <th :class="'text-'+col.align" :style="{width: col.width}" class="resizable-header">
                                <div class="d-flex align-center" :class="{'justify-end': col.align==='right', 'justify-center': col.align==='center'}">
                                    <v-icon size="small" class="drag-handle cursor-move mr-1">mdi-drag</v-icon>
                                    <span class="cursor-pointer" @click="col.sortable && sortBy(col.key)">
                                        {{ col.label }}
                                        <v-icon v-if="sortKey === col.key" size="x-small">{{ sortOrder === 1 ? 'mdi-arrow-up' : 'mdi-arrow-down' }}</v-icon>
                                    </span>
                                </div>
                            </th>
                        </template>
                    </draggable>
                </thead>
                <tbody>
                    <tr v-for="item in filteredRows" :key="item.month" :class="{'bg-blue-grey-lighten-5': editingId===item.month}">
                        <td v-for="col in columns" :key="col.key" :class="'text-'+col.align">
                            <v-checkbox-btn v-if="col.key === 'select'" v-model="selectedRows" :value="item.month" density="compact" hide-details></v-checkbox-btn>
                            <div v-else-if="col.key === 'month'" class="font-weight-bold">{{ item.month }}</div>
                            <div v-else-if="col.key === 'salary'">
                                <v-text-field v-if="editingId===item.month" v-model.number="editForm.salary" prefix="£" density="compact" variant="outlined" hide-details type="number" inputmode="decimal"></v-text-field>
                                <span v-else>£{{ item.salary ? item.salary.toFixed(2) : '0.00' }}</span>
                            </div>
                            <div v-else-if="col.key === 'balance'">
                                <v-text-field v-if="editingId===item.month" v-model.number="editForm.balance" prefix="£" density="compact" variant="outlined" hide-details type="number" inputmode="decimal"></v-text-field>
                                <span v-else :class="item.balance < 0 ? 'text-red' : 'text-green'">£{{ item.balance ? item.balance.toFixed(2) : '0.00' }}</span>
                            </div>
                            <div v-else-if="col.key === 'actions'">
                                <div v-if="editingId===item.month"><v-btn icon="mdi-check" color="green" size="small" variant="text" @click="saveRow"></v-btn><v-btn icon="mdi-close" color="red" size="small" variant="text" @click="editingId=null"></v-btn></div>
                                <v-btn v-else icon="mdi-pencil" color="grey" variant="text" size="small" @click="startEdit(item)"></v-btn>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </v-table>
        </v-card>

        <v-card v-if="selectedRows.length" class="position-fixed bottom-0 left-0 right-0 ma-6 pa-3 rounded-pill bg-inverse-surface d-flex align-center justify-center" style="z-index: 100; max-width: 400px; margin: 0 auto 20px auto !important;">
            <span class="font-weight-bold mr-4">{{selectedRows.length}} Selected</span>
            <v-btn icon="mdi-delete" color="error" variant="text" class="mr-2" @click="deleteSelected"></v-btn>
            <v-btn icon="mdi-close" size="small" variant="text" @click="selectedRows = []"></v-btn>
        </v-card>
    </div>
</template>

<style scoped>
.cursor-move { cursor: move; }
.resizable-header { resize: horizontal; overflow: hidden; min-width: 50px; }
</style>