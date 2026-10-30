# 背景圖

> 程式：`src/components/fx/backgrounds.ts`（依所在地點挑圖）、`src/components/fx/BackgroundLayer.vue`（顯示、淡入淡出）；圖：`src/assets/backgrounds/`（檔名規則見那裡的 README.md）。

## 1. 顯示

- 整頁背景放在背景氛圍（晝夜色調、地城灰塵、野外飄落物）底下；換地點、時段或地下城的層時，舊圖淡出、新圖淡入。
- 有背景圖時面板變透明（`html[data-bg]` 把 `--frame-bg` 換成不透明度 `--panel-alpha` 的顏色），四周壓暗，和介面的深咖啡色接起來。
- 「⚙️ 設定 → 畫面」：背景圖開關、亮度（20～100%，預設 60%）、面板不透明度（40～100%，預設 80%）。

## 2. 挑哪一張

依所在的區域找（前面的優先，有那張圖才用）：

| 所在 | 順序 |
|---|---|
| 聚落、房子、近郊 | `<地點>-<時段>` → `<地點>` → `region-<地區>-<時段>` → `region-<地區>` |
| 地下城 | `<地點>-<層>` → `<地點>` → 地區 |
| 特殊地圖 | `special-<地圖 id>` → 所屬地點 → 地區 |
| 旅途、臨時地圖 | 地區 |
| 首頁 | `title` → `region-central` |

時段：清晨 5～7 點（dawn）、白天 7～17（day）、黃昏 17～19（dusk）、其他是夜晚（night）。層：outskirts、shallow、middle、deep、abyss。

## 3. 目前有的圖

48 張基本版：6 個地區、26 個城鎮、16 座地下城都有（webp，1536×864，共約 8.5 MB）。時段版（`-dawn`、`-day`、`-dusk`、`-night`）與地下城的分層版（`-shallow`……）還沒有，放進來就會自動用上。特殊地圖用所屬地點的圖。

## 4. 生圖

48 個場景（6 地區、26 城鎮、16 地下城）的提示詞與 OpenRouter 生圖腳本另外整理（共用畫風：史詩奇幻概念畫、帶一點油畫筆觸、主體偏一側、中間低對比）。生好之後挑一張、照第 2 節的檔名轉成 webp 放進 `src/assets/backgrounds/`。

緋夢樂園（[LUST_PARK](LUST_PARK.md)）的 16 個場景（入口廣場 `special-sm_lust_park`、五個園區的淺層、中層、深層 `park_*-shallow` 這類）的提示詞與腳本在 `tools/backgrounds/`（見那裡的 README.md）：ComfyUI（Checkpoint、UNet、自訂工作流程，和遊戲的 ComfyUI 設定組合同一套）、NovelAI、ChatGPT（不含成人內容）三個生圖腳本，以及裁成 1536×864 webp 的 `finalize.py`。16 張都已經生成並放進 `src/assets/backgrounds/`（2026-10-30，GPT 圖片）。
