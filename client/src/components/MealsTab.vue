<script setup>
    import { ref, onMounted, computed } from 'vue';
    import axios from 'axios';
    
    // State
    const meals = ref([]);
    const plan = ref([]);
    const people = ref([]);
    const dialog = ref(false);
    const weekOffset = ref(0);
    
    // Editing Meal State
    const editedItem = ref({ id: null, name: '', description: '', tags: [] });
    const defaultItem = { id: null, name: '', description: '', tags: [] };
    
    // Fetch Data
    const fetchData = async () => {
      try {
        const [mealsRes, settingsRes] = await Promise.all([
          axios.get('/api/meals'),
          axios.get('/api/settings')
        ]);
        meals.value = mealsRes.data || [];
        const settings = settingsRes.data || {};
        if (settings.people) people.value = JSON.parse(settings.people);
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
      
      // Apply Offset
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
    const getMealForDate = (date) => {
      return plan.value.find(p => p.date === date);
    };
    
    const assignMeal = async (date, mealId) => {
      if (!mealId) return;
      await axios.post('/api/meal-plan', { date, meal_id: mealId });
      fetchPlan();
    };
    
    const clearDay = async (date) => {
      await axios.delete(`/api/meal-plan?date=${date}`);
      fetchPlan();
    };
    
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
      if (confirm("Delete this meal?")) {
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
          <v-card class="fill-height">
            <v-card-title class="d-flex justify-space-between align-center">
              Meal Library
              <v-btn color="primary" size="small" icon="mdi-plus" @click="openDialog()"></v-btn>
            </v-card-title>
            <v-divider></v-divider>
            <v-list class="overflow-y-auto" style="max-height: 600px">
              <v-list-item v-for="meal in meals" :key="meal.id" :title="meal.name" :subtitle="meal.description">
                <template v-slot:append>
                  <div class="d-flex align-center">
                    <v-chip v-for="tag in meal.tags" :key="tag" size="x-small" class="mr-1">{{ tag }}</v-chip>
                    <v-btn icon="mdi-pencil" size="small" variant="text" @click="openDialog(meal)"></v-btn>
                    <v-btn icon="mdi-delete" size="small" color="error" variant="text" @click="deleteMeal(meal.id)"></v-btn>
                  </div>
                </template>
              </v-list-item>
            </v-list>
          </v-card>
        </v-col>
    
        <v-col cols="12" md="8">
          <v-card>
            <v-card-title class="d-flex align-center justify-space-between">
              <v-btn icon="mdi-chevron-left" variant="text" @click="changeWeek(-1)"></v-btn>
              <span>Week of {{ weekDates[0].date }}</span>
              <v-btn icon="mdi-chevron-right" variant="text" @click="changeWeek(1)"></v-btn>
            </v-card-title>
            <v-divider></v-divider>
            <v-row dense class="pa-2">
              <v-col cols="12" v-for="day in weekDates" :key="day.date">
                <v-card variant="outlined" class="d-flex align-center pa-2">
                  <div style="width: 100px" class="text-subtitle-1 font-weight-bold">
                    {{ day.name }} <br/>
                    <span class="text-caption">{{ day.date.slice(5) }}</span>
                  </div>
                  <div class="flex-grow-1">
                    <div v-if="getMealForDate(day.date)">
                      <div class="text-h6 text-primary">{{ getMealForDate(day.date).name }}</div>
                      <div class="text-caption">{{ getMealForDate(day.date).description }}</div>
                      <div v-if="getMealForDate(day.date).tags">
                        <v-chip v-for="t in getMealForDate(day.date).tags" :key="t" size="x-small" color="secondary" class="mr-1">{{ t }}</v-chip>
                      </div>
                    </div>
                    <div v-else class="text-grey font-italic">No meal planned</div>
                  </div>
                  <div>
                    <v-menu>
                      <template v-slot:activator="{ props }">
                        <v-btn v-bind="props" variant="text" icon="mdi-pencil"></v-btn>
                      </template>
                      <v-card width="300">
                        <v-list>
                          <v-list-item v-for="m in meals" :key="m.id" @click="assignMeal(day.date, m.id)">
                            <v-list-item-title>{{ m.name }}</v-list-item-title>
                          </v-list-item>
                        </v-list>
                      </v-card>
                    </v-menu>
                    <v-btn v-if="getMealForDate(day.date)" icon="mdi-close" color="error" variant="text" @click="clearDay(day.date)"></v-btn>
                  </div>
                </v-card>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>
    
      <v-dialog v-model="dialog" max-width="500px">
        <v-card>
          <v-card-title>{{ editedItem.id ? 'Edit' : 'New' }} Meal</v-card-title>
          <v-card-text>
            <v-text-field v-model="editedItem.name" label="Name" autofocus></v-text-field>
            <v-textarea v-model="editedItem.description" label="Description" rows="2"></v-textarea>
            <v-select v-model="editedItem.tags" :items="people" label="Tags (Family)" multiple chips></v-select>
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn color="blue-darken-1" variant="text" @click="dialog = false">Cancel</v-btn>
            <v-btn color="blue-darken-1" variant="text" @click="saveMeal">Save</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </template>