<script setup>
    import { ref, computed } from 'vue';
    import axios from 'axios';
    import draggable from 'vuedraggable';
    
    const props = defineProps({ 
        people: Array, // Budget accounts
        family: Array, // Meal planning people
        categories: Array, 
        defaultSalary: Number, 
        payDay: Number, 
        templates: Array 
    });
    
    const emit = defineEmits(['notify', 'refresh', 'update:people', 'update:family', 'update:categories', 'update:default-salary', 'update:pay-day']);
    const API_URL = '/api';
    
    // --- Local State for Renaming/Templates ---
    const renameForm = ref({ type: 'people', oldName: null, newName: '' });
    const newTemplate = ref({});
    const editingId = ref(null);
    const editForm = ref({});
    const search = ref('');
    
    // --- Computed Proxies for Lists (Fixes mutation/saving issues) ---
    // These computed properties handle the v-model binding correctly.
    // When the list changes (item added/removed), it emits the update AND saves to DB.
    
    const peopleList = computed({
        get: () => props.people || [],
        set: (val) => {
            emit('update:people', val);
            saveSetting('people', val);
        }
    });

    const familyList = computed({
        get: () => props.family || [],
        set: (val) => {
            emit('update:family', val);
            saveSetting('family_members', val);
        }
    });

    const categoryList = computed({
        get: () => props.categories || [],
        set: (val) => {
            emit('update:categories', val);
            saveSetting('categories', val);
        }
    });

    // Dynamic Columns for Templates Table
    const columns = ref([
        { key: 'name', label: 'Name', align: 'left', width: '', sortable: true },
        { key: 'amount', label: 'Amount', align: 'left', width: '120px', sortable: true },
        { key: 'who', label: 'Who', align: 'left', width: '120px', sortable: true },
        { key: 'category', label: 'Category', align: 'left', width: '140px', sortable: true },
        { key: 'actions', label: '', align: 'end', width: '80px', sortable: false }
    ]);
    const sortKey = ref('name');
    const sortOrder = ref(1);
    
    // --- API Actions ---
    const saveSetting = async (key, val) => { 
        await axios.post(`${API_URL}/settings`, { key, value: JSON.stringify(val) }); 
        emit('notify', 'Saved'); 
    };
    
    const saveSalary = async () => { 
        await axios.post(`${API_URL}/settings`, { key: 'default_salary', value: props.defaultSalary }); 
        emit('notify', 'Salary Saved'); 
    };
    
    const savePayDay = async () => { 
        await axios.post(`${API_URL}/settings`, { key: 'pay_day', value: props.payDay }); 
        emit('notify', 'Pay Day Saved'); 
    };
    
    const performRename = async () => { 
        if(confirm("Rename?")) { 
            await axios.post(`${API_URL}/settings/rename`, renameForm.value); 
            emit('refresh'); 
            emit('notify', 'Renamed'); 
        } 
    };
    
    const addTemplate = async () => { 
        if(!newTemplate.value.name) return; 
        await axios.post(`${API_URL}/templates`, newTemplate.value); 
        newTemplate.value = {}; 
        emit('refresh'); 
    };
    
    const saveTemplate = async () => { 
        await axios.put(`${API_URL}/templates/${editForm.value.id}`, editForm.value); 
        editingId.value = null; 
        emit('refresh'); 
    };
    
    const deleteTemplate = async (id) => { 
        if(confirm("Delete?")) { 
            await axios.delete(`${API_URL}/templates/${id}`); 
            emit('refresh'); 
        } 
    };
    
    const startEdit = (t) => { editingId.value = t.id; editForm.value = {...t}; };
    const sortBy = (key) => { if(sortKey.value === key) sortOrder.value *= -1; else { sortKey.value = key; sortOrder.value = 1; } };
    
    const filteredTemplates = computed(() => {
        let items = props.templates || [];
        if (search.value) items = items.filter(t => t.name.toLowerCase().includes(search.value.toLowerCase()));
        return [...items].sort((a, b) => {
            let vA = a[sortKey.value], vB = b[sortKey.value];
            if (typeof vA === 'string') { vA = vA.toLowerCase(); vB = vB.toLowerCase(); }
            return (vA < vB ? -1 : vA > vB ? 1 : 0) * sortOrder.value;
        });
    });
</script>
    
<template>
    <v-row>
        <v-col cols="12" md="4">
            <v-card class="mb-4 pa-4 border-s-lg border-primary" elevation="3">
                <h3 class="text-h6 mb-2">Global Rename</h3>
                <v-radio-group v-model="renameForm.type" inline density="compact" hide-details>
                    <v-radio label="Person" value="people"></v-radio><v-radio label="Category" value="categories"></v-radio>
                </v-radio-group>
                <v-select v-model="renameForm.oldName" :items="renameForm.type==='people'?people:categories" label="Find" density="compact" variant="outlined"></v-select>
                <v-text-field v-model="renameForm.newName" label="Replace With" density="compact" variant="outlined"></v-text-field>
                <v-btn block color="primary" @click="performRename">Rename</v-btn>
            </v-card>
            <v-card class="mb-4 pa-4">
                <h3 class="text-h6 mb-2">Financial Defaults</h3>
                <v-text-field :model-value="props.defaultSalary" @update:model-value="(val) => emit('update:default-salary', Number(val))" @change="saveSalary" label="Default Salary" prefix="£" variant="outlined" class="mb-2"></v-text-field>
                <v-text-field :model-value="props.payDay" @update:model-value="(val) => emit('update:pay-day', Number(val))" @change="savePayDay" label="Pay Day (Date)" type="number" min="1" max="31" suffix="th" variant="outlined"></v-text-field>
            </v-card>
            <v-card class="pa-4">
                <h3 class="text-h6 mb-2">Lists</h3>
                <v-combobox v-model="peopleList" chips multiple label="Budget Accounts (Who Pay)"></v-combobox>
                <v-combobox v-model="familyList" chips multiple label="Family Members (Who Eat)" class="mt-2"></v-combobox>
                <v-combobox v-model="categoryList" chips multiple label="Categories" class="mt-2"></v-combobox>
            </v-card>
        </v-col>

        <v-col cols="12" md="8">
            <v-card title="Master Bill List">
                <template #append><v-text-field v-model="search" density="compact" variant="plain" hide-details prepend-inner-icon="mdi-magnify" label="Search" style="width:150px"></v-text-field></template>
                <v-table density="compact">
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
                        <tr>
                            <td v-for="col in columns" :key="'new'+col.key">
                                <div v-if="col.key === 'name'"><v-text-field v-model="newTemplate.name" density="compact" hide-details placeholder="Name"></v-text-field></div>
                                <div v-else-if="col.key === 'amount'"><v-text-field v-model.number="newTemplate.amount" type="number" density="compact" hide-details placeholder="0.00"></v-text-field></div>
                                <div v-else-if="col.key === 'who'"><v-select v-model="newTemplate.who" :items="people" density="compact" hide-details></v-select></div>
                                <div v-else-if="col.key === 'category'"><v-select v-model="newTemplate.category" :items="categories" density="compact" hide-details></v-select></div>
                                <div v-else-if="col.key === 'actions'"><v-btn size="small" color="primary" @click="addTemplate">Add</v-btn></div>
                            </td>
                        </tr>
                        <tr v-for="t in filteredTemplates" :key="t.id">
                            <td v-for="col in columns" :key="col.key">
                                <div v-if="col.key === 'name'"><v-text-field v-if="editingId===t.id" v-model="editForm.name" density="compact" variant="outlined"></v-text-field><span v-else>{{t.name}}</span></div>
                                <div v-else-if="col.key === 'amount'"><v-text-field v-if="editingId===t.id" v-model.number="editForm.amount" density="compact" variant="outlined"></v-text-field><span v-else>£{{t.amount}}</span></div>
                                <div v-else-if="col.key === 'who'"><v-select v-if="editingId===t.id" v-model="editForm.who" :items="people" density="compact" variant="outlined"></v-select><span v-else>{{t.who}}</span></div>
                                <div v-else-if="col.key === 'category'"><v-select v-if="editingId===t.id" v-model="editForm.category" :items="categories" density="compact" variant="outlined"></v-select><span v-else>{{t.category}}</span></div>
                                <div v-else-if="col.key === 'actions'">
                                    <div v-if="editingId===t.id"><v-btn icon="mdi-check" color="green" size="small" variant="text" @click="saveTemplate"></v-btn></div>
                                    <div v-else><v-btn icon="mdi-pencil" color="grey" size="small" variant="text" @click="startEdit(t)"></v-btn><v-btn icon="mdi-delete" color="grey" size="small" variant="text" @click="deleteTemplate(t.id)"></v-btn></div>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </v-table>
            </v-card>
        </v-col>
    </v-row>
</template>
    
<style scoped>
.cursor-move { cursor: move; }
.resizable-header { resize: horizontal; overflow: hidden; min-width: 50px; }
</style>