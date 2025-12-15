<script setup>
  import { ref, onMounted, computed } from 'vue';
  import axios from 'axios';
  
  // Props
  const props = defineProps({
    people: { type: Array, default: () => [] } // Receives 'familyMembers' from App.vue
  });

  const emit = defineEmits(['notify']);
  
  // State
  const meals = ref([]);
  const plan = ref([]);
  const slots = ['Breakfast', 'Lunch', 'Dinner'];
  
  // Library Dialog
  const dialog = ref(false);
  const editedItem = ref({ id: null, name: '', description: '', tags: [] }); 
  const defaultItem = { id: null, name: '', description: '', tags: [] };

  // Assignment Dialog
  const assignDialog = ref(false);
  const assignForm = ref({ date: null, slot: null, meal_id: null, who: [] });
  
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
  
  // Computed Week Dates
  const weekDates = computed(() => {
    const d = new Date();
    // Adjust for current day of week (Monday = 1)
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
  const getMealForSlot = (date, slot) => {
    return plan.value.find(p => p.date === date && p.slot === slot);
  };

  // Check if every family member is covered for this specific meal slot
  const isSlotComplete = (date, slot) => {
      const meal = getMealForSlot(date, slot);
      if (!meal) return false;
      const whoList = meal.who || [];
      // Check if every person in props.people is in the meal's who list
      return props.people.length > 0 && props.people.every(p => whoList.includes(p));
  };
  
  const openAssignDialog = (date, slot) => {
      // Default to everyone in the family list
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
    <v-card class="fill-height" elevation="2">
      <v-card-title class="d-flex justify-space-between align-center bg-blue-grey-lighten-5">
        Meal Library
        <v-btn color="primary" size="small" icon="mdi-plus" @click="openDialog()"></v-btn>
      </v-card-title>
      <v-list class="overflow-y-auto" style="max-height: 700px">
        <v-list-item v-for="meal in meals" :key="meal.id" lines="two">
          <v-list-item-title class="font-weight-bold">{{ meal.name }}</v-list-item-title>
          <v-list-item-subtitle>{{ meal.description }}</v-list-item-subtitle>
          <template v-slot:append>
            <div class="d-flex align-center">
              <v-btn icon="mdi-pencil" size="small" variant="text" color="grey" @click="openDialog(meal)"></v-btn>
              <v-btn icon="mdi-delete" size="small" color="error" variant="text" @click="deleteMeal(meal.id)"></v-btn>
            </div>
          </template>
        </v-list-item>
      </v-list>
    </v-card>
  </v-col>

  <v-col cols="12" md="8">
    <v-card>
      <v-card-title class="d-flex align-center justify-space-between bg-primary text-white">
        <v-btn icon="mdi-chevron-left" variant="text" color="white" @click="changeWeek(-1)"></v-btn>
        <span>Week of {{ weekDates[0].date }}</span>
        <v-btn icon="mdi-chevron-right" variant="text" color="white" @click="changeWeek(1)"></v-btn>
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
                      <div v-for="slot in slots" :key="slot" class="d-flex align-center border-b py-1" style="min-height: 40px;">
                          <div style="width: 100px;" class="d-flex align-center pl-2">
                              <span class="text-caption font-weight-bold text-medium-emphasis mr-1">{{ slot }}</span>
                              <v-icon v-if="isSlotComplete(day.date, slot)" color="green" size="small">mdi-check-circle</v-icon>
                          </div>
                          
                          <div class="flex-grow-1">
                              <template v-if="getMealForSlot(day.date, slot)">
                                  <div class="d-flex align-center justify-space-between px-2 rounded bg-blue-grey-lighten-5 ma-1">
                                      <div>
                                          <span class="text-body-2 font-weight-bold mr-2">{{ getMealForSlot(day.date, slot).name }}</span>
                                          <v-chip v-for="p in getMealForSlot(day.date, slot).who" :key="p" size="x-small" density="compact" class="mr-1" style="height: 18px;">{{ p }}</v-chip>
                                      </div>
                                      <v-btn icon="mdi-close" size="x-small" variant="text" color="grey" @click="removeAssignment(getMealForSlot(day.date, slot).id)"></v-btn>
                                  </div>
                              </template>
                              <template v-else>
                                  <v-btn size="x-small" variant="text" color="grey" class="ml-2" @click="openAssignDialog(day.date, slot)">+ Add</v-btn>
                              </template>
                          </div>
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
              :items="meals" 
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
</template>