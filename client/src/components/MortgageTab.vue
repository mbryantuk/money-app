<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import axios from 'axios';
const emit = defineEmits(['notify']);
const API_URL = 'http://localhost:4001/api';

const mortgageData = ref({ soldPrice: 0, h2b: { balance: 0, percentage: 0 }, mortgages: [] });

const fetchMortgage = async () => {
    const res = await axios.get(`${API_URL}/mortgage`);
    mortgageData.value = res.data;
};
const saveMortgage = async () => {
    await axios.post(`${API_URL}/mortgage`, mortgageData.value);
    emit('notify', 'Mortgage Saved');
};
const addLoan = () => mortgageData.value.mortgages.push({ id: Date.now(), name: 'New Loan', balance: 0, rate: 0, term: 0 });
const removeLoan = (i) => { mortgageData.value.mortgages.splice(i, 1); saveMortgage(); };

const totalDebt = computed(() => mortgageData.value.mortgages.reduce((a, m) => a + Number(m.balance), 0) + Number(mortgageData.value.h2b.balance));
const equity = computed(() => Number(mortgageData.value.soldPrice) - totalDebt.value);

// Auto-calc H2B balance based on percentage
watch([() => mortgageData.value.soldPrice, () => mortgageData.value.h2b.percentage], ([p, pct]) => {
    mortgageData.value.h2b.balance = parseFloat((Number(p) * (Number(pct)/100)).toFixed(2));
});

onMounted(fetchMortgage);
</script>

<template>
    <div>
        <v-card class="rounded-xl overflow-hidden mb-6" elevation="4">
            <div class="d-flex flex-column flex-md-row">
                <div class="bg-blue-grey-darken-4 pa-6 flex-grow-1 text-center d-flex flex-column justify-center">
                    <div class="text-subtitle-1 text-grey-lighten-1">Estimated Equity</div>
                    <div class="text-h3 font-weight-black text-green-accent-3">£{{ equity.toLocaleString() }}</div>
                </div>
                <div class="pa-6 flex-grow-1 bg-surface">
                    <v-row>
                        <v-col cols="6"><div class="text-caption">Sold Price</div><v-text-field v-model.number="mortgageData.soldPrice" prefix="£" variant="underlined" class="text-h6 font-weight-bold" @change="saveMortgage"></v-text-field></v-col>
                        <v-col cols="6"><div class="text-caption text-end">Total Debt</div><div class="text-h6 font-weight-bold text-red-lighten-1 text-end mt-2">-£{{ totalDebt.toLocaleString() }}</div></v-col>
                    </v-row>
                </div>
            </div>
        </v-card>

        <v-row>
            <v-col cols="12" md="8">
                <v-card title="Loans" class="mb-4">
                    <template #append><v-btn icon="mdi-plus" color="primary" variant="text" @click="addLoan"></v-btn></template>
                    <v-table>
                        <thead><tr><th>Name</th><th class="text-end">Balance</th><th class="text-end">Rate %</th><th class="text-end">Term</th><th></th></tr></thead>
                        <tbody>
                            <tr v-for="(m, i) in mortgageData.mortgages" :key="m.id">
                                <td><v-text-field v-model="m.name" variant="plain" density="compact" hide-details></v-text-field></td>
                                <td><v-text-field v-model.number="m.balance" type="number" prefix="£" variant="plain" density="compact" hide-details class="text-end font-weight-bold"></v-text-field></td>
                                <td><v-text-field v-model.number="m.rate" type="number" suffix="%" variant="plain" density="compact" hide-details class="text-end"></v-text-field></td>
                                <td><v-text-field v-model.number="m.term" type="number" suffix="Yr" variant="plain" density="compact" hide-details class="text-end"></v-text-field></td>
                                <td><v-btn icon="mdi-delete" size="x-small" variant="text" color="grey" @click="removeLoan(i)"></v-btn></td>
                            </tr>
                        </tbody>
                    </v-table>
                </v-card>
                <v-card class="border-s-lg border-info d-flex align-center justify-space-between pa-4">
                    <div class="d-flex align-center"><v-icon icon="mdi-home-group" color="info" class="mr-3" size="large"></v-icon><div><div class="font-weight-bold">Help to Buy</div><div class="text-caption">Government Share</div></div></div>
                    <div class="d-flex gap-4"><v-text-field v-model.number="mortgageData.h2b.percentage" suffix="%" label="Share" density="compact" variant="outlined" style="width: 80px"></v-text-field><v-text-field v-model.number="mortgageData.h2b.balance" prefix="£" label="Balance" density="compact" variant="outlined" style="width: 140px" class="font-weight-bold"></v-text-field></div>
                </v-card>
            </v-col>
            <v-col cols="12" md="4"><v-card class="pa-4"><v-btn block color="primary" size="large" @click="saveMortgage">Save Changes</v-btn></v-card></v-col>
        </v-row>
    </div>
</template>