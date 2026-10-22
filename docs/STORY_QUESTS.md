# 特殊任務與劇情旗標

公會的**一般委託**由系統生成（見 [`GAME_DESIGN.md`](GAME_DESIGN.md) 第 3 節）。**特殊任務**是人工編寫的任務鏈：有故事線、固定的 NPC、獨特的報酬，要到多個地點、經過多次判定，依結果走向不同的分支。

- 資料：`data/rules/stories.json`（內建）＋「🛠️ 內容 → ⭐ 特殊任務」的自訂內容（存在瀏覽器，所有存檔共用，可以匯出、匯入）。
- 程式：`src/engine/story.ts`（進行任務）、`src/engine/storyMods.ts`（整理、檢查）、`src/engine/storyFlags.ts`（劇情旗標）。
- 內建的範例：「失竊的聖環徽記」（瑟琳），四個任務點分別示範劇情、判定、戰鬥、選擇，以及任務同行；「翻覆的篷車」示範旅途上的開頭、臨時地圖與改道（見 [`TRAVEL_EVENTS.md`](TRAVEL_EVENTS.md)）。

## 1. 想法：用劇情旗標串起任務點

自動生成任務鏈很難寫得好看，所以特殊任務改成人工編寫，但格式盡量簡單：

1. 一個任務 = **開頭** + 一串**任務點** + **完成報酬**。
2. 每個任務點只描述「在哪裡、什麼時候出現、發生什麼、結果是什麼」。
3. 任務點之間的順序與分支**不用畫流程圖**，而是用**劇情旗標**表達：
   - 任務點的「解鎖條件」是一組旗標（全部成立才出現），也可以要求某些旗標「不成立」。
   - 任務點的每個結果可以「設定」或「清除」旗標。
   - 例：A 成功設定 🚩`trail_found` → 需要 🚩`trail_found` 的 B 才出現；A 失敗設定 🚩`trail_lost` → C 出現，走另一條路。
4. 同時解鎖的任務點可以任意順序完成（例如「去三個地方收集線索」）；需要的旗標全部到齊才出現的任務點就是匯合點。
5. 編輯器下方有**檢查任務鏈**：列出每個旗標由誰設定、誰需要；需要卻沒有人設定的旗標、沒有完成的結果、不存在的 NPC 與怪物都會提醒。

旗標是全域的：存在存檔的 `flags` 裡（`story:名稱`），其他任務、固定 NPC 的出現條件、旅途事件、情報都可以讀同一個旗標，所以任務之間也能互相接續（例如完成甲任務設定 🚩`elder_trusts_you`，乙任務的接取條件需要它）。以 `ai:` 開頭的名稱讀 AI 判定寫下的旗標。

## 2. 格式

```jsonc
{
  "id": "lost_relic",
  "title": "失竊的聖環徽記",
  "summary": "冒險筆記上的簡介",
  "rank": "F",                       // 建議等級（顯示用）
  "start": {
    "kind": "npc",                   // guild 公會、npc 固定 NPC、travel 旅途事件、informant 情報商、manual 只由其他事件開啟
    "npc": "npc_selene",             // npc：這位角色在身邊時可以接
    "location": "soriel",            // guild：哪座城的公會；informant：哪座城的情報商（不寫＝任何一家）
    "chance": 0.2, "regions": [],    // travel：每段旅程遇到的機率、只在前往這些地區時
    "price": 120,                    // informant：情報的價格
    "min_level": 1,
    "min_affinity": 30,              // npc：這位角色的親密度至少多少才會拜託你（沒見過面算 0；不寫＝不限）
    "requires": { "flags": [], "flags_none": [] },
    "text": "開頭的事件描述"
  },
  "start_flags": ["relic_started"],  // 開始時成立的旗標
  "nodes": [ /* 任務點 */ ],
  "rewards": [ /* 完成報酬：效果的清單 */ ]
}
```

### 任務點

| 欄位 | 說明 |
|---|---|
| `id`、`title`、`text` | id（英數）、冒險筆記上的目標、觸發時的事件描述（也交給 AI） |
| `at.where` | `settlement` 在聚落裡、`cell` 站在某種設施上（`at.cell`）、`npc` 某位固定 NPC 在身邊（`at.npc`）、`outskirts` 近郊的 ⭐、`dungeon` 地下城某一層的 ⭐（`at.layer`）、`road` 旅途上、`side` 臨時地圖裡的 ⭐（`at.side_map`） |
| `at.location` | 地點 id（`npc` 可以不寫，跟著角色走） |
| `requires` | 解鎖的旗標條件 |
| `allies` | 在場的友方固定 NPC（id 的清單，任何種類的任務點都可以用）：解鎖之後站在 ⭐ 旁邊，或站在設施上（`cell`；`settlement` 在城門），不管他平常的出沒與出現條件；戰鬥時站在你這邊（由你操作，生命值不留到戰鬥之後）；AI 判定與寫經過時知道他們在場（`report.others`） |
| `kind` | `story` 劇情（直接發生）、`check` 判定（`check: { attr, dc }`）、`combat` 戰鬥（`enemies` 怪物、`foes` 固定 NPC）、`choice` 選擇（`options`，每個選項可以有自己的檢定） |
| `success`、`fail` | 結果（劇情只有 success；判定與戰鬥沒寫 fail 時，失敗可以再試） |

近郊與地下城的任務點在進入那一區時放一格 ⭐（解鎖之後才放）。判定與有檢定的選項走主動行動：玩家可以描述做法、搭配能力，交給 AI 判定（大成功、成功、部分成功都算成功）；沒有 AI 時依規則擲骰。

### 結果

```jsonc
{
  "text": "發生的事",
  "set_flags": ["relic_found"], "clear_flags": [],
  "effects": [{ "type": "money", "amount": 150 }],  // 金錢、物品、裝備、經驗、聲望、親密度、記憶、能力、正式入隊、生命值、開始特殊任務、主角淪為奴隸
  "join": "npc_selene",      // 固定 NPC 以「任務同行」加入（不佔隊伍名額）
  "leave": "npc_selene",     // 任務同行離開
  "complete": true,          // 完成任務（發完成報酬）；或 "fail_quest": true 任務失敗
  "retry": false,            // true：這個任務點不結束，之後可以再來
  "side_map": "cave",        // 進入臨時地圖（洞窟、遺跡、驛站），出口回到原本的地方
  "travel_to": "rivervale"   // 改去別的地點（旅途中直接抵達，不在旅途時被帶過去）
}
```

任務結束（完成、失敗或放棄）時，這個任務帶來的任務同行夥伴都會離隊。

**主角淪為奴隸**（只有特殊任務能用）：
- 固定 NPC 當主人：`{ "type": "enslave_player", "master": "npc_selene", "contract": "labor" }`
- 隨機的 NPC 當主人：`{ "type": "enslave_player", "random": { "tag": "noble" }, "contract": "combat" }`（`tag` 是主人的身分標籤，不寫＝依奴隸市場的權重抽；在目前的地點生成，比主角高 1～4 級）

`contract` 是主人打算刻的印記（勞役 labor、戰奴 combat、魔導束縛 arcane、娼妓 brothel），之後照樣有刻印檢定；主角原本的同伴（包括任務同行）會分開；已經是奴隸時改成換主人（印記沿用）。主人會在自己的城市有一棟房子（見 [`COMPANIONS.md`](COMPANIONS.md) 第 3.4 節）。編輯器的「＋ 效果…」選「主角淪為奴隸」，再選「固定 NPC 當主人」或「隨機的 NPC 當主人」；檢查任務鏈會提醒不存在的主人。

**開始特殊任務**（`{ "type": "start_story", "story": "id" }`）：在結果裡接著開啟另一個特殊任務（另外一則日誌）。不看接取條件；已經開始過就略過。開頭是「只由其他事件開啟」（`manual`）的任務要靠它開始，「檢查任務鏈」會提醒沒有任何任務開啟它的情況。

### 例：營救 A，同行一段時間後回公會

```jsonc
{
  "start": { "kind": "guild", "location": "soriel", "text": "公會的委託：A 被盜賊抓走了。" },
  "start_flags": ["rescue_started"],
  "nodes": [
    { "id": "free", "title": "到近郊救出 A", "at": { "where": "outskirts", "location": "soriel" },
      "requires": { "flags": ["rescue_started"] },
      "kind": "combat", "enemies": [["bandit", 2]], "allies": ["npc_a"],          // A 被綁在 ⭐ 旁邊，戰鬥時幫你打
      "success": { "text": "你割斷繩子，A 說要跟你一起回去。", "join": "npc_a", "set_flags": ["a_rescued"] } },
    { "id": "back", "title": "帶 A 回公會", "at": { "where": "cell", "location": "soriel", "cell": "guild" },
      "requires": { "flags": ["a_rescued"] },
      "kind": "story", "success": { "leave": "npc_a", "complete": true } }
  ]
}
```

如果 A 之後要搬家，在固定 NPC 的「依劇情旗標改變出沒」加一組需要 🚩`a_rescued` 的設定（見 [`CONTENT_EDITOR.md`](CONTENT_EDITOR.md) 第 4 節）。

## 3. 編輯器（🛠️ 內容 → ⭐ 特殊任務）

- **基本與開頭**：名稱、簡介、建議等級；從哪裡開始、接取條件、開頭的事件描述、開頭的旗標。
- **任務點清單**：每一列顯示種類、地點、需要的旗標（需要 🚩）、會設定的旗標（→ 🚩）、會不會完成（✅）或失敗（❌）任務。點開編輯；可以上下移動、複製、刪除。
- **旗標輸入**：一個一個加入，自動完成內容頁籤裡用過的所有旗標（任務與固定 NPC）。
- **完成報酬**：效果的清單。
- **檢查任務鏈**：問題清單與旗標流向表。
- 內建任務可以修改、恢復預設，不能刪除；自建的可以刪除。固定 NPC 的編輯見 [`CONTENT_EDITOR.md`](CONTENT_EDITOR.md) 第 4 節。

## 4. 遊戲裡

- 公會：站在公會時，這座城的特殊任務列在「⭐ 特殊任務」。固定 NPC：角色在身邊時出現「接下任務」。
- 任務點所在的地方會出現「⭐ 特殊任務」面板：劇情按「繼續」、判定按「嘗試」（可以描述做法）、戰鬥按「開始戰鬥」、選擇按選項。
- 每次推進都產生一份日誌（`report.story`），AI 寫經過時會看到事件描述與結果。
- 進度與經過記在 `state.stories`。

## 5. 冒險筆記（📒 筆記）

左邊的「📒 筆記」按鈕打開冒險筆記，分三頁：

- **一般委託**：進行中的委託（進度、地點、目標怪物、交付地點、線索），可以交付的會標出來，也可以放棄（公會聲望 -1）；下方是完成過的委託。
- **特殊任務**：每個任務的簡介、目前可以進行的目標（解鎖的任務點與地點）、經過；可以放棄進行中的任務。
- **情報**：買到的事件點（地點、事件、有效期限、是否完成或過期）與特殊任務的消息。
