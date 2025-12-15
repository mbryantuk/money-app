<script setup>
    import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
    import axios from 'axios';
    import draggable from 'vuedraggable';
    import { useTheme } from 'vuetify';
    
    const props = defineProps({
      month: String,
      people: Array,
      categories: Array,
      defaultSalary: Number,
      payDay: { type: Number, default: 19 },
      birthdays: { type: Array, default: () => [] }
    });
    const emit = defineEmits(['update:month', 'notify']);
    const API_URL = '/api';
    const theme = useTheme();
    const isDark = computed(() => theme.global.current.value.dark);
    
    // LOCAL STATE
    const balance = ref(0);
    const salary = ref(0);
    const notes = ref('');
    const expenses = ref([]);
    const selectedExpenses = ref([]);
    const search = ref(''); 
    const isCompact = ref(false); 

    // SOUND EFFECT
    // A simple, free-to-use cash register sound URL
    const kachingSound = new Audio('https://www.myinstants.com/media/sounds/ka-ching.mp3');
    kachingSound.volume = 0.5; // Set volume to 50% so it's not startling

    // UNDO / REDO STATE
    const history = ref([]);
    const future = ref([]);
    
    // Standardized Columns
    const columns = ref([
      { key: 'select', label: '', width: '40px', align: 'center', sortable: false },
      { key: 'paid', label: 'Paid', width: '60px', align: 'center', sortable: true },
      { key: 'who', label: 'Who', width: '100px', align: 'left', sortable: true },
      { key: 'vendor', label: 'Vendor', width: '140px', align: 'left', sortable: true },
      { key: 'name', label: 'Bill Name', width: '', align: 'left', sortable: true },
      { key: 'expected_date', label: 'Day', width: '60px', align: 'center', sortable: true },
      { key: 'amount', label: 'Amount', width: '120px', align: 'right', sortable: true },
      { key: 'category', label: 'Category', width: '140px', align: 'left', sortable: true },
    ]);
    const sortKey = ref('date'); 
    const sortOrder = ref(1);
    const newExpense = ref({ name: '', amount: '', who: 'Joint', category: 'Housing', vendor: '', expected_date: '' });
    
    // --- DATES & COMPUTED ---
    const getPayDate = (year, month) => {
        let d = new Date(year, month, props.payDay); 
        const day = d.getDay(); 
        if (day === 0) d.setDate(d.getDate() - 2); 
        else if (day === 6) d.setDate(d.getDate() - 1); 
        return d.getDate();
    };
    
    const formattedMonth = computed(() => {
        if (!props.month) return { main: '', range: '', days: 0, start: null, end: null };
        const [y, m] = props.month.split('-').map(Number);
        const startDayVal = getPayDate(y, m - 1); 
        const startDate = new Date(y, m - 1, startDayVal);
        const endDayVal = getPayDate(y, m);
        const endDate = new Date(y, m, endDayVal); 
        const diffTime = Math.abs(endDate - startDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        const startMonthName = startDate.toLocaleString('default', { month: 'short' });
        const endMonthName = endDate.toLocaleString('default', { month: 'short' });
        const mainMonthName = startDate.toLocaleString('default', { month: 'long', year: 'numeric' });
        return { main: mainMonthName, range: `${startMonthName} ${startDayVal} - ${endMonthName} ${endDayVal - 1}`, days: diffDays, start: startDate, end: endDate };
    });
    
    const upcomingBirthdays = computed(() => {
        if (!props.birthdays || !formattedMonth.value.start || !formattedMonth.value.end) return [];
        const start = formattedMonth.value.start;
        const end = formattedMonth.value.end;
        return props.birthdays.filter(person => {
            const dob = new Date(person.date);
            let bdayThisYear = new Date(start.getFullYear(), dob.getMonth(), dob.getDate());
            if (bdayThisYear >= start && bdayThisYear < end) return true;
            let bdayNextYear = new Date(end.getFullYear(), dob.getMonth(), dob.getDate());
            if (bdayNextYear >= start && bdayNextYear < end) return true;
            return false;
        }).map(p => { const d = new Date(p.date); return { ...p, displayDate: `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}` } });
    });
    
    // COMPUTED TOTALS
    const totalExpenses = computed(() => expenses.value.reduce((acc, item) => acc + Number(item.amount), 0));
    const paidExpenses = computed(() => expenses.value.filter(item => item.paid).reduce((acc, item) => acc + Number(item.amount), 0));
    const leftToPay = computed(() => expenses.value.filter(item => !item.paid).reduce((acc, item) => acc + Number(item.amount), 0));
    const projectedBalance = computed(() => Number(balance.value) - Number(leftToPay.value));
    const selectedTotal = computed(() => expenses.value.filter(item => selectedExpenses.value.includes(item.id)).reduce((sum, item) => sum + Number(item.amount), 0));
    const breakdownByWho = computed(() => { const g = {}; expenses.value.forEach(i => { if(!i.paid) g[i.who||'Joint'] = (g[i.who||'Joint'] || 0) + i.amount; }); return g; });

    // SORTING & GROUPING
    const sortItems = (items) => {
        return [...items].sort((a, b) => {
            let vA = a[sortKey.value], vB = b[sortKey.value];
            if (vA == null) vA = ''; if (vB == null) vB = '';
            if (typeof vA === 'string') { vA = vA.toLowerCase(); vB = vB.toLowerCase(); }
            if (vA < vB) return -1 * sortOrder.value;
            if (vA > vB) return 1 * sortOrder.value;
            return 0;
        });
    };
    
    const groupedExpenses = computed(() => {
        let items = expenses.value;
        if (search.value) {
            const s = search.value.toLowerCase();
            items = items.filter(i => (i.name && i.name.toLowerCase().includes(s)) || (i.who && i.who.toLowerCase().includes(s)) || (i.category && i.category.toLowerCase().includes(s)) || (i.vendor && i.vendor.toLowerCase().includes(s)));
        }
        const groupByCategory = (list) => {
            const groups = {};
            list.forEach(item => { const cat = item.category || 'Other'; if (!groups[cat]) groups[cat] = []; groups[cat].push(item); });
            return Object.keys(groups).sort().map(cat => ({ name: cat, items: sortItems(groups[cat]), total: groups[cat].reduce((sum, i) => sum + Number(i.amount), 0) }));
        };
        return { unpaid: groupByCategory(items.filter(i => !i.paid)), paid: groupByCategory(items.filter(i => i.paid)) };
    });
    
    // ACTIONS
    const fetchData = async () => {
        const res = await axios.get(`${API_URL}/data`, { params: { month: props.month, _t: Date.now() } });
        balance.value = parseFloat(res.data.balance) || 0;
        salary.value = parseFloat(res.data.salary) || props.defaultSalary;
        notes.value = res.data.notes || '';
        expenses.value = (res.data.expenses || []).map(e => ({...e, amount: Math.abs(parseFloat(e.amount))}));
        selectedExpenses.value = []; history.value = []; future.value = [];
    };
    
    const saveNotes = async () => { await axios.post(`${API_URL}/month/notes`, { month: props.month, notes: notes.value }); };
    const updateBalance = async () => { saveToHistory(); await axios.post(`${API_URL}/balance`, { month: props.month, amount: Number(balance.value) }); emit('notify', 'Balance Saved'); };
    const updateSalary = async () => { saveToHistory(); await axios.post(`${API_URL}/salary`, { month: props.month, amount: Number(salary.value) }); emit('notify', 'Salary Logged'); };
    const createSnapshot = () => JSON.stringify({ balance: balance.value, salary: salary.value, expenses: expenses.value });
    const saveToHistory = () => { history.value.push(createSnapshot()); future.value = []; if (history.value.length > 20) history.value.shift(); };
    const performUndo = async () => { if (!history.value.length) return; const previous = JSON.parse(history.value.pop()); future.value.push(createSnapshot()); await applySnapshot(previous); emit('notify', 'Undo successful'); };
    const performRedo = async () => { if (!future.value.length) return; const next = JSON.parse(future.value.pop()); history.value.push(createSnapshot()); await applySnapshot(next); emit('notify', 'Redo successful'); };
    const applySnapshot = async (state) => { balance.value = state.balance; salary.value = state.salary; expenses.value = state.expenses; try { await axios.post(`${API_URL}/month/sync`, { month: props.month, balance: state.balance, salary: state.salary, expenses: state.expenses }); } catch (e) { emit('notify', 'Error syncing undo', 'error'); } };
    const changeMonth = (offset) => { const [y, m] = props.month.split('-').map(Number); const d = new Date(y, m - 1 + offset, 1); emit('update:month', `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`); };
    const initMonth = async (source) => { if(!confirm("Initialize month?")) return; saveToHistory(); const [y, m] = props.month.split('-').map(Number); const pd = new Date(y, m - 2, 1); await axios.post(`${API_URL}/month/init`, { month: props.month, source, previousMonth: `${pd.getFullYear()}-${String(pd.getMonth()+1).padStart(2,'0')}` }); fetchData(); };
    const resetMonth = async () => { if(!confirm("Delete ALL data?")) return; saveToHistory(); await axios.delete(`${API_URL}/month`, { params: { month: props.month } }); fetchData(); };
    
    const addExpense = async () => { 
        if(!newExpense.value.name || !newExpense.value.amount) return; 
        saveToHistory(); 
        await axios.post(`${API_URL}/expenses`, { ...newExpense.value, month: props.month, amount: Math.abs(parseFloat(newExpense.value.amount)) }); 
        newExpense.value.name = ''; newExpense.value.amount = ''; newExpense.value.vendor = ''; newExpense.value.expected_date = '';
        fetchData(); 
    };
    
    const togglePaid = async (item) => { 
        saveToHistory(); 
        item.paid = !item.paid; 
        item.paid_at = item.paid ? new Date().toISOString() : null; 
        
        // Play Ka-Ching sound if marking AS paid (not unmarking)
        if (item.paid) {
            kachingSound.currentTime = 0; // Reset sound to start if clicked rapidly
            kachingSound.play().catch(e => console.log("Audio play blocked", e));
        }

        await axios.post(`${API_URL}/expenses/${item.id}/toggle`, { paid: item.paid }); 
    };

    const updateCell = async (item, key, value) => { if (item[key] === value) return; saveToHistory(); item[key] = value; try { await axios.put(`${API_URL}/expenses/${item.id}`, item); } catch (e) { emit('notify', 'Error saving item', 'error'); } };
    const deleteSelected = async () => { if(!selectedExpenses.value.length) return; if(!confirm(`Delete ${selectedExpenses.value.length} items?`)) return; saveToHistory(); try { await Promise.all(selectedExpenses.value.map(id => axios.delete(`${API_URL}/expenses/${id}`))); selectedExpenses.value = []; fetchData(); emit('notify', 'Items deleted'); } catch (e) { console.error(e); } };
    const sortBy = (key) => { if(sortKey.value === key) sortOrder.value *= -1; else { sortKey.value = key; sortOrder.value = 1; } };
    const getStringHue = (str) => { let hash = 0; if(!str) return 0; for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash); return Math.abs(hash % 360); };
    const getRowStyle = (ex) => { const style = { transition: 'background-color 0.2s ease' }; const hue = getStringHue(ex.who || 'Joint'); if (isDark.value) { style.backgroundColor = `hsl(${hue}, 50%, 15%, 0.5)`; } else { style.backgroundColor = `hsl(${hue}, 70%, 96%, 0.6)`; } if (ex.paid) { style.opacity = 0.6; } return style; };
    const getChipColor = (who) => `hsl(${getStringHue(who || 'Joint')}, 70%, 40%)`;
    const formatDateTime = (iso) => iso ? new Date(iso).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '';
    const handleScroll = () => { isCompact.value = window.scrollY > 50; };

    watch(() => props.month, fetchData);
    onMounted(() => { fetchData(); window.addEventListener('scroll', handleScroll); });
    onUnmounted(() => { window.removeEventListener('scroll', handleScroll); });
</script>
    
<template>
    <div class="position-relative">
        <div class="sticky-header pt-2" style="background: rgb(var(--v-theme-surface));">
            <v-card class="mb-2 rounded-xl mx-auto text-center position-relative" elevation="2" max-width="600">
                <div class="position-absolute left-0 top-0 ma-2 d-flex" style="z-index: 20;">
                    <v-tooltip text="Undo" location="top"><template v-slot:activator="{ props }"><v-btn v-bind="props" icon="mdi-undo" variant="tonal" color="primary" size="small" class="mr-1" :disabled="!history.length" @click="performUndo"></v-btn></template></v-tooltip>
                    <v-tooltip text="Redo" location="top"><template v-slot:activator="{ props }"><v-btn v-bind="props" icon="mdi-redo" variant="tonal" color="primary" size="small" :disabled="!future.length" @click="performRedo"></v-btn></template></v-tooltip>
                </div>
                <div class="d-flex align-center justify-space-between pa-2 pt-4">
                    <div style="width: 40px"></div>
                    <div class="d-flex align-center">
                        <v-btn icon="mdi-chevron-left" @click="changeMonth(-1)" variant="text" size="large" color="primary"></v-btn>
                        <div><h2 class="text-h5 font-weight-bold text-primary mb-0">{{ formattedMonth.main }}</h2><div class="text-caption text-medium-emphasis font-weight-bold">{{ formattedMonth.range }} ({{ formattedMonth.days }} Days)</div></div>
                        <v-btn icon="mdi-chevron-right" @click="changeMonth(1)" variant="text" size="large" color="primary"></v-btn>
                    </div>
                    <div style="width: 40px"><v-btn v-if="expenses.length" icon="mdi-delete-sweep-outline" color="red-lighten-1" variant="text" @click="resetMonth"></v-btn></div>
                </div>
            </v-card>
            <v-textarea v-if="!isCompact" v-model="notes" rows="1" auto-grow density="compact" variant="solo-filled" label="Month Notes" hide-details class="mb-4 mx-auto" style="max-width: 600px" @blur="saveNotes"></v-textarea>
            
            <div v-if="expenses.length">
                <v-row class="mb-4">
                    <v-col cols="12" sm="3"><v-card class="h-100 rounded-lg pa-4 text-center d-flex flex-column justify-center" elevation="2"><div class="text-caption text-uppercase font-weight-bold text-medium-emphasis mb-1">Income</div><v-text-field :model-value="salary" @update:model-value="v => { salary=v; updateSalary() }" prefix="£" variant="plain" density="compact" bg-color="transparent" class="text-h4 font-weight-bold centered-input minimal-input" inputmode="decimal" hide-details single-line></v-text-field></v-card></v-col>
                    <v-col cols="12" sm="3"><v-card class="h-100 rounded-lg pa-4 text-center d-flex flex-column justify-center" elevation="2"><div class="text-caption text-uppercase font-weight-bold text-medium-emphasis mb-1">Balance</div><v-text-field :model-value="balance" @update:model-value="v => { balance=v; updateBalance() }" prefix="£" variant="plain" density="compact" bg-color="transparent" :color="balance < 0 ? 'error' : 'primary'" class="text-h4 font-weight-black centered-input minimal-input" inputmode="decimal" hide-details single-line></v-text-field></v-card></v-col>
                    <v-col cols="12" sm="3"><v-card class="h-100 rounded-lg pa-4 text-center d-flex flex-column justify-center" elevation="2" :color="projectedBalance < 0 ? 'red-lighten-4' : 'green-lighten-4'"><div :class="projectedBalance < 0 ? 'text-red-darken-4' : 'text-green-darken-4'" class="text-caption text-uppercase font-weight-bold mb-1">Projected Left</div><div :class="projectedBalance < 0 ? 'text-red-darken-4' : 'text-green-darken-4'" class="text-h4 font-weight-black">£{{ projectedBalance.toFixed(2) }}</div></v-card></v-col>
                    <v-col cols="12" sm="3"><v-card class="h-100 rounded-lg pa-4" elevation="2"><div class="text-caption text-uppercase font-weight-bold text-medium-emphasis mb-2">Unpaid Total</div><div v-if="Object.keys(breakdownByWho).length" class="overflow-y-auto" style="max-height: 80px;"><div v-for="(amt, p) in breakdownByWho" :key="p" class="d-flex justify-space-between border-b py-1"><span class="text-caption font-weight-bold" :style="{ color: getChipColor(p) }">{{p}}</span><span class="text-caption font-monospace font-weight-bold">£{{amt.toFixed(2)}}</span></div></div><div v-else class="text-caption text-grey text-center mt-2">All paid!</div></v-card></v-col>
                </v-row>
            </div>
        </div>
        
        <v-alert v-if="!expenses.length" type="info" variant="tonal" class="mb-6 rounded-lg">No transactions. <v-btn color="primary" class="ml-4" @click="initMonth('template')">Use Master List</v-btn><v-btn variant="outlined" class="ml-2" @click="initMonth('previous')">Copy Last Month</v-btn></v-alert>
        
        <div v-if="expenses.length" class="mt-4">
            <v-card class="rounded-lg" elevation="3">
                <v-card-text class="pa-4 bg-surface">
                    <v-row dense align="center">
                        <v-col cols="2"><v-select v-model="newExpense.who" :items="people" density="compact" variant="outlined" hide-details label="Who" bg-color="surface"></v-select></v-col>
                        <v-col cols="2"><v-text-field v-model="newExpense.vendor" density="compact" variant="outlined" hide-details label="Vendor" bg-color="surface"></v-text-field></v-col>
                        <v-col cols="3"><v-text-field v-model="newExpense.name" density="compact" variant="outlined" hide-details label="Bill Name" bg-color="surface"></v-text-field></v-col>
                        <v-col cols="1"><v-text-field v-model="newExpense.expected_date" type="number" density="compact" variant="outlined" hide-details label="Day" bg-color="surface"></v-text-field></v-col>
                        <v-col cols="2"><v-text-field v-model="newExpense.amount" type="number" prefix="£" density="compact" variant="outlined" hide-details label="Amount" inputmode="decimal" bg-color="surface"></v-text-field></v-col>
                        <v-col cols="2"><v-select v-model="newExpense.category" :items="categories" density="compact" variant="outlined" hide-details label="Category" bg-color="surface"></v-select></v-col>
                        <v-col cols="12"><v-btn block color="primary" @click="addExpense" height="40" variant="flat">Add</v-btn></v-col>
                    </v-row>
                </v-card-text>
                <div class="d-flex justify-end px-4 py-2 border-t"><v-text-field v-model="search" prepend-inner-icon="mdi-magnify" label="Search" single-line hide-details density="compact" variant="plain" style="max-width: 200px"></v-text-field></div>
                <v-divider></v-divider>
                
                <v-table hover density="comfortable">
                    <thead>
                        <draggable v-model="columns" tag="tr" item-key="key" handle=".drag-handle">
                            <template #item="{ element: col }">
                                <th :class="'text-'+col.align" :style="{width: col.width}" class="resizable-header text-caption text-uppercase">
                                    <div class="d-flex align-center" :class="{'justify-end': col.align==='right', 'justify-center': col.align==='center'}">
                                        <v-icon size="x-small" class="drag-handle cursor-move mr-1 text-disabled">mdi-drag</v-icon>
                                        <span class="cursor-pointer" @click="col.sortable && sortBy(col.key)">{{ col.label }} <v-icon v-if="sortKey === col.key" size="x-small">{{ sortOrder === 1 ? 'mdi-arrow-up' : 'mdi-arrow-down' }}</v-icon></span>
                                    </div>
                                </th>
                            </template>
                        </draggable>
                    </thead>
                    <tbody>
                        <template v-for="(groupName, groupKey) in ['unpaid', 'paid']" :key="groupKey">
                            <template v-for="catGroup in groupedExpenses[groupName]" :key="groupName+'-'+catGroup.name">
                                <tr :class="isDark ? 'bg-grey-darken-3' : 'bg-grey-lighten-4'" class="font-weight-bold section-header" :style="{ opacity: groupName === 'paid' ? 0.8 : 1 }"><td :colspan="columns.length" class="text-overline">{{ groupName === 'paid' ? 'Paid' : 'Unpaid' }} • {{ catGroup.name }} <span class="float-right">£{{ catGroup.total.toFixed(2) }}</span></td></tr>
                                <tr v-for="ex in catGroup.items" :key="ex.id" :style="getRowStyle(ex)">
                                    <td v-for="col in columns" :key="col.key" :class="'text-'+col.align" class="pa-1">
                                        <v-checkbox-btn v-if="col.key === 'select'" v-model="selectedExpenses" :value="ex.id" density="compact" hide-details class="ma-0"></v-checkbox-btn>
                                        <div v-else-if="col.key === 'paid'" class="d-flex justify-center"><v-tooltip v-if="ex.paid && ex.paid_at" location="top" :text="'Paid: ' + formatDateTime(ex.paid_at)"><template v-slot:activator="{ props }"><v-btn v-bind="props" icon="mdi-check-circle" color="green" variant="text" size="small" density="compact" @click="togglePaid(ex)"></v-btn></template></v-tooltip><v-btn v-else icon="mdi-circle-outline" color="grey" variant="text" size="small" density="compact" @click="togglePaid(ex)"></v-btn></div>
                                        <div v-else-if="col.key === 'who'"><v-select :model-value="ex.who" :items="people" density="compact" variant="plain" hide-details class="text-caption font-weight-bold text-uppercase" @update:model-value="v => updateCell(ex, 'who', v)"></v-select></div>
                                        <div v-else-if="col.key === 'vendor'"><v-text-field :model-value="ex.vendor" density="compact" variant="plain" hide-details single-line @update:model-value="v => updateCell(ex, 'vendor', v)"></v-text-field></div>
                                        <div v-else-if="col.key === 'name'"><v-text-field :model-value="ex.name" density="compact" variant="plain" hide-details single-line @update:model-value="v => updateCell(ex, 'name', v)"></v-text-field></div>
                                        <div v-else-if="col.key === 'expected_date'"><v-text-field :model-value="ex.expected_date" density="compact" variant="plain" hide-details single-line type="number" @update:model-value="v => updateCell(ex, 'expected_date', v)"></v-text-field></div>
                                        <div v-else-if="col.key === 'amount'"><v-text-field :model-value="ex.amount" prefix="£" density="compact" variant="plain" hide-details single-line type="number" class="font-monospace font-weight-bold text-right" @update:model-value="v => updateCell(ex, 'amount', Number(v))"></v-text-field></div>
                                        <div v-else-if="col.key === 'category'"><v-select :model-value="ex.category" :items="categories" density="compact" variant="plain" hide-details class="text-caption" @update:model-value="v => updateCell(ex, 'category', v)"></v-select></div>
                                    </td>
                                </tr>
                            </template>
                        </template>
                    </tbody>
                </v-table>
            </v-card>
            <v-card v-if="selectedExpenses.length" class="position-fixed bottom-0 left-0 right-0 ma-6 pa-3 rounded-pill bg-grey-darken-3 d-flex align-center justify-center text-white" style="z-index: 100; max-width: 400px; margin: 0 auto 20px auto !important;"><span class="font-weight-bold mr-4">{{selectedExpenses.length}} Selected</span><span class="text-h6 font-weight-black mr-4">£{{selectedTotal.toFixed(2)}}</span><v-btn icon="mdi-delete" color="white" variant="text" class="mr-2" @click="deleteSelected"></v-btn><v-btn icon="mdi-close" color="white" size="small" variant="text" @click="selectedExpenses = []"></v-btn></v-card>
        </div>
    </div>
</template>
    
<style scoped>
.sticky-header { position: sticky; top: 48px; z-index: 1000; margin-top: -24px; padding-top: 24px; padding-bottom: 10px; transition: all 0.2s ease-in-out; }
.centered-input :deep(input) { text-align: center; }
.font-monospace { font-family: 'Roboto Mono', monospace; }
.cursor-move { cursor: move; }
.resizable-header { resize: horizontal; overflow: hidden; min-width: 50px; border-right: 1px solid rgba(0,0,0,0.1); }
.minimal-input :deep(.v-field__outline) { display: none; }
.minimal-input :deep(.v-field:hover .v-field__outline) { display: block; opacity: 0.2; }
.minimal-input :deep(.v-field--focused .v-field__outline) { display: block; opacity: 0.5; }
:deep(.v-field--variant-plain .v-field__overlay) { display: none; }
:deep(.v-field--variant-plain:hover .v-field__overlay) { display: block; opacity: 0.05; }
</style>