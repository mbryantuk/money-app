<script setup>
    import { ref, computed, onMounted } from 'vue';
    import axios from 'axios';
    import draggable from 'vuedraggable';
    import { useTheme } from 'vuetify';
    
    const props = defineProps({ 
        people: Array, 
        categories: Array, 
        templates: Array 
    });
    
    const emit = defineEmits(['notify', 'refresh']);
    const API_URL = '/api';
    const theme = useTheme();
    const isDark = computed(() => theme.global.current.value.dark);
    
    // State
    const search = ref('');
    const newTemplate = ref({ name: '', amount: '', who: 'Joint', category: 'Housing', vendor: '', expected_date: '' });
    const selectedTemplates = ref([]);
    const sortKey = ref('name');
    const sortOrder = ref(1);
    
    // Import Dialog
    const importDialog = ref(false);
    const importMonth = ref(new Date().toISOString().slice(0, 7));

    // Columns
    const columns = ref([
        { key: 'select', label: '', width: '40px', align: 'center', sortable: false },
        { key: 'who', label: 'Who', width: '100px', align: 'left', sortable: true },
        { key: 'vendor', label: 'Vendor', width: '140px', align: 'left', sortable: true },
        { key: 'name', label: 'Bill Name', width: '', align: 'left', sortable: true },
        { key: 'expected_date', label: 'Day', width: '60px', align: 'center', sortable: true },
        { key: 'amount', label: 'Amount', width: '120px', align: 'right', sortable: true },
        { key: 'category', label: 'Category', width: '140px', align: 'left', sortable: true },
        { key: 'actions', label: '', width: '50px', align: 'center', sortable: false }
    ]);
    
    // COMPUTED
    const sortedTemplates = computed(() => {
        let items = props.templates || [];
        if (search.value) {
            const s = search.value.toLowerCase();
            items = items.filter(t => 
                t.name.toLowerCase().includes(s) || 
                (t.vendor && t.vendor.toLowerCase().includes(s)) ||
                (t.category && t.category.toLowerCase().includes(s))
            );
        }
        return [...items].sort((a, b) => {
            let vA = a[sortKey.value], vB = b[sortKey.value];
            if (typeof vA === 'string') { vA = vA.toLowerCase(); vB = vB.toLowerCase(); }
            if (vA < vB) return -1 * sortOrder.value;
            if (vA > vB) return 1 * sortOrder.value;
            return 0;
        });
    });

    const groupedTemplates = computed(() => {
        const groups = {};
        sortedTemplates.value.forEach(item => { 
            const cat = item.category || 'Other'; 
            if (!groups[cat]) groups[cat] = []; 
            groups[cat].push(item); 
        });
        return Object.keys(groups).sort().map(cat => ({ 
            name: cat, 
            items: groups[cat], 
            total: groups[cat].reduce((sum, i) => sum + Number(i.amount), 0) 
        }));
    });

    const totalAmount = computed(() => (props.templates || []).reduce((sum, t) => sum + Number(t.amount), 0));

    // ACTIONS
    const addTemplate = async () => { 
        if(!newTemplate.value.name) return; 
        try {
            await axios.post(`${API_URL}/templates`, newTemplate.value); 
            newTemplate.value = { name: '', amount: '', who: 'Joint', category: 'Housing', vendor: '', expected_date: '' };
            emit('refresh'); 
            emit('notify', 'Template added');
        } catch(e) { emit('notify', 'Error adding template', 'error'); }
    };
    
    const updateCell = async (item, key, value) => { 
        if (item[key] === value) return;
        item[key] = value;
        try {
            await axios.put(`${API_URL}/templates/${item.id}`, item); 
        } catch(e) { emit('notify', 'Error saving', 'error'); }
    };
    
    const deleteTemplate = async (id) => { 
        if(!confirm("Delete this template?")) return;
        try {
            await axios.delete(`${API_URL}/templates/${id}`); 
            emit('refresh'); 
        } catch(e) { emit('notify', 'Error deleting', 'error'); }
    };

    const deleteSelected = async () => {
        if(!selectedTemplates.value.length) return;
        if(!confirm(`Delete ${selectedTemplates.value.length} templates?`)) return;
        try {
            await Promise.all(selectedTemplates.value.map(id => axios.delete(`${API_URL}/templates/${id}`)));
            selectedTemplates.value = [];
            emit('refresh');
            emit('notify', 'Templates deleted');
        } catch(e) { emit('notify', 'Batch delete failed', 'error'); }
    };

    const clearAll = async () => {
        if(!confirm("⚠️ WARNING: This will delete ALL templates from the Master List. Are you sure?")) return;
        try {
            await axios.delete(`${API_URL}/templates/all`);
            emit('refresh');
            emit('notify', 'All templates cleared');
        } catch(e) { emit('notify', 'Clear failed', 'error'); }
    };

    const runImport = async () => {
        if(!confirm(`Import all bills from ${importMonth.value} into Master List?`)) return;
        try {
            await axios.post(`${API_URL}/templates/import`, { month: importMonth.value });
            importDialog.value = false;
            emit('refresh');
            emit('notify', 'Import successful');
        } catch(e) { emit('notify', 'Import failed', 'error'); }
    };
    
    const sortBy = (key) => { if(sortKey.value === key) sortOrder.value *= -1; else { sortKey.value = key; sortOrder.value = 1; } };
    const getStringHue = (str) => { let hash = 0; if(!str) return 0; for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash); return Math.abs(hash % 360); };
    const getRowStyle = (ex) => { 
        const style = { transition: 'background-color 0.2s ease' }; 
        const hue = getStringHue(ex.who || 'Joint'); 
        if (isDark.value) style.backgroundColor = `hsl(${hue}, 50%, 15%, 0.5)`; 
        else style.backgroundColor = `hsl(${hue}, 70%, 96%, 0.6)`; 
        return style; 
    };
</script>
    
<template>
    <v-card class="h-100 d-flex flex-column">
        <div class="d-flex justify-space-between align-center px-4 py-3 bg-primary text-white">
            <div class="d-flex align-center">
                <span class="text-h6 font-weight-bold mr-4">Master Bill List</span>
                <v-chip class="font-weight-bold" color="white" variant="outlined">Total: £{{ totalAmount.toFixed(2) }}</v-chip>
            </div>
            <div class="d-flex align-center">
                <v-btn variant="tonal" color="white" class="mr-2" prepend-icon="mdi-import" @click="importDialog = true">Import from Month</v-btn>
                <v-btn variant="text" color="red-lighten-4" prepend-icon="mdi-delete-sweep" @click="clearAll">Clear All</v-btn>
            </div>
        </div>

        <v-card-text class="pa-3 bg-surface border-b">
            <v-row dense align="center">
                <v-col cols="2"><v-select v-model="newTemplate.who" :items="people" density="compact" variant="outlined" hide-details label="Who" bg-color="surface"></v-select></v-col>
                <v-col cols="2"><v-text-field v-model="newTemplate.vendor" density="compact" variant="outlined" hide-details label="Vendor" bg-color="surface"></v-text-field></v-col>
                <v-col cols="3"><v-text-field v-model="newTemplate.name" density="compact" variant="outlined" hide-details label="Bill Name" bg-color="surface"></v-text-field></v-col>
                <v-col cols="1"><v-text-field v-model="newTemplate.expected_date" type="number" density="compact" variant="outlined" hide-details label="Day" bg-color="surface"></v-text-field></v-col>
                <v-col cols="2"><v-text-field v-model="newTemplate.amount" type="number" prefix="£" density="compact" variant="outlined" hide-details label="Amount" bg-color="surface"></v-text-field></v-col>
                <v-col cols="2"><v-select v-model="newTemplate.category" :items="categories" density="compact" variant="outlined" hide-details label="Category" bg-color="surface"></v-select></v-col>
                <v-col cols="12"><v-btn block color="primary" @click="addTemplate" height="40" variant="flat">Add to Master List</v-btn></v-col>
            </v-row>
        </v-card-text>

        <div class="d-flex justify-end px-4 py-2 bg-grey-lighten-4 border-b">
            <v-text-field v-model="search" density="compact" variant="solo" hide-details prepend-inner-icon="mdi-magnify" label="Search Templates" style="max-width: 250px"></v-text-field>
        </div>

        <div class="flex-grow-1 overflow-y-auto">
            <v-table hover density="comfortable">
                <thead class="bg-surface sticky-top">
                    <draggable v-model="columns" tag="tr" item-key="key" handle=".drag-handle">
                        <template #item="{ element: col }">
                            <th :class="'text-'+col.align" :style="{width: col.width}" class="resizable-header text-caption text-uppercase">
                                <div class="d-flex align-center" :class="{'justify-end': col.align==='right', 'justify-center': col.align==='center'}">
                                    <v-icon size="x-small" class="drag-handle cursor-move mr-1 text-disabled">mdi-drag</v-icon>
                                    <span class="cursor-pointer" @click="col.sortable && sortBy(col.key)">
                                        {{ col.label }} <v-icon v-if="sortKey === col.key" size="x-small">{{ sortOrder === 1 ? 'mdi-arrow-up' : 'mdi-arrow-down' }}</v-icon>
                                    </span>
                                </div>
                            </th>
                        </template>
                    </draggable>
                </thead>
                <tbody>
                    <template v-for="catGroup in groupedTemplates" :key="catGroup.name">
                        <tr :class="isDark ? 'bg-grey-darken-3' : 'bg-grey-lighten-4'" class="font-weight-bold section-header">
                            <td :colspan="columns.length" class="text-overline">{{ catGroup.name }} <span class="float-right">£{{ catGroup.total.toFixed(2) }}</span></td>
                        </tr>
                        <tr v-for="t in catGroup.items" :key="t.id" :style="getRowStyle(t)">
                            <td v-for="col in columns" :key="col.key" :class="'text-'+col.align" class="pa-1">
                                <v-checkbox-btn v-if="col.key === 'select'" v-model="selectedTemplates" :value="t.id" density="compact" hide-details class="ma-0"></v-checkbox-btn>
                                <div v-else-if="col.key === 'who'"><v-select :model-value="t.who" :items="people" density="compact" variant="plain" hide-details class="text-caption font-weight-bold text-uppercase" @update:model-value="v => updateCell(t, 'who', v)"></v-select></div>
                                <div v-else-if="col.key === 'vendor'"><v-text-field :model-value="t.vendor" density="compact" variant="plain" hide-details single-line @update:model-value="v => updateCell(t, 'vendor', v)"></v-text-field></div>
                                <div v-else-if="col.key === 'name'"><v-text-field :model-value="t.name" density="compact" variant="plain" hide-details single-line @update:model-value="v => updateCell(t, 'name', v)"></v-text-field></div>
                                <div v-else-if="col.key === 'expected_date'"><v-text-field :model-value="t.expected_date" density="compact" variant="plain" hide-details single-line type="number" @update:model-value="v => updateCell(t, 'expected_date', v)"></v-text-field></div>
                                <div v-else-if="col.key === 'amount'"><v-text-field :model-value="t.amount" prefix="£" density="compact" variant="plain" hide-details single-line type="number" class="font-monospace font-weight-bold text-right" @update:model-value="v => updateCell(t, 'amount', Number(v))"></v-text-field></div>
                                <div v-else-if="col.key === 'category'"><v-select :model-value="t.category" :items="categories" density="compact" variant="plain" hide-details class="text-caption" @update:model-value="v => updateCell(t, 'category', v)"></v-select></div>
                                <div v-else-if="col.key === 'actions'"><v-btn icon="mdi-delete" color="grey" variant="text" size="small" density="compact" @click="deleteTemplate(t.id)"></v-btn></div>
                            </td>
                        </tr>
                    </template>
                </tbody>
            </v-table>
        </div>

        <v-card v-if="selectedTemplates.length" class="position-fixed bottom-0 left-0 right-0 ma-6 pa-3 rounded-pill bg-grey-darken-3 d-flex align-center justify-center text-white" style="z-index: 100; max-width: 400px; margin: 0 auto 20px auto !important;">
            <span class="font-weight-bold mr-4">{{selectedTemplates.length}} Selected</span>
            <v-btn icon="mdi-delete" color="white" variant="text" class="mr-2" @click="deleteSelected"></v-btn>
            <v-btn icon="mdi-close" color="white" size="small" variant="text" @click="selectedTemplates = []"></v-btn>
        </v-card>

        <v-dialog v-model="importDialog" max-width="400">
            <v-card>
                <v-card-title>Import from Month</v-card-title>
                <v-card-text>
                    <div class="text-caption text-grey mb-4">Select a historical month to copy bills from. This will add to the current list.</div>
                    <v-text-field v-model="importMonth" type="month" label="Select Month" variant="outlined"></v-text-field>
                </v-card-text>
                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn variant="text" @click="importDialog = false">Cancel</v-btn>
                    <v-btn color="primary" @click="runImport">Import</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </v-card>
</template>

<style scoped>
.sticky-top { position: sticky; top: 0; z-index: 10; }
.cursor-move { cursor: move; }
.resizable-header { resize: horizontal; overflow: hidden; min-width: 50px; border-right: 1px solid rgba(0,0,0,0.1); }
:deep(.v-field--variant-plain .v-field__overlay) { display: none; }
:deep(.v-field--variant-plain:hover .v-field__overlay) { display: block; opacity: 0.05; }
</style>