<script setup>
import { ref } from 'vue';
import axios from 'axios';
const props = defineProps({ people: Array, categories: Array, defaultSalary: Number, templates: Array });
const emit = defineEmits(['notify', 'refresh', 'update:people', 'update:categories', 'update:default-salary']);
const API_URL = '/api';

const renameForm = ref({ type: 'people', oldName: null, newName: '' });
const newTemplate = ref({});
const editingId = ref(null);
const editForm = ref({});

const saveSetting = async (key, val) => {
    await axios.post(`${API_URL}/settings`, { key, value: JSON.stringify(val) });
    emit('notify', 'Saved');
};
const saveSalary = async () => {
    await axios.post(`${API_URL}/settings`, { key: 'default_salary', value: props.defaultSalary });
    emit('notify', 'Salary Saved');
};
const performRename = async () => {
    if(!renameForm.value.oldName || !renameForm.value.newName) return;
    if(confirm("Rename everywhere?")) {
        await axios.post(`${API_URL}/settings/rename`, renameForm.value);
        emit('refresh'); emit('notify', 'Renamed');
    }
};
const addTemplate = async () => {
    if(!newTemplate.value.name) return;
    await axios.post(`${API_URL}/templates`, newTemplate.value);
    newTemplate.value = {}; emit('refresh');
};
const saveTemplate = async () => {
    await axios.put(`${API_URL}/templates/${editForm.value.id}`, editForm.value);
    editingId.value = null; emit('refresh');
};
const deleteTemplate = async (id) => {
    if(confirm("Delete?")) { await axios.delete(`${API_URL}/templates/${id}`); emit('refresh'); }
};
const startEdit = (t) => { editingId.value = t.id; editForm.value = {...t}; };
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
                <h3 class="text-h6 mb-2">Default Salary</h3>
                <v-text-field v-model="props.defaultSalary" @change="saveSalary" prefix="£" variant="outlined"></v-text-field>
            </v-card>
            <v-card class="pa-4">
                <h3 class="text-h6 mb-2">Lists</h3>
                <v-combobox v-model="props.people" chips multiple label="People" @update:modelValue="saveSetting('people', props.people)"></v-combobox>
                <v-combobox v-model="props.categories" chips multiple label="Categories" @update:modelValue="saveSetting('categories', props.categories)" class="mt-2"></v-combobox>
            </v-card>
        </v-col>

        <v-col cols="12" md="8">
            <v-card title="Master Bill List">
                <v-table density="compact">
                    <thead><tr><th>Name</th><th>Amount</th><th>Who</th><th>Category</th><th></th></tr></thead>
                    <tbody>
                        <tr>
                            <td><v-text-field v-model="newTemplate.name" density="compact" hide-details placeholder="Name"></v-text-field></td>
                            <td><v-text-field v-model.number="newTemplate.amount" type="number" density="compact" hide-details placeholder="0.00"></v-text-field></td>
                            <td><v-select v-model="newTemplate.who" :items="people" density="compact" hide-details></v-select></td>
                            <td><v-select v-model="newTemplate.category" :items="categories" density="compact" hide-details></v-select></td>
                            <td><v-btn size="small" color="primary" @click="addTemplate">Add</v-btn></td>
                        </tr>
                        <tr v-for="t in templates" :key="t.id">
                            <td><v-text-field v-if="editingId===t.id" v-model="editForm.name" density="compact" variant="outlined"></v-text-field><span v-else>{{t.name}}</span></td>
                            <td><v-text-field v-if="editingId===t.id" v-model.number="editForm.amount" density="compact" variant="outlined"></v-text-field><span v-else>£{{t.amount}}</span></td>
                            <td><v-select v-if="editingId===t.id" v-model="editForm.who" :items="people" density="compact" variant="outlined"></v-select><span v-else>{{t.who}}</span></td>
                            <td><v-select v-if="editingId===t.id" v-model="editForm.category" :items="categories" density="compact" variant="outlined"></v-select><span v-else>{{t.category}}</span></td>
                            <td>
                                <div v-if="editingId===t.id"><v-btn icon="mdi-check" color="green" size="small" variant="text" @click="saveTemplate"></v-btn></div>
                                <div v-else><v-btn icon="mdi-pencil" color="grey" size="small" variant="text" @click="startEdit(t)"></v-btn><v-btn icon="mdi-delete" color="grey" size="small" variant="text" @click="deleteTemplate(t.id)"></v-btn></div>
                            </td>
                        </tr>
                    </tbody>
                </v-table>
            </v-card>
        </v-col>
    </v-row>
</template>