# 新增地標（landmarks）

> 遊戲規則見 [docs/LANDMARKS.md](../../docs/LANDMARKS.md)；這份只寫生成內容時要填什麼、填在哪裡、哪些值會被整理掉。
> 整理程式：`src/engine/landmarkMods.ts` 的 `sanitizeLandmarkMod`；擺上地圖：`src/engine/grid.ts` 的 `buildBlock`。

## 1. 用途與放在哪裡

地標是**聚落地圖上的一格**，代表那座城的特色建築。格子的種類就是地標的 id，所以特殊任務、固定 NPC、特質的受訓地點都直接用 id 指它。

- section key：`landmarks`。世界包寫在 `content.landmarks`，內容檔寫在最上層的 `landmarks`。
- 每一筆的 key 就是 id，要符合 `/^lm_[a-z0-9_]+$/`（小寫英數與底線）。不合的整筆丟掉。建議加上世界的前綴，例如 `lm_myworld_clocktower`，避免和內建或別的世界撞名。
- **新增**：寫 `"custom": true`，可以擺在任何聚落（不能是地下城）。
- **修改內建**：用內建的 id、不寫 `custom`，而且要**寫整份**（從 `data/world/landmarks.json` 複製再改）：沒寫的欄位（`visit`、`work`……）會被拿掉。內建地標只能在**同一個聚落**裡換格子。
- 一個地標只在一處。

## 2. 欄位一覽

| 欄位 | 型別 | 範圍 | 說明 |
|---|---|---|---|
| `id` | 字串 | 同 key | 寫和 key 一樣的值 |
| `custom` | `true` | | 新增的一定要寫；修改內建時不寫 |
| `name` | 字串 | 1～12 字 | 超過截斷 |
| `emoji` | 字串 | 最多 8 個字元（JS 長度） | 地圖與標題的圖示；組合式 emoji 可能超過 8 被截斷，用單一個 |
| `location` | 聚落 id | `geography.json` 裡不是 `dungeon` 的地點 | 自建的地標**由 `at.area` 決定**，寫了別的會被改掉；內建的不能換 |
| `at.area` | 區塊 key | `<聚落 id>/<區塊 id>` | 要是這個聚落的區塊（見 2.1） |
| `at.x`、`at.y` | 整數 | 0 ≤ x < 寬、0 ≤ y < 高 | x 是第幾欄、y 是第幾列（`grid[y][x]`），從 0 起算；**那一格要是空的街道 `.`**（見 2.1） |
| `desc` | 字串 | ≤ 200 字 | 地點面板的說明（給玩家看） |
| `scene` | 字串 | ≤ 200 字 | 氛圍：站在這裡做主動行動時，AI 的場景加上「・名稱（氛圍）」。寫看得到、聽得到的東西 |
| `types` | 字串陣列 | 最多 4 個，見下表 | 決定聚到這裡的居民與公會委託 |
| `open.hours` | `"day"`／`"night"` | | 只在白天（6～18 時）／只在夜裡開放 |
| `open.flags`、`open.flags_none` | 字串陣列 | 各最多 4 個，每個 ≤ 40 字 | 劇情旗標：這些成立、那些不成立時才開放（空白換成 `_`） |
| `open.min_reputation` | 整數 | 1～100 | 在**這個聚落所屬勢力**的聲望至少要多少 |
| `open.official` | `true` | | 官方場所：逃亡奴隸不能用 |
| `open.hidden` | `true` | 要有 `open.flags` 或 `open.flags_none` | 旗標的條件不成立時不顯示：地圖上是普通的道路（例如完成任務才出現的店、秘密俱樂部） |
| `open.adult` | `true` | | 成人向的場所：沒有開啟成人向時不開放，地圖上也不顯示 |
| `visit.title` | 字串 | 1～16 字 | **必填**，沒有時整個 `visit` 拿掉 |
| `visit.desc` | 字串 | ≤ 200 字 | |
| `visit.money_cc` | 整數 | 1～100000 | 參訪費（白鸛幣）；0 不寫 |
| `visit.hours` | 數字 | 0.5～24，0.5 的倍數 | 花的時間；沒寫時是 0.5 |
| `visit.effects` | 效果陣列 | 最多 6 個，見 2.2 | 參訪得到的 |
| `visit.cooldown_days` | 整數 | 2～60 | 隔幾天才能再來；預設 1（每天一次），**1 不要寫** |
| `explore.title` | 字串 | 1～16 字 | **必填**，沒有時整個 `explore` 拿掉 |
| `explore.desc` | 字串 | ≤ 200 字 | |
| `explore.attr` | `str`／`dex`／`int`／`fai`／`cha` | | 檢定屬性；沒寫時 `int` |
| `explore.dc` | 整數 | 5～30 | 沒寫時 12 |
| `explore.hours` | 數字 | 0.5～24，0.5 的倍數 | 沒寫時 2 |
| `explore.effects` | 效果陣列 | 最多 6 個 | 成功（含大成功）得到的 |
| `explore.critical` | 效果陣列 | 最多 6 個 | 大成功另外得到的 |
| `explore.cooldown_days` | 整數 | 1～60，不要寫 7 | 預設 7（失敗也算） |
| `work.attr` | 屬性 id | | 沒寫時 `cha` |
| `work.dc` | 整數 | 5～30 | 沒寫時 12 |
| `work.rate_cc` | 整數 | 0～100 | 時薪（白鸛幣）；沒寫時 3 |
| `work.desc` | 字串 | ≤ 200 字 | 沒寫時「在這裡幫忙。」；打工的名稱固定是「<地標名稱>的雜務」 |
| `scenes` | 場景陣列 | 最多 8 個，見 2.3 | 條件成立時可以選的固定場景（例如解鎖的特殊區域） |
| `interior` | 特殊地圖 id | 同一個聚落的**固定**特殊地圖 | 內部：地標格變成入口，從出口離開回到地標格；場景可以用 `spot` 指定在裡面的哪一格。不合的會被拿掉 |

地標的類型（`data/world/landmarks.json` 的 `types`）：

| id | 名稱 | 聚到這裡的居民 | 公會委託（範本） |
|---|---|---|---|
| `holy` | 聖地 | 一般人、神官與主教（很高）、好人 | 守夜、調查怪聲、維持儀式秩序 |
| `academy` | 學院 | 一般人、冒險者、貴族 | 替學者找資料 |
| `official` | 官府・議會 | 貴族、皇族 | 守夜、維持儀式秩序 |
| `military` | 軍事・校場 | 冒險者 | 擔任陪練對手 |
| `market` | 市集・交易 | 一般人、商人、旅人、惡人 | 卸貨、揪出扒手 |
| `workshop` | 工坊 | 一般人 | 清除巨鼠、搬運礦石 |
| `harbor` | 碼頭・渡口 | 旅人、商人 | 清除巨鼠、卸貨 |
| `monument` | 古蹟 | 一般人、冒險者、旅人 | 清除巨鼠、守夜、調查怪聲 |
| `nature` | 自然 | 一般人 | 採集藥草 |
| `haunted` | 陰森之地 | 惡人 | 清除巨鼠、調查怪聲 |

公會委託的範本（`data/rules/town_quests.json`）不能從內容包新增或修改；地標只要有符合的類型，委託板就會自動用它（標題的 `{landmark}` 換成地標名稱，執行地點就是那一格）。沒有類型的地標不會有委託，居民也不會特別聚過去。

### 2.1 找一格空地

聚落的區塊在 `data/world/maps.json`：

- `maps.<聚落 id>.blocks[]`：每個區塊有 `id`、`name`、`grid`（字串陣列，一列一個字串）、`links`、`zone`。區塊 key 是 `<聚落 id>/<區塊 id>`，例如 `rhineburg/lower`。沒有自己地圖的聚落用 `templates`（依 `template_by_type`），目前每個聚落都有自己的地圖。
- 圖例（`legend`）：`#` 建築（牆）、`~` 水道、`.` 街道、`I` 旅店、`G` 冒險者公會、`T` 酒館、`S` 雜貨店、`C` 神殿、`E` 城門、`B` 娼館、`F` 鐵匠鋪、`D` 裁縫店、`J` 珠寶店、`M` 魔法物品店、`N` 情報商、`H` 民宅、`K` 刺青店、`X` 刻印師。數字 `1`～`9` 是往別的區塊的通道（`links` 寫通到哪個區塊）。
- `zone: "noble"`（貴族區）被通緝時進不去；`zone: "palace"`（王城）要聲望或通行許可才進得去。一般的地標不要擺在王城。

遊戲組出一個區塊的順序（`settlementArea` → `buildBlock`，遊戲裡再加上 `getArea` 的部分）：

1. 照 `grid` 與圖例建立格子（數字變成通道）。
2. 內容包移動或擺上的商店蓋上去。
3. 地標：**只有那一格是街道（floor）時才擺上去**，不是的話地標不顯示；同一格有兩個地標時，內建的（或先登錄的）佔走。
4. 遊戲裡：**待售的房子**（`homes.ts` 的 `lotsOf`，大多是臨街的建築格，有些城是街道格）蓋上去，接著是特殊地圖的通道。

所以「空地」是：`grid` 上是 `.`，而且不是別的地標、待售房子、內容包擺的商店。**整理時不檢查這一點**：套用時不是街道或是待售房子的，地標照樣登錄（用到它的 NPC 與任務不會失效），但地圖上看不見，並列進匯入的問題（「地標「名」的位置（x, y）不是空地（道路）」「……是待售的空地」），世界檢查是錯誤。一定要用下面的腳本挑格子。

把下面的腳本存成 `/tmp/town-cells.mjs`，在專案根目錄執行 `node /tmp/town-cells.mjs <聚落 id> [世界包或內容檔]`。它印出每個區塊的格子（附座標）、可以擺地標的空地，以及可以接特殊地圖通道的牆或水（[special-maps.md](special-maps.md) 用）。給了檔案時，也排除檔案裡已經用掉的地標、商店與通道格子。

```js
// 用法（在專案根目錄）：node /tmp/town-cells.mjs <聚落 id> [世界包或內容檔.json]
import fs from 'node:fs'
const [loc, packPath] = process.argv.slice(2)
const J = (p) => JSON.parse(fs.readFileSync(p, 'utf8'))
const maps = J('data/world/maps.json'), geo = J('data/world/geography.json'), homes = J('data/rules/homes.json')
const L = geo.locations.find((l) => l.id === loc)
if (!L || L.type === 'dungeon') throw new Error(`${loc} 不是聚落`)
const pack = packPath ? J(packPath) : {}
const content = pack.type === 'elondia-world' ? pack.content : pack
// 地標：內建的，再套上這個檔案的（同 id 的覆蓋）
const lms = Object.fromEntries(J('data/world/landmarks.json').landmarks.map((l) => [l.id, l]))
Object.assign(lms, content.landmarks ?? {})
// 特殊地圖的通道端點：內建的與這個檔案的
const sms = { ...J('data/world/special_maps.json').maps, ...(content.specialMaps ?? {}) }
const ends = Object.values(sms).flatMap((m) => (m.connections ?? []).map((c) => c.to))
// 這個檔案的商店擺的位置
const shopCells = Object.values(content.shops ?? {}).flatMap((s) => [...(s.places ?? []), ...(s.moves ?? []).map((m) => m.to)])
const blocks = maps.maps[loc]?.blocks ?? maps.templates[maps.template_by_type[L.type] ?? 'town'].blocks
// 待售的空地（照 src/engine/homes.ts 的 lotsOf）：遊戲裡會蓋掉那一格
const hash = (t) => { let h = 2166136261; for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619) >>> 0; return h }
const cand = { b: [], s: [] }
for (const b of blocks) {
  if (b.zone === 'palace') continue
  for (let y = 1; y < b.grid.length - 1; y++) for (let x = 1; x < b.grid[0].length - 1; x++) {
    const ch = b.grid[y][x]
    if (ch !== '#' && ch !== '.') continue
    const street = [[0, 1], [0, -1], [1, 0], [-1, 0]].map(([dx, dy]) => ({ x: x + dx, y: y + dy })).find((p) => b.grid[p.y]?.[p.x] === '.')
    if (!street) continue
    const id = `${loc}:${b.id}:${x},${y}`
    cand[ch === '#' ? 'b' : 's'].push({ area: `${loc}/${b.id}`, x, y, street, noble: b.zone === 'noble', order: hash(id) })
  }
}
cand.b.sort((a, c) => a.order - c.order); cand.s.sort((a, c) => a.order - c.order)
const want = homes.lots[L.type] ?? 1, lots = []
const noble = cand.b.find((c) => c.noble) ?? cand.s.find((c) => c.noble)
for (const c of [...(noble ? [noble] : []), ...cand.b, ...cand.s]) {
  if (lots.length >= want) break
  if (lots.includes(c) || lots.some((o) => o.area === c.area && ((o.street.x === c.x && o.street.y === c.y) || (o.x === c.street.x && o.y === c.street.y)))) continue
  lots.push(c)
}
const at = (list, key, x, y) => list.some((p) => p.area === key && p.x === x && p.y === y)
const walk = (ch) => ch !== undefined && ch !== '#' && ch !== '~' && ch !== 'H'
for (const b of blocks) {
  const key = `${loc}/${b.id}`, w = b.grid[0].length, h = b.grid.length
  const free = [], conn = []
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ch = b.grid[y][x]
    const taken = at(Object.values(lms).map((l) => l.at), key, x, y) || at(lots, key, x, y) || at(shopCells, key, x, y)
    if (ch === '.' && !taken) free.push(`(${x},${y})`)
    const door = [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => walk(b.grid[y + dy]?.[x + dx]))
    if ((ch === '#' || ch === '~') && door && !at(lots, key, x, y) && !at(ends, key, x, y)) conn.push(`(${x},${y})${ch === '~' ? '水' : ''}`)
  }
  console.log(`\n== ${key}  ${b.name}  ${w}×${h}${b.zone ? `  zone=${b.zone}` : ''}`)
  console.log('   ' + [...Array(w).keys()].map((x) => x % 10).join(''))
  b.grid.forEach((r, y) => console.log(String(y).padStart(2) + ' ' + r))
  console.log('可以擺地標的空地：' + (free.join(' ') || '（沒有）'))
  console.log('可以接通道的牆／水（旁邊走得到）：' + (conn.join(' ') || '（沒有）'))
}
```

步驟：

1. 決定聚落（`geography.json` 的 `locations[].id`，`type` 不是 `dungeon`）。
2. 跑腳本，帶上你正在寫的檔案，從「可以擺地標的空地」挑一格；寫進 `at`。
3. 同一個聚落要放好幾個地標時，每放一個就重跑一次（檔案裡的地標會被排除）。
4. 想挑「感覺對」的位置：神殿旁、城門口、水道邊……看印出的格子與座標決定。

### 2.2 參訪與探索可以用的效果

只收下面這些種類（其他種類，例如 `start_story`、`companion`、`enslave_player`，整理時拿掉）；格式和特殊任務的效果相同（[docs/EFFECTS.md](../../docs/EFFECTS.md)）。

| type | 欄位 | 範圍 |
|---|---|---|
| `money` | `amount` | 整數，負數是花費 |
| `item` | `name`、`qty` | qty −99～99（預設 1）；**名稱要和物品完全一樣**（內建或這個包裡的），整理時不檢查 |
| `gear` | `spec`（底材 × 材料……）、`name`、`desc` | 見 [items-gear.md](items-gear.md) |
| `xp` | `amount` | 1～1000000 |
| `reputation` | `faction`、`delta` | delta −20～20；`faction` 寫**勢力 id**（`geography.json` 的 `factions`，例如 `rhine_empire`） |
| `affinity` | `npc`、`delta`、`reason` | delta −50～50；npc 是固定 NPC 的 id |
| `memory` | `summary`、`importance` | summary ≤ 200 字；importance 1～3（預設 2） |
| `ability` | `ability`（能力 id）或 `choices` | choices 1～5（「N 選一」） |
| `hp` | `ratio` | −0.9～1（比例）；`target` 一律是主角 |
| `perk` | `perk`、`options`、`direct` | 可以選的特質 id |
| `condition` | `condition`、`add` | `blessed` `cheered` `honed` `relaxed` `well_rested` `tipsy` `shaken` `punished` `fed_light` `fed_fine` `fed_well` `fed_feast` `fed_legend`；`add: false` 是拿掉 |
| `tattoo` | `template`（圖樣 id）或自己描述 | 見 [statuses-perks-tattoos.md](statuses-perks-tattoos.md) |

### 2.3 場景（`scenes`）

條件成立時可以選的固定場景：付錢、花時間，在場的固定 NPC 加好感，得到效果，AI 照 `scene` 寫經過（標了成人向的照成人場景規則詳細描寫）。預設每 3 天一次，同一個地標的場景共用冷卻。系統說明見 [LANDMARKS](../../docs/LANDMARKS.md) 第 6 節。

| 欄位 | 型別 | 範圍 | 說明 |
|---|---|---|---|
| `title` | 字串 | 1～16 字 | **必填**：按鈕的名稱；同一個地標裡不要重複 |
| `scene` | 字串 | 1～400 字 | **必填**：交給 AI 的經過。`{cast}` 換成在場的人 |
| `desc` | 字串 | ≤ 200 字 | 地點面板的說明（給玩家看） |
| `tags` | 字串陣列 | `adult`、`ntr`、`non_virgin`、`pc_unwilling` | 內容標籤：設定關掉的標籤不出現；`adult` 的場景交給 AI 時標成成人場景 |
| `requires.flags`、`requires.flags_none`、`requires.flags_any` | 字串陣列 | 各最多 4 個 | 劇情旗標：成立／不成立／任一個成立時才出現 |
| `pc_body` | 字串陣列 | `masc`、`fem`、`andro` | 只給這些體型的主角；三個都寫或都不寫＝都可以 |
| `cast` | 陣列 | 最多 6 個 | 登場的固定 NPC：`{ "npc": "<id>", "flags": [...] }`。寫了 `flags` 的，旗標成立才在場；沒寫的一定在場（死了或被抓走時整個場景不出現） |
| `extras` | 字串 | ≤ 30 字 | 有寫了旗標的人不在場時，代替的人（例如「其他不知名的魅魔」） |
| `money_cc` | 整數 | 1～100000 | 花費；0 不寫 |
| `hours` | 數字 | 0.5～24，0.5 的倍數 | 沒寫時 2 |
| `effects` | 效果陣列 | 最多 6 個，見 2.2 | |
| `affinity` | 整數 | 1～30 | 在場的每個固定 NPC 加的好感 |
| `cooldown_days` | 整數 | 1～60，不要寫 3 | 隔幾天才能再來；預設 3 |
| `own_cooldown` | `true` | | 自己算冷卻，不和其他場景共用（例如咖啡廳前廳的喝茶） |
| `spot` | `{ "x": 整數, "y": 整數 }` | 內部地圖裡走得到的一格（不是牆或水） | 只在內部的那一格出現；沒寫時在外面的地標格上。地標沒有 `interior` 時拿掉 |
| `spot_name` | 字串 | ≤ 16 字 | 那一格的名稱（地圖提示、地點面板的標題），例如「米米的小房間」 |

## 3. 可以引用什麼

地標引用的（要先存在）：

| 欄位 | 要先有 |
|---|---|
| `at.area` | 聚落的區塊（`data/world/maps.json`）；城鎮地圖不能從內容包新增 |
| `types` | `data/world/landmarks.json` 的類型（上表 10 種） |
| `open.flags` | 劇情旗標：由特殊任務、事件的 `set_flags` 設定 |
| 效果的 `item`、`ability`、`perk`、`tattoo`、`affinity.npc` | 內建或同一個包裡的物品、能力、特質、刺青圖樣、固定 NPC |

引用地標的（地標要先在同一個包裡或是內建的）：

- **特殊任務的任務點**：`"at": { "where": "cell", "location": "<地標的聚落>", "cell": "<地標 id>" }`。`location` 要和地標的聚落一樣，否則換成酒館。地標擺錯格子（不顯示）時，檢查報告會出錯誤「<聚落>沒有<地標 id>」。
  ```json
  "at": { "where": "cell", "location": "rhineburg", "cell": "lm_wg_clocktower" }
  ```
- **固定 NPC 待在地標**：`"landmark": "<地標 id>"`，NPC 的 `location` 要是地標的聚落，否則拿掉。
  ```json
  "location": "rhineburg",
  "landmark": "lm_wg_clocktower"
  ```
- **受訓**（特質的寫法見 [statuses-perks-tattoos.md](statuses-perks-tattoos.md)）：寫在**特質**上（`perks.<特質 id>.train.cells` 加上地標 id），不在地標上。要讓內建特質也能在這裡學，用內建特質的 id 寫**整份**特質（從 `data/rules/perks.json` 複製），在 `train.cells` 加上地標：
  ```json
  "perks": {
    "silver_tongue": {
      "id": "silver_tongue",
      "name": "能言善道",
      "desc": "魅力檢定 +1；殺價、交涉價格與談判再 +1。",
      "effects": [
        { "check": { "attrs": ["cha"] }, "bonus": 1 },
        { "check": { "kinds": ["haggle", "bargain"] }, "bonus": 1 },
        { "check": { "contexts": ["negotiation"] }, "bonus": 1 }
      ],
      "train": { "cells": ["tavern", "lm_wg_clocktower"], "price_cc": 300, "hours": 8, "attr": "cha", "dc": 12 },
      "npc": { "weight": 2, "tags": ["merchant", "noble"] }
    }
  }
  ```
- **公會委託**：看 `types`（第 2 節），不用另外寫。
- 城鎮事件（`travelEvents`）的設施清單**不能**選地標。

## 4. 最小範例

一個新地標：名稱、圖示、位置、說明、類型。

```json
{
  "type": "elondia-content",
  "landmarks": {
    "lm_wg_old_well": {
      "id": "lm_wg_old_well",
      "name": "老井廣場",
      "emoji": "🪣",
      "location": "rhineburg",
      "at": { "area": "rhineburg/lower", "x": 3, "y": 3 },
      "desc": "下城區居民打水、閒聊的小廣場，井邊的石欄被磨得發亮。",
      "types": ["market"],
      "custom": true
    }
  }
}
```

## 5. 完整範例

開放條件、參訪、探索（含大成功）、打工都有的自建地標，加上一個修改內建地標的例子（騎士學院：整份複製，只改 `desc`）。

```json
{
  "type": "elondia-content",
  "landmarks": {
    "lm_wg_clocktower": {
      "id": "lm_wg_clocktower",
      "name": "帝國鐘樓",
      "emoji": "🕰️",
      "location": "rhineburg",
      "at": { "area": "rhineburg/avenue", "x": 5, "y": 3 },
      "desc": "帝國大道正中的老鐘樓，鐘聲替整座首都報時。夜裡守鐘人會放信得過的人上去。",
      "scene": "巨大的齒輪在頭頂緩緩轉動，每到整點，鐘聲震得石牆嗡嗡作響。",
      "types": ["monument", "official"],
      "open": { "hours": "night", "flags_none": ["wg_bell_cracked"], "min_reputation": 5, "official": true },
      "visit": {
        "title": "登上鐘樓眺望",
        "desc": "付一點錢給守鐘人，爬上頂樓看首都的夜景。",
        "money_cc": 5,
        "hours": 1,
        "effects": [
          { "type": "condition", "target": "pc", "condition": "cheered", "add": true },
          { "type": "memory", "summary": "在帝國鐘樓頂上看過首都的夜景。", "importance": 1 }
        ],
        "cooldown_days": 3
      },
      "explore": {
        "title": "查看鐘樓的機關",
        "desc": "在齒輪之間找找有沒有人藏了東西。",
        "attr": "dex",
        "dc": 14,
        "hours": 2,
        "effects": [
          { "type": "money", "amount": 40 },
          { "type": "xp", "amount": 25 }
        ],
        "critical": [
          { "type": "item", "name": "藥草", "qty": 2 },
          { "type": "reputation", "faction": "rhine_empire", "delta": 2 }
        ],
        "cooldown_days": 10
      },
      "work": { "attr": "str", "dc": 11, "rate_cc": 3, "desc": "替守鐘人上油、搬運替換的齒輪。" },
      "custom": true
    },
    "lm_knight_academy": {
      "id": "lm_knight_academy",
      "name": "騎士學院",
      "emoji": "🛡️",
      "location": "rhineburg",
      "at": { "area": "rhineburg/gate", "x": 4, "y": 1 },
      "types": ["military", "academy"],
      "desc": "培養騎士的主要機構，教導騎士的思想與戰鬥技巧。最近開始收平民出身的見習生。",
      "scene": "校場上傳來整齊的喊聲與鐵器碰撞聲，見習騎士在教官的口令下操練。",
      "open": { "official": true },
      "work": { "attr": "str", "dc": 12, "rate_cc": 4, "desc": "替見習騎士整理裝備、餵馬、搬運訓練用的木樁。" },
      "explore": {
        "title": "旁聽戰術課",
        "attr": "int",
        "dc": 13,
        "hours": 3,
        "effects": [
          { "type": "xp", "amount": 30 },
          { "type": "memory", "summary": "在騎士學院旁聽了一堂戰術課。", "importance": 1 }
        ]
      }
    }
  }
}
```

數值的參考：參訪費 5～30 白鸛、1 小時；探索 DC 12～15、2～3 小時、冷卻 7～14 天，獎勵是 25～40 經驗、幾十白鸛或一筆記憶（比照第 5 節的內建地標，見 `data/world/landmarks.json`）。

## 6. 常見錯誤

整理時（`sanitizeLandmarkMod`）不報錯，直接改掉或拿掉的：

| 寫法 | 結果 |
|---|---|
| id 不是 `lm_` 開頭的小寫英數與底線 | 整筆丟掉 |
| `at.area` 不是聚落的區塊（拼錯、地下城、`sm/...`）、座標超出區塊 | 自建的整筆丟掉；內建的回到原位 |
| 內建地標的 `at.area` 換到別的聚落 | 回到原位 |
| 自建地標的 `location` 和 `at.area` 的聚落不同 | `location` 改成區塊的聚落 |
| `at` 指到牆、商店、別的地標或待售房子 | **不會被改**：遊戲裡地標不顯示。套用時列進匯入的問題，世界檢查是錯誤（「套用」）。用 2.1 的腳本挑格子 |
| `types` 寫了不存在的類型、超過 4 個 | 拿掉多的 |
| `visit`／`explore` 沒有 `title` | 整段拿掉 |
| `visit.cooldown_days: 1`、`explore.cooldown_days: 7` | 拿掉（就是預設值）。不要寫預設值 |
| `visit.money_cc: 0`、`open.min_reputation: 0`、`open.official: false`、空的 `open: {}` | 拿掉 |
| `hours` 不是 0.5 的倍數（例如 0.75） | 四捨五入到 0.5 的倍數 |
| 數值超出範圍（DC、時薪、天數、聲望、金額） | 夾到範圍內 |
| 字串太長（name 12、title 16、desc／scene 200） | 截斷 |
| 效果用了不收的種類（`start_story`、`companion`、`flag`……）、超過 6 個 | 拿掉 |
| `condition` 寫了不在清單裡的狀態（`slave_mark`、`fugitive`、戰鬥狀態） | 拿掉那個效果 |
| `explore.attr`／`work.attr` 寫錯 | 換成 `int`／`cha` |
| 修改內建地標只寫要改的欄位 | 沒寫的功能（參訪、探索、打工、氛圍）被拿掉：要寫整份 |

另外要注意（整理不會改，但遊戲裡不對）：

- `reputation` 效果寫 `"faction": "local"` 是所在地的勢力（地標所屬聚落的勢力；聚落沒有勢力時算冒險者公會）。想加別的勢力就寫實際的勢力 id。
- 所屬勢力是空的聚落（例如 `windhammer`、`ashport`，`geography.json` 沒有 `faction`）寫了 `open.min_reputation`，永遠不會開放。
- `item` 效果的物品名稱拼錯，整理時不會發現。
- 寫完一定跑檢查：`WORLD=<檔案> WORLD_TRIALS=6 npx vitest run src/__tests__/worldCheck.spec.ts`，報告（同資料夾的 `check-report.md`）裡「地標「…」整理時改了」就是上表寫錯的地方，要改到沒有。

## 7. 相關的系統文件

- [docs/LANDMARKS.md](../../docs/LANDMARKS.md)：地標的規則（類型、用途、公會委託、功能、內建的設定）
- [docs/CONTENT_EDITOR.md](../../docs/CONTENT_EDITOR.md) 3.9 節：內容編輯器的地標頁籤
- [docs/WORLD.md](../../docs/WORLD.md)：聚落地圖與區塊
- [docs/EFFECTS.md](../../docs/EFFECTS.md)：效果的格式
- [docs/WORK.md](../../docs/WORK.md)：打工
- [docs/PERKS.md](../../docs/PERKS.md)：特質的受訓地點
- [docs/STORY_QUESTS.md](../../docs/STORY_QUESTS.md)、[docs/NPC_SYSTEM.md](../../docs/NPC_SYSTEM.md)：任務點與固定 NPC
- [docs/HOMES.md](../../docs/HOMES.md)：待售的房子（會蓋掉地圖上的格子）
- [special-maps.md](special-maps.md)：特殊地圖（接到城鎮區塊的通道）
