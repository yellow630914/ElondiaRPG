# 新增特殊地圖（specialMaps）

> 遊戲規則見 [docs/SPECIAL_MAPS.md](../../docs/SPECIAL_MAPS.md)；這份只寫生成內容時要填什麼、填在哪裡、哪些值會被整理掉。
> 整理程式：`src/engine/specialMapMods.ts` 的 `sanitizeSpecialMapMod`；生成：`src/engine/grid.ts` 的 `generateSpecial`；通道：`src/engine/specialMaps.ts`。

## 1. 用途與放在哪裡

特殊地圖是人工設計、自成一張的地方（下水道、地下墓室、密道），**屬於某個地點**：遭遇表的地區、商店的物價、AI 看到的地點、戰敗後被送回的地方都看它。進去的方式有兩種：特殊任務或事件的結果傳送進來，或從城鎮區塊（或別張特殊地圖）的通道走進來。

- section key：`specialMaps`。世界包寫在 `content.specialMaps`，內容檔寫在最上層的 `specialMaps`。
- 每一筆的 key 就是 id，要符合 `/^sm_[a-z0-9_]+$/`。不合的整筆丟掉。建議加上世界的前綴，例如 `sm_myworld_crypt`。
- 區域 key 是 `sm/<id>`：通道、固定 NPC 用這個指地圖；特殊任務的 `special_map` 寫的是 id（不加 `sm/`）。
- **新增**：寫 `"custom": true`。
- **修改內建**（`sm_rhineburg_sewer`、`sm_rhineburg_cistern`）：用內建的 id、不寫 `custom`，**寫整份**（從 `data/world/special_maps.json` 複製再改）：沒寫的欄位會被拿掉或換成預設。

## 2. 欄位一覽

| 欄位 | 型別 | 範圍 | 說明 |
|---|---|---|---|
| `id` | 字串 | 同 key | 寫和 key 一樣的值 |
| `custom` | `true` | | 新增的一定要寫 |
| `name` | 字串 | 1～16 字 | 地圖名稱 |
| `location` | 地點 id | `geography.json` 的任何地點（聚落或地下城） | 所屬地點；寫錯換成第一個地點（`soriel`） |
| `desc` | 字串 | ≤ 300 字 | 給 AI 的描述：在裡面時每一則日誌的場景都帶上名稱與描述。寫外觀、氣氛、危險 |
| `lighting` | `lit`／`daylight`／`dark` | | 一直有光／白天有光／黑暗；沒寫時 `dark` |
| `layer` | `outskirts`／`shallow`／`middle`／`deep`／`abyss` | | 陷阱的 DC 與傷害、寶箱上鎖比照地下城的哪一層；所屬地點是地下城而且沒寫 `table` 時，也用這一層的遭遇。沒寫時 `shallow` |
| `refresh` | `true` | | 離開這片特殊地圖後作廢，下次進來遭遇、資源、寶箱全部重來；不寫＝打過、採過的一直留著 |
| `peaceful` | `true` | | 安全的室內（例如地標的內部）：休息不會被襲擊，一進去就看得到整張地圖，空地叫「室內」 |
| `grid` | 字串陣列 | 3～20 列，每列 3～20 字 | **固定地圖**（見 2.1）。有 `grid` 時 `size`、`carve_steps` 不用 |
| `size` | `[寬, 高]` | 各 3～20 | **隨機地圖**（沒有 `grid` 時）；沒寫時 `[9, 7]` |
| `carve_steps` | 整數 | 5～400 | 隨機地圖挖幾步；沒寫時是寬 × 高 |
| `encounters` | `[最少, 最多]` | 0～20 | 另外隨機撒的遭遇數 |
| `elites` | 整數 | 0～5 | 另外撒的強敵數 |
| `traps` | `[最少, 最多]` | 0～20 | 另外撒的陷阱數 |
| `resources` | `[最少, 最多]` | 0～20 | 另外撒的資源數 |
| `chests` | `[最少, 最多]` | 0～20 | 另外撒的寶箱數 |
| `table` | 遭遇組的陣列 | 最多 8 組，每組最多 4 種怪物，每種 1～6 隻 | `[[["怪物 id", 數量], ...], ...]`（見 2.2） |
| `resource_items` | 物品名稱陣列 | 最多 6 個 | 資源格採到的東西（見 2.2） |
| `entry` | `{ x, y }` | 在地圖內 | 被傳送進來時站的位置；沒寫時站在出口 `E`，再沒有就是第一格空地 |
| `connections` | 通道陣列 | 最多 8 個；只有固定地圖 | 見 2.3 |
| `shops` | `{ shop, x, y }` 陣列 | 最多 8 家；只有固定地圖 | 見 2.4 |
| `bosses` | `{ x, y, group, name }` 陣列 | 最多 8 格；只有固定地圖，座標要是畫成 `B` 的格子 | 見 2.5 |

座標一律是 `x` 第幾欄、`y` 第幾列，從 0 起算（`grid[y][x]`）。

### 2.1 版面

**固定地圖**（`grid`）：每個字元依共用的圖例（`data/world/special_maps.json` 的 `legend`）對應格子：

| 字元 | 格子 | 說明 |
|---|---|---|
| `#` | 牆 | |
| `.` | 道路 | |
| `~` | 水 | 不能走 |
| `E` | 出口 | 站上去按「離開」：回到進來前的地方（沒有記錄時到所屬地點的入口） |
| `S` | 安全房 | 可以長休（要乾糧、每間一次） |
| `M` | 遭遇 | 生成時從遭遇表抽一組 |
| `X` | 強敵 | 遭遇表裡最強的一組再多一隻 |
| `B` | BOSS | 在 `bosses` 指定這一格的怪物與名字（見 2.5）；沒指定時照強敵 |
| `R` | 資源 | 從 `resource_items` 抽 |
| `C` | 寶箱 | 等級是遭遇表裡最高的怪物等級 |
| `T` | 陷阱 | DC 與傷害照 `layer` |

- 寬度是最長那一列；短的列在右邊補 `#`。不到 3 列或 3 欄時用牆補到 3，超過 20 列或 20 欄截掉。圖例以外的字元（包括其他城鎮圖例的字母）都變成 `#`。地圖不能自訂圖例（`legend` 欄位會被拿掉）。
- **整張圖要自己確定走得通**：生成時不會檢查連通，畫成死路的格子就是到不了。
- 至少要有一個出口 `E` 或一個通道，否則只能靠倒下或事件傳送離開。
- 外框不一定要是牆，但地圖邊緣以外不能走；通道的端點常放在邊緣的 `.` 上（內建的下水道就是這樣）。

**隨機地圖**（只寫 `size`）：出口在最下面一列的正中央，從那裡往上隨機挖出通道，每次生成都不一樣。只能由傳送進來；**不能設通道、商店、固定 NPC 或任務點的確切格子**。

**額外的隨機內容**（`encounters`、`elites`、`traps`、`resources`、`chests`）撒在空地上，兩種版面都可以用；出口、入口、通道端點、商店的格子不會放。每次生成時在最少～最多之間擲。

### 2.2 遭遇表與採集物

- `table` 沒寫時：所屬地點是地下城就用 `layer` 那一層的遭遇，否則用所屬地點地區的城郊遭遇表。
  ```json
  "table": [
    [["skeleton", 2]],
    [["grave_rat", 1], ["skeleton", 1]]
  ]
  ```
- `table` 可以用內建的怪物，或同一個包裡 `enemies` 的自建怪物；不存在的會被拿掉（整組都不存在時整組拿掉）。自建怪物只想出現在特殊地圖裡時，不用寫 `spawns`（[monsters.md](monsters.md)）（世界檢查會把特殊地圖的遭遇表算成出現地點）。
- `resource_items` 沒寫時用地下城的採集表（`maps.json` 的 `generation.dungeon.resource_items`）。可以用內建的物品名稱，或同一個包裡 `items` 的自建物品。
- 怪物 id 在 `data/rules/enemies.json`，物品名稱在 `data/rules/items.json`（`category: "material"` 的適合當採集物）。

### 2.3 通道

```json
{ "at": { "x": 0, "y": 3 }, "to": { "area": "rhineburg/avenue", "x": 0, "y": 4 }, "requires": { "flags": ["wg_undercroft_open"] } }
```

- `at`：這張地圖的一格（在地圖內）。打開時變成通道格，關著時還原成畫的字元。畫成 `.` 是一直看得到的路口；畫成 `#` 是打開前像牆的暗門。
- `to.area`：
  - **城鎮區塊** `<聚落 id>/<區塊 id>`：那一格要是**牆 `#` 或水 `~`**，而且不是待售房子的格子，不是的話整條通道拿掉。打開時那一格變成通道，關著時還是牆。
  - **別張固定特殊地圖** `sm/<id>`：任何一格都可以（同一個包裡的地圖也認得）。不能接自己。
  - 近郊、地下城每次重新生成，不能接。
- `to.x`、`to.y`：要在對方地圖內。
- `requires.flags`、`requires.flags_none`：各最多 4 個劇情旗標；成立時才打開。沒寫時一直開著。
- **一條通道只寫一次**（寫在其中一張特殊地圖上），另一頭自動接回來。
- 走上通道格就站到另一頭的通道格上；從城鎮走進來時記下回程，走回城鎮那一頭就算離開。

找城鎮區塊上可以接的牆或水：用 [landmarks.md 2.1 節](landmarks.md#21-找一格空地)的腳本，在專案根目錄執行 `node /tmp/town-cells.mjs <聚落 id> <你的檔案>`，從「可以接通道的牆／水（旁邊走得到）」挑一格。腳本已經排除：

- 旁邊沒有可走格子的牆（打開了也走不到）；
- **待售房子**的格子（遊戲裡那一格會變成房子，整理時會拿掉這條通道）；
- 已經被別的通道用掉的格子（內建的下水道接在 `rhineburg/lower` 的 (5, 6)）。

最穩的是區塊最外圈的牆（不是數字、不是城門 `E`）：待售房子不會在外圈。

### 2.4 商店

```json
"shops": [
  { "shop": "general", "x": 3, "y": 5 },
  { "shop": "tavern", "x": 6, "y": 5 }
]
```

- `shop` 是店種 id（`data/rules/shops.json` 的 `types`）：`general`（雜貨店）、`temple`、`smithy`、`tailor`、`jeweler`、`magic`、`informant`、`tavern`；或同一個包裡 `shops` 的自建商店 id（`shop_` 開頭）。流浪商人 `wanderer` 不行；旅店、公會不是店種，不能擺。
- 那一格變成這種店，原本畫的字元被蓋掉：畫成 `.`，而且旁邊走得到。同一格只能一家。
- 物價與貨色照所屬地點。

### 2.5 BOSS 格

```json
"bosses": [
  { "x": 5, "y": 1, "group": [["skeleton_knight", 1], ["skeleton", 2]], "name": "墓室守衛長" }
]
```

- 座標要是 `grid` 裡畫成 `B` 的格子，一格一組；沒畫在 `B` 上的設定在匯入時拿掉。
- `group` 最多 4 種怪物、每種 1～6 隻（怪物 id 要存在，同一包裡新增的也算）；`name` 選填，最多 12 字，顯示在地圖上與戰鬥場景（「地下墓室・墓室守衛長」）。
- 畫了 `B` 但沒有設定（或怪物都不存在）時照強敵的規則（遭遇表最大的一組再多一隻），名字是「BOSS」。
- 戰鬥照層主的格子（怪物比較容易帶特徵），但特殊地圖的 BOSS 不給公會的層主功績。打倒之後不再出現；`refresh` 的地圖離開再進來時重來。強度參考 [balance/monsters](../balance/monsters.md) 的層主。

## 3. 可以引用什麼

特殊地圖引用的（要先存在）：

| 欄位 | 要先有 |
|---|---|
| `location` | `geography.json` 的地點（地點不能從內容包新增） |
| `table` | 內建或同一個包裡的怪物 id（見 2.2） |
| `resource_items` | 內建或同一個包裡的物品名稱（見 2.2） |
| `connections[].to.area` | 聚落的區塊（`data/world/maps.json`），或內建、同一個包裡的固定特殊地圖 |
| `connections[].requires` | 劇情旗標：由特殊任務、事件的 `set_flags` 設定 |
| `shops[].shop` | 內建店種，或同一個包裡的自建商店 |

引用特殊地圖的：

- **傳送進來**：特殊任務（或旅途、城鎮事件）結果的 `special_map`，寫 id。報告提交之後傳送到入口。
  ```json
  "success": { "text": "你撬開石板，順著梯子爬了下去。", "set_flags": ["wg_undercroft_open"], "special_map": "sm_wg_undercroft" }
  ```
- **任務點**：`"at": { "where": "special", "special_map": "<id>" }`，⭐ 隨機放在一格空地。固定地圖可以再寫 `x`、`y` 指定格子：要是道路，或畫好的 `M`、`X`、`R`、`C`、`T`；**不能是**入口、通道端點、牆、水、出口、安全房、商店（檢查報告會提醒，遊戲裡改成隨機）。不用寫 `location`。
  ```json
  "at": { "where": "special", "special_map": "sm_wg_undercroft", "x": 3, "y": 3 }
  ```
- **固定 NPC 站在地圖上**：`"fixed": { "area": "sm/<id>", "x": .., "y": .. }`（依旗標改變出沒的 `stages[].fixed` 也一樣）。只有固定地圖；那一格不能是牆或水，否則拿掉。
  ```json
  "fixed": { "area": "sm/sm_wg_undercroft", "x": 3, "y": 1 }
  ```
- **別張特殊地圖的通道**：`"to": { "area": "sm/<id>", ... }`。

## 4. 最小範例

一間固定的小地窖，只能由傳送進來（或從別張地圖的通道接進來）。

```json
{
  "type": "elondia-content",
  "specialMaps": {
    "sm_wg_cellar": {
      "id": "sm_wg_cellar",
      "name": "鐘樓地窖",
      "location": "rhineburg",
      "desc": "帝國鐘樓底下的舊地窖，堆著發霉的木箱，牆角長著一圈蒼白的蘑菇。",
      "grid": [
        "#######",
        "#.....#",
        "#..R..#",
        "#.....#",
        "###E###"
      ],
      "custom": true
    }
  }
}
```

## 5. 完整範例

三張地圖：固定的地下墓室（所有圖例、額外內容、遭遇表、入口、兩條通道、兩家店）、第 4 節的地窖（墓室的通道接過去），和一張隨機坑道。

- 墓室左邊的 (0, 3) 接到 `rhineburg/avenue` 的 (0, 4)（帝國大道西側的牆），旗標 `wg_undercroft_open` 成立後才打開；右下的 (10, 5) 一直通到地窖的 (6, 2)（地窖右邊的牆）。
- 墓室的 (3, 3) 留給任務點，(3, 1) 留給固定 NPC（第 3 節的例子）。

```json
{
  "type": "elondia-content",
  "specialMaps": {
    "sm_wg_cellar": {
      "id": "sm_wg_cellar",
      "name": "鐘樓地窖",
      "location": "rhineburg",
      "desc": "帝國鐘樓底下的舊地窖，堆著發霉的木箱，牆角長著一圈蒼白的蘑菇。",
      "grid": [
        "#######",
        "#.....#",
        "#..R..#",
        "#.....#",
        "###E###"
      ],
      "custom": true
    },
    "sm_wg_undercroft": {
      "id": "sm_wg_undercroft",
      "name": "帝國大道地下墓室",
      "location": "rhineburg",
      "desc": "帝國大道底下一段被封起來的舊墓室，石棺排在兩側，積水的渠道把墓室切成兩半。盜墓賊在角落搭了個小攤子，偶爾有骷髏從棺材裡爬出來。",
      "lighting": "dark",
      "layer": "shallow",
      "refresh": true,
      "grid": [
        "#####E#####",
        "#S..M...C.#",
        "#.##.~~~#.#",
        "......X...#",
        "#.T.#~~~#R#",
        "#..........",
        "###########"
      ],
      "encounters": [1, 2],
      "elites": 1,
      "traps": [1, 1],
      "resources": [0, 1],
      "chests": [0, 1],
      "table": [
        [["skeleton", 2]],
        [["grave_rat", 1], ["skeleton", 1]],
        [["bandit", 2]]
      ],
      "resource_items": ["古舊骨片", "夜光蘑菇"],
      "entry": { "x": 2, "y": 3 },
      "connections": [
        { "at": { "x": 0, "y": 3 }, "to": { "area": "rhineburg/avenue", "x": 0, "y": 4 }, "requires": { "flags": ["wg_undercroft_open"] } },
        { "at": { "x": 10, "y": 5 }, "to": { "area": "sm/sm_wg_cellar", "x": 6, "y": 2 } }
      ],
      "shops": [
        { "shop": "general", "x": 3, "y": 5 },
        { "shop": "tavern", "x": 6, "y": 5 }
      ],
      "custom": true
    },
    "sm_wg_tunnels": {
      "id": "sm_wg_tunnels",
      "name": "鼠群坑道",
      "location": "rhineburg",
      "desc": "下水道更深處被巨鼠挖開的坑道，又窄又低，每次走進去路都不太一樣。",
      "lighting": "dark",
      "layer": "shallow",
      "refresh": true,
      "size": [12, 9],
      "carve_steps": 60,
      "encounters": [1, 2],
      "traps": [0, 1],
      "resources": [1, 2],
      "chests": [0, 1],
      "table": [
        [["giant_rat", 2]],
        [["cave_bat", 1], ["giant_rat", 1]]
      ],
      "resource_items": ["熒光苔蘚", "夜光蘑菇"],
      "custom": true
    }
  }
}
```

規模的參考：內建的下水道 11 × 7，畫了遭遇 2、強敵 1、資源 1、寶箱 1、陷阱 1，另外撒資源 1；淺層的怪物等級 1～3。

## 6. 常見錯誤

整理時（`sanitizeSpecialMapMod`）不報錯，直接改掉或拿掉的：

| 寫法 | 結果 |
|---|---|
| id 不是 `sm_` 開頭的小寫英數與底線 | 整筆丟掉 |
| `location` 拼錯 | 換成 `soriel`（內建的換回原本的地點） |
| `lighting`、`layer` 寫錯 | 換成 `dark`、`shallow` |
| `grid` 裡有圖例以外的字元（`W`、`D`、中文、城鎮的字母） | 變成 `#` |
| 寫了 `legend` | 拿掉（不能自訂圖例），用到的字元變成 `#` |
| `grid` 超過 20 列或 20 欄 | 截掉 |
| `size` 超出 3～20、`carve_steps` 超出 5～400 | 夾到範圍內 |
| `encounters` 等寫成一個數字（`2`）或 `[0, 0]` | 拿掉；要寫 `[最少, 最多]` |
| `elites` 超過 5、數量超過 20 | 夾到範圍內 |
| `table` 用了不存在的怪物 id、一組超過 4 種、數量超出 1～6 | 拿掉那隻怪物（整組空了就拿掉整組）、多的截掉、數量夾住 |
| `resource_items` 用了拼錯的物品 | 拿掉 |
| `entry` 在地圖外 | 拿掉 |
| 隨機地圖（沒有 `grid`）寫了 `connections`、`shops` | 拿掉 |
| 通道的城鎮那一頭不是牆或水（街道、商店、城門、區塊之間的數字格），或是待售房子的格子 | 整條拿掉 |
| 通道的 `to.area` 拼錯、接到近郊或地下城、接自己、座標在對方地圖外 | 整條拿掉 |
| `at` 在這張地圖外 | 整條拿掉 |
| 超過 8 條通道 | 只看前 8 條（不合的也算在內） |
| `shops` 用了 `shop`（應該是 `general`）、`inn`、`guild`、`wanderer`、不存在的自建商店、格子在地圖外、兩家同一格 | 拿掉那一家 |
| 字串太長（name 16、desc 300） | 截斷 |
| 修改內建地圖只寫要改的欄位 | 沒寫的（通道、遭遇表、`refresh`……）被拿掉：要寫整份 |

另外要注意（整理不會改，但遊戲裡不對）：

- 通道的另一頭接到**隨機**特殊地圖：整理時算合格，但那張圖每次重挖，通道格可能被牆包住。只接固定地圖。
- 固定地圖畫成走不通、沒有出口也沒有通道：不會被改，但玩家會卡住。
- 商店擺在牆上：會變成店，但可能走不到。
- 寫完一定跑檢查：`WORLD=<檔案> WORLD_TRIALS=6 npx vitest run src/__tests__/worldCheck.spec.ts`，報告（同資料夾的 `check-report.md`）裡「特殊地圖「…」整理時改了」就是上表寫錯的地方；任務點格子不合時也會在「特殊任務」提醒。要改到沒有。

## 7. 相關的系統文件

- [docs/SPECIAL_MAPS.md](../../docs/SPECIAL_MAPS.md)：特殊地圖的規則（版面、進出、通道、刷新、任務點、商店、固定 NPC）
- [docs/CONTENT_EDITOR.md](../../docs/CONTENT_EDITOR.md) 3.95 節：內容編輯器的特殊地圖頁籤
- [docs/DUNGEON_DESIGN.md](../../docs/DUNGEON_DESIGN.md)：遭遇、陷阱、寶箱、光線
- [docs/WORLD.md](../../docs/WORLD.md)：區域、聚落地圖與區塊
- [docs/STORY_QUESTS.md](../../docs/STORY_QUESTS.md)：任務點與傳送
- [docs/TRADE.md](../../docs/TRADE.md)：擺在地圖上的商店
- [docs/NPC_SYSTEM.md](../../docs/NPC_SYSTEM.md)：固定 NPC 站的格子
- [docs/MONSTERS.md](../../docs/MONSTERS.md)：怪物的出現地點（`spawns`）
- [landmarks.md](landmarks.md)：找城鎮區塊格子的腳本
