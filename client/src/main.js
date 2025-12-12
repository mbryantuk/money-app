import { createApp } from 'vue'
import { createPinia } from 'pinia' // [!code ++]
import router from './router' // [!code ++]
import './style.css'
import App from './App.vue'

// Vuetify
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { aliases, mdi } from 'vuetify/iconsets/mdi'
import '@mdi/font/css/materialdesignicons.css'

const vuetify = createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: 'light',
    themes: {
      light: { colors: { primary: '#1976D2', secondary: '#424242' } },
      dark: { colors: { primary: '#2196F3', secondary: '#424242' } },
    },
  },
  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: { mdi },
  },
})

const app = createApp(App)

app.use(createPinia()) // [!code ++]
app.use(router) // [!code ++]
app.use(vuetify)

app.mount('#app')