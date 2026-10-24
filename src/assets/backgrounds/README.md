# 背景圖

整頁背景（`src/components/fx/BackgroundLayer.vue`，對應規則在 `backgrounds.ts`）。檔名去掉副檔名就是 key；webp、png、jpg 都可以，建議 webp、寬 1536～1920、每張 500 KB 以內（建置時原樣打包）。

## 檔名

| 場景 | 檔名 | 例子 |
|---|---|---|
| 城鎮、地下城（地點 id，見 `data/world/geography.json`） | `<地點 id>` | `silvermoon.webp`、`quicksand_temple.webp` |
| 地區（找不到地點的圖時用） | `region-<地區 id>` | `region-forest.webp`（central、north、south、forest、east_sea、west） |
| 城鎮與地區的時段版 | `<key>-<時段>` | `soriel-night.webp`（dawn 5～7 點、day 7～17、dusk 17～19、night） |
| 地下城的分層版 | `<地點 id>-<層>` | `whisper_crypt-deep.webp`（outskirts、shallow、middle、deep、abyss） |
| 特殊地圖 | `special-<地圖 id>` | `special-sm_rhineburg_sewer.webp` |
| 首頁（還沒開始遊戲） | `title` | 沒有時用 `region-central` |

## 找圖的順序

- 聚落、房子、近郊：`<地點>-<時段>` → `<地點>` → `region-<地區>-<時段>` → `region-<地區>`
- 地下城：`<地點>-<層>` → `<地點>` → 地區
- 特殊地圖：`special-<id>` → 所屬地點 → 地區
- 旅途、旅途上的臨時地圖：地區

都沒有時不顯示背景圖。提示詞與生圖腳本見 `docs/BACKGROUNDS.md`。
