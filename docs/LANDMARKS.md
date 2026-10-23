# 城鎮的特色地標

> 上層：[GAME_DESIGN](GAME_DESIGN.md)。依賴：[WORLD](WORLD.md)（聚落地圖）。被依賴：[STORY_QUESTS](STORY_QUESTS.md)（任務點）、[NPC_SYSTEM](NPC_SYSTEM.md)（固定 NPC、生成居民的分布）、[CONTENT_EDITOR](CONTENT_EDITOR.md)（地標頁籤）。
> 資料在 `data/world/landmarks.json`（類型與地標）。程式：`src/engine/landmarks.ts`（遊戲中的功能）、`src/engine/landmarkMods.ts`（內容編輯器）、`src/engine/grid.ts`（擺上地圖）。

## 1. 地標是什麼

聚落地圖上的一格，代表那座城的特色建築（騎士學院、聖環主殿、舊石橋……）。**格子的種類就是地標的 id**（`lm_` 開頭），所以所有用「格子種類」指定地方的系統都可以直接指定地標。一個地標只在一處。

- 內建 44 個：世界書各區域條目的「特色建築」32 個，加上世界書沒寫到的聚落由本專案補寫 12 個（月輝之母、生命之泉、七潮議會廳、深潮席渡口、海靈祠、渡口燈塔、花崗岩城牆、風錘、變異藥沼、森語之環、浮石觀星台、長老石廳）。
- 每個地標：名稱、圖示、說明（地點面板顯示）、**氛圍**（站在這裡行動時交給 AI）、**類型**（最多 4 種）、位置（區塊 key 與座標，要是道路）。
- 擺法：建立聚落區塊時疊在道路上（`grid.ts` 的 `buildBlock`，在商店的位置之後）；不改 `maps.json`，所以舊存檔讀進來也看得到。地標可以走過去，不會擋路。

## 2. 類型

| 類型 | id | 聚到這裡的居民 |
|---|---|---|
| 聖地 | `holy` | 一般人、神官與主教（很高）、好人 |
| 學院 | `academy` | 一般人、冒險者、貴族 |
| 官府・議會 | `official` | 貴族、皇族 |
| 軍事・校場 | `military` | 冒險者 |
| 市集・交易 | `market` | 一般人、商人、旅人、惡人 |
| 工坊 | `workshop` | 一般人 |
| 碼頭・渡口 | `harbor` | 旅人、商人 |
| 古蹟 | `monument` | 一般人、冒險者、旅人 |
| 自然 | `nature` | 一般人 |
| 陰森之地 | `haunted` | 惡人 |

權重在 `landmarks.json` 的 `types[].npc`（`commoner`、`adventurer`，`tags` 是帶這些標籤的人）；一個地標有好幾種類型時取最高的（`population.ts` 的 `landmarkWeight`）。

## 3. 用途

| 用途 | 說明 |
|---|---|
| 特殊任務的任務點 | `at.where = cell`、`at.cell = 地標 id`（地標要在 `at.location` 那個聚落）；編輯器的設施清單會列出這個地點的地標 |
| 固定 NPC 的站點 | 出現的方式選「待在地標」（`NpcDef.landmark`）：站在地標那一格，地標搬家時跟著走；依劇情旗標搬走時看那一組的設定 |
| 生成居民的分布 | 依類型（第 2 節） |
| AI 的場景 | 站在地標上做主動行動時，場景加上「・地標名稱（氛圍）」（`withLandmark`） |
