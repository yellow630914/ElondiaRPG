# ElondiaRPG 遊戲設計（總綱）

> 狀態：可遊玩版本已實作（Vue 3 網頁版）。這份是總綱：核心原則、遊戲迴圈、報告格式、AI 管線與系統地圖；各系統的規則在各自的文件（見 [README](README.md) 的文件地圖）。待決定事項集中在 [OPEN_QUESTIONS](OPEN_QUESTIONS.md)。

## 1. 核心概念

玩家透過 **UI 介面**（按鈕、清單、地圖）決定行動，**遊戲引擎**負責所有數值運算與判定。每次行動、事件或戰鬥結束後，引擎輸出一份**結構化報告**，再交給 **AI 敘事器**寫成小說式的事件經過。

```
┌──────────┐  玩家操作   ┌────────────┐  報告 JSON   ┌────────────┐  敘事文字   ┌──────────┐
│  UI 介面  │ ──────────▶ │  遊戲引擎   │ ───────────▶ │  AI 敘事器  │ ──────────▶ │ 日誌/閱讀 │
└──────────┘             │ (唯一真相)  │              │ + 世界書注入 │             └──────────┘
      ▲                  └────────────┘              └────────────┘
      └──────────── 狀態更新（金錢、HP、物品、親密值…）───┘
```

### 設計原則

1. **引擎是唯一真相。** 擲骰、傷害、金錢、經驗、親密值都由引擎決定並寫進報告。AI 只描寫，不改數字、不改結果、不新增物品。
2. **AI 可以判定，但後果由程式夾住。** 主動行動擲骰後由 AI 決定成功程度並寫出經過，但能造成的後果只能是封閉清單裡的效果、數值夾在上限內（見 [ACTIONS](ACTIONS.md)）。
3. **報告即事件紀錄。** 每個動作都產生一份報告，並透過 `commitReport` 把 `changes` 套用到遊戲狀態。存檔直接保存狀態本身（含亂數種子與報告），不靠重播報告來還原；較舊的日誌會封存成精簡紀錄（見 [SAVES](SAVES.md) 第 6 節）。
4. **AI 失敗不影響遊戲。** 敘事生成失敗或玩家關閉 AI 時，用報告本身（時間軸＋結果）顯示簡易戰報；主動行動改用規則判定。遊戲在 AI 關閉時完整可玩。
5. **世界書是設定來源，不是執行邏輯。** 世界書原本為 SillyTavern 聊天角色扮演設計（讓 AI 自己追蹤狀態欄、親密值）。在本遊戲中，這些規則改由引擎實作，世界書只負責提供敘事用的背景知識。

## 2. 遊戲迴圈

```
城鎮（公會 / 商店 / 旅店 / 酒館 / 工作 / 自己的房子）
  ├─ 接取委託 ──▶ 旅行（旅途地圖）──▶ 冒險區域（近郊 / 地下城四層）──▶ 返回交付
  ├─ 購物、打造、休息、學習技能
  └─ 與 NPC 互動、招募夥伴（影響親密值與人際關係）
```

時間以「遊戲日」推進。旅行、任務、休息都會消耗時間，食宿與補給會消耗金錢，讓世界書的路程與物價產生實際意義。

## 3. 系統地圖

| 系統 | 文件 | 主要程式 |
|---|---|---|
| 屬性、資源、戰鬥、能力、狀態、敵人 AI、戰敗 | [COMBAT_SYSTEM](COMBAT_SYSTEM.md) | `character.ts`、`combat.ts`、`defeat.ts` |
| 特質（被動，影響所有檢定與戰鬥） | [PERKS](PERKS.md) | `perks.ts`、`perkActions.ts` |
| 效果（報酬／後果模板） | [EFFECTS](EFFECTS.md) | `effects.ts` |
| 主動行動（擲骰 → AI 判定） | [ACTIONS](ACTIONS.md) | `actions.ts`、`checks.ts`、`narrator/judge.ts` |
| 地點、聚落、走格子 | [WORLD](WORLD.md) | `world.ts`、`grid.ts` |
| 地下城分層、光線、撤退 | [DUNGEON_DESIGN](DUNGEON_DESIGN.md) | `grid.ts`、`light.ts`、`expedition.ts` |
| 旅途、旅途事件、情報 | [TRAVEL_EVENTS](TRAVEL_EVENTS.md) | `road.ts`、`travel.ts`、`intel.ts` |
| 公會委託與階級 | [GUILD](GUILD.md) | `town.ts`、`materialQuests.ts`、`guild.ts` |
| 特殊任務與劇情旗標 | [STORY_QUESTS](STORY_QUESTS.md) | `story.ts`、`storyFlags.ts`、`storyMods.ts` |
| 商店、交易、談判 | [TRADE](TRADE.md) | `trade.ts`、`negotiation.ts` |
| 物品與裝備 | [ITEMS](ITEMS.md) | `gear.ts`、`inventory.ts`、`tools.ts` |
| 刺青（奴隸印記、誓約印記、普通刺青） | [TATTOOS](TATTOOS.md) | `tattoos.ts` |
| 工藝 | [CRAFTING](CRAFTING.md) | `crafting.ts`、`craft.ts`、`recipes.ts`、`invention.ts` |
| 房屋與種植 | [HOMES](HOMES.md) | `homes.ts`、`garden.ts` |
| 工作與娼館 | [WORK](WORK.md) | `work.ts`、`brothel.ts` |
| NPC 名單、互動、警戒與通緝 | [NPC_SYSTEM](NPC_SYSTEM.md) | `population.ts`、`interactions.ts`、`encounters.ts`、`security.ts` |
| 夥伴、休息、奴隸契約、主人的家 | [COMPANIONS](COMPANIONS.md) | `companions.ts`、`party.ts`、`rest.ts`、`slavery.ts`、`masterHome.ts` |
| 人際關係與共同記憶 | [RELATIONSHIP_MEMORY](RELATIONSHIP_MEMORY.md) | `social.ts` |
| 事件視窗 | [EVENTS](EVENTS.md) | `components/events/` |
| AI 服務與提示詞 | [PROMPTS](PROMPTS.md) | `narrator/` |
| 角色形象插圖 | [PORTRAITS](PORTRAITS.md) | `narrator/image*.ts`、`narrator/comfy.ts` |
| 自訂內容與世界 | [CONTENT_EDITOR](CONTENT_EDITOR.md)、[CONTENT_DEPENDENCIES](CONTENT_DEPENDENCIES.md) | `mods.ts`、`usage.ts`、`stores/content.ts` |
| 存檔 | [SAVES](SAVES.md) | `stores/saves.ts`、`stores/game.ts`、`state.ts` |

### 3.1 世界書 → 引擎

| 世界書條目 | 引擎中的實作 | 資料檔 |
|---|---|---|
| 區域地理地標相對位置、世界地圖 | 地點圖＋路線天數 | `data/world/geography.json` |
| 力量體系／等級成長規則 | 等級 1–20、五個生命層級、魔法環階／武技境界／信仰階位 | `data/rules/progression.json` |
| 冒險者公會等級制度 | 公會階級 F–S、接任務限制、功績與晉升考核（[GUILD](GUILD.md)） | 同上 |
| 技能規則／技能獲取 | 技能品質上限受生命層級限制；升級三選一 | 同上 |
| 職業體系規則 | 10 個職業及其力量來源 | `data/rules/classes.json` |
| 分階段親密值規則 | 每個 NPC 一個 -100～100 的隱藏數值，引擎計算、AI 只呈現態度 | `progression.json` |
| 角色扮演指導（四層判斷） | 引擎先算出「實力差（生命層級差）→ 立場」，寫進報告的 `attitude`；性格與親密值交給 AI 演繹 | `progression.json` 的 `power_gap_attitude` |
| 價格參考-貨幣／食宿／任務報酬 | 價格表（全大陸統一使用阿爾貝納發行的白鸛幣，1 白鸛 = 世界書的 1 銅幣）；委託報酬在各階級的範圍內擲出 | `data/rules/economy.json` |
| 其餘價格參考、種族、神祇、巨龍、區域細節 | 不需引擎邏輯，作為敘事背景注入 | `data/worldbook/elondia.worldbook.json` |

世界書條目在提示詞裡怎麼注入（常駐、關鍵字、停用）見 [PROMPTS](PROMPTS.md) 第 5 節。

## 4. 報告格式

完整定義見 [`schemas/report.schema.json`](../schemas/report.schema.json)，範例見 [`examples/reports/`](../examples/reports/)。

| 欄位 | 用途 |
|---|---|
| `kind` | `travel` / `combat` / `action` / `event` / `quest` / `rest` / `trade` / `social` |
| `time` | 開始與結束的遊戲時間（第幾天、幾點） |
| `location` | 地點 id、目的地、細部場景、天氣 |
| `party` / `others` | 事件前後的角色快照（HP 為 `[前, 後, 上限]`）、NPC 性格與態度 |
| `timeline` | 依序的關鍵節拍：誰、做了什麼、擲骰、結果、效果 |
| `outcome` | 總結果＋一句話摘要 |
| `changes` | 所有狀態變化：金錢、經驗、升級、技能、物品、親密值、聲望、劇情旗標、功績…… |
| `narration` | 給 AI 的敘事指示：視角、長度、語氣、重點、玩家意圖、成人場景 |
| `lore_keys` | 用來挑選世界書條目的關鍵字 |

## 5. AI 敘事管線

```
報告 JSON
  ├─ 1. 挑選世界書條目：常駐條目＋關鍵字命中（繁簡兩種寫法都比）的條目，依 order 排序並裁切到字數上限
  ├─ 2. 組合提示詞：不太變動的放前面（可快取），每次不同的放後面
  │     system：規則（文風是最後一條）、常駐世界書、其他提示詞（前段）
  │     user：主角、觸發的世界書、人際關係與記憶、報告、其他提示詞（後段）、本次要求
  └─ 3. 呼叫模型（串流顯示）
```

- 敘事的硬性規則：報告的結果、數值、物品、傷亡不可更改或新增；親密值、擲骰與 DC 不寫數字；只輸出正文，不輸出世界書原本要求的 `<thinking>`、狀態欄等聊天用模組。全文與可修改的地方見 [PROMPTS](PROMPTS.md) 第 3 節。
- 主角名用 `{{player}}` 代入；世界書寫死的玩家名「沈頤」也會換成主角名。
- AI 服務（Anthropic、OpenAI、Gemini、OpenAI 相容格式）、模型來源與功能分配見 [PROMPTS](PROMPTS.md) 第 0、1 節。

## 6. 專案結構

```
assets/map/           世界地圖
data/worldbook/       原始世界書（SillyTavern 格式，保持原樣以便回頭用酒館編輯）
data/world/           地理、聚落地圖與生成參數、具名 NPC、生成 NPC 的素材
data/rules/           各系統的規則數值（改 JSON 就能調整，不必動程式）
schemas/              報告格式（JSON Schema）
examples/reports/     範例報告
docs/                 設計文件（文件地圖見 docs/README.md）
src/engine/           遊戲引擎（純 TypeScript，不依賴 Vue），每個系統一到數個模組（見第 3 節）
src/narrator/         世界書挑選、提示詞、AI 服務、插圖
src/stores/           Pinia：遊戲狀態與存檔、設定、自訂內容、提示詞、插圖
src/components/       Vue 介面
src/__tests__/        Vitest 測試（含報告格式驗證）
```
