<script setup>
    import { ref, computed } from 'vue';
    import axios from 'axios';
    
    const props = defineProps({ 
        people: Array, 
        family: Array,
        categories: Array, 
        defaultSalary: Number, 
        payDay: Number,
        ollamaUrl: String,
        ollamaModel: String,
        primaryColor: String, // <--- 1. NEW PROP
        prompts: { type: Object, default: () => ({}) }
    });
    
    const emit = defineEmits([
        'notify', 'refresh', 
        'update:people', 'update:family', 'update:categories', 
        'update:default-salary', 'update:pay-day',
        'update:ollama-url', 'update:ollama-model',
        'update:primary-color' // <--- 2. NEW EMIT
    ]);
    
    const API_URL = '/api';
    
    // ... [Existing state: renameForm, availableModels, etc] ...
    // Note: Keep existing code for computed proxies and API Actions
    const renameForm = ref({ type: 'people', oldName: null, newName: '' });
    const availableModels = ref([]);
    const loadingModels = ref(false);
    const promptTab = ref('budget');
    const localPrompts = ref({ ...props.prompts });

    const peopleList = computed({
        get: () => props.people || [],
        set: (val) => { emit('update:people', val); saveSetting('people', val); }
    });

    const familyList = computed({
        get: () => props.family || [],
        set: (val) => { emit('update:family', val); saveSetting('family_members', val); }
    });

    const categoryList = computed({
        get: () => props.categories || [],
        set: (val) => { emit('update:categories', val); saveSetting('categories', val); }
    });

    const saveSetting = async (key, val) => { 
        await axios.post(`${API_URL}/settings`, { key, value: typeof val === 'object' ? JSON.stringify(val) : val }); 
        emit('notify', 'Saved'); 
    };
    
    // ... [Existing save functions] ...
    const saveSalary = async () => { saveSetting('default_salary', props.defaultSalary); };
    const savePayDay = async () => { saveSetting('pay_day', props.payDay); };
    const saveOllamaUrl = async (val) => { saveSetting('ollama_url', val); };
    const saveOllamaModel = async (val) => { saveSetting('ollama_model', val); };
    const savePrompt = (key) => { saveSetting(`prompt_${key}`, localPrompts.value[key]); };

    // ... [Existing fetchModels and performRename logic] ...
    const fetchModels = async () => {
        if (!props.ollamaUrl) return emit('notify', 'Please set Ollama URL first', 'error');
        loadingModels.value = true;
        try {
            const res = await axios.get(`${API_URL}/ai/models`);
            if (Array.isArray(res.data)) {
                availableModels.value = res.data.map(m => m.name);
                const preferred = ['llama3', 'mistral', 'gemma:7b', 'llama2', 'qwen'];
                const bestMatch = preferred.find(p => availableModels.value.some(m => m.includes(p)));
                if (bestMatch) {
                    const exactModel = availableModels.value.find(m => m.includes(bestMatch));
                    if (exactModel) {
                        emit('update:ollama-model', exactModel);
                        saveOllamaModel(exactModel);
                        emit('notify', `Found & selected: ${exactModel}`);
                    }
                } else if (availableModels.value.length > 0) {
                    emit('update:ollama-model', availableModels.value[0]);
                    saveOllamaModel(availableModels.value[0]);
                    emit('notify', `Selected: ${availableModels.value[0]}`);
                }
            }
        } catch (e) {
            emit('notify', 'Failed to fetch models. Check URL.', 'error');
        } finally {
            loadingModels.value = false;
        }
    };
    
    const performRename = async () => { 
        if(confirm("Rename?")) { 
            await axios.post(`${API_URL}/settings/rename`, renameForm.value); 
            emit('refresh'); 
            emit('notify', 'Renamed'); 
        } 
    };
</script>
    
<template>
    <v-row>
        <v-col cols="12">
            <v-card class="pa-4 border-s-lg border-info" elevation="3">
                <h3 class="text-h6 mb-2">Appearance</h3>
                <div class="d-flex align-center">
                    <v-text-field
                        :model-value="props.primaryColor"
                        @update:model-value="(val) => emit('update:primary-color', val)"
                        @change="(e) => saveSetting('theme_color', e.target.value)"
                        label="Primary Theme Color"
                        variant="outlined"
                        density="compact"
                        hide-details
                        class="mr-4"
                        style="max-width: 300px"
                    >
                        <template v-slot:prepend>
                            <div :style="{ backgroundColor: props.primaryColor, width: '24px', height: '24px', borderRadius: '4px', border: '1px solid #ddd' }"></div>
                        </template>
                    </v-text-field>
                    <input 
                        type="color" 
                        :value="props.primaryColor" 
                        @input="(e) => emit('update:primary-color', e.target.value)"
                        @change="(e) => saveSetting('theme_color', e.target.value)"
                        style="height: 40px; cursor: pointer; width: 60px;"
                        title="Pick Color"
                    >
                </div>
            </v-card>
        </v-col>

        <v-col cols="12" md="6">
            <v-card class="mb-4 pa-4 border-s-lg border-primary" elevation="3">
                <h3 class="text-h6 mb-2">Global Rename</h3>
                <div class="text-caption text-grey mb-4">Rename a person or category across all history.</div>
                <v-radio-group v-model="renameForm.type" inline density="compact" hide-details class="mb-2">
                    <v-radio label="Person" value="people"></v-radio><v-radio label="Category" value="categories"></v-radio>
                </v-radio-group>
                <v-select v-model="renameForm.oldName" :items="renameForm.type==='people'?people:categories" label="Find Old Name" density="compact" variant="outlined"></v-select>
                <v-text-field v-model="renameForm.newName" label="Replace With New Name" density="compact" variant="outlined"></v-text-field>
                <v-btn block color="primary" @click="performRename">Execute Rename</v-btn>
            </v-card>

            <v-card class="mb-4 border-s-lg border-secondary" elevation="3">
                <div class="pa-4">
                    <div class="d-flex align-center mb-2">
                        <v-icon color="secondary" class="mr-2">mdi-robot</v-icon>
                        <h3 class="text-h6">AI Configuration</h3>
                    </div>
                    <div class="text-caption text-grey mb-4">Connect to a local Ollama instance.</div>
                    
                    <v-text-field 
                        :model-value="props.ollamaUrl" 
                        @update:model-value="(val) => emit('update:ollama-url', val)" 
                        @change="(e) => saveOllamaUrl(e.target.value)"
                        label="Ollama Server URL" 
                        placeholder="http://localhost:11434" 
                        variant="outlined" 
                        density="compact"
                        class="mb-2"
                    ></v-text-field>

                    <div class="d-flex mb-4">
                        <v-combobox
                            :model-value="props.ollamaModel" 
                            :items="availableModels"
                            @update:model-value="(val) => { emit('update:ollama-model', val); saveOllamaModel(val); }" 
                            label="Model Name" 
                            placeholder="e.g. llama3" 
                            variant="outlined" 
                            density="compact"
                            hint="Click fetch to auto-detect best model"
                            persistent-hint
                            class="mr-2"
                        ></v-combobox>

                        <v-btn color="secondary" variant="tonal" height="40" :loading="loadingModels" @click="fetchModels">Fetch</v-btn>
                    </div>
                </div>

                <v-divider></v-divider>

                <div class="pa-0">
                    <v-tabs v-model="promptTab" density="compact" bg-color="grey-lighten-4" color="secondary" show-arrows>
                        <v-tab value="budget">Budget</v-tab>
                        <v-tab value="savings">Savings</v-tab>
                        <v-tab value="credit_cards">Credit</v-tab>
                        <v-tab value="dashboard">Dash</v-tab>
                        <v-tab value="meals">Meals</v-tab>
                        <v-tab value="birthdays">Birthdays</v-tab>
                        <v-tab value="christmas">Xmas</v-tab>
                        <v-tab value="sandbox">Sandbox</v-tab>
                        <v-tab value="mortgage">Mortgage</v-tab>
                    </v-tabs>
                    <v-window v-model="promptTab">
                        <v-window-item v-for="key in ['budget', 'savings', 'credit_cards', 'dashboard', 'meals', 'birthdays', 'christmas', 'sandbox', 'mortgage']" :key="key" :value="key">
                            <div class="pa-4">
                                <v-textarea 
                                    v-model="localPrompts[key]" 
                                    label="Custom Prompt Template" 
                                    variant="outlined" 
                                    rows="6" 
                                    auto-grow
                                    class="mb-2 font-monospace"
                                ></v-textarea>
                                <div class="d-flex justify-space-between align-center">
                                    <div class="text-caption text-grey">
                                        <span v-if="key==='budget'" v-text="'Vars: {{month}} {{income}} {{expenses}} {{balance}} {{unpaid_text}}'"></span>
                                        <span v-if="key==='savings'" v-text="'Vars: {{total_saved}} {{breakdown}}'"></span>
                                        <span v-if="key==='dashboard'" v-text="'Vars: {{year}} {{income}} {{expenses}}'"></span>
                                        <span v-if="key==='credit_cards'" v-text="'Vars: {{total_debt}} {{cards_text}}'"></span>
                                        <span v-if="key==='meals'" v-text="'Vars: {{meals_list}}'"></span>
                                        <span v-if="key==='birthdays'" v-text="'Vars: {{upcoming_list}}'"></span>
                                        <span v-if="key==='christmas'" v-text="'Vars: {{spent}} {{total}} {{remaining_count}} {{items_list}}'"></span>
                                        <span v-if="key==='sandbox'" v-text="'Vars: {{salary}} {{total_expenses}} {{balance}} {{expense_list}}'"></span>
                                        <span v-if="key==='mortgage'" v-text="'Vars: {{value}} {{equity}} {{mortgage_list}}'"></span>
                                    </div>
                                    <v-btn size="small" color="secondary" @click="savePrompt(key)">Save Prompt</v-btn>
                                </div>
                            </div>
                        </v-window-item>
                    </v-window>
                </div>
            </v-card>
        </v-col>

        <v-col cols="12" md="6">
            <v-card class="mb-4 pa-4">
                <h3 class="text-h6 mb-2">Financial Defaults</h3>
                <v-text-field :model-value="props.defaultSalary" @update:model-value="(val) => emit('update:default-salary', Number(val))" @change="saveSalary" label="Default Salary" prefix="£" variant="outlined" class="mb-2"></v-text-field>
                <v-text-field :model-value="props.payDay" @update:model-value="(val) => emit('update:pay-day', Number(val))" @change="savePayDay" label="Pay Day (Date)" type="number" min="1" max="31" suffix="th" variant="outlined"></v-text-field>
            </v-card>
            <v-card class="pa-4">
                <h3 class="text-h6 mb-2">Manage Lists</h3>
                <v-combobox v-model="peopleList" chips multiple label="Budget Accounts (Who Pay)" variant="outlined" class="mb-2"></v-combobox>
                <v-combobox v-model="familyList" chips multiple label="Family Members (Who Eat)" variant="outlined" class="mb-2"></v-combobox>
                <v-combobox v-model="categoryList" chips multiple label="Categories" variant="outlined"></v-combobox>
            </v-card>
        </v-col>
    </v-row>
</template>

<style scoped>
.font-monospace { font-family: monospace; font-size: 0.9em; }
</style>