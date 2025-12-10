<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import axios from 'axios';
import draggable from 'vuedraggable';

const emit = defineEmits(['notify']);
const API_URL = '/api';

const mortgageData = ref({ soldPrice: 0, h2b: { balance: 0, percentage: 0 }, mortgages: [] });
const search = ref('');

// Columns
const columns = ref([
    { key: 'name', label: 'Name', align: 'left', width: '', sortable: true },
    { key: 'balance', label: 'Balance', align: 'right', width: '130px', sortable: true },
    { key: 'rate', label: 'Rate %', align: 'right', width: '90px', sortable: true },
    { key: 'left', label: 'Time Left', align: 'right', width: '160px', sortable: true },
    { key: 'actions', label: '', align: 'center', width: '50px', sortable: false }
]);
const sortKey = ref('balance');
const sortOrder = ref(-1);

const fetchMortgage = async () => {
    const res = await axios.get(`${API_URL}/mortgage`);
    mortgageData.value = res.data;
    if (mortgageData.value.mortgages) mortgageData.value.mortgages.forEach(m => calculateDisplayFromEndDate(m));
};
const saveMortgage = async () => { await axios.post(`${API_URL}/mortgage`, mortgageData.value); emit('notify', 'Mortgage Saved'); };
const addLoan = () => { mortgageData.value.mortgages.push({ id: Date.now(), name: 'New Loan', balance: 0, rate: 0, endDate: null, yearsLeft: 25, monthsLeft: 0 }); updateEndDate(mortgageData.value.mortgages[mortgageData.value.mortgages.length-1]); };
const removeLoan = (id) => { const idx = mortgageData.value.mortgages.findIndex(m=>m.id===id); if(idx!==-1) { mortgageData.value.mortgages.splice(idx,1); saveMortgage(); } };

const totalDebt = computed(() => mortgageData.value.mortgages.reduce((a, m) => a + Number(m.balance), 0) + Number(mortgageData.value.h2b.balance));
const equity = computed(() => Number(mortgageData.value.soldPrice) - totalDebt.value);

const filteredMortgages = computed(() => {
    let items = mortgageData.value.mortgages;
    if (search.value) items = items.filter(m => m.name && m.name.toLowerCase().includes(search.value.toLowerCase()));
    
    return [...items].sort((a, b) => {
        let vA = a[sortKey.value], vB = b[sortKey.value];
        if (sortKey.value === 'left') { vA = new Date(a.endDate||0).getTime(); vB = new Date(b.endDate||0).getTime(); }
        else if (typeof vA === 'string') { vA = vA.toLowerCase(); vB = vB.toLowerCase(); }
        return (vA < vB ? -1 : vA > vB ? 1 : 0) * sortOrder.value;
    });
});
const sortBy = (key) => { if(sortKey.value === key) sortOrder.value *= -1; else { sortKey.value = key; sortOrder.value = 1; } };

const calculateDisplayFromEndDate = (m) => {
    if (!m.endDate) { m.yearsLeft = 0; m.monthsLeft = 0; return; }
    const end = new Date(m.endDate); const now = new Date();
    let monthsDiff = (end.getFullYear() - now.getFullYear()) * 12; monthsDiff -= now.getMonth(); monthsDiff += end.getMonth();
    if (now.getDate() > end.getDate()) monthsDiff--;
    if (monthsDiff <= 0) { m.yearsLeft = 0; m.monthsLeft = 0; } else { m.yearsLeft = Math.floor(monthsDiff / 12); m.monthsLeft = monthsDiff % 12; }
};
const updateEndDate = (m) => {
    const now = new Date(); const end = new Date(now);
    end.setFullYear(end.getFullYear() + Number(m.yearsLeft || 0)); end.setMonth(end.getMonth() + Number(m.monthsLeft || 0));
    m.endDate = end.toISOString().split('T')[0]; saveMortgage();
};
watch([() => mortgageData.value.soldPrice, () => mortgageData.value.h2b.percentage], ([p, pct]) => { mortgageData.value.h2b.balance = parseFloat((Number(p) * (Number(pct)/100)).toFixed(2)); });
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
            <v-col cols="12" md="10">
                <v-card class="mb-4">
                    <div class="d-flex align-center justify-space-between pa-4">
                        <div class="text-h6">Loans</div>
                        <div class="d-flex align-center">
                            <v-text-field v-model="search" prepend-inner-icon="mdi-magnify" label="Search" density="compact" variant="plain" hide-details class="mr-4" style="width: 150px"></v-text-field>
                            <v-btn icon="mdi-plus" color="primary" variant="text" @click="addLoan"></v-btn>
                        </div>
                    </div>
                    <v-table>
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
                            <tr v-for="m in filteredMortgages" :key="m.id">
                                <td v-for="col in columns" :key="col.key" :class="'text-'+col.align">
                                    <div v-if="col.key === 'name'"><v-text-field v-model="m.name" variant="plain" density="compact" hide-details @change="saveMortgage"></v-text-field></div>
                                    <div v-else-if="col.key === 'balance'"><v-text-field v-model.number="m.balance" type="number" prefix="£" variant="plain" density="compact" hide-details class="text-end font-weight-bold" @change="saveMortgage"></v-text-field></div>
                                    <div v-else-if="col.key === 'rate'"><v-text-field v-model.number="m.rate" type="number" suffix="%" variant="plain" density="compact" hide-details class="text-end" @change="saveMortgage"></v-text-field></div>
                                    <div v-else-if="col.key === 'left'" class="d-flex align-center justify-end"><v-text-field v-model.number="m.yearsLeft" type="number" suffix="Y" variant="plain" density="compact" hide-details class="text-end mr-1" style="min-width: 60px" @change="updateEndDate(m)"></v-text-field><v-text-field v-model.number="m.monthsLeft" type="number" suffix="M" variant="plain" density="compact" hide-details class="text-end" style="min-width: 60px" @change="updateEndDate(m)"></v-text-field></div>
                                    <div v-else-if="col.key === 'actions'"><v-btn icon="mdi-delete" size="x-small" variant="text" color="grey" @click="removeLoan(m.id)"></v-btn></div>
                                </td>
                            </tr>
                        </tbody>
                    </v-table>
                </v-card>
                <v-card class="border-s-lg border-info d-flex align-center justify-space-between pa-4">
                    <div class="d-flex align-center"><v-icon icon="mdi-home-group" color="info" class="mr-3" size="large"></v-icon><div><div class="font-weight-bold">Help to Buy</div><div class="text-caption">Government Share</div></div></div>
                    <div class="d-flex gap-4"><v-text-field v-model.number="mortgageData.h2b.percentage" suffix="%" label="Share" density="compact" variant="outlined" style="width: 80px"></v-text-field><v-text-field v-model.number="mortgageData.h2b.balance" prefix="£" label="Balance" density="compact" variant="outlined" style="width: 140px" class="font-weight-bold"></v-text-field></div>
                </v-card>
            </v-col>
            <v-col cols="12" md="2"><v-card class="pa-4"><v-btn block color="primary" size="large" @click="saveMortgage">Save</v-btn></v-card></v-col>
        </v-row>
    </div>
</template>

<style scoped>
.cursor-move { cursor: move; }
.resizable-header { resize: horizontal; overflow: hidden; min-width: 50px; }
</style>