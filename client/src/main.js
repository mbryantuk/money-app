import { createApp } from 'vue'
import App from './App.vue'

// Vuetify
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import { md3 } from 'vuetify/blueprints' 
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import '@mdi/font/css/materialdesignicons.css'

// Official Dracula Palette: https://draculatheme.com/contribute#color-palette
const dracula = {
    dark: true,
    colors: {
        background: '#282a36', // Background
        surface: '#44475a',    // Current Line / Surface
        primary: '#bd93f9',    // Purple
        secondary: '#6272a4',  // Comment
        error: '#ff5555',      // Red
        info: '#8be9fd',       // Cyan
        success: '#50fa7b',    // Green
        warning: '#ffb86c',    // Orange
        'on-background': '#f8f8f2', // Foreground
        'on-surface': '#f8f8f2',
    }
}

// Alucard (Light version of Dracula)
const alucard = {
    dark: false,
    colors: {
        background: '#f8f8f2', // Dracula Foreground becomes Light Background
        surface: '#ffffff',    // White surface for cards creates depth against off-white BG
        primary: '#bd93f9',    // Purple (Keep consistent)
        secondary: '#6272a4',  // Comment
        error: '#ff5555',      // Red
        info: '#8be9fd',       // Cyan
        success: '#50fa7b',    // Green
        warning: '#ffb86c',    // Orange
        'on-background': '#282a36', // Dracula Background becomes Text Color
        'on-surface': '#282a36',
    }
}

const vuetify = createVuetify({
  blueprint: md3, 
  components,
  directives,
  theme: {
    defaultTheme: 'alucard',
    themes: {
      alucard,
      dracula,
    }
  }
})

createApp(App).use(vuetify).mount('#app')