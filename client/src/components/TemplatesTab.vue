<script setup>
    import { ref, computed } from 'vue';
    import axios from 'axios';
    import draggable from 'vuedraggable';
    
    const props = defineProps({ 
        people: Array, 
        categories: Array, 
        templates: Array 
    });
    
    const emit = defineEmits(['notify', 'refresh']);
    const API_URL = '/api';
    
    // Local State
    const newTemplate = ref({});
    const editingId = ref(null);
    const editForm = ref({});
    const search = ref('');
    const sortKey = ref('name');
    const sortOrder = ref(1);

    const columns = ref([
        { key: 'name', label: 'Name', align: 'left', width: '', sortable: true },
        { key: 'amount', label: 'Amount', align: 'left', width: '120px', sortable: true },
        { key: 'who', label: 'Who', align: 'left', width: '120px', sortable: true },
        { key: 'category', label: 'Category', align: 'left', width: '140px', sortable: true },
        { key: 'actions', label: '', align: 'end', width: '80px', sortable: false }
    ]);
    
    const addTemplate = async () => { 
        if(!newTemplate.value.name) return; 
        try {
            await axios.post(`${API_URL}/templates`, newTemplate.value); 
            newTemplate.value = {}; 
            emit('refresh'); 
            emit('notify', 'Template added');
        } catch(e) { emit('notify', 'Error adding template', 'error'); }
    };
    
    const saveTemplate = async () => { 
        try {
            await axios.put(`${API_URL}/templates/${editForm.value.id}`, editForm.value); 
            editingId.value = null; 
            emit('refresh');
            emit('notify', 'Template saved');
        } catch(e) { emit('notify', 'Error saving template', 'error'); }
    };
    
    const deleteTemplate = async (id) => { 
        if(confirm("Delete?")) { 
            await axios.delete(`${API_URL}/templates/${id}`); 
            emit('refresh'); 
            emit('notify', 'Template deleted');
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
    <v-card>
        <v-card-title class="d-flex justify-space-between align-center">
            Master Bill List
            <v-text-field v-model="search" density="compact" variant="outlined" hide-details prepend-inner-icon="mdi-magnify" label="Search" style="max-width: 300px" class="ml-4"></v-text-field>
        </v-card-title>
        <v-divider></v-divider>
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
                <tr class="bg-grey-lighten-4">
                    <td v-for="col in columns" :key="'new'+col.key">
                        <div v-if="col.key === 'name'"><v-text-field v-model="newTemplate.name" density="compact" hide-details placeholder="New Bill Name" variant="plain"></v-text-field></div>
                        <div v-else-if="col.key === 'amount'"><v-text-field v-model.number="newTemplate.amount" type="number" density="compact" hide-details placeholder="0.00" variant="plain"></v-text-field></div>
                        <div v-else-if="col.key === 'who'"><v-select v-model="newTemplate.who" :items="people" density="compact" hide-details variant="plain" placeholder="Who"></v-select></div>
                        <div v-else-if="col.key === 'category'"><v-select v-model="newTemplate.category" :items="categories" density="compact" hide-details variant="plain" placeholder="Category"></v-select></div>
                        <div v-else-if="col.key === 'actions'"><v-btn size="small" color="primary" @click="addTemplate">Add</v-btn></div>
                    </td>
                </tr>
                <tr v-for="t in filteredTemplates" :key="t.id">
                    <td v-for="col in columns" :key="col.key">
                        <div v-if="col.key === 'name'"><v-text-field v-if="editingId===t.id" v-model="editForm.name" density="compact" variant="outlined" hide-details></v-text-field><span v-else>{{t.name}}</span></div>
                        <div v-else-if="col.key === 'amount'"><v-text-field v-if="editingId===t.id" v-model.number="editForm.amount" density="compact" variant="outlined" hide-details></v-text-field><span v-else>£{{t.amount}}</span></div>
                        <div v-else-if="col.key === 'who'"><v-select v-if="editingId===t.id" v-model="editForm.who" :items="people" density="compact" variant="outlined" hide-details></v-select><span v-else>{{t.who}}</span></div>
                        <div v-else-if="col.key === 'category'"><v-select v-if="editingId===t.id" v-model="editForm.category" :items="categories" density="compact" variant="outlined" hide-details></v-select><span v-else>{{t.category}}</span></div>
                        <div v-else-if="col.key === 'actions'" class="text-right">
                            <div v-if="editingId===t.id"><v-btn icon="mdi-check" color="green" size="small" variant="text" @click="saveTemplate"></v-btn></div>
                            <div v-else><v-btn icon="mdi-pencil" color="grey" size="small" variant="text" @click="startEdit(t)"></v-btn><v-btn icon="mdi-delete" color="grey" size="small" variant="text" @click="deleteTemplate(t.id)"></v-btn></div>
                        </div>
                    </td>
                </tr>
            </tbody>
        </v-table>
    </v-card>
</template>

<style scoped>
.cursor-move { cursor: move; }
.resizable-header { resize: horizontal; overflow: hidden; min-width: 50px; }
</style>