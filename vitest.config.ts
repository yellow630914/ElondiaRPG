import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'happy-dom',
      // 發布流程（GitHub Actions）的機器比較慢：走遍城鎮、模擬平衡這類較重的測試在本機 2～3 秒，在那裡會超過預設的 5 秒
      testTimeout: 30_000,
      exclude: [...configDefaults.exclude, 'e2e/**'],
      root: fileURLToPath(new URL('./', import.meta.url)),
    },
  }),
)
