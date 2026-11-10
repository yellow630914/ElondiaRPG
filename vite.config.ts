import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// 版本號（首頁與設定頁顯示）：照 package.json
const version = (JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }).version

/**
 * @fontsource 的 CSS 每個字型切片都寫了 woff2 與舊的 woff 兩個檔案；現在的瀏覽器都支援 woff2，
 * 拿掉 woff 的那一段，建置結果少一千多個檔案（約 43 MB），GitHub Pages 同步檔案才不會逾時
 */
function woff2Only(): Plugin {
  return {
    name: 'woff2-only',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('@fontsource') || !id.endsWith('.css')) return null
      return { code: code.replace(/,\s*url\([^)]+\.woff\)\s*format\('woff'\)/g, ''), map: null }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version) },
  // 相對路徑：建置結果放在任何路徑底下都能用（例如 GitHub Pages 的 https://<帳號>.github.io/ElondiaRPG/）
  base: './',
  plugins: [
    woff2Only(),
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@data': fileURLToPath(new URL('./data', import.meta.url)),
    },
  },
})
