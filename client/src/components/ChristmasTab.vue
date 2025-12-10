<script setup>
import { ref, onMounted, computed } from 'vue';
import axios from 'axios';
import draggable from 'vuedraggable';

const API_URL = '/api';

const list = ref([]);
const newGift = ref({ recipient: '', item: '', amount: '' });
const editingId = ref(null);
const editForm = ref({});
const search = ref('');

// Dynamic Columns
const columns = ref([
    { key: 'bought', label: 'Got It?', align: 'left', width: '80px', sortable: true },
    { key: 'recipient', label: 'Recipient', align: 'left', width: '', sortable: true },
    { key: 'item', label: 'Item', align: 'left', width: '', sortable: true },
    { key: 'amount', label: 'Amount', align: 'right', width: '120px', sortable: true },
    { key: 'actions', label: 'Actions', align: 'end', width: '80px', sortable: false }
]);
const sortKey = ref('recipient');
const sortOrder = ref(1);

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
const sortBy = (key) => { if(sortKey.value === key) sortOrder.value *= -1; else { sortKey.value = key; sortOrder.value = 1; } };

const filteredList = computed(() => {
    let items = list.value;
    if (search.value) {
        const s = search.value.toLowerCase();
        items = items.filter(i => i.recipient.toLowerCase().includes(s) || i.item.toLowerCase().includes(s));
    }
    return [...items].sort((a, b) => {
        let vA = a[sortKey.value], vB = b[sortKey.value];
        if (typeof vA === 'string') { vA = vA.toLowerCase(); vB = vB.toLowerCase(); }
        return (vA < vB ? -1 : vA > vB ? 1 : 0) * sortOrder.value;
    });
});

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
            <div class="d-flex justify-end px-4 py-2"><v-text-field v-model="search" label="Search" density="compact" variant="plain" hide-details prepend-inner-icon="mdi-magnify" style="max-width: 200px"></v-text-field></div>
            <v-table>
                <thead>
                    <draggable v-model="columns" tag="tr" item-key="key" handle=".drag-handle">
                        <template #item="{ element: col }">
                            <th :class="'text-'+col.align" :style="{width: col.width}" class="resizable-header">
                                <div class="d-flex align-center" :class="{'justify-end': col.align==='end', 'justify-center': col.align==='center'}">
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
                    <tr v-for="g in filteredList" :key="g.id" :class="{'bg-green-lighten-5': g.bought}">
                        <td v-for="col in columns" :key="col.key" :class="'text-'+col.align">
                            <v-checkbox-btn v-if="col.key === 'bought'" v-model="g.bought" @change="toggleBought(g)" color="green" density="compact" hide-details></v-checkbox-btn>
                            <div v-else-if="col.key === 'recipient'"><v-text-field v-if="editingId===g.id" v-model="editForm.recipient" density="compact" variant="outlined"></v-text-field><span v-else>{{g.recipient}}</span></div>
                            <div v-else-if="col.key === 'item'"><v-text-field v-if="editingId===g.id" v-model="editForm.item" density="compact" variant="outlined"></v-text-field><span v-else>{{g.item}}</span></div>
                            <div v-else-if="col.key === 'amount'"><v-text-field v-if="editingId===g.id" v-model="editForm.amount" type="number" density="compact" variant="outlined"></v-text-field><span v-else>£{{Number(g.amount).toFixed(2)}}</span></div>
                            <div v-else-if="col.key === 'actions'">
                                <div v-if="editingId===g.id"><v-btn icon="mdi-check" color="green" variant="text" size="small" @click="saveGift"></v-btn></div>
                                <div v-else><v-btn icon="mdi-pencil" color="grey" variant="text" size="small" @click="startEdit(g)"></v-btn><v-btn icon="mdi-delete" color="grey" variant="text" size="small" @click="deleteGift(g.id)"></v-btn></div>
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