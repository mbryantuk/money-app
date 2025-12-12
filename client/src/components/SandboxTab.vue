<script setup>
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';
import draggable from 'vuedraggable';
import { useTheme } from 'vuetify';
import { useSettingsStore } from '../stores/settings';

const settings = useSettingsStore();
const emit = defineEmits(['notify']);
const API_URL = '/api';
const theme = useTheme();
const isDark = computed(() => theme.global.current.value.dark);

const expenses = ref([]);
const salary = ref(0);
const profiles = ref([]);
const newProfile = ref('');
const newItem = ref({ who: 'Joint', name: '', amount: '', category: 'Spending' });
const editingId = ref(null);
const editForm = ref({});
const search = ref('');

// Dynamic Columns
const columns = ref([
    { key: 'who', label: 'Who', align: 'left', width: '100px', sortable: true },
    { key: 'name', label: 'Item', align: 'left', width: '', sortable: true },
    { key: 'amount', label: 'Amount', align: 'right', width: '120px', sortable: true },
    { key: 'category', label: 'Category', align: 'left', width: '140px', sortable: true },
    { key: 'actions', label: '', align: 'end', width: '80px', sortable: false }
]);
const sortKey = ref('amount');
const sortOrder = ref(1);

const fetchSandbox = async () => {
    const res = await axios.get(`${API_URL}/sandbox`);
    expenses.value = res.data;
    const pRes = await axios.get(`${API_URL}/sandbox/profiles`);
    profiles.value = pRes.data;
};
const addItem = async () => {
    if(!newItem.value.name) return;
    await axios.post(`${API_URL}/sandbox`, { ...newItem.value, amount: parseFloat(newItem.value.amount) });
    newItem.value.name = ''; newItem.value.amount = ''; fetchSandbox();
};
const saveItem = async () => { await axios.put(`${API_URL}/sandbox/${editForm.value.id}`, editForm.value); editingId.value = null; fetchSandbox(); };
const deleteItem = async (id) => { await axios.delete(`${API_URL}/sandbox/${id}`); fetchSandbox(); };
const clear = async () => { if(confirm("Clear?")) { await axios.post(`${API_URL}/sandbox/clear`); fetchSandbox(); }};
const importMonth = async () => { 
    if(confirm("Overwrite?")) { 
        await axios.post(`${API_URL}/sandbox/clear`); 
        await axios.post(`${API_URL}/sandbox/import`, { month: settings.currentMonth }); 
        fetchSandbox(); 
    }
};
const saveProfile = async () => { if(!newProfile.value) return; await axios.post(`${API_URL}/sandbox/profiles`, { name: newProfile.value, salary: salary.value, expenses: expenses.value }); newProfile.value = ''; fetchSandbox(); emit('notify', 'Saved'); };
const loadProfile = async (id) => { if(confirm("Load?")) { const res = await axios.post(`${API_URL}/sandbox/profiles/${id}/load`); salary.value = res.data.salary; fetchSandbox(); }};
const deleteProfile = async (id) => { if(confirm("Delete?")) { await axios.delete(`${API_URL}/sandbox/profiles/${id}`); fetchSandbox(); }};
const startEdit = (i) => { editingId.value = i.id; editForm.value = {...i}; };
const sortBy = (key) => { if(sortKey.value === key) sortOrder.value *= -1; else { sortKey.value = key; sortOrder.value = 1; } };

const total = computed(() => expenses.value.reduce((a,c) => a + c.amount, 0));
const calculatedResult = computed(() => salary.value - expenses.value.reduce((a,c) => a + Number(c.amount), 0));

const filteredExpenses = computed(() => {
    let items = expenses.value;
    if (search.value) items = items.filter(i => i.name.toLowerCase().includes(search.value.toLowerCase()));
    return [...items].sort((a, b) => {
        let vA = a[sortKey.value], vB = b[sortKey.value];
        if (typeof vA === 'string') { vA = vA.toLowerCase(); vB = vB.toLowerCase(); }
        return (vA < vB ? -1 : vA > vB ? 1 : 0) * sortOrder.value;
    });
});

onMounted(fetchSandbox);
</script>

<template>
    <div>
        <v-alert icon="mdi-test-tube" title="Sandbox Mode" variant="tonal" color="deep-purple-accent-2" class="mb-6">
            Isolate scenario testing. <template #append><v-btn @click="importMonth" color="deep-purple-darken-1">Clone Current Month</v-btn></template>
        </v-alert>

        <v-card class="pa-4 mb-4" border>
            <div class="d-flex align-center mb-4"><v-text-field v-model="newProfile" label="Save Scenario As..." density="compact" variant="outlined" hide-details class="mr-2" style="max-width:300px"></v-text-field><v-btn @click="saveProfile" color="deep-purple">Save</v-btn></div>
            <div class="d-flex flex-wrap gap-2"><v-chip v-for="p in profiles" :key="p.id" closable @click:close="deleteProfile(p.id)" color="deep-purple" variant="outlined">{{p.name}} <v-icon end icon="mdi-upload" @click.stop="loadProfile(p.id)"></v-icon></v-chip></div>
        </v-card>

        <v-row class="mb-4">
            <v-col cols="6"><v-card class="pa-4"><div class="text-overline">Income</div><v-text-field v-model.number="salary" prefix="£" variant="underlined" class="text-h5 font-weight-bold"></v-text-field></v-card></v-col>
            <v-col cols="6">
                <v-card class="pa-4" :color="calculatedResult < 0 ? (isDark ? 'red-darken-4' : 'red-lighten-5') : (isDark ? 'green-darken-4' : 'green-lighten-5')">
                    <div class="text-overline">Result</div><div class="text-h5 font-weight-black">£{{ calculatedResult.toFixed(2) }}</div>
                </v-card>
            </v-col>
        </v-row>

        <v-card>
            <v-card-text class="bg-background pa-4">
                <v-row dense>
                    <v-col cols="3"><v-select v-model="newItem.who" :items="settings.people" density="compact" variant="solo" hide-details></v-select></v-col>
                    <v-col cols="3"><v-text-field v-model="newItem.name" label="Item" density="compact" variant="solo" hide-details></v-text-field></v-col>
                    <v-col cols="2"><v-text-field v-model="newItem.amount" type="number" prefix="£" density="compact" variant="solo" hide-details></v-text-field></v-col>
                    <v-col cols="2"><v-select v-model="newItem.category" :items="settings.categories" density="compact" variant="solo" hide-details></v-select></v-col>
                    <v-col cols="2"><v-btn block color="deep-purple" @click="addItem">Add</v-btn></v-col>
                </v-row>
            </v-card-text>
            <div class="d-flex justify-end px-4 py-2"><v-text-field v-model="search" label="Search" density="compact" variant="plain" hide-details prepend-inner-icon="mdi-magnify" style="max-width: 200px"></v-text-field></div>
            <v-table>
                <thead>
                    <draggable v-model="columns" tag="tr" item-key="key" handle=".drag-handle">
                        <template #item="{ element: col }">
                            <th :class="'text-'+col.align" :style="{width: col.width}" class="resizable-header">
                                <div class="d-flex align-center" :class="{'justify-end': col.align==='right', 'justify-center': col.align==='center'}"><v-icon size="small" class="drag-handle cursor-move mr-1">mdi-drag</v-icon><span class="cursor-pointer" @click="col.sortable && sortBy(col.key)">{{ col.label }}<v-icon v-if="sortKey === col.key" size="x-small">{{ sortOrder === 1 ? 'mdi-arrow-up' : 'mdi-arrow-down' }}</v-icon></span></div>
                            </th>
                        </template>
                    </draggable>
                </thead>
                <tbody>
                    <tr v-for="ex in filteredExpenses" :key="ex.id">
                        <td v-for="col in columns" :key="col.key" :class="'text-'+col.align">
                            <div v-if="col.key === 'who'"><v-select v-if="editingId===ex.id" v-model="editForm.who" :items="settings.people" density="compact" variant="outlined"></v-select><span v-else>{{ex.who}}</span></div>
                            <div v-else-if="col.key === 'name'"><v-text-field v-if="editingId===ex.id" v-model="editForm.name" density="compact" variant="outlined"></v-text-field><span v-else>{{ex.name}}</span></div>
                            <div v-else-if="col.key === 'amount'"><v-text-field v-if="editingId===ex.id" v-model.number="editForm.amount" density="compact" variant="outlined"></v-text-field><span v-else>£{{ex.amount.toFixed(2)}}</span></div>
                            <div v-else-if="col.key === 'category'"><v-select v-if="editingId===ex.id" v-model="editForm.category" :items="settings.categories" density="compact" variant="outlined"></v-select><span v-else>{{ex.category}}</span></div>
                            <div v-else-if="col.key === 'actions'">
                                <div v-if="editingId===ex.id"><v-btn icon="mdi-check" size="small" variant="text" color="green" @click="saveItem"></v-btn></div>
                                <div v-else><v-btn icon="mdi-pencil" size="small" variant="text" color="grey" @click="startEdit(ex)"></v-btn><v-btn icon="mdi-delete" size="small" variant="text" color="grey" @click="deleteItem(ex.id)"></v-btn></div>
                            </div>
                        </td>
                    </tr>
                    <tr class="font-weight-bold" :class="isDark ? 'bg-grey-darken-3' : 'bg-grey-lighten-4'"><td colspan="2">TOTAL</td><td class="text-right text-red">£{{ total.toFixed(2) }}</td><td colspan="2"></td></tr>
                </tbody>
            </v-table>
            <v-card-actions class="justify-end"><v-btn color="error" @click="clear">Clear All</v-btn></v-card-actions>
        </v-card>
    </div>
</template>

<style scoped>
.cursor-move { cursor: move; }
.resizable-header { resize: horizontal; overflow: hidden; min-width: 50px; }
</style>