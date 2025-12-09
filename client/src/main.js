import { createApp } from 'vue'
import App from './App.vue'

// Vuetify
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import '@mdi/font/css/materialdesignicons.css'

// 🌊 Deep Ocean Theme
const myCustomTheme = {
  dark: false,
  colors: {
    background: '#F2F5F8',
    surface: '#FFFFFF',
    primary: '#1976D2',
    'primary-darken-1': '#3700B3',
    secondary: '#03DAC6',
    error: '#CF6679',
    info: '#2196F3',
    success: '#4CAF50',
    warning: '#FB8C00',
  }
}

const vuetify = createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: 'myCustomTheme',
    themes: {
      myCustomTheme,
    }
  }
})

createApp(App).use(vuetify).mount('#app')