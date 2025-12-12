<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue';

const props = defineProps(['show']);
const emit = defineEmits(['update:show', 'notify']);

const calcDisplay = ref('0');
let calcCurrent = '', calcPrevious = '', calcOperation = null;
const calcResetNext = ref(false);

const close = () => emit('update:show', false);

const calcAppend = (num) => {
  if (calcDisplay.value === '0' || calcResetNext.value) { 
    calcDisplay.value = String(num); 
    calcResetNext.value = false; 
  } else { 
    calcDisplay.value += String(num); 
  }
};

const calcSetOp = (op) => {
  if (calcOperation !== null) calcCompute();
  calcPrevious = calcDisplay.value; 
  calcOperation = op; 
  calcResetNext.value = true;
};

const calcCompute = () => {
  const prev = parseFloat(calcPrevious); 
  const current = parseFloat(calcDisplay.value);
  if (isNaN(prev) || isNaN(current)) return;
  
  const map = { '+': prev + current, '-': prev - current, '*': prev * current, '/': prev / current };
  calcDisplay.value = String(map[calcOperation] || 0);
  calcOperation = null; 
  calcResetNext.value = true;
};

const calcClear = () => { 
  calcDisplay.value = '0'; 
  calcPrevious = ''; 
  calcOperation = null; 
};

const copyToClipboard = () => { 
  navigator.clipboard.writeText(calcDisplay.value); 
  emit('notify', 'Copied'); 
};

const handleKeydown = (e) => {
    if (!props.show) return;
    if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

    if (e.key >= '0' && e.key <= '9') calcAppend(Number(e.key));
    if (e.key === '.') calcAppend('.');
    if (['+', '-', '*', '/'].includes(e.key)) calcSetOp(e.key);
    if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); calcCompute(); }
    if (e.key === 'Escape' || e.key.toLowerCase() === 'c') calcClear();
    if (e.key === 'Backspace') {
        calcDisplay.value = calcDisplay.value.slice(0, -1);
        if (calcDisplay.value === '' || calcDisplay.value === '-') calcDisplay.value = '0';
    }
};

onMounted(() => window.addEventListener('keydown', handleKeydown));
onUnmounted(() => window.removeEventListener('keydown', handleKeydown));
</script>

<template>
    <v-card v-if="show" elevation="8" class="calculator-card rounded-lg d-flex flex-column">
        <v-card-title class="d-flex justify-space-between align-center py-2 px-3 bg-primary text-white flex-grow-0">
            <span class="text-caption font-weight-bold">Quick Calc</span>
            <v-icon size="small" @click="close">mdi-close</v-icon>
        </v-card-title>
        <div class="d-flex justify-space-between align-center pa-2 border-b mb-2 flex-grow-0">
            <v-btn icon="mdi-content-copy" size="x-small" variant="text" @click="copyToClipboard"></v-btn>
            <div class="text-h4 font-monospace text-end flex-grow-1">{{ calcDisplay }}</div>
        </div>
        <div class="pa-2 flex-grow-1">
            <v-row dense class="h-100">
                <v-col cols="3"><v-btn block size="small" variant="tonal" @click="calcClear" color="error" class="h-100 text-h6">C</v-btn></v-col>
                <v-col cols="3"><v-btn block size="small" variant="tonal" @click="calcSetOp('/')" class="h-100 text-h6">/</v-btn></v-col>
                <v-col cols="3"><v-btn block size="small" variant="tonal" @click="calcSetOp('*')" class="h-100 text-h6">x</v-btn></v-col>
                <v-col cols="3"><v-btn block size="small" variant="tonal" @click="calcSetOp('-')" class="h-100 text-h6">-</v-btn></v-col>
                <v-col cols="3" v-for="n in [7,8,9]" :key="n"><v-btn block size="small" variant="text" @click="calcAppend(n)" class="h-100 text-h6">{{n}}</v-btn></v-col>
                <v-col cols="3"><v-btn block size="small" variant="tonal" @click="calcSetOp('+')" class="h-100 text-h6">+</v-btn></v-col>
                <v-col cols="3" v-for="n in [4,5,6]" :key="n"><v-btn block size="small" variant="text" @click="calcAppend(n)" class="h-100 text-h6">{{n}}</v-btn></v-col>
                <v-col cols="3"><v-btn block size="small" color="primary" @click="calcCompute" class="h-100 text-h6" style="grid-row: span 2">=</v-btn></v-col>
                <v-col cols="3" v-for="n in [1,2,3]" :key="n"><v-btn block size="small" variant="text" @click="calcAppend(n)" class="h-100 text-h6">{{n}}</v-btn></v-col>
                <v-col cols="9" class="d-flex">
                    <v-btn block size="small" variant="text" @click="calcAppend(0)" class="h-100 text-h6 flex-grow-1" style="width: 66%">0</v-btn>
                    <v-btn block size="small" variant="text" @click="calcAppend('.')" class="h-100 text-h6 flex-grow-1" style="width: 33%">.</v-btn>
                </v-col>
            </v-row>
        </div>
    </v-card>
</template>

<style scoped>
.calculator-card { 
    position: fixed; top: 70px; right: 20px; z-index: 2000;
    width: 320px; height: 480px; min-width: 280px; min-height: 400px;
    resize: both; overflow: auto;
    background-color: white; /* fallback */
}
.font-monospace { font-family: 'Roboto Mono', monospace; }
</style>