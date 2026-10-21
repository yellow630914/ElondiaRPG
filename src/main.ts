import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { initContent } from './stores/content'
import { preloadCurrent } from './stores/saves'
import './style.css'

// 自訂內容（怪物、物品、裝備）要在讀檔之前套用
initContent()

// 進行中的遊戲存在 IndexedDB（非同步），讀出來之後才掛上畫面
void preloadCurrent().finally(() => {
  const app = createApp(App)
  app.use(createPinia())
  app.mount('#app')
})
