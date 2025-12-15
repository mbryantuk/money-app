import { createApp } from 'vue'
import App from './App.vue'

// Vuetify
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import { md3 } from 'vuetify/blueprints' 
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import '@mdi/font/css/materialdesignicons.css'

const myCustomTheme = {
  dark: false,
  colors: {
    // Initial Fallback Colors (Material Blue)
    background: '#fdfbff',
    surface: '#fdfbff',
    primary: '#1976d2',
    secondary: '#555f71',
    error: '#ba1a1a',
  }
}

const vuetify = createVuetify({
  blueprint: md3, 
  components,
  directives,
  theme: {
    defaultTheme: 'myCustomTheme',
    themes: {
      myCustomTheme,
      dark: {
          dark: true,
          colors: {
              background: '#1a1c1e',
              surface: '#1a1c1e',
              primary: '#a0c9ff', // Default Dark Primary
          }
      }
    }
  }
})

createApp(App).use(vuetify).mount('#app')