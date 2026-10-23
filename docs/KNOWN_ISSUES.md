# 程式中發現的問題

> 2026-10 整理文件時，對照程式碼發現的 Bug 與業務邏輯上不合理的地方。和 [OPEN_QUESTIONS](OPEN_QUESTIONS.md)（原本就列在文件裡的待決定事項）分開。
> 文件已經照**程式現在的行為**寫；這裡記的是程式本身可能要改的地方。修好之後從這裡刪掉，並更新對應的系統文件。

## 1. Bug

目前沒有。

## 2. 業務邏輯不合理

目前沒有。

## 3. 需要你判斷是不是 Bug

| # | 問題 | 說明 | 位置 |
|---|---|---|---|
| Q2 | **世界書「价格参考-货币体系」永遠不會注入** | 它在世界書裡是常駐、沒有關鍵字，卻沒有列進常駐名單，落到關鍵字模式就永遠不觸發。可能是刻意的（貨幣說明由規則的 `{{currency}}` 提供） | `narrator/lore.ts` |
| Q3 | **字型從 Google Fonts 載入，而且會擋住畫面** | 介面 v2 在 `index.html` 用一般的 `<link rel="stylesheet">` 載入 Noto Serif TC 與霞鶩文楷：連不上 Google（中國大陸的使用者、或網路慢）時整個畫面要等到請求逾時才出現；每次開啟也都會連到 Google，和「請求只送到你選的服務」的說法不一致。[UI_V2_PLAN](UI_V2_PLAN.md) 決定不打包中文字型（10 MB 以上），但「沒網路時退回系統字型」只在請求很快失敗時成立。至少可以改成不阻擋的載入方式（`media="print" onload="this.media='all'"`） | `index.html` |
| Q4 | **上傳的圖示會讓每個存檔都變大** | 存檔欄位附帶整份世界的自訂內容（`stores/game.ts` 的 `currentContent()`），上傳的圖示（每張最多 16 KB 的 data URL）也在裡面：100 張圖示時每個手動存檔、快速存檔與自動存檔各多約 1 MB，用 localStorage 存檔時很快就滿。可以只在存檔裡記世界 id、世界在時不帶圖示，或把圖示另外存一份 | `stores/game.ts`、`engine/itemIcons.ts` |

## 4. 可以清理的

- 舊的 `travel()`（`travel.ts`）正式流程已不用，只剩測試在用；它的 `EVENT_CHANCE`（官道 0.15）和 `travel_events.json` 的 `chance`（官道 0.3）不同，容易誤導。
- 沒有被讀取的設定：`economy.json` 的 `price_variance.quest_reward`、`npc_population.json` 的 `known_weight`（`data.ts` 型別裡有，程式沒用）。
- 過時的程式註解：`road.ts` 開頭（說其他路段吃乾糧、沒乾糧會挨餓）、`travel.ts` 開頭（「遭遇戰留待之後實作」）、`crafting.ts` 開頭（「五種工藝」「之後的房屋系統」）。
- 世界編輯器的「🖼️ 類別圖示」是用一個假的物品列（key `|icons`）接進物品列表的，選取、複製、篩選都要特別略過它；可以改成物品頁的獨立分頁（`ContentView.vue`）。
- MONSTERS、ITEMS、COMBAT_SYSTEM 第 9 節是資料檔的複本，沒有產生腳本；這次比對都一致，但之後改資料容易忘記同步。可以補一支產生腳本，或改成只列重點、其餘看資料檔。
