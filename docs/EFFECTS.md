# 效果（報酬／後果模板）

> 上層：[GAME_DESIGN](GAME_DESIGN.md)。被依賴：主動行動（[ACTIONS](ACTIONS.md)）、公會委託（[GUILD](GUILD.md)）、特殊任務（[STORY_QUESTS](STORY_QUESTS.md)）、交易清單與談判（[TRADE](TRADE.md)）、主人的突發事件（[COMPANIONS](COMPANIONS.md) 2.4 節）、旅途事件（[TRAVEL_EVENTS](TRAVEL_EVENTS.md)）。
> 程式：`src/engine/effects.ts`（`RewardEffect`、`applyEffects`）。

事件、委託、交易與主動行動的結果都用同一組「效果」描述，可以任意組合。`applyEffects` 在報告提交前呼叫：金錢、物品、親密度、聲望、經驗、旗標寫進 `report.changes`，由 `commitReport` 套用；入隊、離隊、狀態、生命值等直接修改狀態，並記錄在 `report.changes`。**數值上限由呼叫端負責夾住**（例如主動行動的 caps，見 [ACTIONS](ACTIONS.md) 第 4 節）。

## 1. 效果種類

| 種類 | 說明 |
|---|---|
| `money` | 金錢（白鸛幣），負數為花費 |
| `item` | 物品；qty 負數為失去 |
| `gear` | 裝備：`spec`（底材 × 材料＋稀有度與附魔，已依 `gear.json` 整理）與選填的 `name`、`desc`；新的裝備登錄在存檔的 `customItems`，制式品沿用目錄名稱（見 [ITEMS](ITEMS.md)） |
| `affinity` | 某人的親密度增減 |
| `reputation` | 勢力聲望 |
| `xp` | 經驗值（全隊或指定成員） |
| `flag` | 劇情旗標 |
| `quest_reward` | 委託報酬按百分比調整（談判的結果） |
| `quest_flag` | 委託的任務旗標，例如 `lead`（委託檢定 +5）、`suspicious`（−2）、`negotiated` |
| `ability` | 技能報酬：學會新能力。可指定能力（id 或名稱，必須是目前可以學的，否則隨機挑一項）、給一次「N 選一」的學習機會（`choices`），或加上取得機率（`chance`）。記錄在報告的 `skills_gained`，來源為 `insight` |
| `companion` | 新增夥伴：`voluntary` 自願、`hired` 雇傭、`slave` 奴隸（可指定契約）。對象可以是已登場的 NPC，也可以是一份規格（名字、種族、職業、等級……），程式會生成並登錄。隊伍滿了時不會出錯，報告註明「想加入，但隊伍已滿」 |
| `join_party` | 主角加入別人的隊伍（隊長、隊員，可附簽約金） |
| `leave` | 某人離隊 |
| `meet` | 認識新的人（例如同旅館的旅客）：登錄 NPC、建立人際關係，平常待在 `spot` |
| `relationship_text` | 「與主角的關係」文字；預設是提議，玩家確認後才寫入 |
| `memory` | 新增一筆共同記憶 |
| `condition` | 非戰鬥狀態（奴隸印記、逃亡、受罰、用餐……）的增減 |
| `hp` | 生命值增減（點數或比例；不會因此倒下，至少留 1 點） |
| `slot` | 法術環：`delta` 負數花掉（至少 `circle` 環，用最低的）、正數回復（不超過 `circle` 環） |
| `hit_dice` | 生命骰：`delta` 負數花掉、正數回復 |
| `intel` | 情報：在近郊或地下城的某一層放一個事件點，記在冒險筆記（見 [TRAVEL_EVENTS](TRAVEL_EVENTS.md) 第 5 節） |
| `start_story` | 開始一個特殊任務 |
| `enslave_player` | 主角淪為奴隸（只有特殊任務能用；見 [STORY_QUESTS](STORY_QUESTS.md)） |
| `mark` | 刻印時提議的印記名稱與描述（只是文字，數值依模板） |
| `free` | 解除契約：`npc` 為 `pc` 時是主角獲釋 |
| `change_master` | 替換主角的主人（印記沿用）；`master` 為 `null` 時變成無主 |
| `master_home` | 主人把主角帶回主人的家（主人的事件用） |
| `strict` | 嚴加看管的點數，正數加重、負數放寬（主人的事件用） |
| `home_extend` | 離家期限延長幾小時（主人的事件用） |

完整清單是 `effects.ts` 的 `EFFECT_TYPES`；特殊任務編輯器只開放其中一部分（見 [STORY_QUESTS](STORY_QUESTS.md) 第 2 節）。

## 2. 例

委託報酬「80 白鸛＋傷藥 2 瓶＋委託人好感 +5＋獵戶自願入隊」：

```json
[
  { "type": "money", "amount": 80 },
  { "type": "item", "name": "傷藥", "qty": 2 },
  { "type": "affinity", "npc": "gen_3", "delta": 5 },
  { "type": "companion", "npc": { "name": "獵戶托比", "race": "human", "class": "ranger", "level": 2 }, "mode": "voluntary" }
]
```

## 3. 誰在用

- **公會委託**：交付時用這個模板；`town_quests.json` 的範本可以加 `rewards` 給額外報酬。目前「夜間巡邏」「偵查商道」有 15% 機率領悟新能力，「討伐哥布林」有 20% 機率得到一次三選一的學習機會。
- **主動行動**：AI 可以提出的效果依行動種類限定（`actions.json` 各 kind 的 `effects`）；AI 判定為大成功時可以給一項技能報酬（例如向高手請教）。
- **交易與談判**：交易清單的「得到」、談判各成功程度的結果（見 [TRADE](TRADE.md)）。
- **特殊任務**：任務點的結果與完成報酬。
- **主人的突發事件**：選項的結果（`slavery.json` 的 `master_events`）。
