import { readdirSync, readFileSync } from 'node:fs'
import { availableParallelism } from 'node:os'
import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config.ts'

// 測試分兩組並行跑：
// - isolated：每個檔案自己載入一份模組（原本的作法）。用 vi.mock 換模組、用到 Pinia store、瀏覽器儲存（localStorage、IndexedDB）
//   或掛載元件的測試，這些狀態留在模組裡，混在一起會互相影響。
// - shared：其他（純引擎）測試在同一個 worker 裡共用已經載入的模組（isolate: false），省掉每個檔案重新載入引擎與資料的時間。
//   每個檔案開始前 src/__tests__/setup/resetGlobals.ts 把引擎的全域設定還原；新的全域設定（模組層級的 let 與 set 函式）要加進那裡。
// 分組依檔案內容自動判斷（ISOLATED_MARKERS），新的測試不用手動登記；真的需要時再加進 ALSO_ISOLATED。
const TESTS = 'src/__tests__'
const ISOLATED_MARKERS = /vi\.(mock|doMock)\(|@\/stores|indexedDB|fake-indexeddb|localStorage|sessionStorage|@vue\/test-utils|\.vue'/
// 檔案裡的測試互相依賴全域狀態（例如提示詞組的預設內容）
const ALSO_ISOLATED = ['prompts.spec.ts']
const ISOLATED = readdirSync(TESTS)
  .filter((f) => /\.(spec|test)\.ts$/.test(f) && (ALSO_ISOLATED.includes(f) || ISOLATED_MARKERS.test(readFileSync(`${TESTS}/${f}`, 'utf8'))))
  .map((f) => `${TESTS}/${f}`)
const exclude = [...configDefaults.exclude, 'e2e/**']

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'happy-dom',
      // 發布流程（GitHub Actions）的機器比較慢：走遍城鎮、模擬平衡這類較重的測試在本機 2～3 秒，在那裡會超過預設的 5 秒
      testTimeout: 30_000,
      // 用滿所有核心（預設少留一個）：測試多半在等載入，本機與 GitHub Actions（4 核）都快一些
      maxWorkers: availableParallelism(),
      exclude,
      root: fileURLToPath(new URL('./', import.meta.url)),
      projects: [
        { extends: true, test: { name: 'isolated', include: ISOLATED } },
        { extends: true, test: { name: 'shared', isolate: false, exclude: [...exclude, ...ISOLATED], setupFiles: ['src/__tests__/setup/resetGlobals.ts'] } },
      ],
    },
  }),
)
