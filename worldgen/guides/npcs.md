# 固定 NPC（`npcs`）

> 這份文件講固定 NPC 的格式：每個欄位的範圍、出現在哪裡的四種寫法、能引用什麼，以及匯入時會被默默改掉的地方。怎麼設計一批角色不在這裡。
> 系統文件：[NPC_SYSTEM](../../docs/NPC_SYSTEM.md)（名單、標籤、地區、互動）、[COMPANIONS](../../docs/COMPANIONS.md)（雇傭、任務同行）、[CONTENT_EDITOR](../../docs/CONTENT_EDITOR.md) 第 4 節（固定 NPC 的編輯）。程式：`src/engine/mods.ts` 的 `sanitizeNpc`（整理）、`src/engine/npcs.ts`（登場、依旗標改變出沒）、`src/engine/population.ts`（每天在哪裡、站哪一格）。

## 1. 用途與放在哪裡

固定 NPC 是有名字、固定待在某個地點名單上的角色：不會因為名單變動消失或被換掉，特殊任務用 id 指定他們（開頭、任務點、友方、敵人、同行）。

- **區塊**：`npcs`。世界包寫在 `content.npcs`，內容檔寫在最外層的 `npcs`（外層格式見 [content-file](content-file.md)）。
- **id**（區塊裡的 key）：新的角色用 `mod_npc_<英文小寫>`，只用小寫英數與底線，看得出是誰（`mod_npc_rhine_ratcatcher`）。整個世界裡不能重複。
- **新的角色**：加 `"custom": true`。
- **修改內建的角色**：用原本的 id（`npc_lina`、`npc_selene`……，查 `data/world/npcs.json`），**不加** `custom`，寫整份修改後的資料。
- 項目裡可以不寫 `id`；寫了要和 key 一樣。

## 2. 欄位一覽

範圍以外的值會被夾住或拿掉（第 6 節）。「沒寫」都用預設值，不算錯。

### 2.1 身分

| 欄位 | 型別 | 範圍 | 說明 |
|---|---|---|---|
| `custom` | 布林 | 新的角色一律 `true` | 改內建的角色時不寫 |
| `name` | 字串 | 最多 **12** 字；空的變「未命名」 | 遊戲裡顯示的名字。不要和內建角色同名（檢查會提醒） |
| `gender` | id | `male`、`female`、`femboy`、`ts`、`futa`、`unknown` | 其他值整欄拿掉。來源：`data/world/npc_pool.json` 的 `genders` |
| `race` | id | `human`、`elf`、`dwarf`、`demon`、`catfolk`、`yulin` | 其他值變 `human`。來源：`data/rules/attributes.json` 的 `races` |
| `kind` | 字串 | `adventurer` 冒險者、`commoner` 普通人 | 一律明寫。沒寫或寫錯時依 `class`：有戰鬥職業的當冒險者，沒有（或 `noncombatant`）的當普通人 |
| `class` | id | 冒險者：`fighter`、`barbarian`、`paladin`、`ranger`、`rogue`、`monk`、`bard`、`cleric`、`druid`、`wizard` | 冒險者寫其他值（包括 `noncombatant`）變 `fighter`。普通人**不要寫**（一律清成空字串）。來源：`data/rules/classes.json` |
| `level` | 整數 | 1～20，預設 1 | |
| `location` | 地點 id | 聚落（`type` 不是 `dungeon` 的地點） | 名單所屬的地點。地下城或不存在的 id 變 `soriel` |
| `hire_cc` | 整數 | 0～10000000；冒險者預設 100、普通人 0 | 雇傭的要價（白鸛幣），見 2.4 |
| `unhireable` | 布林 | 只有冒險者 | 不受雇用：不出現在雇用候選與酒館名單、不能談雇用（統治者、機構首長用）；特殊任務的「任務同行」不受影響。普通人寫了會被拿掉 |
| `no_attack` | 布林 | 只有冒險者（普通人本來就不能攻擊） | 不可偷襲：「這裡的人」的偷襲按鈕停用，AI 判定也不讓刺殺、偷襲得手。一國之主、機構首長用；特殊任務的戰鬥（`foes`）不受影響 |
| `no_steal` | 布林 | 冒險者與普通人 | 不可偷竊：偷竊按鈕停用，AI 判定也不讓偷竊得手 |
| `faction` | 字串 | 最多 30 字 | 勢力。**不檢查**：寫 `data/world/geography.json` 的 `factions` 的 id（`rhine_empire`、`holy_ring`……） |
| `occupation` | 字串 | 最多 **12** 字 | 普通人的職業描述（鐵匠、賣花女……），給 AI 參考 |
| `lineage` | 字串 | 最多 30 字 | 血統、部族、氏族（「鐵爐氏族」「沙痕部落」「魅魔（赤翼宮廷）」），名稱參考 [NPC_SYSTEM](../../docs/NPC_SYSTEM.md) 第 13 節與 `data/world/npc_traits.json` |
| `personality` | 字串 | 最多 160 字 | 性格。**一定要寫**：沒寫時補「沉默寡言。」，檢查會提醒 |
| `appearance` | 字串 | 最多 240 字 | 外貌 |
| `background` | 字串 | 最多 400 字 | 背景 |
| `tags` | id 陣列 | `data/rules/npc_tags.json` 的 key | `traveler` 旅人、`merchant` 商人、`commoner` 平民、`slave` 奴隸、`noble` 貴族、`royal` 皇族、`priest` 神官、`bishop` 主教、`good` 好人、`villain` 惡人、`prostitute` 娼妓。不存在的拿掉、重複的合併。**不檢查適用的類型與互斥**，自己遵守：`villain` 只給冒險者，`good` 和 `villain` 不能同時有，`merchant`、`commoner`、`royal`、`bishop`、`prostitute` 只給普通人 |
| `relations` | 物件 | `{ "<角色 id>": "文字" }`，每段最多 160 字 | 和其他角色的關係（給 AI）。空字串的拿掉 |
| `squad` | 物件 | `{ "name", "members", "together"?, "requires"? }` | 這個人帶著的小隊（寫在**隊長**身上）：`members` 是其他固定 NPC 的 id（1–3 人，不含自己）、`together` 是隊員每天跟著隊長的機率（0–1，預設 1）、`requires` 是小隊成立的條件。隊員跟著隊長出沒，只能整隊邀請或請他們帶主角同行（[NPC_SYSTEM](../../docs/NPC_SYSTEM.md) 第 3.1 節）。隊員之間記得也寫 `relations` |

### 2.2 能力值、技能、特質、裝備

不寫時依職業、種族與等級生成。普通人沒有戰鬥資料，這幾欄不用寫。

| 欄位 | 型別 | 範圍 | 說明 |
|---|---|---|---|
| `attrs` | 物件 | key 只有 `str` 力量、`dex` 靈巧、`int` 智力、`fai` 信仰、`cha` 魅力；值 1～30 | 升級後的**最終值**。寫 0 的不收，其他 key（`con`、`wis`）拿掉 |
| `abilities` | id 陣列 | `data/rules/abilities.json` 的 id，或同一個包裡 `abilities` 的自建技能 | 取代依職業學的技能。不存在的拿掉。**不檢查職業**，自己挑這個職業的（`classes` 欄位） |
| `perks` | id 陣列 | `data/rules/perks.json` 裡沒有 `race` 的特質（缺陷 `flaw_` 也可以），或自建的特質 | 不寫＝依 id 固定地抽；`[]`＝沒有特質。種族特質與不存在的拿掉 |
| `gear` | 物件 | `{ "<欄位>": <裝備規格> }` | 指定的欄位用這件，沒寫的欄位空著（見下表） |

**裝備的欄位**：`main_hand` 主手、`off_hand` 副手、`head`、`body`、`legs`、`wrists`、`feet`、`belt`、`accessory` 首飾、`ring_1`、`ring_2`、`piercing_1`、`piercing_2`、`leg_accessory`。

**裝備規格**（`data/rules/gear.json`；裝備的組成見 [ITEMS](../../docs/ITEMS.md)）：

| 欄位 | 範圍 | 說明 |
|---|---|---|
| `base` | `gear.json` 的 `bases`，或自建底材 | 底材的 `slot` 要對得上欄位：`ring` 放 `ring_1`／`ring_2`，`piercing` 放 `piercing_1`／`piercing_2`，其他要一樣（長劍不能放副手）。對不上的整件拿掉 |
| `material` | `gear.json` 的 `materials`，或自建材料 | 材料的 `kind`（metal、leather、cloth、wood、jewel）要和底材一樣。不合的整件拿掉 |
| `rarity` | `common`、`uncommon`、`rare`、`epic`、`legendary` | 選填。**和材料本身的稀有度一樣時被拿掉**：只在要改稀有度時寫 |
| `enchants` | `mods`（`hit`、`evade`、`save`、`damage`、`dr`、`ap_regen`、`crit`、`threat`，每項 −5～5）、`resist`、`offense` | 選填，附魔 |
| `attrs` | 每項 −3～3 | 選填，屬性加減 |

### 2.3 出現在哪裡

除了 `location`（名單所屬的地點），再選一種方式。都沒寫時只有認識之後才找得到（檢查會說明）。

| 欄位 | 型別 | 範圍 | 說明 |
|---|---|---|---|
| `haunts` | 陣列 | `[{ "location": "<地點 id>", "zone": "<地區>", "weight": 1 }]`；`location` 任何地點（包括地下城），`zone` 是 `town`、`noble`、`palace`、`temple`、`brothel`、`outskirts`、`dungeon`，`weight` 0.01～10（沒寫＝1） | **活躍地點**：每天依權重決定在哪個地點的哪個地區，在那個區塊裡隨機一格。地點或地區不對的那一筆拿掉 |
| `fixed` | 物件 | `{ "area": "<區塊 key>", "x": 0, "y": 0 }` | **固定在一格**。`area` 是聚落的區塊（`rhineburg/lower`）或固定的特殊地圖（`sm/sm_rhineburg_sewer`）。格子不能是牆或水。有 `fixed` 時不看 `haunts` |
| `landmark` | 地標 id | `lm_` 開頭，而且這個地標的 `location` 要和角色的 `location` 一樣 | **待在地標**：站在地標那一格，地標搬家時跟著走。有 `landmark` 時不看 `fixed` 與 `haunts` |
| `keeper` | 店種 | `general` 雜貨店、`temple` 神殿、`tavern` 酒館、`smithy` 鐵匠鋪、`tailor` 裁縫店、`jeweler` 珠寶店、`magic` 魔法物品店、`informant` 情報商，或自建商店的 id（`shop_…`） | **擔任店主**：取代所屬地點那間店生成的店主，平常待在店裡。所屬地點要有這種店（第 3.2 節的表）。同一間店有好幾位時用第一位。流浪商人 `wanderer` 不行 |
| `requires` | 物件 | `{ "flags": [...], "flags_none": [...] }` | 只在 `flags` 全部成立、`flags_none` 全部不成立時出現。不成立時不在任何地圖上、不能雇用；特殊任務把他列為友方時例外。旗標名稱的規則見 [stories](stories.md) 第 2.6 節 |
| `stages` | 陣列 | `[{ "requires": {...}, "location": "<聚落 id>", "haunts": [...], "fixed": {...} }]` | **依劇情旗標改變出沒**：由上往下用第一組 `requires` 成立的設定，取代 `location`、`haunts`、`fixed`（和上面的規則一樣）。一組成立時不看 `landmark`。沒有 `requires` 的一組整組拿掉；`location` 不對時用角色本身的 `location`。同一個角色，親密度、記憶、等級、裝備都延續 |

- `x` 是第幾欄、`y` 是第幾列，從 0 開始，對照區塊的 `grid`（每一列是一個字串）。
- 座標超出區塊時被夾到邊上，再看那一格：是牆或水就整欄拿掉，不是就留下（可能落在通道上）。

### 2.4 雇傭與同行

- **只有冒險者能雇用**（也只有冒險者能戰鬥、被攻擊）。普通人沒有戰鬥資料，不能雇用。
- 雇用的要價是 `hire_cc`；出價低於要價時是談判（[COMPANIONS](../../docs/COMPANIONS.md) 2.1 節）。統治者、機構首長這類不會跟冒險者走的人加 `"unhireable": true`（`hire_cc` 寫 0）。生成的冒險者要價約 60 + 45 × 等級 + 10 × 等級²（±25%），固定 NPC 的可以參考。
- `requires` 不成立、在別的隊伍裡、敵對時不能雇用。
- 特殊任務可以讓固定 NPC「任務同行」（結果的 `join`、`leave`）：不佔隊伍名額，最多 2 人，任務結束時離隊。正式入隊用效果 `{ "type": "companion", "npc": "<id>", "mode": "voluntary" }`（見 [stories](stories.md)）。

## 3. 可以引用什麼

被引用的要先存在：內建的，或同一個檔案裡的自建項目（整理的順序是技能、特質、材料、底材、地標、特殊地圖、商店，然後才是固定 NPC，所以同一個包裡的都認得）。

### 3.1 查詢的地方

| 要什麼 | 去哪裡查 |
|---|---|
| 地點 id、類型、地區、勢力 | `data/world/geography.json` 的 `locations`（`id`、`type`、`region`、`faction`）、`factions` |
| 城鎮區塊與格子 | `data/world/maps.json` 的 `maps.<地點 id>.blocks`：區塊 key 是 `<地點 id>/<區塊 id>`；`zone` 沒寫的是 `town`；`grid` 的字元對照 `legend`（`#` 建築、`~` 水道、`.` 街道、`I` 旅店、`G` 公會、`T` 酒館、`S` 雜貨店、`C` 神殿、`E` 城門、`B` 娼館、`F` 鐵匠鋪、`D` 裁縫店、`J` 珠寶店、`M` 魔法物品店、`N` 情報商、`H` 民宅、`K` 刺青店、`X` 刻印師；數字是通往別的區塊的通道） |
| 特殊地圖與格子 | `data/world/special_maps.json` 的 `maps`（`grid`、`entry`、`connections`），或同一個包裡的 `specialMaps`。只有有 `grid` 的固定地圖能放人。字元：`#` 牆、`.` 道路、`~` 水、`E` 出口、`S` 安全房、`M` 遭遇、`X` 強敵、`R` 資源、`C` 寶箱、`T` 陷阱 |
| 地標 | `data/world/landmarks.json` 的 `landmarks`（`id`、`location`、`at`），或同一個包裡的 `landmarks` |
| 店種 | `data/rules/shops.json` 的 `types`，或同一個包裡的 `shops`（`shop_…`） |
| 標籤 | `data/rules/npc_tags.json` 的 `tags`（`kinds` 是適用的類型、`exclusive` 是互斥） |
| 技能 | `data/rules/abilities.json`（`classes` 是哪些職業會） |
| 特質 | `data/rules/perks.json`（有 `race` 的不行） |
| 底材、材料 | `data/rules/gear.json` 的 `bases`、`materials` |

一行查出某個地點的區塊與格子：

```
python3 -c "import json;m=json.load(open('data/world/maps.json'))['maps']['rhineburg'];[print(b['id'],b.get('zone','town'),*b['grid'],sep='\n') for b in m['blocks']]"
```

### 3.2 聚落的區塊與設施

區塊 key 是 `<地點>/<區塊>`；括號裡是地區（沒有標的是 `town`）。地區 `temple`、`brothel` 是有神殿格、娼館格的地點才有；`noble`、`palace` 只有標了的區塊。

| 地點 | 區塊：設施 |
|---|---|
| `soriel` 索里耶爾 | `pilgrim`：城門、旅店、酒館、雜貨店、情報商、刻印師 ／ `market`：公會、鐵匠鋪、裁縫店、珠寶店、魔法物品店、刺青店、娼館、酒館 ／ `sanctum`（noble）：神殿、旅店 ／ `harbor`：雜貨店、裁縫店、酒館、神殿 |
| `rhineburg` 萊茵堡 | `gate`：城門、公會、旅店、雜貨店、鐵匠鋪、酒館、刻印師 ／ `avenue`：珠寶店、裁縫店、魔法物品店、情報商、刺青店、神殿 ／ `lower`：娼館、旅店、酒館、裁縫店 ／ `noble`（noble）：神殿 ／ `palace`（palace） |
| `dawnlight` 晨光城 | `gate`：城門、公會、旅店、雜貨店、鐵匠鋪、裁縫店、刺青店、酒館 ／ `plaza`：娼館、刻印師、情報商、珠寶店、魔法物品店、神殿 ／ `noble`（noble）：神殿 ／ `palace`（palace） |
| `albena` 阿爾貝納 | `gate`：城門、公會、旅店、鐵匠鋪、裁縫店、酒館、刻印師 ／ `market`：娼館、情報商、珠寶店、魔法物品店、雜貨店、刺青店 ／ `river`：神殿 |
| `rivervale` 河谷鎮 | `bank`：城門、公會、旅店、雜貨店、鐵匠鋪、裁縫店、酒館 ／ `upper`：娼館、情報商、神殿 |
| `coast_ferry` 沿海渡口 | `ferry`：城門、公會、旅店、雜貨店、鐵匠鋪、裁縫店、刺青店、酒館 ／ `village`：娼館、情報商、神殿 |
| `ironforge` 鐵爐堡 | `gate`：城門、公會、旅店、雜貨店、酒館 ／ `forge`：珠寶店、鐵匠鋪、裁縫店、刺青店 ／ `market`：娼館、刻印師、情報商、魔法物品店、神殿 ／ `noble`（noble）：神殿 ／ `palace`（palace） |
| `greyrock` 灰岩堡壘 | `outer`：城門、公會、旅店、雜貨店、鐵匠鋪、裁縫店、酒館 ／ `inner`：娼館、情報商、神殿 |
| `windhammer` 風錘村、`snowridge` 雪嵴哨站、`sunscorch` 烈日草原 | `main`：城門、公會、旅店、雜貨店、鐵匠鋪、酒館、娼館（沒有神殿、情報商） |
| `bloodplume` 血羽城堡 | `gate`：城門、旅店、鐵匠鋪、裁縫店、酒館、刻印師 ／ `market`：公會、情報商、珠寶店、魔法物品店、雜貨店、刺青店、神殿 ／ `slums`：娼館、酒館 ／ `noble`（noble）：神殿 ／ `palace`（palace） |
| `moltenhold` 熔火堡壘 | `bridge`：城門、公會、旅店、雜貨店、鐵匠鋪、裁縫店、酒館 ／ `keep`：娼館、情報商、神殿 |
| `shadow_vale` 陰影之谷 | `gate`：城門、公會、旅店、鐵匠鋪、裁縫店、酒館 ／ `market`：情報商、珠寶店、魔法物品店、雜貨店、刺青店、神殿 ／ `low`：娼館 |
| `bone_hills` 獸骨荒丘 | `main`：城門、公會、旅店、雜貨店、鐵匠鋪、酒館、娼館 |
| `silent_tomb` 寂墓聖堂 | `gate`：城門、公會、旅店、雜貨店、鐵匠鋪、裁縫店、刺青店、酒館 ／ `market`：娼館、情報商、珠寶店、魔法物品店 ／ `cathedral`：神殿 |
| `rotmarsh` 腐沼村 | `main`：城門、公會、旅店、雜貨店、酒館、娼館 |
| `ashport` 灰港鎮 | `port`：城門、公會、旅店、雜貨店、鐵匠鋪、裁縫店、刺青店、酒館 ／ `market`：娼館、刻印師、情報商、珠寶店、魔法物品店、神殿 |
| `silvermoon` 銀月城 | `gate`：城門、公會、旅店、雜貨店、鐵匠鋪、裁縫店、酒館 ／ `market`：娼館、情報商、珠寶店、魔法物品店、神殿 ／ `noble`（noble）：刻印師、刺青店、神殿 ／ `palace`（palace） |
| `mosswhisper` 苔語村、`windspeak` 風語崗哨、`stilltide_oasis` 靜潮綠洲 | `main`：城門、公會、旅店、雜貨店、裁縫店、酒館、娼館（沒有鐵匠鋪、神殿、情報商） |
| `tidehaven` 潮汐港 | `docks`：城門、旅店、雜貨店、鐵匠鋪、酒館、刻印師 ／ `market`：公會、情報商、珠寶店、魔法物品店、裁縫店、刺青店、神殿 ／ `lower`：娼館、旅店、酒館 ／ `noble`（noble）：神殿 ／ `palace`（palace） |
| `coral_bay` 珊瑚灣鎮 | `docks`：城門、公會、旅店、雜貨店、鐵匠鋪、裁縫店、酒館 ／ `town`：娼館、情報商、神殿 |
| `canglue` 滄月闕 | `gate`：城門、公會、旅店、雜貨店、鐵匠鋪、裁縫店、酒館 ／ `market`：娼館、情報商、珠寶店、魔法物品店、刺青店、神殿 ／ `noble`（noble）：刻印師、神殿 ／ `palace`（palace） |
| `sandcastle` 沙堡營地 | `camp`：城門、公會、旅店、雜貨店、鐵匠鋪、裁縫店、酒館 ／ `bazaar`：娼館、情報商、神殿 |

地下城（`haunts` 的 `zone: "dungeon"` 用）：`whisper_crypt`、`snake_creek`、`mist_abbey`、`redemption_pit`、`echo_rift`、`giants_spine`、`ember_rift`、`bloodrock_cave`、`hell_greenhouse`、`moonshadow_roots`、`thorn_corridor`、`verdant_hollow`、`tidefall_cave`、`skull_isle`、`echo_canyon`、`quicksand_temple`。

這張表是目前資料的樣子；以 `maps.json` 為準。

## 4. 最小範例

一位每天在河谷鎮城裡或近郊出沒的冒險者：

```json
{
  "type": "elondia-content",
  "npcs": {
    "mod_npc_rivervale_guard": {
      "custom": true,
      "name": "托瑪斯",
      "gender": "male",
      "race": "human",
      "kind": "adventurer",
      "class": "fighter",
      "level": 2,
      "location": "rivervale",
      "hire_cc": 140,
      "personality": "退伍的民兵，話不多，守信用，對新來的冒險者很照顧。",
      "haunts": [
        { "location": "rivervale", "zone": "town", "weight": 1 },
        { "location": "rivervale", "zone": "outskirts", "weight": 0.4 }
      ]
    }
  }
}
```

## 5. 完整範例

萊茵堡的一組角色，示範每一種出現的方式。葛蕾塔是 [stories](stories.md) 完整範例的委託人：平常在城裡活躍，任務完成（🚩`sewer_app_done`）後固定待在下城區的一格。

```json
{
  "type": "elondia-content",
  "npcs": {
    "mod_npc_rhine_ratcatcher": {
      "custom": true,
      "name": "葛蕾塔",
      "gender": "female",
      "race": "human",
      "kind": "adventurer",
      "class": "rogue",
      "level": 3,
      "location": "rhineburg",
      "hire_cc": 260,
      "tags": ["good"],
      "lineage": "萊茵帝國",
      "faction": "rhine_empire",
      "personality": "下城區長大的捕鼠人，嘴巴刻薄、手腳俐落，對收的學徒卻像親姊姊一樣護短。",
      "appearance": "灰褐色短髮塞在油布帽裡，臉頰有一道被老鼠咬過的淺疤；腰間掛著一串捕鼠夾與一盞防風燈。",
      "background": "葛蕾塔替萊茵堡的行會清理下水道已經十年，熟悉每一條排水溝。最近她的學徒在古蓄水池附近失蹤，衛兵不肯為一個捕鼠學徒下去找人。",
      "relations": { "mod_npc_sewer_hermit": "常拿乾糧跟他換下水道深處的消息，嘴上叫他老瘋子。" },
      "attrs": { "str": 10, "dex": 16, "int": 12, "fai": 9, "cha": 13 },
      "abilities": ["sneak_attack", "cunning_action", "poison_blade"],
      "perks": ["streetwise"],
      "gear": {
        "main_hand": { "base": "shortsword", "material": "steel", "rarity": "uncommon" },
        "body": { "base": "leather_armor", "material": "hard_leather" },
        "feet": { "base": "boots", "material": "leather" },
        "ring_1": { "base": "ring_swift", "material": "silver" }
      },
      "haunts": [
        { "location": "rhineburg", "zone": "town", "weight": 1 },
        { "location": "rhineburg", "zone": "outskirts", "weight": 0.3 }
      ],
      "stages": [
        {
          "requires": { "flags": ["sewer_app_done"] },
          "location": "rhineburg",
          "fixed": { "area": "rhineburg/lower", "x": 3, "y": 3 }
        }
      ]
    },
    "mod_npc_sewer_hermit": {
      "custom": true,
      "name": "老鼠伯",
      "gender": "male",
      "race": "human",
      "kind": "commoner",
      "level": 1,
      "location": "rhineburg",
      "occupation": "流浪漢",
      "tags": ["commoner"],
      "personality": "住在下水道的老人，說話顛三倒四，卻記得每一條水道通往哪裡。",
      "fixed": { "area": "sm/sm_rhineburg_sewer", "x": 2, "y": 5 },
      "requires": { "flags_none": ["sewer_hermit_gone"] }
    },
    "mod_npc_rhine_smith": {
      "custom": true,
      "name": "漢斯",
      "gender": "male",
      "race": "dwarf",
      "kind": "commoner",
      "level": 4,
      "location": "rhineburg",
      "occupation": "鐵匠",
      "tags": ["merchant"],
      "lineage": "鐵爐氏族",
      "personality": "從鐵爐堡搬來的矮人鐵匠，重承諾，討價還價時寸步不讓。",
      "keeper": "smithy"
    },
    "mod_npc_rhine_drillmaster": {
      "custom": true,
      "name": "奧托",
      "gender": "male",
      "race": "human",
      "kind": "adventurer",
      "class": "paladin",
      "level": 6,
      "location": "rhineburg",
      "hire_cc": 900,
      "tags": ["noble"],
      "personality": "騎士學院的教官，嚴厲、守規矩，私下會替貧窮的學員付學費。",
      "landmark": "lm_knight_academy"
    },
    "mod_npc_rhine_flowergirl": {
      "custom": true,
      "name": "莉莎",
      "gender": "female",
      "race": "catfolk",
      "kind": "commoner",
      "level": 1,
      "location": "rhineburg",
      "occupation": "賣花女",
      "tags": ["commoner"],
      "personality": "總是在城門兵營區賣花的貓魅族少女，愛打聽消息。",
      "fixed": { "area": "rhineburg/gate", "x": 2, "y": 3 }
    }
  }
}
```

| 角色 | 出現的方式 | 格子 |
|---|---|---|
| 葛蕾塔 | 活躍地點；🚩`sewer_app_done` 成立後改成固定格子 | `rhineburg/lower` 第 3 列 `#...#...#.2` 的 x=3（`.`） |
| 老鼠伯 | 固定在特殊地圖的一格；🚩`sewer_hermit_gone` 成立後消失 | `sm_rhineburg_sewer` 第 5 列 `#C....X...#` 的 x=2（`.`） |
| 漢斯 | 萊茵堡鐵匠鋪的店主 | 萊茵堡 `gate` 區塊有 `F` |
| 奧托 | 待在地標 `lm_knight_academy`（`location` 是 `rhineburg`） | 地標的 `at` |
| 莉莎 | 固定在聚落的一格 | `rhineburg/gate` 第 3 列 `2....I....#` 的 x=2（`.`） |

## 6. 常見錯誤

匯入時整理（`sanitizeNpc`）不會報錯，只會默默改掉。世界檢查的「整理時改了」列出的就是這些；**一筆都不要留**。

| 寫法 | 整理後 |
|---|---|
| 沒寫 `kind` | 有戰鬥職業的變成冒險者，沒有的變成普通人（檢查**不會**提醒，因為 `kind` 是補上的預設值）：冒險者忘了寫 `class` 會變成普通人 |
| 普通人寫了 `class` | 清成空字串 |
| 冒險者的 `class` 是 `noncombatant` 或不存在 | 變 `fighter` |
| `name` 超過 12 字、`occupation` 超過 12 字、`personality` 超過 160 字、`appearance` 超過 240 字、`background` 超過 400 字 | 截斷 |
| `race`、`gender` 不存在 | `race` 變 `human`；`gender` 整欄拿掉 |
| `level` 超過 20、`attrs` 超過 30 | 夾到上限 |
| `location` 是地下城或不存在 | 變 `soriel` |
| `attrs` 寫 0、寫 `con`／`wis` 這類不存在的屬性 | 那一項拿掉 |
| `tags`、`abilities`、`perks` 裡不存在的 id；`perks` 裡的種族特質 | 拿掉 |
| `haunts` 的地區不是七種之一（`market`、`city`……）、地點不存在 | 那一筆拿掉；`weight` 超過 10 夾到 10 |
| 裝備的底材放錯欄位、材料的類型和底材不同、底材或材料不存在 | 那一件拿掉 |
| 裝備的 `rarity` 和材料本身一樣（鋼 `common`、銀 `uncommon`……） | `rarity` 拿掉 |
| `fixed` 的座標超出區塊 | 夾到邊上；夾過去是牆或水時整欄拿掉 |
| `fixed` 落在牆（`#`）或水（`~`）上、區塊 key 不存在、特殊地圖是隨機地圖 | 整欄拿掉 |
| `landmark` 屬於別的地點 | 整欄拿掉 |
| `keeper` 是 `wanderer` 或不存在的店種 | 整欄拿掉 |
| `stages` 有一組沒寫 `requires`（或旗標全是空的） | 那一組拿掉 |
| `stages` 的 `location` 不對 | 改成角色本身的 `location` |
| 旗標名稱有空白、`story:` 前綴、超過 40 字 | 空白換成 `_`、去掉前綴、截斷 |
| `squad` 的隊員寫到自己、重複、超過 3 人 | 拿掉自己與重複的，留前 3 人；一個隊員都沒有時整欄拿掉。`together` 夾在 0–1 |

整理不檢查、要自己對的：

- `tags` 的適用類型與互斥（`villain` 給普通人、`good` 和 `villain` 一起寫都會留著）。
- `abilities` 是不是這個職業的技能。
- `faction` 是不是勢力 id；`relations` 的 key 是不是存在的角色。
- `squad` 的隊員是不是存在的角色、有沒有同時在兩支小隊、隊長是不是別隊的隊員（遊戲中略過不存在的 id，重複時只算第一支小隊）。
- `keeper` 的店在所屬地點有沒有（第 3.2 節；沒有時世界檢查會提醒，但整理不拿掉）；`haunts` 的地區在那個地點有沒有（例如 `palace` 只有王都）。
- `fixed` 落在通道（數字）上也會留著：選 `.` 或設施格，不要選通道。

## 7. 相關的系統文件

- [NPC_SYSTEM](../../docs/NPC_SYSTEM.md)：名單、標籤（第 4 節）、地區與活躍地點（第 5 節）、格子上的位置（11.1 節）、名字外貌性格與血統（第 13 節）
- [COMPANIONS](../../docs/COMPANIONS.md)：雇傭（2.1 節）、任務同行、主人的身分
- [CONTENT_EDITOR](../../docs/CONTENT_EDITOR.md) 第 4 節：固定 NPC 的編輯、擔任店主、依劇情旗標改變出沒
- [STORY_QUESTS](../../docs/STORY_QUESTS.md)：劇情旗標、特殊任務怎麼用固定 NPC
- [SPECIAL_MAPS](../../docs/SPECIAL_MAPS.md) 第 6 節、[LANDMARKS](../../docs/LANDMARKS.md)：站在特殊地圖與地標上
- [ITEMS](../../docs/ITEMS.md)：裝備的組成
