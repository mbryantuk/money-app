<script setup>
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';
import draggable from 'vuedraggable';

const emit = defineEmits(['notify']);
const API_URL = '/api';

const rows = ref([]);
const editingId = ref(null);
const editForm = ref({});
const search = ref('');

// Dynamic Columns
const columns = ref([
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
};

const saveRow = async () => {
    // We reuse existing endpoints for Salary and Balance
    await axios.post(`${API_URL}/salary`, { month: editForm.value.month, amount: Number(editForm.value.salary) });
    await axios.post(`${API_URL}/balance`, { month: editForm.value.month, amount: Number(editForm.value.balance) });
    
    editingId.value = null; 
    fetchRows();
    emit('notify', 'Data Saved');
};

const startEdit = (item) => { 
    editingId.value = item.month; // Month is PK
    editForm.value = { ...item }; 
};

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

onMounted(fetchRows);
</script>

<template>
    <div>
        <v-alert icon="mdi-shield-account" title="Data Admin" variant="tonal" color="blue-grey" class="mb-6">
            Review and correct historical data.
        </v-alert>

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
                            <div v-if="col.key === 'month'" class="font-weight-bold">{{ item.month }}</div>
                            <div v-else-if="col.key === 'salary'">
                                <v-text-field v-if="editingId===item.month" v-model.number="editForm.salary" prefix="£" density="compact" variant="outlined" hide-details type="number"></v-text-field>
                                <span v-else>£{{ item.salary ? item.salary.toFixed(2) : '0.00' }}</span>
                            </div>
                            <div v-else-if="col.key === 'balance'">
                                <v-text-field v-if="editingId===item.month" v-model.number="editForm.balance" prefix="£" density="compact" variant="outlined" hide-details type="number"></v-text-field>
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
    </div>
</template>

<style scoped>
.cursor-move { cursor: move; }
.resizable-header { resize: horizontal; overflow: hidden; min-width: 50px; }
</style>