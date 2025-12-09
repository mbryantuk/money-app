<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import axios from 'axios';
import draggable from 'vuedraggable';
import { useTheme } from 'vuetify';

const props = defineProps({
  month: String,
  people: Array,
  categories: Array,
  defaultSalary: Number
});
const emit = defineEmits(['update:month', 'notify']);
const API_URL = 'http://localhost:4001/api';
const theme = useTheme();
const isDark = computed(() => theme.global.current.value.dark);

// LOCAL STATE
const balance = ref(0);
const salary = ref(0);
const expenses = ref([]);
const selectedExpenses = ref([]);
const editingId = ref(null);
const editForm = ref({});
const columns = ref([
  { key: 'select', label: '', width: '50px', align: 'center', sortable: false },
  { key: 'status', label: 'Status', width: '60px', align: 'center', sortable: true },
  { key: 'who', label: 'Who', width: '100px', align: 'left', sortable: true },
  { key: 'name', label: 'Bill Name', width: '', align: 'left', sortable: true },
  { key: 'amount', label: 'Amount', width: '120px', align: 'right', sortable: true },
  { key: 'category', label: 'Category', width: '140px', align: 'left', sortable: false },
  { key: 'actions', label: 'Edit', width: '80px', align: 'end', sortable: false }
]);
const sortKey = ref('paid');
const sortOrder = ref(1);
const newExpense = ref({ name: '', amount: '', who: 'Joint', category: 'Housing' });

// --- PAY DATE CALCULATION (Working day before 20th) ---
const getPayDate = (year, month) => {
    let d = new Date(year, month, 20);
    const day = d.getDay(); 
    // If 20th is Sun(0) -> Fri(18). If Sat(6) -> Fri(19). 
    // If Mon(1) -> Fri(17) (Working day BEFORE). Else -> 19th.
    if (day === 0) d.setDate(18); 
    else if (day === 6) d.setDate(19); 
    else if (day === 1) d.setDate(17); 
    else d.setDate(19); 
    return d.getDate();
};

const formattedMonth = computed(() => {
    if (!props.month) return { main: '', range: '' };
    const [y, m] = props.month.split('-').map(Number);
    
    // Logic: The "November" budget covers Nov 19 -> Dec 18
    // Start: Payday of this month (m-1 in JS index)
    // End: Payday of next month (m) - 1 day
    
    const startDay = getPayDate(y, m - 1); 
    const endDayRef = getPayDate(y, m);
    
    const startMonthName = new Date(y, m - 1).toLocaleString('default', { month: 'short' });
    const endMonthName = new Date(y, m).toLocaleString('default', { month: 'short' });
    const mainMonthName = new Date(y, m - 1).toLocaleString('default', { month: 'long', year: 'numeric' });

    return {
        main: mainMonthName,
        range: `${startMonthName} ${startDay} - ${endMonthName} ${endDayRef - 1}`
    };
});

// COMPUTED
const totalExpenses = computed(() => expenses.value.reduce((acc, item) => acc + Number(item.amount), 0));
const paidExpenses = computed(() => expenses.value.filter(item => item.paid).reduce((acc, item) => acc + Number(item.amount), 0));
const leftToPay = computed(() => expenses.value.filter(item => !item.paid).reduce((acc, item) => acc + Number(item.amount), 0));
const projectedBalance = computed(() => Number(balance.value) + Number(leftToPay.value));
const progressPercentage = computed(() => totalExpenses.value === 0 ? 0 : Math.round((Math.abs(paidExpenses.value) / Math.abs(totalExpenses.value)) * 100));
const selectedTotal = computed(() => expenses.value.filter(item => selectedExpenses.value.includes(item.id)).reduce((sum, item) => sum + Number(item.amount), 0));
const breakdownByWho = computed(() => {
    const g = {};
    expenses.value.forEach(i => { if(!i.paid) g[i.who||'Joint'] = (g[i.who||'Joint'] || 0) + i.amount; });
    return g;
});
const sortedExpenses = computed(() => {
    return [...expenses.value].sort((a, b) => {
        let vA = a[sortKey.value], vB = b[sortKey.value];
        if (typeof vA === 'string') { vA = vA.toLowerCase(); vB = vB.toLowerCase(); }
        return (vA < vB ? -1 : vA > vB ? 1 : 0) * sortOrder.value;
    });
});

// ACTIONS
const fetchData = async () => {
    const res = await axios.get(`${API_URL}/data`, { params: { month: props.month } });
    balance.value = parseFloat(res.data.balance) || 0;
    salary.value = parseFloat(res.data.salary) || props.defaultSalary;
    expenses.value = res.data.expenses || [];
    selectedExpenses.value = [];
};
const updateBalance = async () => {
    await axios.post(`${API_URL}/balance`, { month: props.month, amount: Number(balance.value) });
    emit('notify', 'Balance Saved');
};
const updateSalary = async () => {
    await axios.post(`${API_URL}/salary`, { month: props.month, amount: Number(salary.value) });
    emit('notify', 'Salary Logged');
};
const changeMonth = (offset) => {
    const [y, m] = props.month.split('-').map(Number);
    const d = new Date(y, m - 1 + offset, 1);
    const newM = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    emit('update:month', newM);
};
const initMonth = async (source) => {
    if(!confirm("Initialize month?")) return;
    const [y, m] = props.month.split('-').map(Number);
    const pd = new Date(y, m - 2, 1);
    const prevM = `${pd.getFullYear()}-${String(pd.getMonth()+1).padStart(2,'0')}`;
    await axios.post(`${API_URL}/month/init`, { month: props.month, source, previousMonth: prevM });
    fetchData();
};
const resetMonth = async () => {
    if(confirm("Delete ALL data for this month?")) {
        await axios.delete(`${API_URL}/month`, { params: { month: props.month } });
        fetchData();
    }
};
const addExpense = async () => {
    if(!newExpense.value.name || !newExpense.value.amount) return;
    await axios.post(`${API_URL}/expenses`, { ...newExpense.value, month: props.month, amount: parseFloat(newExpense.value.amount) });
    newExpense.value.name = ''; newExpense.value.amount = '';
    fetchData();
};
const togglePaid = async (item) => {
    item.paid = !item.paid;
    await axios.post(`${API_URL}/expenses/${item.id}/toggle`, { paid: item.paid });
};
const saveExpense = async () => {
    await axios.put(`${API_URL}/expenses/${editForm.value.id}`, editForm.value);
    editingId.value = null; fetchData();
};
const getChipColor = (who) => ({ 'Joint': 'orange', 'f1': 'blue', 'f2': 'cyan', 's': 'green', 'Matt': 'deep-purple' }[who] || 'grey');
const sortBy = (key) => { if(sortKey.value === key) sortOrder.value *= -1; else { sortKey.value = key; sortOrder.value = 1; } };
const startEdit = (item) => { editingId.value = item.id; editForm.value = {...item}; };

watch(() => props.month, fetchData);
onMounted(fetchData);
</script>

<template>
    <div>
        <v-card class="mb-6 rounded-xl mx-auto text-center" elevation="2" max-width="600">
            <div class="d-flex align-center justify-space-between pa-2">
                <div style="width: 40px"></div>
                <div class="d-flex align-center">
                    <v-btn icon="mdi-chevron-left" @click="changeMonth(-1)" variant="text" size="large" color="primary"></v-btn>
                    <div>
                        <h2 class="text-h5 font-weight-bold text-primary mb-0" style="line-height: 1.2">{{ formattedMonth.main }}</h2>
                        <div class="text-caption text-medium-emphasis font-weight-bold">{{ formattedMonth.range }}</div>
                    </div>
                    <v-btn icon="mdi-chevron-right" @click="changeMonth(1)" variant="text" size="large" color="primary"></v-btn>
                </div>
                <div style="width: 40px"><v-btn v-if="expenses.length" icon="mdi-delete-sweep-outline" color="red-lighten-1" variant="text" @click="resetMonth"></v-btn></div>
            </div>
        </v-card>

        <v-alert v-if="!expenses.length" type="info" variant="tonal" class="mb-6 rounded-lg">
            No transactions. <v-btn color="primary" class="ml-4" @click="initMonth('template')">Use Master List</v-btn>
            <v-btn variant="outlined" class="ml-2" @click="initMonth('previous')">Copy Last Month</v-btn>
        </v-alert>

        <div v-else>
            <v-row class="mb-4">
                <v-col cols="12" sm="3"><v-card class="h-100 rounded-lg pa-5 text-center"><div class="text-subtitle-1 text-medium-emphasis">Salary</div><v-text-field v-model.number="salary" prefix="£" variant="underlined" class="text-h4 font-weight-bold centered-input" @keydown.enter="updateSalary" append-inner-icon="mdi-content-save" @click:append-inner="updateSalary"></v-text-field></v-card></v-col>
                <v-col cols="12" sm="3"><v-card class="h-100 rounded-lg pa-5 text-center" :color="balance < 0 ? 'red-lighten-5' : undefined"><div class="text-subtitle-1 text-medium-emphasis">Balance</div><v-text-field v-model.number="balance" prefix="£" variant="underlined" class="text-h4 font-weight-black centered-input" @keydown.enter="updateBalance" append-inner-icon="mdi-content-save" @click:append-inner="updateBalance"></v-text-field></v-card></v-col>
                <v-col cols="12" sm="3"><v-card class="h-100 rounded-lg pa-5 text-center" :color="projectedBalance < 0 ? 'red-lighten-5' : undefined"><div class="text-subtitle-1 text-medium-emphasis">Projected</div><div class="text-h4 font-weight-black">£{{ projectedBalance.toFixed(2) }}</div><v-progress-linear v-model="progressPercentage" height="6" rounded class="mt-4" striped :color="projectedBalance < 0 ? 'red' : 'green'"></v-progress-linear></v-card></v-col>
                <v-col cols="12" sm="3"><v-card class="h-100 rounded-lg pa-5"><div class="text-subtitle-1 text-medium-emphasis mb-2">Unpaid Split</div><div v-for="(amt, p) in breakdownByWho" :key="p" class="d-flex justify-space-between border-b py-1"><v-chip size="x-small" :color="getChipColor(p)" class="text-uppercase font-weight-bold">{{p}}</v-chip><span class="font-monospace text-red">£{{amt.toFixed(2)}}</span></div></v-card></v-col>
            </v-row>

            <v-card class="rounded-lg" elevation="3">
                <v-card-text class="pa-4 bg-background">
                    <v-row dense align="center">
                        <v-col style="width: 50px"></v-col>
                        <v-col v-for="col in columns" :key="col.key" :style="{width: col.width, flex: '0 0 auto'}">
                            <span v-if="col.key === 'status'"><v-icon icon="mdi-plus" color="primary" class="ml-4"></v-icon></span>
                            <v-select v-else-if="col.key === 'who'" v-model="newExpense.who" :items="people" density="compact" variant="plain" hide-details></v-select>
                            <v-text-field v-else-if="col.key === 'name'" v-model="newExpense.name" density="comfortable" variant="solo" hide-details></v-text-field>
                            <v-text-field v-else-if="col.key === 'amount'" v-model="newExpense.amount" type="number" prefix="£" density="comfortable" variant="solo" hide-details></v-text-field>
                            <v-select v-else-if="col.key === 'category'" v-model="newExpense.category" :items="categories" density="compact" variant="plain" hide-details></v-select>
                            <v-btn v-else-if="col.key === 'actions'" color="primary" @click="addExpense">Add</v-btn>
                        </v-col>
                    </v-row>
                </v-card-text>
                <v-divider></v-divider>
                <v-table hover>
                    <thead>
                        <draggable v-model="columns" tag="tr" item-key="key">
                            <template #item="{ element: col }"><th :class="'text-'+col.align" :style="{width: col.width}" @click="col.sortable && sortBy(col.key)">{{ col.label }} <v-icon v-if="sortKey === col.key" size="x-small">{{ sortOrder === 1 ? 'mdi-arrow-up' : 'mdi-arrow-down' }}</v-icon></th></template>
                        </draggable>
                    </thead>
                    <tbody>
                        <tr v-for="ex in sortedExpenses" :key="ex.id" :class="{'bg-green-lighten-5': !isDark && ex.paid, 'text-medium-emphasis': ex.paid, 'bg-amber-lighten-5': editingId===ex.id && !isDark, 'bg-grey-darken-3': editingId===ex.id && isDark}">
                            <td v-for="col in columns" :key="col.key" :class="'text-'+col.align">
                                <v-checkbox-btn v-if="col.key === 'select'" v-model="selectedExpenses" :value="ex.id" density="compact" hide-details></v-checkbox-btn>
                                <v-btn v-else-if="col.key === 'status'" :icon="ex.paid ? 'mdi-check-bold' : 'mdi-circle-outline'" :color="ex.paid?'green':'grey'" variant="text" size="small" @click="togglePaid(ex)"></v-btn>
                                <div v-else-if="col.key === 'who'">
                                    <v-select v-if="editingId===ex.id" v-model="editForm.who" :items="people" density="compact" variant="outlined" hide-details></v-select>
                                    <v-chip v-else :color="getChipColor(ex.who)" size="small" label class="text-uppercase font-weight-bold">{{ex.who}}</v-chip>
                                </div>
                                <div v-else-if="col.key === 'name'">
                                    <v-text-field v-if="editingId===ex.id" v-model="editForm.name" density="compact" variant="outlined" hide-details></v-text-field>
                                    <span v-else :class="{'text-decoration-line-through': ex.paid}">{{ex.name}}</span>
                                </div>
                                <div v-else-if="col.key === 'amount'">
                                    <v-text-field v-if="editingId===ex.id" v-model.number="editForm.amount" density="compact" variant="outlined" hide-details type="number"></v-text-field>
                                    <span v-else class="font-monospace font-weight-bold">£{{ex.amount.toFixed(2)}}</span>
                                </div>
                                <div v-else-if="col.key === 'category'">
                                    <v-select v-if="editingId===ex.id" v-model="editForm.category" :items="categories" density="compact" variant="outlined" hide-details></v-select>
                                    <span v-else class="text-caption">{{ex.category}}</span>
                                </div>
                                <div v-else-if="col.key === 'actions'">
                                    <div v-if="editingId===ex.id"><v-btn icon="mdi-check" color="green" size="small" variant="text" @click="saveExpense"></v-btn><v-btn icon="mdi-close" color="red" size="small" variant="text" @click="editingId=null"></v-btn></div>
                                    <v-btn v-else icon="mdi-pencil" color="grey" variant="text" size="small" @click="startEdit(ex)"></v-btn>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </v-table>
            </v-card>

            <v-card v-if="selectedExpenses.length" class="position-fixed bottom-0 left-0 right-0 ma-6 pa-3 rounded-pill bg-inverse-surface d-flex align-center justify-center" style="z-index: 100; max-width: 400px; margin: 0 auto 20px auto !important;">
                <span class="font-weight-bold mr-4">{{selectedExpenses.length}} Selected</span>
                <span class="text-h6 font-weight-black mr-4">£{{selectedTotal.toFixed(2)}}</span>
                <v-btn icon="mdi-close" size="small" variant="text" @click="selectedExpenses = []"></v-btn>
            </v-card>
        </div>
    </div>
</template>

<style scoped>
.centered-input :deep(input) { text-align: center; }
.font-monospace { font-family: 'Roboto Mono', monospace; }
</style>