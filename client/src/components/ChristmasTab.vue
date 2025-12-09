<script setup>
import { ref, onMounted, computed } from 'vue';
import axios from 'axios';
const API_URL = '/api';

const list = ref([]);
const newGift = ref({ recipient: '', item: '', amount: '' });
const editingId = ref(null);
const editForm = ref({});

const fetchChristmas = async () => { const res = await axios.get(`${API_URL}/christmas`); list.value = res.data || []; };
const addGift = async () => { 
    if(!newGift.value.recipient) return; 
    await axios.post(`${API_URL}/christmas`, newGift.value); 
    newGift.value = { recipient:'', item:'', amount:'' }; fetchChristmas(); 
};
const saveGift = async () => { await axios.put(`${API_URL}/christmas/${editForm.value.id}`, editForm.value); editingId.value = null; fetchChristmas(); };
const deleteGift = async (id) => { await axios.delete(`${API_URL}/christmas/${id}`); fetchChristmas(); };
const toggleBought = async (g) => { g.bought = !g.bought; await axios.post(`${API_URL}/christmas/${g.id}/toggle`, { bought: g.bought }); };
const startEdit = (g) => { editingId.value = g.id; editForm.value = {...g}; };

const totalBudget = computed(() => list.value.reduce((a,c) => a + Number(c.amount), 0));
const spent = computed(() => list.value.filter(i => i.bought).reduce((a,c) => a + Number(c.amount), 0));
const remaining = computed(() => totalBudget.value - spent.value);

onMounted(fetchChristmas);
</script>

<template>
    <div>
        <v-row class="mb-6">
            <v-col cols="12" md="6"><v-card class="pa-6 rounded-xl bg-green-darken-3 text-white"><div class="text-h6 opacity-80">Total Budget</div><div class="text-h3 font-weight-black">£{{ totalBudget }}</div></v-card></v-col>
            <v-col cols="12" md="6"><v-card class="pa-6 rounded-xl text-white" :class="remaining < 0 ? 'bg-red-darken-3' : 'bg-blue-grey-darken-3'"><div class="text-h6 opacity-80">Remaining</div><div class="text-h3 font-weight-black">£{{ remaining }}</div></v-card></v-col>
        </v-row>

        <v-card class="rounded-lg mb-6">
            <v-card-text class="bg-background pa-4">
                <v-row dense>
                    <v-col cols="12" sm="4"><v-text-field v-model="newGift.recipient" label="Recipient" density="compact" variant="solo" hide-details></v-text-field></v-col>
                    <v-col cols="12" sm="4"><v-text-field v-model="newGift.item" label="Item" density="compact" variant="solo" hide-details></v-text-field></v-col>
                    <v-col cols="12" sm="2"><v-text-field v-model="newGift.amount" type="number" prefix="£" label="Cost" density="compact" variant="solo" hide-details></v-text-field></v-col>
                    <v-col cols="12" sm="2"><v-btn block color="green" @click="addGift" height="40">Add</v-btn></v-col>
                </v-row>
            </v-card-text>
            <v-divider></v-divider>
            <v-table>
                <thead><tr><th>Got It?</th><th>Recipient</th><th>Item</th><th class="text-end">Amount</th><th class="text-end">Actions</th></tr></thead>
                <tbody>
                    <tr v-for="g in list" :key="g.id" :class="{'bg-green-lighten-5': g.bought}">
                        <td><v-checkbox-btn v-model="g.bought" @change="toggleBought(g)" color="green" density="compact" hide-details></v-checkbox-btn></td>
                        <td><v-text-field v-if="editingId===g.id" v-model="editForm.recipient" density="compact" variant="outlined"></v-text-field><span v-else>{{g.recipient}}</span></td>
                        <td><v-text-field v-if="editingId===g.id" v-model="editForm.item" density="compact" variant="outlined"></v-text-field><span v-else>{{g.item}}</span></td>
                        <td class="text-end"><v-text-field v-if="editingId===g.id" v-model="editForm.amount" type="number" density="compact" variant="outlined"></v-text-field><span v-else>£{{Number(g.amount).toFixed(2)}}</span></td>
                        <td class="text-end">
                            <div v-if="editingId===g.id"><v-btn icon="mdi-check" color="green" variant="text" size="small" @click="saveGift"></v-btn></div>
                            <div v-else><v-btn icon="mdi-pencil" color="grey" variant="text" size="small" @click="startEdit(g)"></v-btn><v-btn icon="mdi-delete" color="grey" variant="text" size="small" @click="deleteGift(g.id)"></v-btn></div>
                        </td>
                    </tr>
                </tbody>
            </v-table>
        </v-card>
    </div>
</template>