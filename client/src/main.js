import './assets/base.css'
import VueApexCharts from 'vue3-apexcharts'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'

import App from './App.vue'
import router from './router'

const pinia = createPinia()
const app = createApp(App)

app.use(VueApexCharts)
app.component('apexchart', VueApexCharts) // 🔥 INI YANG KURANG

app.use(pinia)
pinia.use(piniaPluginPersistedstate)

app.use(router)

app.mount('#app')