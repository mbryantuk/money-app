<script setup>
import { ref, onMounted, computed } from 'vue';
import axios from 'axios';

const emit = defineEmits(['notify']);
const API_URL = '/api';

const cards = ref([]);
const activeCard = ref(null); // The card currently being viewed/edited
const transactions = ref([]);
const dialog = ref(false); // New/Edit Card Dialog
const transDialog = ref(false); // New/Edit Transaction Dialog

const editedCard = ref({});
const editedTrans = ref({}); // For transaction editing
const isNewCard = ref(false);
const isNewTrans = ref(false); // Distinguish between adding and editing transaction

// --- FETCH DATA ---
const fetchCards = async () => {
    try {
        const res = await axios.get(`${API_URL}/credit-cards`);
        cards.value = res.data || [];
        if (activeCard.value) {
            const updated = cards.value.find(c => c.id === activeCard.value.id);
            if(updated) activeCard.value = updated;
        }
    } catch (e) { console.error(e); emit('notify', 'Error loading cards', 'error'); }
};

const fetchTransactions = async (cardId) => {
    try {
        const res = await axios.get(`${API_URL}/credit-cards/${cardId}/transactions`);
        transactions.value = res.data || [];
    } catch (e) { console.error(e); }
};

const selectCard = (card) => {
    activeCard.value = card;
    fetchTransactions(card.id);
};

// --- COMPUTED ---
const totalAllocated = computed(() => {
    return transactions.value.reduce((sum, t) => sum + (t.amount || 0), 0);
});

const unallocatedBalance = computed(() => {
    if (!activeCard.value) return 0;
    return (activeCard.value.balance || 0) - totalAllocated.value;
});

const isFullyAllocated = computed(() => {
    return Math.abs(unallocatedBalance.value) < 0.01;
});

const progressPercent = computed(() => {
    if (!activeCard.value || !activeCard.value.balance) return 0;
    const p = (totalAllocated.value / activeCard.value.balance) * 100;
    return Math.min(Math.max(p, 0), 100);
});

// --- ACTIONS ---
const openNewCard = () => { isNewCard.value = true; editedCard.value = {}; dialog.value = true; };
const openEditCard = (card) => { isNewCard.value = false; editedCard.value = {...card}; dialog.value = true; };

const saveCard = async () => {
    try {
        if (isNewCard.value) {
            await axios.post(`${API_URL}/credit-cards`, editedCard.value);
        } else {
            await axios.put(`${API_URL}/credit-cards/${editedCard.value.id}`, editedCard.value);
        }
        dialog.value = false;
        fetchCards();
        emit('notify', 'Card Saved');
    } catch (e) { emit('notify', 'Error saving card', 'error'); }
};

const deleteCard = async (id) => {
    if(!confirm("Delete this card and all its history?")) return;
    await axios.delete(`${API_URL}/credit-cards/${id}`);
    if (activeCard.value && activeCard.value.id === id) activeCard.value = null;
    fetchCards();
    emit('notify', 'Card Deleted');
};

// --- TRANSACTION ACTIONS ---
const openAddTrans = () => {
    isNewTrans.value = true;
    editedTrans.value = { description: '', amount: '', category: 'General', date: new Date().toISOString().slice(0,10) };
    transDialog.value = true;
};

const openEditTrans = (item) => {
    isNewTrans.value = false;
    editedTrans.value = { ...item };
    transDialog.value = true;
};

const saveTransaction = async () => {
    if (!activeCard.value) return;
    try {
        if (isNewTrans.value) {
            await axios.post(`${API_URL}/credit-cards/${activeCard.value.id}/transactions`, editedTrans.value);
        } else {
            await axios.put(`${API_URL}/cc_transactions/${editedTrans.value.id}`, editedTrans.value);
        }
        transDialog.value = false;
        fetchTransactions(activeCard.value.id);
        emit('notify', isNewTrans.value ? 'Transaction Added' : 'Transaction Updated');
    } catch (e) { emit('notify', 'Error saving transaction', 'error'); }
};

const markTransPaid = async (item) => {
    // Toggling paid status (setting paid=1) will remove it from the list
    if (!confirm("Mark this transaction as Paid? It will be removed from this list.")) return;
    try {
        await axios.post(`${API_URL}/cc_transactions/${item.id}/toggle`, { paid: true });
        fetchTransactions(activeCard.value.id);
        emit('notify', 'Transaction marked as Paid');
    } catch (e) { emit('notify', 'Error updating status', 'error'); }
};

const payOffCard = async () => {
    if (!confirm("Are you sure? This will clear the allocated transactions and reset the card balance to 0.")) return;
    try {
        await axios.post(`${API_URL}/credit-cards/${activeCard.value.id}/pay`, { clearBalance: true });
        fetchCards();
        fetchTransactions(activeCard.value.id); 
        emit('notify', 'Card Paid & Reset!', 'success');
    } catch(e) { emit('notify', 'Error processing payment', 'error'); }
};

onMounted(fetchCards);
</script>

<template>
    <v-container fluid class="pa-0">
        <v-row class="mb-4" align="center">
            <v-col>
                <h2 class="text-h5 font-weight-bold text-primary">Credit Cards</h2>
            </v-col>
            <v-col cols="auto">
                <v-btn color="primary" prepend-icon="mdi-credit-card-plus" @click="openNewCard">Add Card</v-btn>
            </v-col>
        </v-row>

        <v-row v-if="!activeCard">
            <v-col cols="12" md="4" v-for="card in cards" :key="card.id">
                <v-card elevation="3" class="rounded-xl" @click="selectCard(card)" hover border>
                    <v-card-item>
                        <div class="d-flex justify-space-between mb-2">
                            <span class="text-h6 font-weight-bold">{{ card.name }}</span>
                            <v-icon color="primary" size="large">mdi-credit-card-chip</v-icon>
                        </div>
                        <div class="text-subtitle-2 text-grey">Current Balance</div>
                        <div class="text-h4 font-weight-bold mb-2">£{{ card.balance ? card.balance.toFixed(2) : '0.00' }}</div>
                        <v-divider class="my-3"></v-divider>
                        <div class="d-flex justify-space-between text-caption">
                            <div>
                                <div class="text-grey">Credit Limit</div>
                                <div class="font-weight-bold">£{{ card.limit_amount }}</div>
                            </div>
                            <div class="text-right">
                                <div class="text-grey">APR</div>
                                <div class="font-weight-bold">{{ card.interest_rate }}%</div>
                            </div>
                        </div>
                    </v-card-item>
                    <v-card-actions>
                        <v-btn variant="text" color="primary" block>Manage Transactions</v-btn>
                    </v-card-actions>
                </v-card>
            </v-col>
            <v-col cols="12" v-if="cards.length === 0">
                <v-alert type="info" variant="tonal" class="border-s-lg border-primary">
                    No credit cards found. Click "Add Card" to get started.
                </v-alert>
            </v-col>
        </v-row>

        <div v-else>
            <v-btn variant="text" prepend-icon="mdi-arrow-left" class="mb-4" @click="activeCard = null">Back to Cards</v-btn>

            <v-card class="mb-4 pa-4 bg-grey-lighten-4 rounded-lg" elevation="0" border>
                <div class="d-flex justify-space-between align-center mb-4">
                    <div>
                        <div class="text-h5 font-weight-bold">{{ activeCard.name }}</div>
                        <div class="text-caption">Limit: £{{ activeCard.limit_amount }} | APR: {{ activeCard.interest_rate }}%</div>
                    </div>
                    <div>
                        <v-btn icon="mdi-pencil" size="small" variant="text" @click="openEditCard(activeCard)"></v-btn>
                        <v-btn icon="mdi-delete" size="small" color="error" variant="text" @click="deleteCard(activeCard.id)"></v-btn>
                    </div>
                </div>

                <div class="mb-2 d-flex justify-space-between">
                    <span class="font-weight-bold text-grey-darken-2">Itemised: £{{ totalAllocated.toFixed(2) }}</span>
                    <span class="font-weight-bold text-primary">Balance: £{{ activeCard.balance.toFixed(2) }}</span>
                </div>
                <v-progress-linear 
                    :model-value="progressPercent" 
                    height="20" 
                    rounded 
                    :color="isFullyAllocated ? 'success' : 'primary'"
                    striped
                >
                    <template v-slot:default>
                        <strong class="text-white text-caption">{{ progressPercent.toFixed(0) }}%</strong>
                    </template>
                </v-progress-linear>
                
                <div v-if="!isFullyAllocated" class="text-center mt-2 text-caption text-grey-darken-1">
                    Wait! You still need to account for <strong class="text-error">£{{ unallocatedBalance.toFixed(2) }}</strong>
                </div>
                <div v-else class="text-center mt-2 text-success font-weight-bold animate-pulse">
                    <v-icon icon="mdi-check-circle" start></v-icon> Fully Allocated! Ready to pay.
                </div>
            </v-card>

            <v-card elevation="2" class="rounded-lg">
                <v-toolbar density="compact" color="white">
                    <v-toolbar-title class="text-subtitle-1 font-weight-bold">Transactions</v-toolbar-title>
                    <v-spacer></v-spacer>
                    <v-btn color="primary" variant="flat" prepend-icon="mdi-plus" @click="openAddTrans">Add Item</v-btn>
                </v-toolbar>
                <v-divider></v-divider>
                
                <v-table hover>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Description</th>
                            <th>Category</th>
                            <th class="text-right">Amount</th>
                            <th class="text-right" style="width: 100px">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="t in transactions" :key="t.id">
                            <td>{{ t.date }}</td>
                            <td>{{ t.description }}</td>
                            <td><v-chip size="x-small">{{ t.category }}</v-chip></td>
                            <td class="text-right font-weight-bold">£{{ t.amount.toFixed(2) }}</td>
                            <td class="text-right">
                                <v-btn icon="mdi-pencil" size="x-small" variant="text" color="blue" class="mr-1" @click="openEditTrans(t)"></v-btn>
                                <v-tooltip text="Mark as Paid" location="top">
                                    <template v-slot:activator="{ props }">
                                        <v-btn v-bind="props" icon="mdi-check" size="x-small" variant="text" color="success" @click="markTransPaid(t)"></v-btn>
                                    </template>
                                </v-tooltip>
                            </td>
                        </tr>
                        <tr v-if="transactions.length === 0">
                            <td colspan="5" class="text-center text-grey py-4">No unpaid transactions itemised yet.</td>
                        </tr>
                    </tbody>
                </v-table>
            </v-card>

            <v-card v-if="isFullyAllocated" color="success" class="mt-6 pa-4 text-center rounded-xl" elevation="4">
                <div class="text-h6 text-white mb-2">Balance Reconciled</div>
                <v-btn size="large" variant="flat" color="white" class="text-success font-weight-bold" prepend-icon="mdi-cash-check" @click="payOffCard">
                    Mark as Paid & Clear
                </v-btn>
            </v-card>
        </div>

        <v-dialog v-model="dialog" max-width="400">
            <v-card>
                <v-card-title class="bg-primary text-white">{{ isNewCard ? 'Add Credit Card' : 'Edit Card' }}</v-card-title>
                <v-card-text class="pt-4">
                    <v-text-field v-model="editedCard.name" label="Card Name" variant="outlined" density="compact"></v-text-field>
                    <v-row dense>
                        <v-col cols="6"><v-text-field v-model.number="editedCard.limit_amount" label="Limit" prefix="£" type="number" variant="outlined" density="compact"></v-text-field></v-col>
                        <v-col cols="6"><v-text-field v-model.number="editedCard.interest_rate" label="Interest %" suffix="%" type="number" variant="outlined" density="compact"></v-text-field></v-col>
                    </v-row>
                    <v-text-field v-model.number="editedCard.balance" label="Current Balance" prefix="£" type="number" variant="outlined" density="compact" hint="Amount currently owed" persistent-hint></v-text-field>
                </v-card-text>
                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn variant="text" @click="dialog = false">Cancel</v-btn>
                    <v-btn color="primary" @click="saveCard">Save</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <v-dialog v-model="transDialog" max-width="400">
            <v-card>
                <v-card-title class="bg-primary text-white">{{ isNewTrans ? 'Itemise Transaction' : 'Edit Transaction' }}</v-card-title>
                <v-card-text class="pt-4">
                    <v-text-field v-model="editedTrans.date" type="date" label="Date" variant="outlined" density="compact"></v-text-field>
                    <v-text-field v-model="editedTrans.description" label="Description" variant="outlined" density="compact"></v-text-field>
                    <v-text-field v-model.number="editedTrans.amount" label="Amount" prefix="£" type="number" variant="outlined" density="compact"></v-text-field>
                    <v-text-field v-model="editedTrans.category" label="Category" variant="outlined" density="compact"></v-text-field>
                </v-card-text>
                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn variant="text" @click="transDialog = false">Cancel</v-btn>
                    <v-btn color="primary" @click="saveTransaction">Save</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </v-container>
</template>

<style scoped>
.animate-pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: .7; }
}
</style>