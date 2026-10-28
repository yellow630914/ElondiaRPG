# 未來計畫

> 上層：[計畫與追蹤](README.md)。
> 這裡記**已經決定要做**、還沒做完的事，包括不影響遊戲的程式整理。還沒決定要不要做的構想放在 [點子庫](ideas/README.md)。
> 做完之後從這裡刪掉，在 [README](README.md) 的「完成紀錄」記一行；新增的功能同時寫進 [CHANGELOG](../../CHANGELOG.md) 的「未發布」。

## 1. 遊戲

| # | 項目 | 現況 | 相關文件 |
|---|---|---|---|
| R1（原 D1） | **數值平衡**：生命值、行動點、傷害、經驗值、報酬 | 都是起始值，要實際遊玩後調整（高階委託的問題見 [LOGIC_ISSUES](LOGIC_ISSUES.md) L1） | [GAME_DESIGN](../GAME_DESIGN.md)、[worldgen/balance/](../../worldgen/balance/README.md) |

## 2. 介面

| # | 項目 | 現況 | 相關文件 |
|---|---|---|---|
| R2 | **UI v2 剩下的部分** | P0～P5、P7 已完成；P6 模組化像素立繪擱置；地圖格要不要改用 ComfyUI 生成的 tileset 還沒決定 | [UI_V2_PLAN](UI_V2_PLAN.md)、[comfy/portrait-spec.md](../comfy/portrait-spec.md) |

## 3. 程式整理

不影響遊戲行為，有空時處理：

| # | 項目 | 說明 |
|---|---|---|
| R3 | 拿掉舊的 `travel()` | `travel.ts` 的 `travel()` 正式流程已不用，只剩測試在用；它的 `EVENT_CHANCE`（官道 0.15）和 `travel_events.json` 的 `chance`（官道 0.3）不同，容易誤導 |
| R4 | 拿掉沒有被讀取的設定 | `economy.json` 的 `price_variance.quest_reward`、`npc_population.json` 的 `known_weight`（`data.ts` 型別裡有，程式沒用） |
| R5 | 更新過時的程式註解 | `road.ts` 開頭（說其他路段吃乾糧、沒乾糧會挨餓）、`travel.ts` 開頭（「遭遇戰留待之後實作」）、`crafting.ts` 開頭（「五種工藝」「之後的房屋系統」） |
| R6 | 世界編輯器的「🖼️ 類別圖示」改成獨立分頁 | 現在是用一個假的物品列（key `\|icons`）接進物品列表，選取、複製、篩選都要特別略過它（`ContentView.vue`） |
| R7 | 資料整理型文件的產生腳本 | MONSTERS、ITEMS、COMBAT_SYSTEM 第 9 節是資料檔的複本，沒有產生腳本，改資料容易忘記同步；補一支產生腳本，或改成只列重點、其餘看資料檔 |
