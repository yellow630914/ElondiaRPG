# 物品、底材與材料（`items`、`bases`、`materials`）

> 這份文件講物品與裝備零件的格式：每個欄位的範圍、裝備怎麼由底材 × 材料組成、物品從哪裡取得，以及匯入時會被默默改掉的地方。價格怎麼抓見 [balance/items](../balance/items.md)。
> 系統文件：[ITEMS](../../docs/ITEMS.md)（目錄、裝備、稀有度與附魔、寶箱、委託打造）、[CRAFTING](../../docs/CRAFTING.md)（工藝、工具、配方）、[HOMES](../../docs/HOMES.md)（家具、種子）、[TRADE](../../docs/TRADE.md)（商店、價格）、[CONTENT_EDITOR](../../docs/CONTENT_EDITOR.md) 第 2、3 節。程式：`src/engine/mods.ts` 的 `sanitizeItem`、`sanitizeBase`、`sanitizeMaterial`、`sanitizeGearSpecLoose`（整理）、`generateCatalog`（制式裝備）；`src/engine/gear.ts`（組成、估價）。

## 1. 用途與放在哪裡

| 區塊 | 內容 | key |
|---|---|---|
| `items` | 所有物品：食物、消耗品、卷軸、雜物（工具、光源）、材料、裝備、情報、家具 | **物品的名稱**（中文，也是遊戲裡顯示的名字） |
| `materials` | 裝備的材料（鐵、絲綢、銀製……） | 新的用 `mod_mat_<英文小寫>`（`mod_mat_frostsilver`） |
| `bases` | 裝備的底材（長劍、皮甲、守護之戒……） | 新的用 `mod_base_<英文小寫>`（`mod_base_hookblade`） |

- 世界包寫在 `content.<區塊>`，內容檔寫在最外層（外層格式見 [content-file](content-file.md)）。
- **新的項目**：加 `"custom": true`。名稱或 id 不要和內建的一樣：一樣時會蓋掉內建的項目。
- **修改內建的項目**：用原本的 key（物品名稱查 `data/rules/items.json`，底材、材料的 id 查 `data/rules/gear.json`），**不加** `custom`，寫整份修改後的資料。內建物品不能改名。
- **物品名稱**（`cleanItemName`）：最多 **20** 字，`|` 與 `*` 會被拿掉。key 超過 20 字時整筆不收（檢查列為錯誤）。物品裡可以不寫 `name`；寫了要和 key 一樣。
- 底材、材料的 id 只用小寫英數與底線，整個世界裡不能重複。

### 1.1 裝備＝底材 × 材料

裝備是 `category: "equipment"` 的物品，`gear` 寫它的組成（`{ "base": 底材 id, "material": 材料 id }`）。數值全部由組成推算（[ITEMS](../../docs/ITEMS.md) 第 3、4 節）：

- **底材**決定欄位、武器或防具的類型、固定加成（`stats`），以及材料的加成怎麼成長（`scale`）。
- **材料**決定等級（`tier`，打造的工錢、DC 與在哪種聚落買得到）、加成（`bonus`，依底材的 `scale` 換算）、原本的稀有度、價格倍率；防具與飾品另外吃材料的 `armor`、`resist`（武器不吃）。
- **稀有度與附魔**寫在物品的 `gear` 上（`rarity`、`enchants`）。稀有度給附魔點數：普通 0、優良 1、稀有 2、史詩 4、傳說 6。
- **估價**（`gearPrice`）＝底材 `price` × 材料 `price` ×（1 + 0.5 × 附魔點數）。稀有度本身不影響價格。

**制式裝備**：新增一個底材或材料時，套用時自動產生「底材 × 同類型材料」的每一件（`generateCatalog`）：

- 名稱是「材料名＋底材名」（霜銀＋長劍＝霜銀長劍）。皮革類：第 1 級只用底材名（皮裘）；底材名以「皮」開頭時省掉那個字（硬皮裘、龍皮裘）。已經有同名物品時不產生。
- 價格＝估價（沒有附魔）；販售：金屬、木材在鐵匠鋪，皮革、布料在裁縫店，寶石在珠寶店；第 3 級要城市、第 4 級要王都，第 5 級不賣（`tags` 是空的）。描述是底材的 `desc` 接材料的 `desc`。
- 束縛用（`restraint`）的底材不產生制式裝備。
- 制式裝備不在 `items` 區塊裡，但商店的固定清單可以直接寫它的名稱（同一個檔案裡新增的底材、材料產生的也可以）；想改它的描述與價格，就在 `items` 用同一個名稱寫一筆（完整範例的「皮裘」）。

### 1.2 物品從哪裡來

一件物品要至少有一種取得方式，否則遊戲裡拿不到（檢查不會提醒）。

| 管道 | 怎麼寫 | 說明 |
|---|---|---|
| 商店的目錄 | 物品的 `tags`（下表）＋ `min_location` | 那種店每天上架。裝備每天只抽 3～6 件（第 1 級最常見，第 4 級極少）；其他物品都上架 |
| 商店的固定清單 | 商店的 `fixed`（[shops](shops.md)） | 每天一定上架，可以指定份數與價格 |
| 寶箱 | 物品的 `chests` | 地下城各層寶箱裡出現的機率 |
| 採集 | 物品的 `gather` | 近郊、地下城的資源格 |
| 怪物掉落 | **寫在怪物上**：`enemies.<id>.loot`（[monsters](monsters.md)） | `[{ "item": "物品名稱", "chance": 0.3, "qty": 2 }]` |
| 事件 | 物品的 `event: true` | AI 判定主動行動時可以把它當成報酬 |
| 特殊任務、旅途與城鎮事件 | 結果的效果 `{ "type": "item", "name": "物品名稱", "qty": 1 }`（[stories](stories.md)、[events](events.md)） | 獨特物品的主要來源 |
| 製作 | 成品的 `recipe`、種子的 `seed` | 依配方製作、種在苗圃 |
| 打造 | 材料的 `forge` 連到 `materials`；裝備在鐵匠鋪、裁縫店、珠寶店委託打造 | 見 1.3 |

**`tags` 是目錄的類型**，不是店的 id：

| `tags` | 店 | 店的 id（`shops`、`keeper` 用） |
|---|---|---|
| `general` | 雜貨店 | `general` |
| `temple` | 神殿 | `temple` |
| `tavern` | 酒館 | `tavern` |
| `smith` | 鐵匠鋪 | `smithy` |
| `tailor` | 裁縫店 | `tailor` |
| `jeweler` | 珠寶店 | `jeweler` |
| `magic` | 魔法物品店（流浪商人也照這份目錄） | `magic` |
| `info` | 情報商 | `informant` |

自建的商店照其中一份目錄上架（[shops](shops.md) 的 `catalog`）；物品不能直接標自建商店的 id。

### 1.3 打造與隨機生成的裝備

- **委託打造、自己動手**：選底材與材料（同類型）。第 1 級材料由工匠提供；**第 2 級以上要自備打造材料**：`forge.materials` 含有那個材料的物品，數量依欄位（主手 2、雙手武器 3、副手 2、上身 3、下身 2，其他 1）。新的材料第 2 級以上一定要有一種打造材料，否則打不出來。工錢、DC 與工匠的等級依材料等級（[ITEMS](../../docs/ITEMS.md) 第 5 節、[CRAFTING](../../docs/CRAFTING.md) 第 2 節）。
- **寶箱、人形怪物掉落、流浪商人、建角、夥伴與 NPC 的配備**：底材從所有非束縛用的底材平均挑（自建的也會被挑到），材料依「類型 × 等級」找（`materialOf`）：**同類型同等級有內建材料時一律用內建的**，自建的材料只會在那一級沒有內建材料時出現。所以自建材料主要靠制式裝備（商店）、委託打造與寫好的裝備物品出現。
- 寶箱的「打造材料」依等級找內建材料，再挑能打造它的物品裡最便宜的一件：自建的物品 `forge` 寫了內建材料、又比內建的便宜時，會取代內建的出現在寶箱。

## 2. 欄位一覽

範圍以外的值會被夾住或拿掉（第 6 節）。「沒寫」都用預設值，不算錯；但寫了等於預設值的某些欄位會被拿掉，檢查會列出來（第 6 節）。

### 2.1 物品的共同欄位

| 欄位 | 型別 | 範圍 | 說明 |
|---|---|---|---|
| `custom` | 布林 | 新的物品一律 `true` | 改內建的物品時不寫 |
| `category` | 字串 | `food` 食物、`consumable` 消耗品、`scroll` 卷軸、`gear` 雜物、`material` 材料、`equipment` 裝備、`info` 情報、`furniture` 家具 | 其他值變 `material`。很多欄位只認某些類別（各節標明） |
| `price_cc` | 整數 | 0～100000000，預設 10 | 一般城鎮的售價（白鸛幣）。**材料是收購價**：商店賣兩倍（流浪商人 1.6 倍），收購照全價；其他物品收購一半。範圍見 [balance/items](../balance/items.md) |
| `tags` | 陣列 | `general`、`temple`、`tavern`、`smith`、`tailor`、`jeweler`、`magic`、`info` | 在哪些店的目錄（1.2 節）。其他值拿掉。空陣列＝不在任何店的目錄 |
| `min_location` | 字串 | `town`、`city`、`capital` | 最低要在哪種聚落才上架（城鎮、港口算 `town`）。`village` 與其他值拿掉（＝不限） |
| `desc` | 字串 | 最多 200 字 | 描述。效果最好寫進去（玩家看得到） |
| `icon` | 字串 | 圖片的 data URL（2.11 節） | 選填：行囊、商店裡的圖示。沒有時用底材的圖（裝備）或類別的圖 |
| `use` | 物件 | 2.2 節 | 使用效果 |
| `event` | 布林 | | `true`：AI 判定主動行動時可以當成報酬 |
| `chests` | 物件 | `{ "<層>": 機率 }`，層是 `outskirts` 周邊、`shallow` 淺層、`middle` 中層、`deep` 深層、`abyss` 底層；機率 0～1（取到 0.01） | 每個寶箱出現的機率。**有這一欄時取代內建的設定**（沒列的層拿掉）。0 的層拿掉 |
| `gather` | 陣列 | `wild` 近郊、`dungeon` 地下城 | 資源格採得到。有這一欄時取代內建的設定 |

### 2.2 使用效果 `use`

消耗品、卷軸、食物用。戰鬥以外只能用 `heal`、`slot`、`condition`、`perks`；其他效果只能在戰鬥中用。

| 欄位 | 型別 | 範圍 | 說明 |
|---|---|---|---|
| `heal` | 骰子 | `XdY` 或 `XdY+Z`（X 0～99、Y 1～999、Z 0～999） | 回復生命。**一定要是骰子**：`"10"` 這種固定值整欄拿掉 |
| `slot` | 整數 | 1～9 | 回復一個 N 環以下的法術環 |
| `condition` | id | `data/rules/companions.json` 的 `conditions` | 食物、飲料：吃完得到的非戰鬥狀態，到下次長休。用餐的是 `fed_light` 果腹、`fed_well` 飽足、`fed_fine` 美食、`fed_feast` 盛宴、`fed_legend` 傳說料理（同時只留一個，好的取代差的）；酒是 `cheered` 興致高昂（再喝變微醺）。其他狀態（印記、受罰……）不要用 |
| `perks` | id 陣列 | 最多 6 個；`data/rules/perks.json` 裡沒有 `race` 的特質，或同一個包裡的自建特質 | **書籍**：讀完（約 4 小時）得到一次學其中一個特質的機會（[PERKS](../../docs/PERKS.md) 4.2 節）。類別用 `consumable`。種族特質與不存在的拿掉 |
| `cleanse` | id 陣列 | `data/rules/statuses.json` 的狀態，或自建的狀態 | 解除這些狀態 |
| `status` | 物件 | `{ "id": 狀態, "turns": 1～20 }`（預設 3） | 使用者或隊友得到一個狀態（藥劑、增益卷軸） |
| `temp_hp` | 整數 | 1～999 | 暫時生命 |
| `ap` | 整數 | 1～10 | 立刻獲得行動點 |
| `revive` | 數字 | 0.01～1 | 以最大生命的比例救起倒下的隊友 |
| `damage` | 物件 | `{ "dice": 骰子, "type": 傷害類型 }` | 投擲、攻擊卷軸：對敵人造成傷害。類型不對變 `fire` |
| `apply` | 物件 | `{ "status": 狀態, "turns": 1～20（預設 2）, "save": 屬性, "dc": 5～30（預設 12） }` | 對敵人施加狀態；`save` 不寫時不能豁免，`dc` 只在有 `save` 時留著 |
| `save` | 物件 | `{ "attr": 屬性, "dc": 5～30 }` | 投擲的豁免：成功時傷害減半、不受狀態。只在有 `damage` 或 `apply` 時留著 |
| `area` | 字串 | `one` 一名敵人、`all` 所有敵人 | 只在有 `damage` 或 `apply` 時有意義；不寫是 `one` |
| `escape` | 布林 | | 全隊立刻脫離戰鬥 |
| `combat_only` | 布林 | | 只能在戰鬥中用。有 `damage`、`apply`、`status`、`temp_hp`、`ap`、`revive`、`cleanse`、`escape`，而且沒有 `heal`、`slot` 時，整理時一律補上 `true`（世界檢查列成說明） |

- 傷害類型：`bludgeoning` 鈍擊、`piercing` 穿刺、`slashing` 斬擊、`fire` 火焰、`cold` 寒冷、`lightning` 閃電、`thunder` 雷鳴、`acid` 酸蝕、`poison` 毒素、`radiant` 神聖、`necrotic` 暗影、`force` 奧術、`psychic` 心靈（`data/rules/damage_types.json`）。
- 屬性：`str` 力量、`dex` 靈巧、`int` 智力、`fai` 信仰、`cha` 魅力。
- 數值照同價位的內建物品（[ITEMS](../../docs/ITEMS.md) 第 6 節）：治療 2d4+2 約 340、4d4+4 約 1050；單體 2d6 的投擲約 150～200；全體 3d6 豁免減半的卷軸約 600～900。

### 2.3 雜物：工具與光源（`category: "gear"`）

| 欄位 | 型別 | 範圍 | 說明 |
|---|---|---|---|
| `tool.kind` | 字串 | `lockpick` 開鎖、`trap` 察覺陷阱、`light` 照明、`travel` 旅途、`camp` 露營、`hone` 保養、`craft` 工藝 | 工具模板（`data/rules/items.json` 的 `tools`；效果見 [ITEMS](../../docs/ITEMS.md) 第 7 節「雜物」）。行囊裡同一種只算加值最高的一件 |
| `tool.bonus` | 整數 | `lockpick`、`trap`、`travel` 1～10（預設 2、2、1）；`light` 1～2（預設 1） | 加值。`camp`、`hone`、`craft` 沒有加值，寫了拿掉 |
| `tool.craft` | id | `smithing` 鍛造、`woodworking` 木工、`leatherwork` 製革、`tailoring` 裁縫、`jewelcraft` 珠寶、`alchemy` 煉金、`cooking` 烹飪 | 只有 `craft`。不對時變 `smithing` |
| `tool.tier` | 整數 | `1` 低階（隨身工具組）、`2` 中階（攜帶式工坊） | 只有 `craft`。其他值（包括 3）變 1；高階是房子裡的工作台家具（2.4 節） |
| `tool.fuel` | 物品名稱 | | 只有 `light`：燒這種物品（油燈燒燈油）。不能是自己 |
| `burns` | 整數 | 1～999 | 光源或燃料每一份照亮幾格。只認 `gear` 類別 |

照明的三種寫法：火把＝`tool.light` ＋ `burns`（燒自己）；油燈＝`tool.light` ＋ `tool.fuel`，燃料另外一件 `burns` 的雜物；魔法照明石＝只有 `tool.light`（不會燒掉）。

### 2.4 家具 `furniture`（`category: "furniture"`）

| 欄位 | 型別 | 範圍 | 說明 |
|---|---|---|---|
| `places` | 陣列 | `indoor` 室內、`yard` 院子、`basement` 地下室 | 能放的地方。沒寫或全部不對時變 `["indoor"]` |
| `function` | 字串 | `bed` 床、`workbench` 高階工作台、`garden` 苗圃 | 沒寫＝只有舒適度 |
| `craft` | id | 2.3 節的工藝 | 只有 `workbench`：哪種工藝的工作台（能處理第 4、5 級）。不對時變 `smithing` |
| `comfort` | 整數 | 1～10 | 舒適度；加總 6 以上時在家長休會「睡得香甜」。0 不要寫 |
| `icon` | 字串 | 最多 2 個字元 | 地圖上的圖示。用單一 emoji；組合 emoji（👩‍🍳 這類）會被切掉一半 |

規則與內建的家具見 [HOMES](../../docs/HOMES.md) 第 4 節。

### 2.5 配方 `recipe` 與種子 `seed`

**配方**（裝備以外的類別；裝備走打造）：

| 欄位 | 型別 | 範圍 | 說明 |
|---|---|---|---|
| `craft` | id | 2.3 節的工藝 | 不對時變 `alchemy` |
| `level` | 整數 | 1～5 | 需要的工藝等級；也決定 DC（10、12、14、16、18）與工具階級（1～2 低階、3 中階、4～5 高階） |
| `inputs` | 陣列 | `[{ "name": 物品名稱, "qty": 1～99 }]`，最多 6 種 | 材料。不能是成品自己；同名的合併。**沒有一個合法的材料時整個配方拿掉** |
| `qty` | 整數 | 2～20 | 一批做出幾份。做 1 份時**不要寫**（寫 1 會被拿掉） |
| `cost_cc` | 整數 | 1～10000000 | 一批另外要買的東西（瓶子、溶劑），乘地點物價。沒有時不要寫 0 |
| `hours` | 整數 | 1～48，預設 2 | 一批幾小時 |

**配方不能拿來賺錢**：材料的價值（材料照全價）加上 `cost_cc`，要不低於成品賣回商店的價格（`price_cc` × 0.5 × `qty`）。見 [CRAFTING](../../docs/CRAFTING.md) 第 6 節。

**種子**（只有 `material` 類別）：

| 欄位 | 型別 | 範圍 | 說明 |
|---|---|---|---|
| `yields` | 名稱陣列 | 1～5 種，不能是自己 | 長出什麼（好幾種時收成時隨機一種）。全部不合時整個 `seed` 拿掉 |
| `qty` | `[最少, 最多]` | 各 1～20 | 收成的份數 |
| `days` | 整數 | 1～30，預設 3 | 幾天成熟 |
| `place` | 字串 | `yard` 菜圃（院子）、`basement` 菇床（地下室）、`indoor` 室內 | 種在哪裡的苗圃，預設 `yard` |

見 [HOMES](../../docs/HOMES.md) 第 6 節。種子的價格要讓「買種子 → 收成 → 賣掉」只有一點點利潤（內建：藥草種子 6，收成 2～3 份 12 的藥草，還要有房子、等 4 天）。

### 2.6 情報 `intel`（只有 `info` 類別）

| 欄位 | 型別 | 範圍 | 說明 |
|---|---|---|---|
| `kind` | 字串 | `point` 事件點、`story` 特殊任務的消息、`lead` 委託的線索 | 不對時變 `point` |
| `event` | 字串 | `combat` 盤踞的強敵、`chest` 藏寶處、`merchant` 流浪商人 | 只有 `point`；不寫時隨機 |
| `location` | 地點 id | `data/world/geography.json` 的 `locations` | 只有 `point`；不寫時在解讀的地方附近。不存在的拿掉 |
| `layer` | 字串 | 2.1 節 `chests` 的五層 | 只有 `point`，而且 `location` 是地下城 |
| `days` | 整數 | 1～30，預設 5 | 只有 `point`：事件點有效幾天 |
| `story` | 特殊任務 id | `mod_story_…` 或內建的任務 id | 只有 `story`：解讀後開始這個任務（**不檢查存不存在**，自己對） |

沒有 `intel` 的情報物品解讀後是附近隨機的事件點。情報商收購情報類物品。見 [ITEMS](../../docs/ITEMS.md) 第 7 節「情報」。

### 2.7 裝備 `gear`（只有 `equipment` 類別）

| 欄位 | 型別 | 範圍 | 說明 |
|---|---|---|---|
| `base` | 底材 id | `gear.json` 的 `bases`，或同一個包裡的 `bases` | |
| `material` | 材料 id | `gear.json` 的 `materials`，或同一個包裡的 `materials` | `kind` 要和底材一樣。底材或材料不存在、類型不同時**整個 `gear` 拿掉**（變成沒有數值的物品） |
| `rarity` | 字串 | `common`、`uncommon`、`rare`、`epic`、`legendary` | 只在和材料原本的稀有度不同時寫；一樣時被拿掉 |
| `enchants.mods` | 物件 | `hit`、`damage`、`evade`、`dr`、`save`、`crit`、`ap_regen` 整數 −5～5；`threat` −1～2 | 附魔的數值修正 |
| `enchants.resist` | 物件 | `{ 傷害類型或群組: −1～2 }` | 受到的傷害倍率（−0.25＝×0.75）。群組：`physical`、`elemental`、`divine`、`arcane`、`all` |
| `enchants.offense` | 物件 | 同上 | 造成的傷害倍率（+0.25＝×1.25） |
| `unique` | 物件 | `{ "check": 篩選條件, "bonus": 1～3 }` | **獨特物品**的檢定加值（和附魔分開、可以疊加）。篩選條件和特質一樣（[PERKS](../../docs/PERKS.md) 第 1、2 節）：`attrs` 屬性、`contexts` 情境、`kinds` 主動行動、`vs_tags` 對象的標籤；全部不寫＝所有檢定 |
| `attrs` | 物件 | `str`、`dex`、`int`、`fai`、`cha` 各 −3～3 | 屬性的加減（[ITEMS](../../docs/ITEMS.md) 3.2 節；身上合計最多 ±4） |

| 欄位（物品上） | 型別 | 範圍 | 說明 |
|---|---|---|---|
| `adult` | 布林 | | 成人向：內容編輯器篩選用的標記 |
| `black_market` | 布林 | 只有有 `unique` 的 | 也會出現在黑市每天刷新的珍品裡 |
| `master_force` | 物件 | `{}` 任何主人，或 `{ "tags": [...] }`：`commoner`、`traveler`、`merchant`、`noble`、`royal`、`priest`、`bishop`、`villain`、`good`、`prostitute` | 主人會強制主角裝上（只有有 `gear` 的物品）。通常用束縛用的底材，效果只靠 `attrs` |

**整理不檢查、要自己守的附魔上限**（照打造與 AI 的規則，`gear.ts` 的 `sanitizeEnchants`）：

- 點數不超過稀有度的點數（稀有度沒寫時用材料原本的）。每點：命中、傷害、迴避、減傷、豁免、幸運一擊 1；行動點回復 2；抗性、屬性攻擊每 0.25 是 1；仇恨每 0.1 是 1。
- 每項上限：命中 2、傷害 3、迴避 2、減傷 2、豁免 2、幸運一擊 1、行動點回復 1；`resist` 只寫負的（−0.25 或 −0.5），`offense` 只寫正的（0.25 或 0.5）；`threat` ±0.1～0.3。
- 負的附魔也照絕對值算點數與價格，不要用。
- 裝備物品的 `price_cc` 寫估價（1.1 節）；檢查要求在估價的 0.6～1.6 倍。

**不在商店上架**：有 `unique`、`attrs` 或 `master_force` 的裝備（`trade.ts` 的 `notForSale`）。目錄、固定清單、AI 的特別商品都會略過，只能從寶箱、特殊任務、事件或主人得到。`tags` 寫空陣列。獨特物品一個世界不要太多（內建 12 件），見 [balance/items](../balance/items.md)。

### 2.8 打造材料 `forge`

| 欄位 | 型別 | 範圍 | 說明 |
|---|---|---|---|
| `forge.materials` | 材料 id 陣列 | `gear.json` 的 `materials`，或同一個包裡的 `materials` | 這件物品可以拿來打造哪些材料的裝備（1.3 節）。不存在的拿掉、重複的合併 |

類別用 `material`。價格參考內建（[ITEMS](../../docs/ITEMS.md) 5.1 節）：第 2 級 10～90、第 3 級 400～600、第 4 級 4000～6000、第 5 級 40000 以上。材料委託的報酬依材料價格算，太貴會讓委託報酬暴增。

### 2.9 材料 `materials`

| 欄位 | 型別 | 範圍 | 說明 |
|---|---|---|---|
| `custom` | 布林 | 新的一律 `true` | |
| `kind` | 字串 | `metal` 金屬、`leather` 皮革、`cloth` 布料、`wood` 木材、`jewel` 寶石 | 其他值變 `metal`。只能做同類型的底材 |
| `name` | 字串 | 最多 **8** 字 | 也是制式裝備名稱的前半 |
| `tier` | 整數 | 1～5 | 等級：委託打造的工錢 ×1～×5、DC 10～18，工匠工藝要到這一級；第 3 級要城市、第 4 級要王都，第 5 級不賣 |
| `bonus` | 整數 | 0～10 | 加成，依底材的 `scale` 換算。內建：第 1～5 級 0、1、2、4、6（寶石 1、1、2、3、4） |
| `rarity` | 字串 | 2.7 節的五種，預設 `common` | 原本的稀有度。內建：普通、普通、稀有、史詩、傳說（銀製是優良） |
| `level` | 整數 | 1～30 | 建議等級（AI 生成的裝備依它限制材料）。內建：1、3、7、11、15 |
| `price` | 數字 | 0.1～100000 | 價格倍率（乘底材的價格）。內建：×1、×2、×15、×150、×1000（寶石 ×1、×4、×20、×200、×1500） |
| `armor` | 物件 | 2.7 節 `enchants.mods` 的 key，−5～5 | 做成防具、飾品時的額外修正（秘銀迴避 +1）。武器不吃 |
| `resist` | 物件 | `{ 傷害類型或群組: −1～2 }` | 做成防具、飾品時的抗性（龍皮火焰 −0.25）。武器不吃 |
| `desc` | 字串 | 最多 120 字 | 接在制式裝備的描述後面 |

修改內建材料時 `kind` 與 `tier` 不能改（改了會被改回）：隨機裝備、起始裝備與 NPC 的配備依「類型 × 等級」找材料。

### 2.10 底材 `bases`

| 欄位 | 型別 | 範圍 | 說明 |
|---|---|---|---|
| `custom` | 布林 | 新的一律 `true` | |
| `slot` | 字串 | `main_hand` 主手、`off_hand` 副手、`head`、`body` 上身、`legs`、`wrists`、`feet`、`belt`、`accessory` 首飾、`leg_accessory` 腿部飾品、`underwear_top` 內衣／內襯、`underwear_bottom` 內褲、`ring` 戒指（兩格）、`piercing` 穿孔飾品（兩格） | 其他值（包括 `ring_1`、`piercing_2`）變 `main_hand` |
| `name` | 字串 | 最多 **12** 字 | 制式裝備名稱的後半 |
| `kind` | 字串 | 2.9 節的五種 | 用哪一類材料。其他值變 `metal` |
| `price` | 整數 | 1～10000000，預設 100 | 底價（乘材料倍率）。內建：主手 30～450、上身 60～6000、飾品 80～260 |
| `two_handed` | 布林 | | 雙手武器（只有 `main_hand`）。會空出副手 |
| `stats` | 物件 | 2.7 節 `enchants.mods` 的 key；整數 −10～10，`threat` −1～2 | 固定加成（盾：減傷 +1） |
| `threat` | 數字 | −1～1 | 仇恨（盾 0.1 = +10%） |
| `scale` | 物件 | `{ 修正: "full" \| "half" \| "up" \| "third" \| "third_up" }` | 材料的 `bonus` 依比例加到哪一項：全部、一半（捨去）、一半（進位）、三分之一（捨去）、三分之一（進位）。武器通常 `{ "damage": "full", "hit": "half" }` |
| `resist_scale` | 物件 | `{ 傷害類型或群組: "res" }` | 每點 `bonus` 受到的傷害 −0.15（抗火項鍊）。**只用 `res`**：寫 `full` 這類會變成弱點 |
| `weaponDef` | 物件 | `{ "name": 最多 12 字, "dice": 骰子, "type": 傷害類型, "attr": 屬性 }` | **主手一定要寫**：普通攻擊的武器。自建的登錄成武器 `w_<id>` |
| `armorDef` | 物件 | `{ "name": 最多 12 字, "evade": −10～10, "dr": 0～20, "resist": {…}, "offense": {…}, "threat": −1～1 }` | **上身一定要寫**：防具的迴避、減傷與抗性。自建的登錄成防具 `a_<id>` |
| `outfit` | 字串 | `regular`、`anime`、`adult` | 服裝：數值寫成同欄位的布衣；不進寶箱與掉落，裁縫店每天另外上架；`adult` 一定是成人向 |
| `adult` | 布林 | | 成人向：內容編輯器篩選用的標記（成人向服裝一律是） |
| `restraint` | 布林 | | 束縛用（主人強制裝備的項圈、鐐銬）：沒有任何加成、不能打造、沒有制式品、不會隨機出現。主手與上身不行 |
| `desc` | 字串 | 最多 120 字 | 制式裝備描述的前半 |
| `icon` | 字串 | 圖片的 data URL（2.11 節） | 選填：這種底材的裝備的圖示 |

- 武器與防具的數值照內建（[ITEMS](../../docs/ITEMS.md) 4.2 節）：單手 1d6～1d8、雙手 1d12；布衣迴避 +1、皮甲迴避 +1 減傷 1、鍊甲迴避 −1 減傷 2、板甲迴避 −3 減傷 4。
- **修改內建底材**：`slot`、`kind`、`two_handed`、`restraint` 不能改（改了會被改回）。沒寫 `slot` 時用內建的（只改 `armorDef` 也可以）。內建資料裡的 `weapon`、`armor`（武器、防具類型的 id）整理時換成那一種**原版**的數值（`weaponDef`、`armorDef`，名稱用底材的）；只能指向它自己原本的類型，指向別的會被忽略。要改數值就寫整份的 `weaponDef`、`armorDef`（數值查 `data/rules/equipment.json`）。改內建底材的 `weaponDef` 會一起改到同一種武器（職業的起始武器、NPC）。

### 2.11 圖示 `icon`

物品（`items`）、底材（`bases`）與類別（`categoryIcons`）都可以有自己的圖示，查找順序是物品 → 底材 → 類別，都沒有時用內建的像素圖（[ITEMS](../../docs/ITEMS.md) 第 8 節）。

- 格式：`data:image/png;base64,…`（也收 WebP、JPG、GIF），**長度最多 16,000 字**，建議 48×48 以內的像素圖。不合的整欄拿掉。
- **生成世界時通常不寫**：內建的圖已經涵蓋所有類別與底材，自建底材也會依武器類型、欄位與材料挑圖。要用時由玩家在世界編輯器上傳（會自動縮圖），再匯出世界包。
- 圖示存在世界裡、跟著世界包走（很多張時世界包會變大）；存檔不帶圖示。

## 3. 可以引用什麼

被引用的要先存在：內建的，或同一個檔案裡的自建項目。整理的順序是狀態、技能、特質、材料、底材，然後才是物品，所以同一個包裡的都認得。

| 欄位 | 引用 | 去哪裡查 | 不存在時 |
|---|---|---|---|
| `use.condition` | 非戰鬥狀態 | `data/rules/companions.json` 的 `conditions` | 拿掉 |
| `use.status`、`use.cleanse`、`use.apply.status` | 狀態 | `data/rules/statuses.json`，或 `statuses` | 拿掉 |
| `use.perks` | 特質 | `data/rules/perks.json`（沒有 `race` 的），或 `perks` | 拿掉 |
| `gear.base`、`gear.material` | 底材、材料 | `data/rules/gear.json`，或 `bases`、`materials` | 整個 `gear` 拿掉 |
| `forge.materials` | 材料 | 同上 | 拿掉 |
| `master_force.tags` | 主人的身分 | `data/rules/slavery.json` 的 `master_tags` | 拿掉 |
| `intel.location` | 地點 | `data/world/geography.json` 的 `locations` | 拿掉 |
| `intel.story` | 特殊任務 | `data/rules/stories.json`，或 `stories` | **不檢查** |
| `recipe.inputs[].name`、`seed.yields`、`tool.fuel` | 物品名稱 | `data/rules/items.json`，或 `items` | **整理時不檢查**：寫錯就永遠做不出來、長出不存在的東西。配方材料不存在時世界檢查會提醒；種子收成與燃料不會 |
| `unique.check.kinds`、`unique.check.vs_tags` | 主動行動、NPC 標籤 | `src/engine/actions.ts` 的 `ActionKind`、`data/rules/npc_tags.json` | **不檢查**；`attrs`、`contexts` 有檢查（`contexts`：`data/rules/perks.json` 的 `contexts`） |

反過來，物品被這些地方引用：怪物的 `loot`、商店的 `fixed`、特殊任務與事件的 `item` 效果、別的物品的配方與種子、特殊地圖的 `resource_items`。改內建物品不能改名，所以這些引用不會斷。

一行查出內建物品的整份資料（修改內建物品時用）：

```
python3 -c "import json;print(json.dumps([i for i in json.load(open('data/rules/items.json'))['items'] if i['name']=='乾糧'][0],ensure_ascii=False))"
```

## 4. 最小範例

一種採集得到的材料：

```json
{
  "type": "elondia-content",
  "items": {
    "雪蓮花": {
      "custom": true, "category": "material", "price_cc": 20, "tags": [], "gather": ["wild"],
      "desc": "只開在雪線上的白花，煉金師拿來做治療藥。"
    }
  }
}
```

## 5. 完整範例

一種新材料（霜銀）、兩種新底材（鉤刃、皮裘），以及各種物品：種子、打造材料、料理、藥劑、投擲物、卷軸、書籍、工具、光源與燃料、家具、情報、獨特物品、附魔的裝備、寫成物品的制式裝備，最後一筆是修改內建的「乾糧」（整份資料，只改了描述）。

```json
{
  "type": "elondia-content",
  "materials": {
    "mod_mat_frostsilver": {
      "custom": true, "kind": "metal", "name": "霜銀", "tier": 3, "bonus": 2, "rarity": "rare", "level": 7, "price": 12,
      "resist": { "cold": -0.25 },
      "desc": "北境冰川裡的銀白金屬，摸起來永遠是冰的。"
    }
  },
  "bases": {
    "mod_base_hookblade": {
      "custom": true, "slot": "main_hand", "name": "鉤刃", "kind": "metal", "price": 220,
      "weaponDef": { "name": "鉤刃", "dice": "1d8", "type": "slashing", "attr": "dex" },
      "scale": { "damage": "full", "hit": "half" },
      "desc": "刃尖反鉤的單手刀，能勾住盾緣。"
    },
    "mod_base_furcoat": {
      "custom": true, "slot": "body", "name": "皮裘", "kind": "leather", "price": 700,
      "armorDef": { "name": "皮裘", "evade": 1, "dr": 1, "resist": { "cold": -0.25 } },
      "scale": { "evade": "half", "dr": "third" },
      "desc": "內襯厚毛的長皮衣，擋得住北境的風雪。"
    }
  },
  "items": {
    "雪蓮花": {
      "custom": true, "category": "material", "price_cc": 20, "tags": [], "gather": ["wild"],
      "desc": "只開在雪線上的白花，煉金師拿來做治療藥。"
    },
    "雪蓮種子": {
      "custom": true, "category": "material", "price_cc": 15, "tags": ["general"],
      "seed": { "yields": ["雪蓮花"], "qty": [1, 2], "days": 5, "place": "yard" },
      "desc": "種在菜圃，五天後開出雪蓮花。"
    },
    "霜銀礦石": {
      "custom": true, "category": "material", "price_cc": 450, "tags": [],
      "forge": { "materials": ["mod_mat_frostsilver"] },
      "chests": { "middle": 0.05, "deep": 0.08 }, "event": true,
      "desc": "結著白霜的礦石，可以打造霜銀裝備。"
    },
    "雪原燉鍋": {
      "custom": true, "category": "food", "price_cc": 25, "tags": ["tavern"],
      "use": { "condition": "fed_well" },
      "recipe": { "craft": "cooking", "level": 2, "inputs": [{ "name": "生肉", "qty": 2 }, { "name": "雪蓮花", "qty": 1 }], "qty": 2, "hours": 2 },
      "desc": "加了雪蓮花瓣的燉肉，吃完全身發暖。"
    },
    "霜苔治療藥": {
      "custom": true, "category": "consumable", "price_cc": 400, "tags": ["temple"],
      "use": { "heal": "2d6+2" },
      "recipe": { "craft": "alchemy", "level": 2, "inputs": [{ "name": "藥草", "qty": 3 }, { "name": "雪蓮花", "qty": 1 }], "cost_cc": 150, "hours": 2 },
      "desc": "帶著薄荷涼意的藥水，回復 2d6+2 生命值。"
    },
    "冰晶飛刀": {
      "custom": true, "category": "consumable", "price_cc": 200, "tags": ["general"],
      "use": { "damage": { "dice": "2d6", "type": "cold" }, "apply": { "status": "chilled", "turns": 2, "save": "dex", "dc": 12 }, "area": "one", "combat_only": true },
      "desc": "對一名敵人造成 2d6 寒冷傷害；靈巧豁免 DC 12 失敗時寒霜 2 回合。"
    },
    "寒光卷軸": {
      "custom": true, "category": "scroll", "price_cc": 700, "tags": ["magic"], "min_location": "town",
      "use": { "damage": { "dice": "3d6", "type": "cold" }, "area": "all", "save": { "attr": "dex", "dc": 13 }, "combat_only": true },
      "desc": "所有敵人 3d6 寒冷傷害；靈巧豁免 DC 13 成功減半。"
    },
    "《雪原求生》": {
      "custom": true, "category": "consumable", "price_cc": 500, "tags": ["general"], "min_location": "town",
      "use": { "perks": ["survivor", "pathfinder", "watchful"] },
      "desc": "北境獵人口述的求生手冊，讀完有機會學會野外求生、識途老馬或眼觀四方。"
    },
    "雪狐撬鎖組": {
      "custom": true, "category": "gear", "price_cc": 120, "tags": ["general"],
      "tool": { "kind": "lockpick", "bonus": 2 },
      "desc": "細如狐毛的鋼針，冷天也不會凍住。"
    },
    "鯨脂蠟": {
      "custom": true, "category": "gear", "price_cc": 4, "tags": ["general"], "burns": 50,
      "desc": "一塊鯨脂熬的蠟，冰燭提燈大約能點 50 格。"
    },
    "冰燭提燈": {
      "custom": true, "category": "gear", "price_cc": 45, "tags": ["general"],
      "tool": { "kind": "light", "bonus": 1, "fuel": "鯨脂蠟" },
      "desc": "燒鯨脂蠟的提燈，風雪裡也不會熄。"
    },
    "熊皮暖床": {
      "custom": true, "category": "furniture", "price_cc": 300, "tags": ["tailor"],
      "furniture": { "places": ["indoor"], "function": "bed", "comfort": 2, "icon": "🛏️" },
      "recipe": { "craft": "leatherwork", "level": 2, "inputs": [{ "name": "狼皮", "qty": 4 }], "cost_cc": 100, "hours": 4 },
      "desc": "鋪著整張熊皮的床。有床就能在家長休。"
    },
    "雪原獵人的記號": {
      "custom": true, "category": "info", "price_cc": 40, "tags": ["info"],
      "intel": { "kind": "point", "event": "combat", "location": "whisper_crypt", "layer": "shallow", "days": 7 },
      "desc": "刻在樹皮上的記號，指著低語墓穴淺層一群魔物的巢。"
    },
    "走私販的口信": {
      "custom": true, "category": "info", "price_cc": 50, "tags": [],
      "intel": { "kind": "lead" },
      "desc": "一句沒頭沒尾的口信，似乎和某件委託的內幕有關。"
    },
    "霜狼之牙護符": {
      "custom": true, "category": "equipment", "price_cc": 400, "tags": [],
      "gear": { "base": "amulet_ward", "material": "silver", "unique": { "check": { "contexts": ["travel", "road"] }, "bonus": 2 } },
      "chests": { "deep": 0.03 },
      "desc": "串著霜狼犬齒的銀護符，戴著它的人總能在暴風雪前找到避風處。"
    },
    "霜咬長劍": {
      "custom": true, "category": "equipment", "price_cc": 5760, "tags": ["smith"], "min_location": "city",
      "gear": { "base": "longsword", "material": "mod_mat_frostsilver", "rarity": "epic", "enchants": { "mods": { "hit": 1 }, "offense": { "cold": 0.25 } } },
      "desc": "劍身結著薄霜的長劍，砍中時帶著刺骨的寒氣。"
    },
    "皮裘": {
      "custom": true, "category": "equipment", "price_cc": 700, "tags": ["tailor"],
      "gear": { "base": "mod_base_furcoat", "material": "leather" },
      "desc": "內襯厚毛的長皮衣，擋得住北境的風雪。"
    },
    "乾糧": {
      "category": "food", "price_cc": 5, "tags": ["general"], "use": { "condition": "fed_light" },
      "desc": "耐放的硬餅與肉乾，北境的獵人還會夾一片鹹魚。吃了可以果腹；在安全房長休時每人要吃一份。",
      "recipe": { "craft": "cooking", "level": 1, "inputs": [{ "name": "生肉", "qty": 1 }], "qty": 3, "cost_cc": 2, "hours": 1 }
    }
  }
}
```

這個範例套用之後：

- 自動產生的制式裝備：霜銀 × 內建的 16 種金屬底材（霜銀長劍 2880、霜銀板甲 72000……，城市以上的鐵匠鋪）、鉤刃 × 6 種金屬材料（鐵鉤刃 220、鋼鉤刃 440……；星隕鐵鉤刃不賣）、皮裘 × 5 種皮料（皮裘、硬皮裘、魔獸皮裘……）。「皮裘」另外寫成物品，是為了改它的價格與描述（[shops](shops.md) 的完整範例把它放進固定清單；制式裝備不另外寫也能放）。
- 霜銀是第 3 級：委託打造要工藝 3 級的工匠（城市一定有，城鎮、港口不一定）與「霜銀礦石」（主手 2 塊、上身 3 塊）。寶箱的隨機裝備仍然用秘銀（同類同級的內建材料），霜銀只從商店、打造、中深層寶箱的礦石與寫好的「霜咬長劍」來。
- 霜咬長劍：估價 240 × 12 ×（1 + 0.5 × 2 點）= 5760；附魔 2 點，不超過史詩的 4 點。
- 價格對照：霜苔治療藥的配方成本 3 × 12 + 20 + 150 = 206，不低於賣回的 200；雪原燉鍋 12 + 20 = 32，不低於賣回的 2 × 12.5。

## 6. 常見錯誤

匯入時整理不會報錯，只會默默改掉。世界檢查的「整理時改了」列出的就是這些；**一筆都不要留**。

| 寫法 | 整理後 |
|---|---|
| 物品名稱（key）超過 20 字 | 整筆不收（檢查列為錯誤） |
| 物品裡的 `name` 和 key 不一樣 | 改成 key |
| `tags` 寫店的 id（`smithy`、`informant`）、`unique` 或自建商店的 id | 拿掉（內建的獨特物品資料裡有 `unique` 標籤，改內建獨特物品時也要拿掉） |
| `min_location` 寫 `village`、`port`、`outpost` | 拿掉（＝不限） |
| `category` 不對 | 變 `material`，接著只有材料能有的欄位會留下 |
| `tool`、`burns` 寫在 `gear` 以外的類別；`seed` 寫在 `material` 以外；`intel` 寫在 `info` 以外；`gear`、`master_force` 寫在 `equipment` 以外；`recipe` 寫在 `equipment` 上 | 整欄拿掉 |
| `use.heal` 寫固定值（`"10"`）或骰子格式不對（`2d6 + 1d4`） | 整欄拿掉 |
| `use.save`、`use.area` 沒有 `damage` 也沒有 `apply` | 拿掉 |
| `use.status`、`apply.status`、`cleanse` 的狀態不存在 | 拿掉 |
| `use.perks` 超過 6 個、有種族特質或不存在的 | 留前 6 個合法的 |
| `tool.bonus` 超過上限（照明 2、其他 10），`camp`／`hone`／`craft` 寫了 `bonus` | 夾住；沒有加值的拿掉 |
| `tool.tier` 寫 3 | 變 1（高階是家具） |
| `furniture.places` 寫 `garden` 這類不存在的 | 拿掉；全部不對時變 `["indoor"]` |
| `furniture.comfort` 超過 10、寫 0 | 夾到 10；0 拿掉 |
| `furniture.icon` 是組合 emoji 或超過 2 個字元 | 截斷 |
| `recipe.qty` 寫 1、`cost_cc` 寫 0 | 拿掉 |
| `recipe.inputs` 超過 6 種、有成品自己、同名重複 | 只留前 6 種、拿掉自己、合併（陣列長度變了，檢查會列出整個 `inputs`） |
| `chests` 某一層寫 0、層名不對（`dungeon`、`boss`） | 拿掉 |
| `gear.rarity` 和材料原本的一樣 | 拿掉 |
| `gear` 的底材和材料類型不同（短劍 × 皮革）、id 不存在 | 整個 `gear` 拿掉 |
| `enchants.mods` 超過 ±5、`unique.bonus` 超過 3、`attrs` 超過 ±3 | 夾住（附魔夾住後仍然可能超過稀有度的點數，自己守 2.7 節） |
| `unique.check.contexts` 不在 `perks.json` 的 `contexts`、`attrs` 不是五屬性 | 拿掉；全部拿掉時變成「所有檢定 +N」 |
| 材料 `name` 超過 8 字、`tier` 超過 5 | 截斷、夾住 |
| 修改內建材料改了 `kind`、`tier` | 改回內建的 |
| 底材 `slot` 寫 `ring_1`、`piercing_1` 這類單一欄位 | 變 `main_hand`（戒指寫 `ring`、穿孔飾品寫 `piercing`） |
| 底材寫 `weapon`、`armor`（武器、防具類型的 id） | 拿掉，換成那一種原版的 `weaponDef`、`armorDef`，名稱用底材的（檢查列為改了）；修改內建底材時指向別的類型的直接拿掉。一律直接寫 `weaponDef`、`armorDef` |
| `two_handed` 寫在主手以外；`weaponDef` 寫在主手以外；`armorDef` 寫在上身以外 | 拿掉 |
| `restraint` 寫在主手或上身底材 | 拿掉 |
| 修改內建底材改了 `slot`、`kind`、`two_handed` | 改回內建的 |

整理不會列成「改了」、要自己注意的：

- `use` 有 `cleanse`（或 `status`、`temp_hp`、`ap`、`revive`、`escape`）但沒有 `heal`、`slot` 時，整理**補上** `combat_only: true`（世界檢查列成說明）：只解毒的解毒劑在戰鬥以外不能用。想在戰鬥以外也能用，配一個小的 `heal`（止血繃帶：`heal` 1d4 ＋ `cleanse`）。
- 主手底材沒有 `weaponDef`、上身底材沒有 `armorDef`：不會被拿掉，但裝上之後沒有武器骰、沒有防具數值。
- 種子收成、燈的燃料、`intel.story`、獨特物品的 `kinds`／`vs_tags` 不檢查存不存在（第 3 節）；配方材料不存在時世界檢查只提醒，不會拿掉。
- 自建材料和內建材料同類同級時，寶箱、掉落、建角與 NPC 的隨機裝備都不會用到它（1.3 節）；新的第 2 級以上材料沒有打造材料就打造不出來。
- 沒有任何取得方式的物品（沒有 `tags`、`chests`、`gather`、`event`、掉落、固定清單、任務或事件給的、配方或種子）遊戲裡拿不到。

## 7. 相關的系統文件

- [ITEMS](../../docs/ITEMS.md)：取得管道（第 1 節）、裝備欄位（第 2 節）、稀有度與附魔、獨特物品、屬性加減與主人強制裝備（第 3 節）、材料與底材、制式裝備、寶箱（第 4 節）、委託打造與打造材料（第 5 節）、消耗品、卷軸、書籍（第 6 節）、食物、雜物、家具、配方、情報（第 7 節）
- [CRAFTING](../../docs/CRAFTING.md)：七種工藝、工具的階級（第 3 節）、配方（第 6 節）
- [HOMES](../../docs/HOMES.md)：家具（第 4 節）、種植（第 6 節）
- [TRADE](../../docs/TRADE.md)：商店的目錄與價格、收購價
- [PERKS](../../docs/PERKS.md)：檢定的篩選條件（第 1、2 節）、書籍與學特質的機會（4.2 節）
- [DUNGEON_DESIGN](../../docs/DUNGEON_DESIGN.md) 第 4 節：光源與照明
- [CONTENT_EDITOR](../../docs/CONTENT_EDITOR.md) 第 2、3 節：物品、底材與材料的編輯畫面
- [CONTENT_DEPENDENCIES](../../docs/CONTENT_DEPENDENCIES.md)：物品、底材、材料被哪些內容引用
- [balance/items](../balance/items.md)：價格的範圍與自己對照的平衡
