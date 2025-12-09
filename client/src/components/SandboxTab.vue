<script setup>
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';
import { useTheme } from 'vuetify';

const props = defineProps({ people: Array, categories: Array, currentMonth: String });
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
const importMonth = async () => { if(confirm("Overwrite?")) { await axios.post(`${API_URL}/sandbox/clear`); await axios.post(`${API_URL}/sandbox/import`, { month: props.currentMonth }); fetchSandbox(); }};
const saveProfile = async () => { if(!newProfile.value) return; await axios.post(`${API_URL}/sandbox/profiles`, { name: newProfile.value, salary: salary.value, expenses: expenses.value }); newProfile.value = ''; fetchSandbox(); emit('notify', 'Saved'); };
const loadProfile = async (id) => { if(confirm("Load?")) { const res = await axios.post(`${API_URL}/sandbox/profiles/${id}/load`); salary.value = res.data.salary; fetchSandbox(); }};
const deleteProfile = async (id) => { if(confirm("Delete?")) { await axios.delete(`${API_URL}/sandbox/profiles/${id}`); fetchSandbox(); }};
const startEdit = (i) => { editingId.value = i.id; editForm.value = {...i}; };

const total = computed(() => expenses.value.reduce((a,c) => a + c.amount, 0));
const remaining = computed(() => salary.value + total.value); // Expenses stored as negative? No, usually positive in amount but logically negative. Let's assume expenses are negative or handled via math. Based on App.vue: "Income - Total".

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
            <v-col cols="6"><v-card class="pa-4" :color="remaining < 0 ? 'red-lighten-5' : 'green-lighten-5'"><div class="text-overline">Result</div><div class="text-h5 font-weight-black">£{{ remaining.toFixed(2) }}</div></v-card></v-col>
        </v-row>

        <v-card>
            <v-card-text class="bg-background pa-4">
                <v-row dense>
                    <v-col cols="3"><v-select v-model="newItem.who" :items="people" density="compact" variant="solo" hide-details></v-select></v-col>
                    <v-col cols="3"><v-text-field v-model="newItem.name" label="Item" density="compact" variant="solo" hide-details></v-text-field></v-col>
                    <v-col cols="2"><v-text-field v-model="newItem.amount" type="number" prefix="£" density="compact" variant="solo" hide-details></v-text-field></v-col>
                    <v-col cols="2"><v-select v-model="newItem.category" :items="categories" density="compact" variant="solo" hide-details></v-select></v-col>
                    <v-col cols="2"><v-btn block color="deep-purple" @click="addItem">Add</v-btn></v-col>
                </v-row>
            </v-card-text>
            <v-table>
                <thead><tr><th>Who</th><th>Name</th><th class="text-end">Amount</th><th>Category</th><th class="text-end"></th></tr></thead>
                <tbody>
                    <tr v-for="ex in expenses" :key="ex.id">
                        <td><v-select v-if="editingId===ex.id" v-model="editForm.who" :items="people" density="compact" variant="outlined"></v-select><span v-else>{{ex.who}}</span></td>
                        <td><v-text-field v-if="editingId===ex.id" v-model="editForm.name" density="compact" variant="outlined"></v-text-field><span v-else>{{ex.name}}</span></td>
                        <td class="text-end"><v-text-field v-if="editingId===ex.id" v-model.number="editForm.amount" density="compact" variant="outlined"></v-text-field><span v-else>£{{ex.amount.toFixed(2)}}</span></td>
                        <td><v-select v-if="editingId===ex.id" v-model="editForm.category" :items="categories" density="compact" variant="outlined"></v-select><span v-else>{{ex.category}}</span></td>
                        <td class="text-end">
                            <div v-if="editingId===ex.id"><v-btn icon="mdi-check" size="small" variant="text" color="green" @click="saveItem"></v-btn></div>
                            <div v-else><v-btn icon="mdi-pencil" size="small" variant="text" color="grey" @click="startEdit(ex)"></v-btn><v-btn icon="mdi-delete" size="small" variant="text" color="grey" @click="deleteItem(ex.id)"></v-btn></div>
                        </td>
                    </tr>
                    <tr class="font-weight-bold bg-grey-lighten-4"><td colspan="2">TOTAL</td><td class="text-end text-red">£{{ total.toFixed(2) }}</td><td colspan="2"></td></tr>
                </tbody>
            </v-table>
            <v-card-actions class="justify-end"><v-btn color="error" @click="clear">Clear All</v-btn></v-card-actions>
        </v-card>
    </div>
</template>