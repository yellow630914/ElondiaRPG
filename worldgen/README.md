# 世界生成（給 Agent）

> 這個資料夾教 Agent（或玩家）用填空與指南生成一整個世界的人事物：怪物、物品、技能、狀態、特質、地標、特殊地圖、商店、固定 NPC、特殊任務、事件，以及配套的世界書與提示詞。
> 遊戲系統的規則在 [`docs/`](../docs/README.md)；這裡的指南只講「怎麼寫出內容」，規則需要時指過去。計畫見 [PLAN](PLAN.md)。

## 0. 守則（一定要遵守）

1. **只產出檔案**：所有產出放在 `worldgen/worlds/<世界的英文代號>/`。**不要改 `data/`、`src/`、`docs/`**，也不要改別的世界的資料夾。
2. **一律做成新的世界**：產出的是「世界包」（見 [guides/content-file.md](guides/content-file.md)），玩家在遊戲裡用「🌍 世界 → 📥 匯入成新的世界」載入。內建的原版世界與玩家其他的世界不會被動到；玩壞了刪掉那個世界就好。
3. **每改一次就檢查一次**：`WORLD=worldgen/worlds/<代號>/world.json npx vitest run src/__tests__/worldCheck.spec.ts`，看同一個資料夾的 `check-report.md`。**錯誤要修到 0**；「整理時改了」的提醒也要處理（那代表寫錯了，匯入時被默默改掉）。流程見 [balance/README.md](balance/README.md)。
4. **新內容一律 `"custom": true`**，id 照各指南的規則（`mod_<種類>_<英文小寫>`、地標 `lm_`、特殊地圖 `sm_`、商店 `shop_`）。改內建的項目時用原本的 id、不加 `custom`；能新增就不要改內建的。
5. **地圖是固定的**：地點、路線、地區、城鎮區塊、職業與種族目前不能新增或修改（[PLAN](PLAN.md) 決定 1）。所有內容都要放在現有的地點上；地點 id 查 `data/world/geography.json`。
6. **世界書是設定的來源**：動筆前先讀 `data/worldbook/elondia.worldbook.json` 相關的條目（地區、種族、勢力、神祇），內容不能和它矛盾；新增的設定最後要寫回世界書（[design/worldbook-and-prompts.md](design/worldbook-and-prompts.md)）。

## 1. 閱讀順序

| 要做的事 | 先讀 |
|---|---|
| 從頭生成一個世界 | [WORLD_GUIDE.md](WORLD_GUIDE.md)（依序生成的步驟）＋ [templates/world-template.md](templates/world-template.md)（玩家填的設定）；範例 [worlds/elondia-plus](worlds/elondia-plus/README.md) |
| 新增或修改某一種內容 | `guides/` 對應的那一份（格式、欄位、範圍、範例） |
| 檢查平衡 | [balance/README.md](balance/README.md)，再看對應的那一份 |
| 設計固定 NPC | [design/npc-design.md](design/npc-design.md) |
| 設計特殊任務 | [design/story-design.md](design/story-design.md) |
| 世界書與提示詞 | [design/worldbook-and-prompts.md](design/worldbook-and-prompts.md) |

## 2. 指南

**新增編輯指南**（`guides/`）：

| 內容 | 指南 |
|---|---|
| 檔案格式、id、引用的先後、匯入 | [content-file.md](guides/content-file.md) |
| 怪物 | [monsters.md](guides/monsters.md) |
| 物品、底材、材料 | [items-gear.md](guides/items-gear.md) |
| 技能（玩家與怪物） | [abilities.md](guides/abilities.md) |
| 狀態、特質、刺青與印記 | [statuses-perks-tattoos.md](guides/statuses-perks-tattoos.md) |
| 固定 NPC | [npcs.md](guides/npcs.md) |
| 特殊任務 | [stories.md](guides/stories.md) |
| 地標 | [landmarks.md](guides/landmarks.md) |
| 特殊地圖 | [special-maps.md](guides/special-maps.md) |
| 商店 | [shops.md](guides/shops.md) |
| 旅途與城鎮事件 | [events.md](guides/events.md) |

**平衡性測試**（`balance/`）：[README（自檢流程）](balance/README.md)、[怪物](balance/monsters.md)、[物品](balance/items.md)、[技能](balance/abilities.md)、[狀態、特質、刺青](balance/statuses-perks-tattoos.md)、[經濟與報酬](balance/economy.md)、[特殊任務](balance/stories.md)。

## 3. 完成前的檢查清單

- [ ] 所有產出都在 `worldgen/worlds/<代號>/`，沒有改到 `data/`、`src/`、`docs/`
- [ ] `world.json` 是世界包格式，`name` 是玩家看得懂的世界名稱
- [ ] 世界檢查沒有錯誤；「整理時改了」的提醒都處理掉了
- [ ] 每隻新怪物都有出現地點（或特殊任務用到），每位固定 NPC 都找得到（活躍地點、固定格子、地標或店）
- [ ] 每條特殊任務都有開頭的方式、會完成，旗標前後接得起來
- [ ] 新的人物、地點、勢力、傳聞都寫進了世界書（提示詞），沒有和原本的設定矛盾
- [ ] 資料夾裡有規劃（`plan.md`）、規劃清單（`npcs.md`、`stories.md`……）與 `check-report.md`，方便玩家看懂這個世界多了什麼
- [ ] 大量的內容由 `scripts/` 的腳本產生，重跑腳本與 `build-world.mjs` 能得到同一份 `world.json`
