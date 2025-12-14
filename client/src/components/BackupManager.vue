<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';

const emit = defineEmits(['notify']);
const API_URL = '/api';

const backups = ref([]);
const config = ref({ frequency: 'never', time: '02:00' });
const frequencies = [
    { title: 'Never (Manual Only)', value: 'never' },
    { title: 'Daily', value: 'daily' },
    { title: 'Weekly (Monday)', value: 'weekly' },
    { title: 'Monthly (1st)', value: 'monthly' },
];

const fetchData = async () => {
    try {
        const res = await axios.get(`${API_URL}/backups`);
        backups.value = res.data.files || [];
        if (res.data.config) config.value = res.data.config;
    } catch (e) { emit('notify', 'Failed to load backups', 'error'); }
};

const saveConfig = async () => {
    try {
        await axios.post(`${API_URL}/backups/config`, config.value);
        emit('notify', 'Schedule Saved');
    } catch (e) { emit('notify', 'Error saving schedule', 'error'); }
};

const createBackup = async () => {
    try {
        await axios.post(`${API_URL}/backups/create`);
        fetchData();
        emit('notify', 'Backup Created');
    } catch (e) { emit('notify', 'Backup failed', 'error'); }
};

const deleteBackup = async (filename) => {
    if (!confirm(`Delete ${filename}?`)) return;
    try {
        await axios.delete(`${API_URL}/backups/${filename}`);
        fetchData();
        emit('notify', 'Backup Deleted');
    } catch (e) { emit('notify', 'Delete failed', 'error'); }
};

const restoreBackup = async (filename) => {
    const confirmation = prompt(`To confirm restore from ${filename}, type "RESTORE" below.\n\nWARNING: Current data will be overwritten and the app will restart.`);
    if (confirmation !== "RESTORE") return;
    
    try {
        await axios.post(`${API_URL}/backups/${filename}/restore`);
        alert("Restore initiated. The application is restarting. Please wait 10 seconds then reload the page.");
        setTimeout(() => location.reload(), 8000);
    } catch (e) { emit('notify', 'Restore failed', 'error'); }
};

const formatSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

onMounted(fetchData);
</script>

<template>
    <v-container fluid class="pa-0">
        <v-row>
            <v-col cols="12" md="4">
                <v-card elevation="2" class="rounded-lg mb-4">
                    <v-card-title class="text-subtitle-1 font-weight-bold text-uppercase text-grey-darken-1">Backup Schedule</v-card-title>
                    <v-card-text>
                        <v-select v-model="config.frequency" :items="frequencies" label="Frequency" variant="outlined" density="compact" class="mb-2"></v-select>
                        <v-text-field v-model="config.time" type="time" label="Time (Server Time)" variant="outlined" density="compact" :disabled="config.frequency === 'never'"></v-text-field>
                        <v-btn block color="primary" @click="saveConfig" :disabled="config.frequency === 'never'">Save Schedule</v-btn>
                    </v-card-text>
                </v-card>

                <v-btn block size="large" color="success" prepend-icon="mdi-content-save" class="mb-4" @click="createBackup">Create Backup Now</v-btn>
            </v-col>

            <v-col cols="12" md="8">
                <v-card elevation="2" class="rounded-lg">
                    <v-card-title class="text-subtitle-1 font-weight-bold text-uppercase text-grey-darken-1">Available Backups</v-card-title>
                    <v-divider></v-divider>
                    <v-list lines="two" v-if="backups.length">
                        <v-list-item v-for="file in backups" :key="file.name">
                            <template v-slot:prepend>
                                <v-icon color="blue-grey" icon="mdi-database"></v-icon>
                            </template>
                            <v-list-item-title class="font-weight-bold">{{ file.name }}</v-list-item-title>
                            <v-list-item-subtitle>{{ new Date(file.created).toLocaleString() }} • {{ formatSize(file.size) }}</v-list-item-subtitle>
                            
                            <template v-slot:append>
                                <v-btn color="warning" variant="text" size="small" class="mr-2" @click="restoreBackup(file.name)">Restore</v-btn>
                                <v-btn color="error" icon="mdi-delete" variant="text" size="small" @click="deleteBackup(file.name)"></v-btn>
                            </template>
                        </v-list-item>
                    </v-list>
                    <div v-else class="pa-8 text-center text-grey">
                        <v-icon size="large" class="mb-2">mdi-database-off</v-icon>
                        <div>No backups found.</div>
                    </div>
                </v-card>
            </v-col>
        </v-row>
    </v-container>
</template>