import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { initContent } from './stores/content'
import { preloadCurrent } from './stores/saves'
// 字型隨遊戲打包（不連 Google Fonts）：依 unicode-range 切片，瀏覽器只下載畫面上用到的字
import '@fontsource/noto-serif-tc/400.css'
import '@fontsource/noto-serif-tc/600.css'
import '@fontsource/noto-serif-tc/700.css'
import '@fontsource/noto-serif-tc/900.css'
// 繁體字型缺的簡體字（世界書原文、AI 用簡體寫的正文）用 Noto Serif SC 補
import '@fontsource/noto-serif-sc/400.css'
import '@fontsource/noto-serif-sc/600.css'
import '@fontsource/noto-serif-sc/700.css'
import '@fontsource/noto-serif-sc/900.css'
import '@fontsource/lxgw-wenkai-tc/400.css'
import '@fontsource/lxgw-wenkai-tc/700.css'
import './style.css'

// 自訂內容（怪物、物品、裝備）要在讀檔之前套用
initContent()

// 進行中的遊戲存在 IndexedDB（非同步），讀出來之後才掛上畫面
void preloadCurrent().finally(() => {
  const app = createApp(App)
  app.use(createPinia())
  app.mount('#app')
})
