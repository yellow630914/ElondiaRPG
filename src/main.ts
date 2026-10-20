import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { initContent } from './stores/content'
import './style.css'

// 自訂內容（怪物、物品、裝備）要在讀檔之前套用
initContent()

const app = createApp(App)

app.use(createPinia())

app.mount('#app')
