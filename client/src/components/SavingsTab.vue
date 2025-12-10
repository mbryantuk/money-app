<script setup>
import { ref, onMounted, computed } from 'vue';
import axios from 'axios';
import { useTheme } from 'vuetify';

const emit = defineEmits(['notify']);
const API_URL = '/api';
const theme = useTheme();
const isDark = computed(() => theme.global.current.value.dark);

const accounts = ref([]);
const newAccountName = ref('');
const editingId = ref(null);
const editForm = ref({});

const fetchSavings = async () => {
    const res = await axios.get(`${API_URL}/savings/structure`);
    accounts.value = res.data;
};
const addAccount = async () => {
    if(!newAccountName.value) return;
    await axios.post(`${API_URL}/savings/accounts`, { name: newAccountName.value });
    newAccountName.value = ''; fetchSavings();
};
const deleteAccount = async (id) => {
    if(confirm("Delete account?")) { await axios.delete(`${API_URL}/savings/accounts/${id}`); fetchSavings(); }
};
const addPot = async (accountId) => {
    const name = prompt("Pot Name:");
    if(name) { await axios.post(`${API_URL}/savings/pots`, { accountId, name, amount: 0 }); fetchSavings(); }
};
const savePot = async () => {
    await axios.put(`${API_URL}/savings/pots/${editForm.value.id}`, editForm.value);
    editingId.value = null; fetchSavings();
};
const deletePot = async (id) => {
    if(confirm("Delete pot?")) { await axios.delete(`${API_URL}/savings/pots/${id}`); fetchSavings(); }
};
const startEdit = (pot) => { editingId.value = pot.id; editForm.value = { ...pot }; };

onMounted(fetchSavings);
</script>

<template>
    <div>
        <v-card class="pa-6 mb-6 rounded-xl bg-primary text-white" elevation="4">
            <div class="text-h6 opacity-80">Total Savings</div>
            <div class="text-h3 font-weight-black mt-1">£{{ accounts.reduce((a,c) => a + c.total, 0).toFixed(2) }}</div>
        </v-card>

        <div class="d-flex align-center mb-4">
            <v-text-field v-model="newAccountName" label="New Account Name" density="compact" variant="solo" hide-details class="mr-2" style="max-width: 300px;"></v-text-field>
            <v-btn color="primary" @click="addAccount">Add Account</v-btn>
        </div>

        <v-row>
            <v-col v-for="acc in accounts" :key="acc.id" cols="12" md="6">
                <v-card class="rounded-lg h-100">
                    <v-card-title class="d-flex justify-space-between pa-4" :class="isDark ? 'bg-grey-darken-3' : 'bg-grey-lighten-4'">
                        <span class="font-weight-bold">{{ acc.name }}</span>
                        <span class="text-green font-weight-black">£{{ acc.total.toFixed(2) }}</span>
                    </v-card-title>
                    <v-list density="compact">
                        <v-list-item v-for="pot in acc.pots" :key="pot.id" class="border-b">
                            <template v-slot:prepend><v-icon icon="mdi-piggy-bank-outline" color="grey" size="small"></v-icon></template>
                            <v-list-item-title v-if="editingId !== pot.id" class="font-weight-medium">{{ pot.name }}</v-list-item-title>
                            <v-text-field v-else v-model="editForm.name" density="compact" variant="underlined" hide-details></v-text-field>
                            
                            <template v-slot:append>
                                <div class="d-flex align-center">
                                    <span v-if="editingId !== pot.id" class="font-weight-bold mr-3">£{{ pot.amount.toFixed(2) }}</span>
                                    <v-text-field v-else v-model.number="editForm.amount" type="number" density="compact" variant="underlined" style="width: 80px" hide-details class="mr-2"></v-text-field>
                                    <div v-if="editingId === pot.id"><v-btn icon="mdi-check" color="green" variant="text" size="x-small" @click="savePot"></v-btn></div>
                                    <div v-else>
                                        <v-btn icon="mdi-pencil" color="grey" variant="text" size="x-small" @click="startEdit(pot)"></v-btn>
                                        <v-btn icon="mdi-delete" color="grey" variant="text" size="x-small" @click="deletePot(pot.id)"></v-btn>
                                    </div>
                                </div>
                            </template>
                        </v-list-item>
                        <v-list-item @click="addPot(acc.id)" class="text-primary cursor-pointer"><v-icon icon="mdi-plus" start></v-icon> Add Pot</v-list-item>
                    </v-list>
                    <v-card-actions><v-spacer></v-spacer><v-btn color="error" variant="text" size="small" @click="deleteAccount(acc.id)">Delete Account</v-btn></v-card-actions>
                </v-card>
            </v-col>
        </v-row>
    </div>
</template>