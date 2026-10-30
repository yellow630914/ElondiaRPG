# 需要回應的事件（事件視窗）

> 上層：[GAME_DESIGN](GAME_DESIGN.md)。依賴（各事件的規則）：[COMBAT_SYSTEM](COMBAT_SYSTEM.md) 8.4 節（戰敗事件）、[NPC_SYSTEM](NPC_SYSTEM.md) 8.1 節（對峙）、[COMPANIONS](COMPANIONS.md) 2.4 節（刻印、主人的要求）、[TRAVEL_EVENTS](TRAVEL_EVENTS.md)（旅途事件）、[RELATIONSHIP_MEMORY](RELATIONSHIP_MEMORY.md) 第 6 節（關係變化）。
> 程式：`src/components/events/eventQueue.ts`（佇列與格式）、`src/components/events/EventCenter.vue`（事件視窗）。

遊戲中所有「要玩家做決定才能繼續」的事件，用同一個格式排成佇列，在一個**帶遮罩的對話框**裡一件一件處理。

## 1. 事件一覽

| 事件 | 什麼時候出現 | 擋住行動 | 處理的畫面 |
|---|---|---|---|
| ⚠️ 倒下之後 | 全隊倒下（戰敗事件） | 是 | `DefeatEventPanel` |
| ⚠️ 對峙 | 敵對的冒險者、強盜擋住去路 | 是 | `StandoffPanel` |
| ⛓️ 戰後處置 | 打贏之後有被制伏的人要處置（[NPC_SYSTEM](NPC_SYSTEM.md) 8.2 節） | 是 | `CaptivesPanel` |
| 🔥 刻下契約印記 | 成為奴隸時（開局或之後） | 是 | `events/MarkingPanel` |
| ⛓️ 主人的要求 | 主角是奴隸時，走動或旅途上隨機發生；調教自己的奴隸、娼館接客或受訓（🌹）結束時也用同一個格式 | 是 | `MasterEventPanel` |
| ⚠️ 地下城事件 | 地下城與近郊觸發陷阱、打開寶箱、採集、在安全房長休之後（成人向，見 [ADULT_EVENTS](ADULT_EVENTS.md)） | 是 | `events/RoadEventPanel`（`dungeon`） |
| 💗 寄生物的發作 | 身上的寄生物在走動、旅途或長休之後發作（[ADULT_EVENTS](ADULT_EVENTS.md) 第 6 節） | 是 | `events/RoadEventPanel`（`parasite`） |
| 🧭 旅途事件 | 旅途上走到 ❔ 事件格 | 是 | `events/RoadEventPanel` |
| ⭐ 特殊任務的任務點 | 走到解鎖的任務點（[STORY_QUESTS](STORY_QUESTS.md)）；不緊急的可以「稍候」，緊急的只能處理或放棄任務 | 是 | `StoryNodeCard` |
| 🤝 入隊 | 事件或 AI 讓人入隊、邀請同行時隊伍滿了：騰出位子或放棄（[COMPANIONS](COMPANIONS.md) 2.7 節） | 是 | `events/JoinPanel` |
| 🏘️ 城鎮事件 | 在聚落裡走上設施時遇到的選擇事件（[TRAVEL_EVENTS](TRAVEL_EVENTS.md) 第 6 節） | 是 | `events/RoadEventPanel`（`town`） |
| 💞 關係變化 | AI 寫敘事或判定後提議更新和某人的關係 | 否，可以稍後 | `events/SuggestionPanel` |
| ⬆️ 升級 | 有能力三選一或屬性點還沒分配 | 否，可以稍後 | `events/LevelUpPanel`（到隊伍視窗選） |
| 🌟 特質的機會 | 隊員有學特質的機會（[PERKS](PERKS.md)） | 否，可以稍後 | `events/PerkOfferPanel` |

「擋住行動」的事件不處理就不能移動、短休（引擎丟出「先回應主人的要求」之類的錯誤），排在佇列前面，不能稍後。短休、長休也一樣，要先處理這些事件，等待中的旅途事件與城鎮事件也算（`rest.ts` 的 `restEventBlock`）。

不在佇列裡的：
- **等待判定的主動行動**：判定中會在冒險日誌最下面顯示一張卡片，列出骰值與可能的結果（AI 判定失敗時也在那裡重試），判定完換成這次行動的日誌；事件視窗這段時間不列出擋住行動的事件。
- **戰鬥**：整個中央換成戰鬥畫面；戰鬥中不顯示事件視窗。
- **談判、商店、工藝**：玩家自己打開的視窗，不是突然發生的事件。

## 2. 統一格式

每件事件是 `{ id, kind, icon, title, blocking, ref? }`：

- `id`：同一件事一直是同一個 id（由事件內容算出）。用來判斷是不是新的事件，以及記住「稍後」。內容變了（例如又多一點屬性）就算新的一件。
- `kind`：決定視窗裡顯示哪一個處理畫面。
- `blocking`：擋住行動的事件。
- `ref`：關係變化是哪一則提議，升級是哪一位隊員，特質的機會是「隊員 id:機會 id」，任務點與入隊是哪一件。

## 3. 事件視窗的行為

- **有新的事件就自動打開**（帶遮罩，背後的畫面不能操作）。一次顯示一件，標題寫著還有幾件，底下列出接下來的事件。
- 可以按 ✕ 或 Esc 關掉，先看看周圍；畫面上方會顯示「🔔 待處理 N」，點一下再打開（手機版在狀態列的鈴鐺）。有擋住行動的事件時，這個提醒是紅色的、會閃動。
- 關掉之後移動（方向鍵或點地圖）**被擋住**時，主角那一格晃一下、地圖角落寫出原因，視窗也會再打開。
- 在特殊任務的任務點按「稍候」離開、之後再回來時，當成新的事件再打開一次。
- 可以稍後的事件按「稍後再說」就跳過，直到它的內容改變；「🔔」的件數仍然算它。
- 冒險日誌最下面（有刻印時）顯示「🔔 開啟事件視窗」，旅途面板（有旅途事件時）顯示「🔔 決定怎麼應付」（手機版在下方的情境按鈕），都是打開事件視窗。
