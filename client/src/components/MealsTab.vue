<script setup>
  import { ref, onMounted, computed } from 'vue';
  import axios from 'axios';
  
  // Props
  const props = defineProps({
    people: { type: Array, default: () => [] } 
  });

  const emit = defineEmits(['notify']);
  
  // State
  const meals = ref([]);
  const plan = ref([]);
  const slots = ['Breakfast', 'Lunch', 'Dinner'];
  const mealTypes = ['Breakfast', 'Lunch', 'Dinner'];
  
  // Library Dialog
  const dialog = ref(false);
  const editedItem = ref({ id: null, name: '', description: '', tags: [], type: 'Dinner' }); 
  const defaultItem = { id: null, name: '', description: '', tags: [], type: 'Dinner' };

  // Assignment Dialog
  const assignDialog = ref(false);
  const assignForm = ref({ date: null, slot: null, meal_id: null, who: [] });

  // Copy Meal Dialog
  const copyDialog = ref(false);
  const copyForm = ref({ sourceMeal: null, targetDate: null, targetSlot: null });
  
  const weekOffset = ref(0);
  
  // Fetch Data
  const fetchData = async () => {
    try {
      const mealsRes = await axios.get('/api/meals');
      meals.value = mealsRes.data || [];
      fetchPlan();
    } catch (err) {
      console.error("Error fetching data", err);
    }
  };

  // Group meals by type for the sidebar
  const mealsByType = computed(() => {
    const groups = { Breakfast: [], Lunch: [], Dinner: [] };
    meals.value.forEach(meal => {
        const type = (meal.type && groups[meal.type]) ? meal.type : 'Dinner';
        groups[type].push(meal);
    });
    return groups;
  });

  // Filter meals for the Assignment Dialog based on the selected Slot
  const filteredMealsForAssign = computed(() => {
      const targetSlot = assignForm.value.slot;
      if (!targetSlot) return meals.value;
      // Default to 'Dinner' if type is missing, to match Sidebar logic
      return meals.value.filter(m => (m.type || 'Dinner') === targetSlot);
  });
  
  // Computed Week Dates
  const weekDates = computed(() => {
    const d = new Date();
    const day = d.getDay() || 7;
    if (day !== 1) d.setHours(-24 * (day - 1));
    d.setDate(d.getDate() + (weekOffset.value * 7));
  
    const days = [];
    for (let i = 0; i < 7; i++) {
      const dateStr = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      days.push({ date: dateStr, name: dayName });
      d.setDate(d.getDate() + 1);
    }
    return days;
  });
  
  const fetchPlan = async () => {
    const start = weekDates.value[0].date;
    const end = weekDates.value[6].date;
    const res = await axios.get(`/api/meal-plan?start=${start}&end=${end}`);
    plan.value = res.data || [];
  };
  
  // Actions
  const getMealsForSlot = (date, slot) => {
    return plan.value.filter(p => p.date === date && p.slot === slot);
  };

  const isSlotComplete = (date, slot) => {
      const meals = getMealsForSlot(date, slot);
      if (!meals.length) return false;
      const allFed = new Set();
      meals.forEach(m => {
          if (Array.isArray(m.who)) m.who.forEach(p => allFed.add(p));
      });
      return props.people.length > 0 && props.people.every(p => allFed.has(p));
  };
  
  const openAssignDialog = (date, slot) => {
      assignForm.value = { 
          date, 
          slot, 
          meal_id: null, 
          who: [...(props.people || [])] 
      }; 
      assignDialog.value = true;
  };

  const confirmAssign = async () => {
      if (!assignForm.value.meal_id) return;
      await axios.post('/api/meal-plan', assignForm.value);
      assignDialog.value = false;
      fetchPlan();
      emit('notify', 'Meal assigned');
  };

  // --- COPY LOGIC ---
  
  const openCopyDialog = (mealItem) => {
      // Find the meal object to get its details
      const originalMeal = meals.value.find(m => m.id === mealItem.meal_id);
      
      copyForm.value = {
          sourceMeal: mealItem,
          originalName: originalMeal ? originalMeal.name : 'Unknown Meal',
          targetDate: mealItem.date, // Default to same day
          targetSlot: mealItem.slot, // Default to same slot
          who: mealItem.who // Keep same people
      };
      copyDialog.value = true;
  };

  const confirmCopy = async () => {
      if(!copyForm.value.targetDate || !copyForm.value.targetSlot) return;

      await axios.post('/api/meal-plan', {
          date: copyForm.value.targetDate,
          slot: copyForm.value.targetSlot,
          meal_id: copyForm.value.sourceMeal.meal_id,
          who: copyForm.value.who
      });
      
      copyDialog.value = false;
      fetchPlan();
      emit('notify', 'Meal Copied');
  };

  const copyLastWeek = async () => {
      if(!confirm("Copy the entire plan from the previous week? This will add to existing meals.")) return;

      // 1. Calculate Previous Week Range
      const currentStart = new Date(weekDates.value[0].date);
      const prevStart = new Date(currentStart);
      prevStart.setDate(prevStart.getDate() - 7);
      
      const prevEnd = new Date(prevStart);
      prevEnd.setDate(prevEnd.getDate() + 6);
      
      const sStr = prevStart.toISOString().split('T')[0];
      const eStr = prevEnd.toISOString().split('T')[0];

      try {
          // 2. Fetch Previous Week
          const res = await axios.get(`/api/meal-plan?start=${sStr}&end=${eStr}`);
          const prevMeals = res.data;

          if(!prevMeals.length) {
              emit('notify', 'No meals found in previous week', 'warning');
              return;
          }

          // 3. Post to Current Week (Shift date by +7 days)
          const promises = prevMeals.map(p => {
              const oldDate = new Date(p.date);
              oldDate.setDate(oldDate.getDate() + 7);
              const newDate = oldDate.toISOString().split('T')[0];
              
              return axios.post('/api/meal-plan', {
                  date: newDate,
                  slot: p.slot,
                  meal_id: p.meal_id,
                  who: p.who
              });
          });

          await Promise.all(promises);
          fetchPlan();
          emit('notify', `Copied ${prevMeals.length} meals from last week`);

      } catch(e) {
          console.error(e);
          emit('notify', 'Error copying week', 'error');
      }
  };
  
  const removeAssignment = async (id) => {
    await axios.delete(`/api/meal-plan/${id}`);
    fetchPlan();
  };
  
  // Library Management
  const openDialog = (item = null) => {
    editedItem.value = item ? { ...item } : { ...defaultItem };
    dialog.value = true;
  };
  
  const saveMeal = async () => {
    if (editedItem.value.id) {
      await axios.put(`/api/meals/${editedItem.value.id}`, editedItem.value);
    } else {
      await axios.post('/api/meals', editedItem.value);
    }
    dialog.value = false;
    fetchData();
  };
  
  const deleteMeal = async (id) => {
    if (confirm("Delete this meal from library?")) {
      await axios.delete(`/api/meals/${id}`);
      fetchData();
    }
  };
  
  const changeWeek = (delta) => {
    weekOffset.value += delta;
    fetchPlan();
  };
  
  onMounted(fetchData);
</script>
  
<template>
<v-row>
  <v-col cols="12" md="4">
    <v-card class="fill-height d-flex flex-column" elevation="2">
      <v-card-title class="d-flex justify-space-between align-center bg-blue-grey-lighten-5">
        Meal Library
        <v-btn color="primary" size="small" icon="mdi-plus" @click="openDialog()"></v-btn>
      </v-card-title>
      
      <v-list class="overflow-y-auto flex-grow-1" style="max-height: 75vh">
        <template v-for="type in mealTypes" :key="type">
            <v-list-subheader class="font-weight-bold text-uppercase bg-grey-lighten-4">{{ type }}</v-list-subheader>
            <v-list-item v-for="meal in mealsByType[type]" :key="meal.id" lines="two">
                <v-list-item-title class="font-weight-bold">{{ meal.name }}</v-list-item-title>
                <v-list-item-subtitle class="text-caption">{{ meal.description }}</v-list-item-subtitle>
                <template v-slot:append>
                    <div class="d-flex align-center">
                    <v-btn icon="mdi-pencil" size="small" variant="text" color="grey" @click="openDialog(meal)"></v-btn>
                    <v-btn icon="mdi-delete" size="small" color="error" variant="text" @click="deleteMeal(meal.id)"></v-btn>
                    </div>
                </template>
            </v-list-item>
            <v-divider></v-divider>
        </template>
      </v-list>
    </v-card>
  </v-col>

  <v-col cols="12" md="8">
    <v-card>
      <v-card-title class="d-flex align-center justify-space-between bg-primary text-white">
        <div class="d-flex align-center">
            <v-btn icon="mdi-chevron-left" variant="text" color="white" @click="changeWeek(-1)"></v-btn>
            <span>Week of {{ weekDates[0].date }}</span>
            <v-btn icon="mdi-chevron-right" variant="text" color="white" @click="changeWeek(1)"></v-btn>
        </div>
        <v-btn variant="tonal" color="white" prepend-icon="mdi-content-copy" size="small" @click="copyLastWeek">Copy Last Week</v-btn>
      </v-card-title>
      
      <div class="pa-2 bg-grey-lighten-4 fill-height">
        <v-row dense>
          <v-col cols="12" v-for="day in weekDates" :key="day.date">
            <v-card variant="elevated" class="pa-0 mb-1">
              <div class="d-flex">
                  <div class="pa-3 d-flex flex-column align-center justify-center bg-white border-e" style="width: 80px; min-width:80px">
                      <div class="text-subtitle-2 font-weight-bold text-uppercase">{{ day.name }}</div>
                      <div class="text-caption text-grey">{{ day.date.slice(5) }}</div>
                  </div>

                  <div class="flex-grow-1 pa-1 d-flex flex-column">
                      <div v-for="slot in slots" :key="slot" class="d-flex flex-column border-b py-1" style="min-height: 40px;">
                          <div class="d-flex align-center pl-2 justify-space-between bg-grey-lighten-5">
                              <div class="d-flex align-center">
                                  <span class="text-caption font-weight-bold text-medium-emphasis mr-1">{{ slot }}</span>
                                  <v-icon v-if="isSlotComplete(day.date, slot)" color="green" size="small">mdi-check-circle</v-icon>
                              </div>
                              <v-btn size="x-small" variant="text" icon="mdi-plus" color="primary" @click="openAssignDialog(day.date, slot)" title="Add Meal"></v-btn>
                          </div>
                          
                          <div v-if="getMealsForSlot(day.date, slot).length">
                              <div v-for="mealPlanItem in getMealsForSlot(day.date, slot)" :key="mealPlanItem.id" class="d-flex align-center justify-space-between px-2 rounded bg-blue-grey-lighten-5 ma-1 border">
                                  <div>
                                      <span class="text-body-2 font-weight-bold mr-2">{{ mealPlanItem.name }}</span>
                                      <v-chip v-for="p in mealPlanItem.who" :key="p" size="x-small" density="compact" class="mr-1" style="height: 18px;">{{ p }}</v-chip>
                                  </div>
                                  <div>
                                      <v-btn icon="mdi-content-copy" size="x-small" variant="text" color="blue" @click="openCopyDialog(mealPlanItem)" title="Copy to another day"></v-btn>
                                      <v-btn icon="mdi-close" size="x-small" variant="text" color="grey" @click="removeAssignment(mealPlanItem.id)"></v-btn>
                                  </div>
                              </div>
                          </div>
                          <div v-else class="text-caption text-grey font-italic pl-2">-</div>
                      </div>
                  </div>
              </div>
            </v-card>
          </v-col>
        </v-row>
      </div>
    </v-card>
  </v-col>
</v-row>

<v-dialog v-model="dialog" max-width="500px">
  <v-card>
    <v-card-title>{{ editedItem.id ? 'Edit' : 'New' }} Meal</v-card-title>
    <v-card-text>
      <v-text-field v-model="editedItem.name" label="Name" autofocus variant="outlined"></v-text-field>
      <v-select v-model="editedItem.type" :items="mealTypes" label="Meal Type" variant="outlined"></v-select>
      <v-textarea v-model="editedItem.description" label="Description" rows="2" variant="outlined"></v-textarea>
      <v-combobox v-model="editedItem.tags" label="Generic Tags (e.g. Quick, Pasta)" multiple chips variant="outlined"></v-combobox> 
    </v-card-text>
    <v-card-actions>
      <v-spacer></v-spacer>
      <v-btn color="grey" variant="text" @click="dialog = false">Cancel</v-btn>
      <v-btn color="primary" variant="flat" @click="saveMeal">Save Library Item</v-btn>
    </v-card-actions>
  </v-card>
</v-dialog>

<v-dialog v-model="assignDialog" max-width="500px">
  <v-card>
      <v-card-title>Plan {{ assignForm.slot }} for {{ assignForm.date }}</v-card-title>
      <v-card-text>
          <v-select 
              v-model="assignForm.meal_id" 
              :items="filteredMealsForAssign" 
              item-title="name" 
              item-value="id" 
              label="Select Meal" 
              variant="outlined"
              autofocus
          ></v-select>
          <v-select 
              v-model="assignForm.who" 
              :items="props.people" 
              label="Who is eating this?" 
              multiple 
              chips 
              variant="outlined"
          ></v-select>
      </v-card-text>
      <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="grey" variant="text" @click="assignDialog = false">Cancel</v-btn>
          <v-btn color="primary" variant="flat" @click="confirmAssign">Add to Day</v-btn>
      </v-card-actions>
  </v-card>
</v-dialog>

<v-dialog v-model="copyDialog" max-width="400px">
    <v-card>
        <v-card-title>Copy Meal</v-card-title>
        <v-card-text>
            <div class="text-subtitle-1 mb-2">Copying: <strong>{{ copyForm.originalName }}</strong></div>
            <v-text-field label="To Date" type="date" v-model="copyForm.targetDate" variant="outlined"></v-text-field>
            <v-select label="To Slot" :items="slots" v-model="copyForm.targetSlot" variant="outlined"></v-select>
        </v-card-text>
        <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn color="grey" variant="text" @click="copyDialog = false">Cancel</v-btn>
            <v-btn color="primary" variant="flat" @click="confirmCopy">Copy</v-btn>
        </v-card-actions>
    </v-card>
</v-dialog>
</template>