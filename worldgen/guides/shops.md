# 商店（`shops`）

> 這份文件講商店的格式：修改內建的店種、新增自建的店，以及和商店有關、但寫在別的區塊的東西（固定 NPC 擔任店主、在店裡受訓的特質、擺在特殊地圖上的店）。每個欄位的範圍、能引用什麼，以及匯入時會被默默改掉的地方。
> 系統文件：[TRADE](../../docs/TRADE.md)（交易清單、價格、店主、交涉）、[CONTENT_EDITOR](../../docs/CONTENT_EDITOR.md) 第 3.8 節（商店的編輯、位置的規則）、[WORK](../../docs/WORK.md) 第 1 節（打工）、[PERKS](../../docs/PERKS.md) 4.2 節（受訓）、[SPECIAL_MAPS](../../docs/SPECIAL_MAPS.md) 第 6 節（地圖上的店）。程式：`src/engine/shopMods.ts` 的 `sanitizeShopMod`（整理）、`applyShopMod`、`computePlacements`（位置）；`src/engine/trade.ts`（清單、價格、店主）。

## 1. 用途與放在哪裡

- **區塊**：`shops`。世界包寫在 `content.shops`，內容檔寫在最外層的 `shops`（外層格式見 [content-file](content-file.md)）。
- **修改內建的店種**：key 是店種的 id（下表），**不加** `custom`。內建的店只能改一部分欄位（2.1 節），而且**只寫和內建不同的欄位**：和內建一樣的值會被拿掉，檢查會列出來。改的是這種店的設定，所有聚落的同一種店一起變。
- **新增自建的店**：key 是 `shop_<小寫英數>`，要符合 `/^shop_[a-z0-9]+$/`：**`shop_` 之後不能再有底線**（`shop_furrier` 可以，`shop_fur_trader` 整筆不收）。加 `"custom": true`，寫整份（2.2 節）。地圖格子的種類就是這個 id。
- 自建的店擺在聚落的格子上（`places`），也可以擺在固定的特殊地圖上（2.6 節）；兩者都沒有就遊戲裡找不到。

和商店有關、寫在別的區塊的：

| 要做的事 | 寫在哪裡 | 見 |
|---|---|---|
| 固定 NPC 擔任店主 | `npcs.<id>.keeper` | 2.5 節、[npcs](npcs.md) 2.3 節 |
| 在這種店受訓的特質 | `perks.<id>.train.cells` | 2.4 節、[statuses-perks-tattoos](statuses-perks-tattoos.md) |
| 店裡賣的物品 | 物品的 `tags`（目錄）或店的 `fixed` | 2.3 節、[items-gear](items-gear.md) 1.2 節 |
| 擺在特殊地圖上 | `specialMaps.<id>.shops` | 2.6 節、[special-maps](special-maps.md) |

### 1.1 內建的店種

| id | 店 | 格子種類（受訓、`moves` 用） | `maps.json` 的字元 | 目錄（`catalog`） | 預設收購（`buys`） | 打工（屬性、DC、時薪） | 專屬功能（不能改、自建的店沒有） |
|---|---|---|---|---|---|---|---|
| `general` | 雜貨店 | `shop` | `S` | `general` | food、gear、material | 智力 11、3 | 幫店主搬貨 |
| `temple` | 神殿 | `temple` | `C` | `temple` | scroll、consumable | 信仰 11、2 | 治療、捐獻、祝福 |
| `tavern` | 酒館 | `tavern` | `T` | `tavern` | food、info | 魅力 11、3 | 用餐、招募、請客、打聽、租工坊（烹飪） |
| `smithy` | 鐵匠鋪 | `smithy` | `F` | `smith` | equipment、material | 力量 12、4 | 委託打造（金屬、木材）、租工坊、拉風箱 |
| `tailor` | 裁縫店 | `tailor` | `D` | `tailor` | equipment、material | 靈巧 11、3 | 委託打造（皮革、布料）、租工坊、縫補 |
| `jeweler` | 珠寶店 | `jeweler` | `J` | `jeweler` | equipment、material | 魅力 12、4 | 委託打造（寶石）、租工坊、鑑定 |
| `magic` | 魔法物品店 | `magic` | `M` | `magic` | scroll、consumable、material | 智力 13、4 | 每天隨機進一批消耗品與材料、租工坊（煉金） |
| `informant` | 情報商 | `informant` | `N` | `info` | info | 魅力 12、3 | 事件點、特殊任務的消息、委託的線索 |
| `wanderer` | 流浪商人 | `merchant` | （不在城裡） | `magic` | material、consumable、info、equipment | 沒有 | 隨機的優良裝備。只能改外觀、AI、店主、固定清單、收購；沒有打工、受訓、位置，不能擔任店主、不能擺在特殊地圖 |

來源：`data/rules/shops.json` 的 `types`、`data/rules/work.json` 的 `jobs`（以格子種類為 key）。注意三組名稱不一樣：店種 id（`smithy`、`informant`）、目錄（`smith`、`info`）、格子種類（雜貨店是 `shop`）。

## 2. 欄位一覽

### 2.1 修改內建的店

| 欄位 | 型別 | 範圍 | 說明 |
|---|---|---|---|
| `emoji` | 字串 | 最多 8 個字元（UTF-16） | 地圖格子與地點卡片上的圖示 |
| `desc` | 字串 | 最多 200 字 | 站在店裡時顯示的描述 |
| `ai` | 布林 | | `false`：第一次進店時不請 AI 設計「今日特別商品」（內建都是 `true`，所以只會寫 `false`） |
| `keeper.title` | 字串 | 最多 **8** 字 | 生成的店主的稱呼（店主、司祭、鐵匠……） |
| `keeper.tags` | id 陣列 | `data/rules/npc_tags.json` 的 key | 生成的店主的標籤（決定 AI 怎麼描寫他）。整份取代；空的不收 |
| `fixed` | 陣列 | 2.3 節 | 固定清單：每天一定上架 |
| `buys` | 陣列 | `food`、`consumable`、`scroll`、`gear`、`material`、`equipment`、`info`、`furniture` | 收購哪些類別。**整份取代**內建的（要保留原本的就一起寫） |
| `work` | 物件 | `{ "dc": 5～30, "rate_cc": 0～100, "desc": 最多 200 字 }` | 打工的 DC、時薪（白鸛幣／小時）與描述。屬性不能改。只寫要改的那幾項 |
| `moves` | 陣列 | `[{ "from": 格子, "to": 格子 }]` | 把某個聚落的這家店搬到同一個聚落的另一格（2.6 節） |

不能改、寫了會被拿掉的：`name`、`catalog`（上架的目錄類型）、`craft`、`places`、`work.attr`、`custom`，以及店的專屬功能與內建的交易（`specials`：搬貨、請客、打聽……不在內容裡）。

### 2.2 自建的店

| 欄位 | 型別 | 範圍 | 說明 |
|---|---|---|---|
| `custom` | 布林 | 一律 `true` | |
| `name` | 字串 | 最多 **12** 字，預設「新的商店」 | 店名 |
| `emoji` | 字串 | 最多 8 個字元，預設 🏪 | 圖示 |
| `desc` | 字串 | 最多 200 字 | 描述 |
| `ai` | 布林 | 預設 `true` | AI 特別商品。自建的店的特別商品只能用物品、好感、旗標與記憶的效果 |
| `keeper` | 物件 | `{ "title": 最多 8 字（預設「店主」）, "tags": [...] }` | 生成的店主（普通人）的稱呼與標籤 |
| `catalog` | 字串 | `general`、`temple`、`tavern`、`smith`、`tailor`、`jeweler`、`magic`、`info`，或 `""` | **平常上架照哪一份內建目錄抽選**（1.1 節的「目錄」欄，不是店種 id）。`""`＝只賣固定清單。照 `magic` 目錄時沒有魔法物品店的每日隨機進貨 |
| `fixed` | 陣列 | 2.3 節 | 固定清單 |
| `buys` | 陣列 | 2.1 節的八種類別 | 收購的類別。不寫＝什麼都不收 |
| `work` | 物件 | `{ "attr": 屬性（預設 cha）, "dc": 5～30（預設 12）, "rate_cc": 0～100（預設 3）, "desc": 最多 200 字 }` | 打工，工作名稱是「店名＋幫工」。**不寫＝沒有打工** |
| `craft` | 陣列 | `metal`、`wood`、`leather`、`cloth`、`jewel` | 接哪些材料類型的委託打造。店主的工藝等級照一般店主（依聚落規模，見 [CRAFTING](../../docs/CRAFTING.md) 第 4 節）。空陣列＝不接 |
| `places` | 陣列 | 最多 20 格，`[{ "area": 區塊 key, "x": 欄, "y": 列 }]` | 擺在哪些格子（2.6 節）。每個聚落的店各自有店主與庫存 |

屬性：`str` 力量、`dex` 靈巧、`int` 智力、`fai` 信仰、`cha` 魅力。時薪參考：內建 2～6，一般人一天生活費約 15。

自建的店沒有專屬功能（治療、招募、情報、刺青、娼館、租工坊）、沒有內建的交易，生成的店主職業參考是盜賊、戰士、吟遊詩人。

### 2.3 固定清單 `fixed`

| 欄位 | 型別 | 範圍 | 說明 |
|---|---|---|---|
| `item` | 物品名稱 | 目錄裡的物品，或同一個包裡 `items` 的物品 | 不存在的、獨特物品（`gear.unique`）、有屬性加減（`gear.attrs`）的、主人強制裝備（`master_force`）的拿掉；同一件只留第一筆 |
| `stock` | 整數 | 1～99，預設 1 | 每天的份數 |
| `price_cc` | 整數 | 1～1000000 | 每一份的價格（再乘聚落的物價）。**不寫**＝目錄價，材料再乘 2（材料的目錄價是收購價）；寫了就用這個價格，材料不再加成 |

- 最多 20 筆。每天一定上架，不論 AI 開關；和目錄重複的以固定清單的份數與價格為準。
- 這就是世界能控制的「交易」：一般商品＝付錢拿一件物品。內建的特殊交易（搬貨、請客、打聽）與 AI 的特別商品不能在內容裡寫。
- 價格不要低於物品的收購價（非材料是目錄價的一半、材料是全價），否則買進賣出就能賺錢。
- 底材 × 材料自動產生的制式裝備可以直接寫名稱，同一個檔案裡新增的底材、材料產生的也可以（例如新材料「星鐵」＋內建匕首＝「星鐵匕首」，[items-gear](items-gear.md) 1.1 節）。

價格的完整算法（物價倍率、親密度折扣、聲望）見 [TRADE](../../docs/TRADE.md) 第 3 節。

### 2.4 受訓（寫在特質上）

哪些特質可以在這種店受訓，存在**特質**的 `train.cells` 上（和「🏛️ 地標」「🏪 商店」頁是同一份資料）：

```
"perks": { "<特質 id>": { …, "train": { "cells": ["tailor", "shop_furrier"], "price_cc": 400, "hours": 8, "attr": "str", "dc": 12 } } }
```

| 欄位 | 範圍 | 說明 |
|---|---|---|
| `train.cells` | 格子種類：`shop`（雜貨店）、`temple`、`tavern`、`smithy`、`tailor`、`jeweler`、`magic`、`informant`，以及 `inn` 旅店、`guild` 公會、`tattoo` 刺青店、`carver` 刻印師、`brothel` 娼館；自建商店的 id；地標的 id（`lm_…`） | 在哪些地方受訓。**雜貨店寫 `shop`，不是 `general`**；流浪商人不行。其他值拿掉，全部拿掉時整個 `train` 拿掉 |
| `train.price_cc` | 0～1000000，預設 300 | 學費 |
| `train.hours` | 1～72，預設 8 | 時數 |
| `train.attr` | 屬性，預設 `str` | 檢定的屬性 |
| `train.dc` | 5～30，預設 12 | DC |

- 自建的特質直接寫 `train`。要讓**內建的特質**也能在自建的店受訓，得修改那個特質（用原本的 id、寫整份資料，`train.cells` 加上店的 id；查 `data/rules/perks.json`）。
- 種族特質不能受訓。特質的其他欄位見 [statuses-perks-tattoos](statuses-perks-tattoos.md)。

### 2.5 店主

- **生成的店主**：每個聚落的每家店一位（`keeper_<地點>_<店種>`），第一次查看時生成，用店的 `keeper.title` 與 `keeper.tags`。
- **固定 NPC 擔任店主**：在固定 NPC 上寫 `"keeper": "<店種 id 或 shop_…>"`（[npcs](npcs.md) 2.3 節）。他取代**他的 `location` 那個聚落**的那家店的店主：交易、交涉、親密度折扣、委託打造的工藝等級都找他，平常待在店裡。所屬地點要真的有這家店（內建店種查 [npcs](npcs.md) 3.2 節；自建的店看 `places`；沒有時世界檢查會提醒）。他在隊伍裡、死亡、劇情旗標不符時換回生成的店主。同一家店有好幾位時用第一位。流浪商人與驛站不行。
- 店主寫成普通人（`"kind": "commoner"`，`occupation` 寫職業），沒有 `haunts`、`fixed` 也找得到（在店裡）。

### 2.6 位置

**格子**（`places`、`moves` 的 `from`／`to`）：`{ "area": "<地點 id>/<區塊 id>", "x": 欄, "y": 列 }`，從 0 開始，對照 `data/world/maps.json` 的 `maps.<地點>.blocks[].grid`（每一列是一個字串）。

- **目標要是空地**：`grid` 裡的 `.`（街道），而且**不是地標的格子**（`data/world/landmarks.json` 的 `at`，地標也擺在 `.` 上）、沒有別家店已經擺在那裡（內建的搬過去、自建的擺上去，同一格只能一家），也不是待售的空地（房屋用地，[HOMES](../../docs/HOMES.md)）。
- **自建的店 `places`**：可以擺在任何聚落（城鎮、村莊、港口、王都……），一個聚落可以擺好幾格（每一格是同一家店的入口，共用店主與庫存）。
- **內建的店 `moves`**：`from` 要是這種店原本的格子（`grid` 裡這種店的字元，1.1 節），`to` 要在**同一個聚落**（可以換區塊）。原本的格子變成街道。
- 整理**只檢查格子在區塊範圍內**：落在牆、水、設施、地標、待售的空地上或撞格的，套用時略過（自建的店不出現、內建的店留在原地），並列進匯入的問題（「商店「名」的位置（area x, y）：原因」），世界檢查是錯誤。寫之前自己對過 `grid`。
- 不要擋路：別把唯一的通道（例如兩個區塊之間的那條街）整條擺滿。

一行印出某個聚落的區塊，地標的格子標成 `L`：

```
python3 -c "import json;loc='rivervale';m=json.load(open('data/world/maps.json'))['maps'][loc];L=[x for x in json.load(open('data/world/landmarks.json'))['landmarks'] if x['location']==loc]
for b in m['blocks']:
  g=[list(r) for r in b['grid']]
  for x in L:
    if x['at']['area']==loc+'/'+b['id']: g[x['at']['y']][x['at']['x']]='L'
  print(loc+'/'+b['id']);[print(y,''.join(r)) for y,r in enumerate(g)]"
```

`maps.json` 的字元：`.` 街道、`#` 建築、`~` 水道、數字是通往別的區塊的通道、`E` 城門，其他是設施（1.1 節，加上 `I` 旅店、`G` 公會、`B` 娼館、`H` 民宅、`K` 刺青店、`X` 刻印師）。

**特殊地圖上的店**（寫在特殊地圖上，`specialMaps.<id>.shops`，見 [special-maps](special-maps.md)）：

| 欄位 | 範圍 | 說明 |
|---|---|---|
| `shop` | 內建店種（`wanderer` 除外），或自建的店（同一個包裡的也認得） | 那一格變成這家店 |
| `x`、`y` | 在地圖範圍內 | 一格一家，最多 8 家。只有固定地圖（有 `grid`）能擺 |

地圖上的店屬於地圖的 `location`：物價、貨色、店主與庫存都和那個聚落的同一家店相同。不要擺在入口（`entry`）與通道的端點上。

## 3. 可以引用什麼

被引用的要先存在：內建的，或同一個檔案裡的自建項目。整理商店時同一個包裡的物品都認得；特殊地圖整理時認得同一個包裡的自建商店。

| 欄位 | 引用 | 去哪裡查 | 不存在時 |
|---|---|---|---|
| `fixed[].item` | 物品 | `data/rules/items.json`，或 `items` | 那一筆拿掉 |
| `buys` | 物品類別 | `data/rules/items.json` 的 `categories` | 拿掉 |
| `catalog` | 目錄 | 1.1 節「目錄」欄 | 變 `""`（只賣固定清單） |
| `keeper.tags` | NPC 標籤 | `data/rules/npc_tags.json` 的 `tags` | 拿掉 |
| `places`、`moves` | 聚落的區塊與格子 | `data/world/maps.json`、`data/world/landmarks.json` | 區塊不存在或超出範圍：拿掉；落在不是空地的格子：套用時略過並列進匯入的問題（2.6 節） |
| `npcs.<id>.keeper` | 店 | 1.1 節的 id（`wanderer` 除外）或 `shop_…` | 整欄拿掉。`shop_…` 整理時**只檢查格式**，寫錯 id 會留著、永遠不會生效；世界檢查會提醒「顧的店不在所在地」 |
| `perks.<id>.train.cells` | 格子種類、店、地標 | 2.4 節 | 拿掉。`shop_…`、`lm_…` **只檢查格式**，寫錯 id 會留著 |
| `specialMaps.<id>.shops[].shop` | 店 | 1.1 節的 id 或 `shop_…` | 那一家拿掉 |

反過來，自建的店被這些地方引用：擔任店主的固定 NPC、特殊地圖、受訓的特質、城鎮事件的設施（[events](events.md)）。

## 4. 最小範例

一家只照酒館目錄上架的茶鋪，擺在河谷鎮上城區的一格街道：

```json
{
  "type": "elondia-content",
  "shops": {
    "shop_snowtea": {
      "custom": true, "name": "雪茶鋪", "catalog": "tavern",
      "places": [{ "area": "rivervale/upper", "x": 2, "y": 5 }]
    }
  }
}
```

## 5. 完整範例

- 修改雜貨店：描述、固定清單、收購類別、打工，並把風錘村的雜貨店往下搬一格。
- 修改酒館：關掉 AI 特別商品、生成的店主改叫「老闆娘」。
- 自建的「霜皮行」：照裁縫店的目錄上架、固定清單、收購、打工、接皮革與布料的委託打造，擺在河谷鎮與阿爾貝納兩處；一位固定 NPC 擔任河谷鎮那一家的店主；一個自建的特質可以在霜皮行與裁縫店受訓；霜皮行底下另有一張特殊地圖「霜皮行地窖」，裡面也有一家霜皮行（屬於河谷鎮，和城裡那家共用店主與庫存）。

固定清單用到的物品（雪蓮種子、鯨脂蠟、熊皮暖床、雪狐撬鎖組、皮裘）是 [items-gear](items-gear.md) 完整範例裡的；兩份範例合在一起就是一個檢查過的世界包。

```json
{
  "type": "elondia-content",
  "shops": {
    "general": {
      "desc": "日用雜貨、食物與基本藥劑；北境的店也進雪蓮種子與鯨脂蠟。",
      "fixed": [{ "item": "雪蓮種子", "stock": 5 }, { "item": "鯨脂蠟", "stock": 10, "price_cc": 5 }],
      "buys": ["food", "gear", "material", "furniture"],
      "work": { "dc": 12, "rate_cc": 4, "desc": "搬貨、點貨、鏟掉門口的積雪。" },
      "moves": [{ "from": { "area": "windhammer/main", "x": 5, "y": 3 }, "to": { "area": "windhammer/main", "x": 5, "y": 4 } }]
    },
    "tavern": {
      "ai": false,
      "keeper": { "title": "老闆娘" }
    },
    "shop_furrier": {
      "custom": true, "name": "霜皮行", "emoji": "🧥", "desc": "掛滿毛皮與皮裘的鋪子，也收北境獵人帶回來的皮料。", "ai": true,
      "keeper": { "title": "皮貨商", "tags": ["merchant"] },
      "catalog": "tailor",
      "fixed": [{ "item": "熊皮暖床", "stock": 1 }, { "item": "雪狐撬鎖組", "stock": 2, "price_cc": 150 }, { "item": "皮裘", "stock": 1 }],
      "buys": ["equipment", "material", "furniture"],
      "work": { "attr": "dex", "dc": 12, "rate_cc": 4, "desc": "刮皮、晾皮、替客人量身。" },
      "craft": ["leather", "cloth"],
      "places": [{ "area": "rivervale/upper", "x": 6, "y": 3 }, { "area": "albena/river", "x": 5, "y": 5 }]
    }
  },
  "perks": {
    "mod_perk_frost_hardy": {
      "custom": true, "name": "耐寒體質", "desc": "受到的寒冷傷害 ×0.75。",
      "effects": [{ "resist": { "cold": -0.25 } }],
      "train": { "cells": ["shop_furrier", "tailor"], "price_cc": 400, "hours": 8, "attr": "str", "dc": 12 }
    }
  },
  "npcs": {
    "mod_npc_furrier_ysa": {
      "custom": true, "name": "伊莎", "gender": "female", "race": "human", "kind": "commoner", "class": "", "occupation": "皮貨商",
      "level": 3, "location": "rivervale", "hire_cc": 0,
      "personality": "說話直來直往，對皮料的好壞一眼就看得出來。",
      "appearance": "手臂粗壯的中年婦人，圍裙上沾著鞣皮的藥水。",
      "keeper": "shop_furrier"
    }
  },
  "specialMaps": {
    "sm_furrier_cellar": {
      "custom": true, "name": "霜皮行地窖", "location": "rivervale", "desc": "霜皮行底下的冷藏地窖，掛滿等著鞣製的生皮。",
      "lighting": "lit", "layer": "outskirts",
      "grid": ["#####", "#...#", "#...#", "#####"],
      "entry": { "x": 1, "y": 1 },
      "shops": [{ "shop": "shop_furrier", "x": 3, "y": 2 }],
      "connections": [{ "at": { "x": 3, "y": 1 }, "to": { "area": "rivervale/upper", "x": 8, "y": 3 } }]
    }
  }
}
```

格子對照（`maps.json`，`x` 從左數、`y` 從上數）：

- `windhammer/main`：`(5,3)` 是 `S`（雜貨店），`(5,4)` 是 `.`；`(2,4)` 雖然也是 `.`，但那是地標「風錘」的格子，不能用。
- `rivervale/upper`：`(6,3)`、`(2,5)` 是 `.`；`(8,3)` 是 `#`（特殊地圖的通道接到城鎮時，城鎮那一頭要是牆或水）。
- `albena/river`：`(5,5)` 是 `.`。
- 改雜貨店的打工只寫了 `dc`、`rate_cc`、`desc`（屬性固定是智力）；收購寫了整份（原本的三種加上 `furniture`）。

## 6. 常見錯誤

匯入時整理（`sanitizeShopMod`）不會報錯，只會默默改掉。世界檢查的「整理時改了」列出的就是這些；**一筆都不要留**。

| 寫法 | 整理後 |
|---|---|
| 自建的店 id `shop_` 之後有底線、大寫或中文（`shop_fur_trader`、`shop_Fur`） | 整筆不收（檢查列為錯誤） |
| 不是內建店種、也不是 `shop_` 開頭的 key（`blacksmith`、`inn`、`guild`） | 整筆不收 |
| 內建的店寫了和內建一樣的值（`"ai": true`、原本的 `desc`、原本的 `buys`、打工的原本 DC 或時薪、原本的店主稱呼） | 那一欄拿掉 |
| 內建的店寫了 `name`、`catalog`、`craft`、`places`、`work.attr` | 拿掉 |
| `catalog` 寫店種 id（`smithy`、`informant`） | 變 `""`：只賣固定清單（目錄是 `smith`、`info`） |
| `name` 超過 12 字、`keeper.title` 超過 8 字、`desc` 超過 200 字 | 截斷 |
| `buys` 有不存在的類別（`weapons`、`potion`） | 拿掉 |
| `craft` 有 `stone` 這類不存在的類型 | 拿掉 |
| `fixed` 超過 20 筆；物品不存在、是獨特物品、有屬性加減、主人強制裝備；同一件重複 | 只留前 20 筆合法的 |
| `fixed.stock` 超過 99、`price_cc` 寫 0 | 夾到 99、1 |
| `work.dc` 超過 30、`rate_cc` 超過 100 | 夾住 |
| `places`、`moves` 的區塊不存在、座標超出區塊 | 那一格拿掉 |
| `places` 超過 20 格、重複的格子 | 只留前 20 格、拿掉重複 |
| `moves` 的 `from` 不是這種店的格子、`to` 在別的聚落、`from` 和 `to` 一樣 | 那一筆拿掉 |
| 特質的 `train.cells` 寫 `general`、`informant_shop` 這類不存在的格子種類 | 拿掉（雜貨店是 `shop`） |
| 特殊地圖的 `shops` 寫 `wanderer`、不存在的店、超出地圖、同一格兩家 | 那一家拿掉 |

整理不會列出、要自己注意的：

- 位置擺不上去：`places` 與 `moves` 的目標落在牆、水、設施、地標、待售的空地上，或和別家店撞格，套用時略過（2.6 節）。這不是整理改的，所以不在「整理時改了」，而是列在「套用」的錯誤。
- 自建的店沒有 `places`、也沒有擺在特殊地圖上：遊戲裡找不到。
- 自建的店沒寫 `work` 就沒有打工；沒寫 `buys` 就什麼都不收；`catalog` 是 `""` 又沒有 `fixed` 就什麼都不賣。
- 擔任店主的固定 NPC 的 `location` 沒有這家店時，他不會出現在任何店裡（世界檢查列成提醒，整理不拿掉）。
- 固定清單的價格比收購價還低，或材料寫了很低的 `price_cc`，會變成買進賣出的刷錢管道（[balance/economy](../balance/economy.md) 第 3 節）。
- 內建的 `buys`、`keeper.tags` 是整份取代：只寫新加的那一種，原本收的就不收了。

## 7. 相關的系統文件

- [TRADE](../../docs/TRADE.md)：交易清單的來源、固定清單、AI 特別商品（第 2 節）、價格與店主（第 3 節）、交涉（第 5 節）、談長期折扣（第 6 節）
- [CONTENT_EDITOR](../../docs/CONTENT_EDITOR.md) 第 3.8 節：商店的編輯、自建的店、位置的規則；第 4 節：固定 NPC 擔任店主
- [WORK](../../docs/WORK.md) 第 1 節：打工的屬性、DC、時薪與報酬
- [PERKS](../../docs/PERKS.md) 4.2 節：受訓
- [CRAFTING](../../docs/CRAFTING.md) 第 4 節：店主的工藝等級、委託打造；[ITEMS](../../docs/ITEMS.md) 第 1 節（各店賣什麼）、第 5 節（委託打造）
- [SPECIAL_MAPS](../../docs/SPECIAL_MAPS.md) 第 6 節：擺在特殊地圖上的店
- [NPC_SYSTEM](../../docs/NPC_SYSTEM.md)：店主的標籤
- [CONTENT_DEPENDENCIES](../../docs/CONTENT_DEPENDENCIES.md)：自建商店被哪些內容引用、刪除的限制
