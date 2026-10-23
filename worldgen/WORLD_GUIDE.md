# 世界生成指南

> 給 Agent：照這份的順序，把玩家填好的 [世界生成模板](templates/world-template.md) 變成一個可以匯入的世界包。每一步都指向對應的指南；系統規則在 [`docs/`](../docs/README.md)。
> 動手前先讀 [README](README.md) 第 0 節的守則：**只在 `worldgen/worlds/<代號>/` 裡產出檔案，一律做成新的世界，不改 `data/`、`src/`、`docs/`。**
> 完整的範例是 [艾隆迪亞擴充](worlds/elondia-plus/)：85 位固定 NPC、37 條特殊任務、7 條改寫與 17 條新增的世界書條目，全部用腳本產生。

## 0. 準備

1. **建立資料夾**：
   ```
   worldgen/worlds/<代號>/
     setting.md       玩家填好的模板（從 templates/world-template.md 複製）
     plan.md          世界規劃（第 1 步產出）
     npcs.md          固定 NPC 規劃清單
     stories.md       特殊任務規劃清單
     parts/           資料分檔：meta.json、prompts.json、其他 <區塊>-<主題>.json
     scripts/         產生 parts 的腳本（建議）
     world.json       build-world.mjs 合併出來的世界包（不要手改）
     check-report.md  世界檢查的報告
   ```
2. **`parts/meta.json`**：`{ "name": "<世界的名稱>", "desc": "<一句話簡介>" }`。
3. **先跑一次空的檢查**，確認工具能用：
   ```
   node worldgen/tools/build-world.mjs <代號>
   WORLD=worldgen/worlds/<代號>/world.json WORLD_TRIALS=6 npx vitest run src/__tests__/worldCheck.spec.ts
   ```

`parts/` 的每個檔案是 `{ "<區塊>": { "<id>": {...} } }`（例如 `parts/npcs-north.json` 放 `{ "npcs": {...} }`），同一個區塊可以分在好幾個檔案；`build-world.mjs` 依檔名順序合併，id 重複時停下來。**大量的內容用腳本產生**（Python 或 Node 都可以），規劃清單也從同一份資料產生，兩邊才不會不一致。

## 1. 讀設定，寫世界規劃

| 讀 | 要拿到的 |
|---|---|
| `setting.md`（玩家填的） | 基調、規模、指定的人與事、主線、不要的東西 |
| `data/worldbook/elondia.worldbook.json` | 地區、種族、勢力、神祇、巨龍；世界書已有名字的人物 |
| `data/world/geography.json` | 地點 id 與類型、地區、勢力 id |
| `data/world/landmarks.json`、`data/world/npcs.json`、`data/rules/enemies.json` | 已有的地標、固定 NPC、每座地下城每一層的怪物 |

產出 `plan.md`：

- 這個世界和原版的差別（時代、大事件、改寫的設定）。
- 每一種內容要做多少（照模板第 1 節的規模表），以及每個地區分到什麼。
- 主線的大綱：幾章、每章在哪個地區、哪個階級。
- **假設**：玩家沒填、由你決定的事，逐條列出。

**把 `plan.md` 給玩家看，確認後再往下做。** 玩家改了方向，先改 `plan.md`。

## 2. 依序生成

順序照「被引用的先做」（[content-file](guides/content-file.md) 第 3 節）。用不到的步驟跳過；**每一步做完都要合併、跑檢查，錯誤修到 0 再做下一步。**

| # | 做什麼 | 指南 | 平衡 | 產出 |
|---|---|---|---|---|
| 1 | 狀態、刺青與印記、特質（新的技能、物品、NPC 要用到的才做） | [statuses-perks-tattoos](guides/statuses-perks-tattoos.md) | [statuses-perks-tattoos](balance/statuses-perks-tattoos.md) | `parts/statuses.json`、`tattoos.json`、`perks.json` |
| 2 | 技能（玩家與怪物；怪物的技能要在怪物之前） | [abilities](guides/abilities.md) | [abilities](balance/abilities.md) | `parts/abilities.json` |
| 3 | 材料、底材、物品（獨特物品、任務道具、掉落物） | [items-gear](guides/items-gear.md) | [items](balance/items.md)、[economy](balance/economy.md) | `parts/items.json`…… |
| 4 | 怪物，以及牠們出現的地方（地下城的層、野外的群組） | [monsters](guides/monsters.md) | [monsters](balance/monsters.md) | `parts/enemies-<地區>.json` |
| 5 | 地標、特殊地圖、商店 | [landmarks](guides/landmarks.md)、[special-maps](guides/special-maps.md)、[shops](guides/shops.md) | [economy](balance/economy.md) | `parts/landmarks.json`…… |
| 6 | 固定 NPC：先寫 `npcs.md` 給玩家看，再做成資料 | [design/npc-design](design/npc-design.md)、[npcs](guides/npcs.md) | | `parts/npcs-<地區>.json` |
| 7 | 特殊任務：先寫 `stories.md` 給玩家看，再做成資料 | [design/story-design](design/story-design.md)、[stories](guides/stories.md) | [stories](balance/stories.md) | `parts/stories.json` |
| 8 | 旅途與城鎮事件 | [events](guides/events.md) | [economy](balance/economy.md) | `parts/events.json` |
| 9 | 世界書與提示詞：把第 1～8 步新增的人、事、地寫回世界書 | [design/worldbook-and-prompts](design/worldbook-and-prompts.md) | | `parts/prompts.json` |

說明：

- **第 6、7 步最花時間**，也是世界的骨架：統治者、機構首長、地標人物、鄉間人物，然後是主線、地區故事線、角色任務線、地下城傳說、獨特物品任務。玩家指定的人與事先放進清單。
- **NPC 與任務會用到第 1～5 步的東西**（NPC 的特質與裝備、任務的怪物與物品與地圖）。做第 6、7 步時發現缺東西，回到前面的步驟補，再重新合併。
- **第 9 步一定要做**：沒有寫回世界書，AI 敘事時不會知道誰是國王、哪裡在鬧事。

## 3. 每一步的檢查

```
node worldgen/tools/build-world.mjs <代號>
WORLD=worldgen/worlds/<代號>/world.json WORLD_TRIALS=6 npx vitest run src/__tests__/worldCheck.spec.ts
```

讀 `check-report.md`（[balance/README](balance/README.md)）：

- **錯誤**修到 0：有錯誤的特殊任務整條不會匯入；引用不存在的東西會被拿掉。
- **「整理時改了」**一定要處理：代表寫錯了欄位或值，匯入時被默默改掉。
- 其他提醒逐條判斷；決定保留的，寫進 `plan.md` 的「已知的提醒」並說明理由。

## 4. 交付

1. 用預設的 20 場戰鬥模擬再跑一次檢查（拿掉 `WORLD_TRIALS`），以這次的報告為準。
2. 對照 [README](README.md) 第 3 節的檢查清單。
3. 告訴玩家：
   - 世界包的位置：`worldgen/worlds/<代號>/world.json`
   - 匯入方式：遊戲首頁「🌍 世界管理」→「📥 匯入成新的世界」，選這個檔案；會同時建立一組同名的提示詞並綁定。開新遊戲時選這個世界。
   - 這個世界多了什麼（數量、主線的開頭在哪裡），以及 `plan.md` 裡的假設與保留的提醒。
4. 玩家試玩後要改：改 `parts/`（或腳本）→ 合併 → 檢查 → 重新匯入成新的世界（舊的刪掉）。玩家在遊戲裡直接改過的，請他用「📦 匯出世界包」匯出，拿回來和 `parts/` 比對。

## 5. 常見的錯

| 錯 | 結果 | 怎麼避免 |
|---|---|---|
| 改了 `data/` 或 `src/` | 原版世界壞掉，遊戲可能跑不起來 | 只在 `worlds/<代號>/` 產出；改內建的東西用世界包裡的同 id 項目 |
| 引用不存在的 id（地點、地標、怪物、NPC） | 匯入時被默默拿掉，任務接不起來 | 先做被引用的；查 `data/` 的 id；看報告的「整理時改了」 |
| 任務的旗標前後接不上、`manual` 的任務沒有人開啟 | 任務永遠做不完 | [design/story-design](design/story-design.md) 第 7 節的檢查清單 |
| 戰鬥任務點用了那一層沒有的怪、等級對不上階級 | 太難或太簡單 | [balance/stories](balance/stories.md) |
| 統治者可以被雇用 | 國王跟著玩家去挖礦 | A、B 層加 `unhireable` |
| 只做資料、沒寫世界書 | AI 不知道新的人與事，敘事和資料對不起來 | 第 2 節第 9 步 |
| 手抄內建世界書的原文再改寫 | 抄錯的地方原本的設定就不見了 | 用腳本從 `elondia.worldbook.json` 讀原文再接上新段落 |
| 引擎目前做不到的寫法 | 匯入時被拿掉，或執行時沒有效果 | 見 [docs/KNOWN_ISSUES](../docs/KNOWN_ISSUES.md) 第 5 節「自訂內容與世界包的問題」 |
