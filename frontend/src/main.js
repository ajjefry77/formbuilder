import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router/index.js'
import './style.css'

// Import Iconify
import { Icon } from '@iconify/vue'

const app = createApp(App)

app.use(createPinia())
app.use(router)

// ثبت کامپوننت Iconify به صورت جهانی
app.component('Icon', Icon)

app.mount('#app')