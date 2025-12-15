<script setup>
import { ref, computed } from 'vue';
import axios from 'axios';
import { useTheme } from 'vuetify';
import ReactMarkdown from 'vue-markdown-render'; // You might need to install this or handle text manually if you don't have it. For now, basic text display.

const props = defineProps({
    currentMonth: String
});

const emit = defineEmits(['notify']);
const theme = useTheme();
const isDark = computed(() => theme.global.current.value.dark);

const selectedMonth = ref(props.currentMonth);
const loading = ref(false);
const summary = ref('');
const error = ref('');

const generateSummary = async () => {
    if (!selectedMonth.value) return;
    loading.value = true;
    summary.value = '';
    error.value = '';

    try {
        const response = await axios.post('/api/ai/generate', {
            month: selectedMonth.value
        });

        if (response.data.success) {
            summary.value = response.data.response;
        } else {
            error.value = response.data.error || 'Failed to generate summary';
        }
    } catch (e) {
        console.error(e);
        error.value = e.response?.data?.error || e.message;
        emit('notify', 'AI Generation Failed', 'error');
    } finally {
        loading.value = false;
    }
};
</script>

<template>
    <v-container class="fill-height align-start">
        <v-row justify="center" class="w-100">
            <v-col cols="12" md="8" lg="6">
                <v-card class="mb-4" elevation="4">
                    <v-card-title class="bg-primary text-white d-flex align-center">
                        <v-icon class="mr-2">mdi-robot-outline</v-icon>
                        Financial Assistant
                    </v-card-title>
                    <v-card-text class="pa-4">
                        <div class="d-flex align-center mb-4">
                            <v-text-field
                                v-model="selectedMonth"
                                type="month"
                                label="Select Month"
                                variant="outlined"
                                density="compact"
                                hide-details
                                class="mr-2"
                                style="max-width: 200px;"
                            ></v-text-field>
                            <v-btn 
                                color="secondary" 
                                @click="generateSummary" 
                                :loading="loading"
                                :disabled="loading"
                                prepend-icon="mdi-creation"
                            >
                                Generate Insight
                            </v-btn>
                        </div>

                        <v-divider class="mb-4"></v-divider>

                        <div v-if="loading" class="text-center py-8">
                            <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
                            <div class="mt-4 text-caption text-grey">Thinking...</div>
                        </div>

                        <div v-else-if="error" class="text-center py-4 text-error">
                            <v-icon color="error" size="large" class="mb-2">mdi-alert-circle</v-icon>
                            <div>{{ error }}</div>
                            <div class="text-caption mt-2">Check your settings to ensure Ollama is running and configured.</div>
                        </div>

                        <div v-else-if="summary" class="markdown-body pa-2">
                            <div style="white-space: pre-wrap; line-height: 1.6; font-size: 1.1rem;">{{ summary }}</div>
                        </div>

                        <div v-else class="text-center py-8 text-grey">
                            <v-icon size="48" class="mb-2 opacity-50">mdi-text-box-search-outline</v-icon>
                            <div>Select a month and click generate to get an AI-powered summary of your finances.</div>
                        </div>
                    </v-card-text>
                </v-card>
            </v-col>
        </v-row>
    </v-container>
</template>

<style scoped>
.markdown-body {
    font-family: sans-serif;
}
</style>