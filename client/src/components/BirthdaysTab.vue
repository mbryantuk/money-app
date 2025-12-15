<script setup>
    import { ref, onMounted, computed } from 'vue';
    import axios from 'axios';
    
    const props = defineProps(['notify']);
    const emit = defineEmits(['notify']);
    
    const birthdays = ref([]);
    const dialog = ref(false);
    const editedItem = ref({ id: null, name: '', date: '', type: 'Family' });
    const defaultItem = { id: null, name: '', date: '', type: 'Family' };
    const types = ['Family', 'Friend', 'Other'];
    
    // Fetch data
    const fetchBirthdays = async () => {
        try {
            const res = await axios.get('/api/birthdays');
            birthdays.value = res.data || [];
        } catch (e) {
            emit('notify', 'Error loading birthdays');
        }
    };
    
    // Utils
    const calculateAge = (dob) => {
        if (!dob) return '';
        const birthDate = new Date(dob);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    };
    
    const formatDate = (dateStr) => {
        if(!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
    };
    
    // Actions
    const openDialog = (item = null) => {
        editedItem.value = item ? { ...item } : { ...defaultItem };
        dialog.value = true;
    };
    
    const saveItem = async () => {
        if (!editedItem.value.name || !editedItem.value.date) return;
        try {
            if (editedItem.value.id) {
                await axios.put(`/api/birthdays/${editedItem.value.id}`, editedItem.value);
            } else {
                await axios.post('/api/birthdays', editedItem.value);
            }
            dialog.value = false;
            fetchBirthdays();
            emit('notify', 'Birthday Saved');
        } catch (e) {
            emit('notify', 'Error saving');
        }
    };
    
    const deleteItem = async (id) => {
        if(!confirm("Remove birthday?")) return;
        try {
            await axios.delete(`/api/birthdays/${id}`);
            fetchBirthdays();
        } catch (e) { emit('notify', 'Error deleting'); }
    };
    
    // Sorted by upcoming month/day (ignoring year)
    const sortedBirthdays = computed(() => {
        return [...birthdays.value].sort((a, b) => {
            const dA = new Date(a.date);
            const dB = new Date(b.date);
            // Compare Month then Day
            if (dA.getMonth() !== dB.getMonth()) return dA.getMonth() - dB.getMonth();
            return dA.getDate() - dB.getDate();
        });
    });
    
    onMounted(fetchBirthdays);
    </script>
    
    <template>
        <v-card class="mx-auto" max-width="800">
            <v-card-title class="d-flex justify-space-between align-center bg-primary text-white">
                <span>Birthdays & Events</span>
                <v-btn icon="mdi-plus" variant="text" color="white" @click="openDialog()"></v-btn>
            </v-card-title>
    
            <v-list lines="two">
                <v-list-item v-for="person in sortedBirthdays" :key="person.id">
                    <template v-slot:prepend>
                        <v-avatar color="primary" variant="tonal">
                            <span class="text-h6">{{ new Date(person.date).getDate() }}</span>
                        </v-avatar>
                    </template>
    
                    <v-list-item-title class="font-weight-bold">
                        {{ person.name }} 
                        <v-chip size="x-small" :color="person.type === 'Family' ? 'green' : 'blue'" class="ml-2" variant="flat">{{ person.type }}</v-chip>
                    </v-list-item-title>
                    <v-list-item-subtitle>
                        {{ formatDate(person.date) }} • Turning {{ calculateAge(person.date) + 1 }} next
                    </v-list-item-subtitle>
    
                    <template v-slot:append>
                        <v-btn icon="mdi-pencil" size="small" variant="text" color="grey" @click="openDialog(person)"></v-btn>
                        <v-btn icon="mdi-delete" size="small" variant="text" color="error" @click="deleteItem(person.id)"></v-btn>
                    </template>
                </v-list-item>
                <v-list-item v-if="birthdays.length === 0">
                    <v-list-item-title class="text-center text-grey font-italic">No birthdays added yet.</v-list-item-title>
                </v-list-item>
            </v-list>
    
            <v-dialog v-model="dialog" max-width="500">
                <v-card>
                    <v-card-title>{{ editedItem.id ? 'Edit' : 'New' }} Birthday</v-card-title>
                    <v-card-text>
                        <v-text-field v-model="editedItem.name" label="Name" variant="outlined" autofocus></v-text-field>
                        <v-text-field v-model="editedItem.date" type="date" label="Date of Birth" variant="outlined"></v-text-field>
                        <v-select v-model="editedItem.type" :items="types" label="Group" variant="outlined"></v-select>
                    </v-card-text>
                    <v-card-actions>
                        <v-spacer></v-spacer>
                        <v-btn color="grey" variant="text" @click="dialog = false">Cancel</v-btn>
                        <v-btn color="primary" variant="flat" @click="saveItem">Save</v-btn>
                    </v-card-actions>
                </v-card>
            </v-dialog>
        </v-card>
    </template>