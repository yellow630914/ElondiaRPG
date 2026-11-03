# 檔案格式：世界包與內容檔

> 一個世界的產出是一個 JSON 檔：`worldgen/worlds/<代號>/world.json`。這份文件講檔案的外層、id 規則、各種內容之間的引用與先後，以及怎麼檢查與匯入。每一種內容的欄位見同一個資料夾的其他指南。
> 系統文件：[CONTENT_EDITOR](../../docs/CONTENT_EDITOR.md) 第 0 節（世界、世界包）、[CONTENT_DEPENDENCIES](../../docs/CONTENT_DEPENDENCIES.md)（內容之間的引用與刪除保護）、[PROMPTS](../../docs/PROMPTS.md) 第 5、6 節（世界書、文風）。程式：`src/engine/worldPackage.ts`、`src/engine/mods.ts`（`ContentMods`、`normalizeMods`、`applyContent`）。

## 1. 世界包

```json
{
  "type": "elondia-world",
  "version": 1,
  "name": "艾隆迪亞擴充",
  "desc": "給玩家看的一段說明：這個世界多了什麼。",
  "content": {
    "statuses": {}, "tattoos": {}, "marks": {}, "markRules": {},
    "dungeons": {}, "landmarks": {}, "specialMaps": {}, "shops": {},
    "abilities": {}, "perks": {}, "materials": {}, "bases": {}, "items": {},
    "enemies": {}, "npcs": {}, "stories": {}, "travelEvents": {}, "eventRules": {}, "categoryIcons": {}, "counters": {}
  },
  "prompts": { "lore": {}, "customLore": [] }
}
```

| 欄位 | 說明 |
|---|---|
| `type` | 一定是 `elondia-world` |
| `version` | 1 |
| `name` | 世界的名稱（最多 30 字），匯入後就是「🌍 世界」裡的名字，同名時自動加數字 |
| `desc` | 說明（最多 500 字） |
| `content` | 自訂內容，每一種內容一個區塊（下表），區塊裡用 id 當 key。沒用到的區塊可以省略 |
| `prompts` | 提示詞組（選填）：匯入時另外建立一組提示詞並綁定到這個世界（見第 5 節） |

只有 `content` 的檔案（`{ "type": "elondia-content", "npcs": {…}, … }`，遊戲「📤 匯出自訂內容」的格式）也能匯入，只是沒有提示詞。

## 2. 內容的區塊與 id

| 區塊 | 內容 | key（id） | 指南 |
|---|---|---|---|
| `statuses` | 狀態（增益、減益） | `mod_status_<英文>` | [statuses-perks-tattoos](statuses-perks-tattoos.md) |
| `tattoos` | 刺青圖樣、誓約印記 | `mod_tattoo_<英文>` | 同上 |
| `marks` | 奴隸印記的模板 | `mod_mark_<英文>` | 同上 |
| `markRules` | 印記的用途與權重（只有一筆，key 是 `rules`） | `rules` | 同上 |
| `dungeons` | 自建的地下城（第 3.1 節） | `loc_<英文>`（`/^loc_[a-z0-9_]+$/`） | 第 3.1 節 |
| `landmarks` | 地標 | `lm_<英文>`（`/^lm_[a-z0-9_]+$/`） | [landmarks](landmarks.md) |
| `specialMaps` | 特殊地圖 | `sm_<英文>`（`/^sm_[a-z0-9_]+$/`） | [special-maps](special-maps.md) |
| `shops` | 商店（內建店種的修改、自建的店） | 內建的店種 id，或 `shop_<英文數字>`（`/^shop_[a-z0-9]+$/`，前綴之後不能有底線） | [shops](shops.md) |
| `abilities` | 技能、法術、怪物的能力 | `mod_ability_<英文>` | [abilities](abilities.md) |
| `perks` | 特質與缺陷 | `mod_perk_<英文>` | [statuses-perks-tattoos](statuses-perks-tattoos.md) |
| `materials` | 裝備材料 | `mod_mat_<英文>` | [items-gear](items-gear.md) |
| `bases` | 裝備底材 | `mod_base_<英文>` | 同上 |
| `items` | 物品 | **物品的名稱**（中文，也是遊戲裡顯示的名字） | 同上 |
| `enemies` | 怪物 | `mod_enemy_<英文>` | [monsters](monsters.md) |
| `npcs` | 固定 NPC | `mod_npc_<英文>` | [npcs](npcs.md) |
| `stories` | 特殊任務 | `mod_story_<英文>` | [stories](stories.md) |
| `travelEvents` | 旅途與城鎮事件 | `mod_event_<英文>` | [events](events.md) |
| `eventRules` | 事件的機率與冷卻（只有一筆，key 是 `rules`） | `rules` | 同上 |
| `categoryIcons` | 物品類別的圖示（取代內建的類別圖）：`{ "<類別>": { "icon": "<data URL>" } }` | 類別 id（`food`、`consumable`……，見 `data/rules/items.json` 的 `categories`） | [items-gear](items-gear.md) 2.11 節 |
| `counters` | 劇情計數器：`{ "<id>": { "name": "…", "desc": "…", "initial": 0, "min": -5, "max": 5, "custom": true } }`（內建的不寫 `custom`，只改名稱、說明、初始值與上下限） | 小寫英文、數字、底線 | [docs/STORY_QUESTS](../../docs/STORY_QUESTS.md) 1.1 節 |

- **新的項目**：加 `"custom": true`。id 用英文小寫、數字、底線，看得出是什麼（`mod_npc_dawnlight_king`），整個世界裡不能重複。
- **修改內建的項目**：用原本的 id（內建的 id 查 `data/` 裡對應的檔案），**不加** `custom`，寫整份修改後的資料（不是只寫改的欄位）。能用新增的就不要改內建的：內建項目被很多地方用到，改了容易牽動別的東西。
- 項目裡的 `id` 欄位（有的話）要和 key 一樣。

## 3. 引用與先後

內容會互相引用：怪物用到技能與物品（掉落），物品用到狀態、底材與材料，固定 NPC 用到地點、地標、技能、特質、裝備，特殊任務用到固定 NPC、怪物、物品、特殊地圖……完整的對照見 [CONTENT_DEPENDENCIES](../../docs/CONTENT_DEPENDENCIES.md) 第 1 節。

- **被引用的要存在**：可以是內建的，或同一個檔案裡新增的。引用到不存在的東西，匯入時會被默默拿掉（或整筆不收），世界檢查會列出來。
- **套用的順序**（`applyContent`）：狀態 → 刺青與印記 → 自建地下城 → 地標 → 商店 → 特殊地圖 → 技能 → 特質 → 材料 → 底材 → 物品 → 怪物 → 固定 NPC → 特殊任務 → 事件。生成時也照這個順序寫：先寫被引用的，再寫引用別人的。
- **聚落是固定的**：地點 id 查 `data/world/geography.json`；城鎮區塊與格子查 `data/world/maps.json`（見 [landmarks](landmarks.md)）。不能新增聚落、地區與路線；**可以新增地下城**（下一節）。

### 3.1 自建的地下城（`dungeons`）

經由旅途到達的地下城，功能和內建的一樣（分層、遭遇、層主、寶箱、公會委託、情報）。世界頁籤的「🕳️ 地下城」可以直接編輯（[CONTENT_EDITOR](../../docs/CONTENT_EDITOR.md) 3.96 節）；內容檔的格式：

```json
"dungeons": {
  "loc_bat_cave": {
    "id": "loc_bat_cave", "name": "蝙蝠洞", "region": "central", "custom": true,
    "desc": "河谷鎮北邊山腰的石灰岩洞，洞口終年垂著蝙蝠。（給 AI 的描述，最多 300 字）",
    "routes": [{ "to": "rivervale", "days": [1, 1], "mode": "trail" }],
    "layers": {
      "outskirts": [[["slime", 2]]],
      "shallow": [[["cave_bat", 3]], [["slime", 1], ["cave_bat", 1]]],
      "middle": [[["cave_bat", 4]]],
      "deep": [[["cave_bat", 2], ["rock_spider", 1]]]
    },
    "bosses": { "deep": [["rock_spider", 1], ["cave_bat", 2]] }
  }
}
```

| 欄位 | 說明 |
|---|---|
| `name` | 最多 16 字，不能和其他地點同名 |
| `region` | 現有的地區（`central`、`north`、`south`、`forest`、`east_sea`、`west`）；沒放怪物的層用這個地區的城郊遭遇表 |
| `routes` | 1～6 條，**只能接內建的聚落**；`days` 是 `[最少, 最多]`（以半天為單位，0.5～30），`mode` 是 `road`、`trail`、`wild`、`sea`、`dive`、`underground`，`fare` 選填（每人的船資）。7 天內的公會會發這座的委託 |
| `layers` | 周邊、淺層、中層、深層（`abyss: true` 時多一層底層）：每層幾組遭遇，每組 1～4 種怪物、每種 1～6 隻，最多 12 組；要提高某一組的機率就多放幾組 |
| `bosses` | 淺層、中層、深層（與底層）的層主：第一種是層主，其他是護衛（最多 3 種）；沒寫的層照強敵的規則 |
| `lighting` | 選填：各層的光線（`lit`、`daylight`、`dark`，從周邊起算） |
| `requires` | 選填：劇情條件，成立才找得到、才能前往 |
| `material_series` | 選填：寶箱與人形怪掉的裝備優先用的材料系列 |

- 遭遇表記在地下城上：怪物的 `spawns` 不能指到自建的地下城（整理時拿掉）。用到的自建怪物，在地下城還用到時不能刪。
- 特殊任務、地下城事件、特殊地圖、情報物品可以引用這個 id；建議階級、委託的等級都照各層怪物的等級算。

## 4. 檢查

```
WORLD=worldgen/worlds/<代號>/world.json npx vitest run src/__tests__/worldCheck.spec.ts
```

- 報告寫在同一個資料夾的 `check-report.md`（`WORLD_REPORT=路徑` 可以改）。戰鬥模擬的場數用 `WORLD_TRIALS`（預設 20，層主戰至少 40；邊寫邊查時可以用 6 加快，最後用預設值再跑一次）。
- 有錯誤時測試失敗。錯誤、提醒的意思與怎麼修見 [balance/README](../balance/README.md)。

## 5. 提示詞（`prompts`）

`prompts` 是一組提示詞的設定（提示詞頁「匯出設定」的格式，`src/narrator/promptConfig.ts` 的 `PromptConfig`）。生成世界時通常只寫世界書：

```json
"prompts": {
  "lore": {
    "12": { "content": "改寫後的內建條目內容……" }
  },
  "customLore": [
    { "uid": 100000, "comment": "人物-晨光王國國王", "content": "……", "keys": ["國王", "阿瑟蘭"], "mode": "keyword", "order": 700, "adult": false, "builtin": false }
  ]
}
```

| 欄位 | 說明 |
|---|---|
| `lore` | 修改內建的世界書條目：key 是條目的 `uid`（查 `data/worldbook/elondia.worldbook.json`），值只寫要改的欄位（`comment`、`content`、`keys`、`mode`、`order`、`adult`） |
| `customLore` | 新增的條目：`uid` 是 **100000 以上**、不重複的整數（不合的整條會被丟掉）；`mode` 是 `constant`（常駐）、`keyword`（關鍵字觸發，要有 `keys`）、`travel`（旅行時）或 `off`；`order` 越小越前面（內建的大多在 100～900） |
| `styles`、`custom` | 文風與其他提示詞。**省略時用預設的**；寫了就整份取代（要保留預設的文風，從遊戲匯出一份設定再加） |

寫法與分工見 [design/worldbook-and-prompts](../design/worldbook-and-prompts.md)。世界書原本是簡體，新增的條目可以用繁體或簡體（關鍵字比對時繁簡都比）。

## 6. 匯入與試玩

1. 在遊戲首頁「🌍 世界管理」（或遊戲中上方的「🌍 世界」）按「📥 匯入成新的世界」，選 `world.json`。
2. 會建立一個新的世界；有 `prompts` 時另外建立一組同名的提示詞並綁定（切換到這個世界時一起切換）。有錯誤的特殊任務不會匯入，畫面會提示幾個。
3. 開新遊戲時選這個世界。玩壞了刪掉這個世界與那組提示詞即可，原版世界不受影響。
4. 在遊戲裡修改之後，「📦 匯出世界包」可以匯出目前的樣子。
