# 新增地下城（dungeons）

> 遊戲規則見 [docs/DUNGEON_DESIGN.md](../../docs/DUNGEON_DESIGN.md)（分層、光線、撤退）與 [docs/CONTENT_EDITOR.md](../../docs/CONTENT_EDITOR.md) 3.96 節（編輯器）；這份只寫生成內容時要填什麼、怎麼排等級、哪些值會被整理掉。
> 整理程式：`src/engine/dungeonMods.ts` 的 `sanitizeDungeonMod`；即時資訊與快速開始：`src/engine/dungeonPreview.ts`；引用與刪除：[CONTENT_DEPENDENCIES](../../docs/CONTENT_DEPENDENCIES.md)。

## 1. 用途與放在哪裡

自建的地下城是世界上**新的一個地點**：經由旅途到達（不像特殊地圖從某個地點走進去），有周邊、淺層、中層、深層（可以加底層），每層隨機挖出通道，遇到這一層遭遇表的怪物，盡頭有層主。公會的清剿與材料委託、晉升考核、情報、建議階級、寶箱、怪物圖鑑都照內建地下城的規則，不用另外寫。

- section key：`dungeons`。世界包寫在 `content.dungeons`，內容檔寫在最上層的 `dungeons`。
- 每一筆的 key 就是 id，要符合 `/^loc_[a-z0-9_]+$/`，不能和內建的地點同 id；不合的整筆丟掉。建議加上世界的前綴，例如 `loc_myworld_bat_cave`。
- 一定要寫 `"custom": true`。**內建的地下城不能用這一區改**：要改內建地下城的遭遇，寫在怪物的 `spawns`／`exclude`（[monsters](monsters.md)）。
- 聚落、地區、路線還是不能新增（[README](../README.md) 守則 5）。

## 2. 欄位一覽

| 欄位 | 型別 | 範圍 | 說明 |
|---|---|---|---|
| `id` | 字串 | 同 key | 寫和 key 一樣的值 |
| `custom` | `true` | | 一定要寫 |
| `name` | 字串 | 1～16 字 | 不能和其他地點同名（世界檢查會提醒） |
| `region` | 地區 id | `central`、`north`、`south`、`forest`、`east_sea`、`west` | 沒放怪物的層用這個地區的城郊遭遇表；地下城事件的 `regions` 篩選、背景圖也看這裡；寫錯換成 `central` |
| `desc` | 字串 | ≤ 300 字 | **給 AI 的描述**：在裡面時每一則日誌的場景都帶上名稱與描述，AI 編排特殊任務的地點清單也列出來。內建地點的設定在世界書，自建的只能靠這一欄：寫外觀、氣氛、傳說、危險 |
| `routes` | 路線陣列 | 1～6 條 | 見 2.1 |
| `layers` | 物件 | 每層最多 12 組 | `outskirts`、`shallow`、`middle`、`deep`（`abyss` 要 `"abyss": true`）各一個遭遇組陣列，見 2.2 |
| `abyss` | `true` | | 多一層底層（底層要有怪物才算五層；深層的層主改成守著往下的階梯，底層的層主是最終層主） |
| `bosses` | 物件 | 每層一組，最多 3 種 | `shallow`、`middle`、`deep`（與 `abyss`）的層主：`[["層主 id", 數量], ["護衛 id", 數量], ...]`，第一種是層主。沒寫的層照強敵的規則（那一層最強的一組多一隻） |
| `lighting` | 字串陣列 | 每層一個 | `lit`／`daylight`／`dark`，從周邊起算；沒寫照共用的預設（[DUNGEON_DESIGN](../../docs/DUNGEON_DESIGN.md) 第 4 節）。比層數短時，後面的層用最後一個 |
| `requires` | 劇情條件 | | 成立才找得到、才能前往（旅行的目的地、委託、情報、AI 看到的地點都不列）；有條件的地下城不會有冒險者出沒 |
| `material_series` | 字串 | gear.json 材料的 `series` | 寶箱與人形怪掉的隨機裝備，同一級有好幾種材料時優先用這一套 |
| `image` | 圖片的 data URL | PNG／WebP／JPEG，≤ 400,000 字 | 在裡面當整頁背景（含屬於它的特殊地圖）；沒有時用地區的背景圖。建議最長邊 1280 以內的 WebP（編輯器上傳時會自動縮） |

### 2.1 路線

```json
"routes": [
  { "to": "rivervale", "days": [1, 1], "mode": "trail" },
  { "to": "coast_ferry", "days": [1.5, 2], "mode": "sea", "fare": 30 }
]
```

- `to`：**只能是內建的聚落**（不能接地下城）；同一座聚落只能一條，接錯的拿掉。
- `days`：`[最少, 最多]`，以半天為單位（0.5～30）。
- `mode`：`road` 官道、`trail` 山道、`wild` 荒野、`sea` 海路、`dive` 潛水、`underground` 地底；決定旅途事件與戰鬥方式。
- `fare`：每人的船資（選填；沒寫時海路每段 50、其他不收）。
- **旅行不會穿過地下城**：接兩座城的地下城不會變成捷徑。
- **委託看路線的最多天數**：7 天內（`days` 的第二個數字加上那座聚落到別處的路程）的公會會發這座的清剿與材料委託、情報商會賣這裡的事件點。全都超過 7 天時沒有委託（世界檢查會說明）。
- 相鄰的聚落（直接接上的）生成的冒險者會到這裡出沒（`requires` 的除外）。

### 2.2 各層的遭遇

```json
"layers": {
  "outskirts": [[["slime", 2]], [["cave_bat", 2]]],
  "shallow": [[["cave_bat", 3]], [["slime", 1], ["cave_bat", 1]]],
  "middle": [[["cave_bat", 4]], [["rock_spider", 1]]],
  "deep": [[["rock_spider", 2]], [["cave_bat", 2], ["rock_spider", 1]]]
},
"bosses": { "shallow": [["rock_spider", 1]], "deep": [["rock_spider", 1], ["cave_bat", 2]] }
```

- 每一組是一個選項：遭遇時從所有組平均抽一組，要提高某一組的機率就多放幾組。每組 1～4 種怪物、每種 1～6 隻；同一組裡同一種只算第一次。
- 怪物可以是內建的，或同一包裡新增的（`mod_enemy_…`）。不存在的怪物整理時拿掉。
- **遭遇表記在地下城上**：怪物的 `spawns` 不能指到自建的地下城（整理時拿掉）。用到的自建怪物在地下城還用到時不能刪。
- 建議階級看這一層一般怪物（不含層主）最高的等級；寶箱的等級也是。周邊沒有層主、沒有階級。

## 3. 等級怎麼排

地下城沒有整座的難度，全看每一層的怪物等級。照同一地區的內建地下城排（不含園區與高等地下城），世界檢查與編輯器差太多時會提醒：

| 地區 | 周邊 | 淺層 | 中層 | 深層 | 底層 |
|---|---|---|---|---|---|
| 中央平原與丘陵地帶 | 1～1 | 1～2 | 1～5 | 3～6 | 6～12 |
| 北境群山 | 3～3 | 3～4 | 4～6 | 6～8 | 8～12 |
| 南境枯萎荒原 | 4～4 | 4～5 | 5～7 | 7～9 | 9～12 |
| 古樹森林 | 2～2 | 2～3 | 3～5 | 5～7 | 7～12 |
| 東海群島 | 2～2 | 2～3 | 3～5 | 5～7 | 7～12 |
| 西部荒野 | 2～2 | 2～3 | 3～5 | 5～7 | 7～12 |

- 一層比一層強；層主比那一層的一般怪物強一兩級（世界檢查會跑自建地下城的層主戰，目標勝率見 [balance/monsters](../balance/monsters.md)）。
- 刻意做成高等級（例如 Lv.13 以上）的地下城可以，但要有 `requires`，不然低等級的玩家旅行時就會看到它，公會也會在 7 天內的城鎮發高階委託。
- 新怪物的數值照 [monsters](monsters.md) 與 [balance/monsters](../balance/monsters.md)。

## 4. 誰可以引用它

| 內容 | 怎麼寫 |
|---|---|
| 特殊任務 | 任務點 `at: { "where": "dungeon", "location": "<id>", "layer": "shallow" }`；結果的 `travel_to: "<id>"` |
| 地下城事件 | `dungeons: ["<id>"]`；也可以只寫 `regions` |
| 特殊地圖 | `location: "<id>"`（陷阱、寶箱比照 `layer`，沒寫遭遇表時用那一層的） |
| 情報物品 | `intel: { "kind": "point", "event": "chest", "location": "<id>", "layer": "middle" }` |

被引用的地下城不能刪（[CONTENT_DEPENDENCIES](../../docs/CONTENT_DEPENDENCIES.md) 第 2 節）。

## 5. 常見的錯

- 沒有 `routes`：到不了（世界檢查報錯誤）。
- 路線全都很遠：沒有委託，玩家不容易發現它。
- 沒寫 `desc`：AI 不知道這是什麼地方，只會照名稱亂猜。
- 某一層空著：那一層用地區的城郊遭遇表（中央平原是 Lv.1～2 的怪），深層會變得很弱。
- 想改內建地下城：用怪物的 `spawns`／`exclude`，不是這一區。
- 世界書：新的地下城最好在世界書補一條（地區條目或新增條目，關鍵字是地下城的名字），寫它在哪、傳說是什麼（[design/worldbook-and-prompts](../design/worldbook-and-prompts.md)）。
