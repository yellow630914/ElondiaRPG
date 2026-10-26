# 特殊任務（`stories`）

> 這份文件講特殊任務的格式：開頭、任務點、地點、結果、效果、旗標的每個欄位與範圍，以及匯入時會被默默改掉、或整條不收的寫法。怎麼設計任務線不在這裡。
> 系統文件：[STORY_QUESTS](../../docs/STORY_QUESTS.md)（特殊任務與劇情旗標）、[EFFECTS](../../docs/EFFECTS.md)（效果）、[SPECIAL_MAPS](../../docs/SPECIAL_MAPS.md)（特殊地圖的任務點與傳送）。程式：`src/engine/storyMods.ts` 的 `sanitizeStory`（整理）與 `storyCheck`（檢查任務鏈）、`src/engine/story.ts`（進行任務）、`src/engine/storyFlags.ts`（旗標）。

## 1. 用途與放在哪裡

特殊任務是人工編寫的任務鏈：一個**開頭**、一串**任務點**、**完成報酬**。任務點之間的順序與分支用**劇情旗標**接起來：任務點需要某些旗標才出現，結果設定或清除旗標。

- **區塊**：`stories`。世界包寫在 `content.stories`，內容檔寫在最外層的 `stories`（外層格式見 [content-file](content-file.md)）。
- **id**（區塊裡的 key）：新的任務用 `mod_story_<英文小寫>`，只用小寫英數與底線（`mod_story_sewer_apprentice`）。整個世界裡不能重複。
- **新的任務**：加 `"custom": true`。
- **修改內建的任務**：用原本的 id（例如 `lost_relic`、`dawn_throne_ambush`，全部查 `data/rules/stories.json`），**不加** `custom`，寫整份修改後的資料。
- 項目裡可以不寫 `id`；寫了要和 key 一樣。
- **有錯誤的任務整條不匯入**（第 6.2 節）；拿掉一條可能讓開啟它的任務也變成有錯誤，會連鎖拿掉。

## 2. 欄位一覽

### 2.1 任務

| 欄位 | 型別 | 範圍 | 說明 |
|---|---|---|---|
| `custom` | 布林 | 新的任務一律 `true` | |
| `title` | 字串 | 最多 **30** 字；空的變「新的特殊任務」 | 名稱 |
| `summary` | 字串 | 最多 300 字 | 冒險筆記上的簡介；開頭沒寫 `text` 時也用它 |
| `tags` | 字串陣列 | `adult`、`ntr`、`non_virgin`、`pc_unwilling` | 內容標籤：接任務時顯示警示；成人向在成人向關閉時不開放，其他標籤玩家可以在設定裡關閉。選項也可以有 `tags`（只有那個分支的內容） |
| `rank` | 字串 | `F`、`E`、`D`、`C`、`B`、`A`、`S` | 建議的公會階級：主角的階級同級或更高才接得到（組隊 2 人以上可以低一級）。不寫＝不限 |
| `merit` | 整數 | 0～100；不寫＝5 | 完成時的公會功績 |
| `time_limit` | 整數 | 1～365 天；0 或不寫＝不限 | 開始後幾天內要完成，過了就失敗 |
| `start` | 物件 | 見 2.2 | 開頭 |
| `start_flags` | 字串陣列 | 旗標名稱（2.6） | 任務開始時成立的旗標，通常是第一個任務點的 `requires`。**不能和別的任務的開頭旗標一樣**（錯誤） |
| `nodes` | 陣列 | 最多 60 個，見 2.3 | 任務點 |
| `rewards` | 效果陣列 | 見 2.5 | 完成報酬（有結果 `complete` 時發） |

### 2.2 開頭（`start`）

| 欄位 | 用在 | 範圍 | 說明 |
|---|---|---|---|
| `kind` | 全部 | `guild` 公會、`npc` 固定 NPC、`travel` 旅途事件、`informant` 情報商、`manual` 只由其他事件開啟 | 其他值變 `guild` |
| `location` | `guild`、`informant` | 地點 id | `guild`：**必填**，那座城要有公會。`informant`：選填（不寫＝任何一家），寫了那座城要有情報商。其他種類寫了會被拿掉 |
| `npc` | `npc` | 固定 NPC 的 id | **必填**。這位角色在身邊時出現「接下任務」 |
| `min_affinity` | `npc` | −100～100 | 這位角色的親密度至少多少才會拜託你（沒見過面算 0）；不寫＝不限 |
| `chance` | `travel` | 0.01～1；不寫＝0.2 | 每段旅程遇到的機率 |
| `regions` | `travel` | `central`、`north`、`south`、`forest`、`east_sea`、`west` | 只在前往這些地區時；不寫＝任何地區。不存在的拿掉 |
| `price` | `informant` | 0～10000000；不寫＝100 | 情報的價格（白鸛幣） |
| `min_level` | 全部 | 1～20 | 主角至少幾級 |
| `requires` | 全部 | `{ "flags": [...], "flags_none": [...], "flags_any": [...], "counters": { "<計數器 id>": { "min": 1 } }, "affinity": { "<固定 NPC id>": 最低好感 } }` | 接取條件（和任務點的 `requires` 同一種寫法） |
| `pc_body` | 全部 | `["fem"]` | 只給這些體型的主角（`masc`、`fem`、`andro`） |
| `text` | 全部 | 最多 400 字 | 開頭的事件描述 |

- `manual` 的任務要靠別的任務的效果 `{ "type": "start_story", "story": "<id>" }` 開始；沒有人開啟時檢查會提醒。
- `travel` 開頭的任務，第一個任務點通常是 `at.where: "road"`（開頭的那段路上）。

### 2.3 任務點（`nodes` 的每一項）

| 欄位 | 型別 | 範圍 | 說明 |
|---|---|---|---|
| `id` | 字串 | 英數與底線，最多 40 字；不寫＝`n1`、`n2`…… | 同一個任務裡不能重複（重複的後面補 `_`）。其他字元換成 `_` |
| `title` | 字串 | 最多 **40** 字 | 冒險筆記上的目標，寫出地點（「到萊茵堡的酒館打聽……」） |
| `text` | 字串 | 最多 600 字 | 觸發時的事件描述（也交給 AI） |
| `at` | 物件 | 見 2.4 | 在哪裡出現；不寫＝`settlement` |
| `requires` | 物件 | `{ "flags": [...], "flags_none": [...], "affinity": { "<固定 NPC id>": 最低好感 } }` | 解鎖的條件：`flags` 全部成立、`flags_none` 全部不成立、`flags_any` 至少一個成立、`counters` 劇情計數器在範圍內、`affinity` 每位角色的好感（-100～100，沒見過面算 0）都夠。不寫＝任務一開始就解鎖 |
| `kind` | 字串 | `story` 劇情、`check` 判定、`combat` 戰鬥、`choice` 選擇 | 其他值變 `story` |
| `check` | 物件 | `{ "attr": "<屬性>", "dc": 12 }`；`attr` 是 `str`、`dex`、`int`、`fai`、`cha`，`dc` 1～40；可以加 `"affinity": { "npc": "<固定 NPC id>", "per": 10, "max": 5, "min": 20 }` | 只有 `check` 用。沒寫時是智力 DC 12；`attr` 寫錯變 `int`。`affinity`：好感每 `per` 點 ±1（1～100，預設 10），最多 ±`max`（0～20，預設 5）；`min`（選填）好感不到就直接失敗、不擲骰。角色不存在是錯誤 |
| `enemies` | 陣列 | `[["<怪物 id>", 數量], ...]`，數量 1～6 | 只有 `combat` 用。怪物 id 查 `data/rules/enemies.json` 或同一個包的 `enemies` |
| `foes` | id 陣列 | 固定 NPC 的 id | 只有 `combat` 用：敵對的固定 NPC。`enemies`、`foes` 至少要有一種 |
| `allies` | id 陣列 | 固定 NPC 的 id | 任何種類都可以：在場的友方，解鎖後站在 ⭐ 旁邊（或站在設施上），戰鬥時站在你這邊，不看他平常的出沒與 `requires`。已經死了或被制伏的不會出現 |
| `urgent` | 布林 | `true` 或不寫 | 走到任務點時一定要先處理（不能移動、休息），事件視窗另外多一個按鈕：**不寫**（不緊急，預設）多「稍候」，這次先略過、離開再來還會遇到；**`true`**（緊急）只能處理或「放棄任務」。緊急只給過了就沒有的場面（旅途上、臨時地圖裡），見 6.4 節 |
| `options` | 陣列 | 最多 6 個 | 只有 `choice` 用，每個選項見下表。至少要有一個 |
| `success` | 結果 | 見 2.5 | `story`：發生的事；`check`：成功；`combat`：勝利。`choice` 不用（寫在選項裡） |
| `fail` | 結果 | 見 2.5 | 只有 `check`、`combat` 用：失敗、落敗或撤退。不寫時失敗可以再試 |

**選項**（`options` 的每一項）：

| 欄位 | 範圍 | 說明 |
|---|---|---|
| `label` | 最多 30 字；空的變「選項」 | 按鈕上的字 |
| `requires` | 同任務點的 `requires` | 選填：選項出現的條件（例如 `{ "affinity": { "npc_selene": 10 } }`），不成立時選項不出現 |
| `check` | 同任務點的 `check` | 選填：有檢定的選項（也可以參考好感） |
| `success` | 結果 | 沒有檢定時選了就發生；有檢定時是成功 |
| `fail` | 結果 | 只有寫了 `check` 的選項才收 |

判定與有檢定的選項走主動行動：大成功、成功、部分成功都算成功。

### 2.4 地點（`at`）

| `where` | 其他欄位 | 說明 |
|---|---|---|
| `settlement` | `location`（聚落，必填） | 在這個聚落的任何地方 |
| `cell` | `location`（聚落，必填）、`cell`（必填） | 站在設施上。`cell` 是 `inn` 旅店、`guild` 公會、`tavern` 酒館、`shop` 雜貨店、`temple` 神殿、`gate` 城門、`brothel` 娼館、`smithy` 鐵匠鋪、`tailor` 裁縫店、`jeweler` 珠寶店、`magic` 魔法物品店、`informant` 情報商、`tattoo` 刺青店、`carver` 刻印師；或自建商店的 id（`shop_…`）；或這個地點的地標 id（`lm_…`）。**那個聚落要有這種設施**（[npcs](npcs.md) 第 3.2 節的表） |
| `npc` | `npc`（固定 NPC 的 id，必填）、`location`（選填） | 這位角色在身邊時。不寫 `location` 就跟著角色走 |
| `outskirts` | `location`（聚落，必填） | 這座城近郊的一格 ⭐（進入近郊時放） |
| `dungeon` | `location`（地下城，必填）、`layer` | 地下城某一層的一格 ⭐。`layer` 是 `outskirts` 周邊、`shallow` 淺層、`middle` 中層、`deep` 深層、`abyss` 底層；寫錯或沒寫變 `outskirts` |
| `road` | — | 旅途上：解鎖之後，**任何一段**旅途的路上都會觸發（不限開頭的那段路，見 6.4 節） |
| `side` | `side_map`（選填） | 臨時地圖裡的 ⭐：`cave` 神秘洞窟、`ruins` 遺跡廢墟、`waystation` 驛站；不寫＝任何一種。**只放在這個任務自己的結果（`side_map`）帶進去的那張地圖**，旅途事件或別的任務帶進去的洞窟裡不會有；任務點沒完成就離開等於放棄任務 |
| `special` | `special_map`（必填）、`x`、`y`（選填） | 特殊地圖裡的 ⭐。`special_map` 是 `sm_` 開頭的 id（內建 `sm_rhineburg_sewer` 萊茵堡下水道、`sm_rhineburg_cistern` 萊茵堡古蓄水池，或同一個包的 `specialMaps`；寫錯或沒寫時整條任務不匯入，6.2 節）。只有固定地圖能寫 `x`、`y` 指定格子 |

- `road`、`side`、`special` 寫了 `location` 會被拿掉。
- **特殊地圖的確切格子**：`x` 是第幾欄、`y` 是第幾列（從 0 開始，對照 `data/world/special_maps.json` 的 `grid`）。可以選 `.` 道路，或畫在地圖上的 `M` 遭遇、`X` 強敵、`R` 資源、`C` 寶箱、`T` 陷阱（⭐ 取代那一格）；**不能**選入口（`entry`）、通道的端點（這張地圖的 `connections[].at`，和別張地圖接過來的 `to`）、牆、水、出口、安全房、商店。超出地圖的整理時拿掉；格子不行時檢查會提醒，遊戲裡隨機放一格空地。
  - 例：下水道（`sm_rhineburg_sewer`）的入口是 (4, 0)，通道端點是 (4, 0) 與 (8, 6)；古蓄水池（`sm_rhineburg_cistern`）的 (1, 0) 是從下水道接過來的通道端點。

### 2.5 結果（`success`、`fail`、選項的 `success`、`fail`）

| 欄位 | 型別 | 範圍 | 說明 |
|---|---|---|---|
| `text` | 字串 | 最多 400 字 | 發生的事 |
| `set_flags`、`clear_flags` | 字串陣列 | 旗標名稱（2.6） | 設定、清除旗標 |
| `counters` | 物件 | `{ "<計數器 id>": 增減 }` | 劇情計數器的加減（-100～100；計數器要先在世界內容的 `counters` 裡有） |
| `effects` | 效果陣列 | 見下表 | |
| `join` | 固定 NPC 的 id | | 以「任務同行」加入：不佔隊伍名額，最多 2 人（第 3 人加不進來，日誌寫原因）。已經死了、被制伏的人不會加入。小隊的人只有他自己加入 |
| `leave` | 固定 NPC 的 id | | 任務同行離開（任務結束時也會自動離開） |
| `complete` | 布林 | | 完成任務，發完成報酬。**整條任務至少要有一個結果寫它** |
| `fail_quest` | 布林 | | 任務失敗。和 `complete` 一起寫時只留 `complete` |
| `retry` | 布林 | | 這個任務點不結束，之後可以再來 |
| `side_map` | 字串 | `cave`、`ruins`、`waystation` | 進入臨時地圖，出口回到原本的地方 |
| `special_map` | 特殊地圖 id | 存在的 `sm_` id | 傳送到那張地圖的入口 |
| `travel_to` | 地點 id | 任何地點 | 改去別的地點（旅途中直接抵達，不在旅途時被帶過去；在臨時地圖或特殊地圖裡時先離開） |
| `deaths` | id 陣列 | 固定 NPC 的 id | 故事裡的死亡：這些角色在這裡死去，之後不再出現；需要他的其他任務失敗。要和他戰鬥時用代替他的怪物（`enemies`），不要用 `foes` |

**效果**（`effects` 與 `rewards` 共用）：特殊任務只收下表這幾種，[EFFECTS](../../docs/EFFECTS.md) 的其他種類（`flag`、`meet`、`intel`、`leave`、`join_party`……）整項拿掉，世界檢查會提醒並寫出替代的寫法：旗標用 `set_flags`／`clear_flags`；認識 NPC 用 `affinity` 或 `npc` 任務點；情報用情報商（`start.kind: informant`）或旅途開頭；同行用 `join`／`leave`，結束後要正式入隊用 `companion`。

| `type` | 欄位與範圍 | 說明 |
|---|---|---|
| `money` | `amount`：整數，±100000000，0 不收 | 金錢（白鸛幣），負數為花費 |
| `item` | `name`：物品名稱（最多 30 字）、`qty`：−99～99，0 不收，不寫＝1 | 得到時物品要存在（`data/rules/items.json` 的 `name`，或同一個包的 `items`） |
| `gear` | `spec`：裝備規格（同 [npcs](npcs.md) 2.2 節）、`name`（最多 20 字）、`desc`（最多 80 字） | 規格不合整項拿掉 |
| `xp` | `amount`：0～1000000 | 全隊的經驗值（不能指定成員，`target` 會被拿掉） |
| `reputation` | `faction`：勢力 id（不檢查，查 `geography.json` 的 `factions`），或 `local`（所在地的勢力，沒有時算冒險者公會）；`delta`：−20～20 | 聲望 |
| `affinity` | `npc`：固定 NPC 的 id、`delta`：−50～50、`reason`（最多 40 字） | 親密度 |
| `memory` | `summary`（最多 200 字）、`importance`：1～3，不寫＝2 | 共同記憶 |
| `ability` | `ability`：能力 id；或 `choices`：1～5 | 學會這項能力：是主角職業的能力（法術要環階夠）時直接學會，不受等級的品質與解鎖限制；已經會了只提示；不是這個職業的或環階不夠時，改成一次三選一並說明原因。不寫或不存在時變成一次「N 選一」（不寫 `choices`＝3）。對象一律是主角 |
| `companion` | `npc`：固定 NPC 的 id、`mode`：`voluntary` 或 `hired` | 正式入隊。**只能指定固定 NPC**（不能寫一份規格），其他 `mode`（`slave`）變 `voluntary`。對方死了或被制伏時不會入隊。隊伍放不下時不會丟掉：事件視窗出現「想加入隊伍」，玩家騰出位子（送回房子、寄放酒館、請離）或放棄，決定前不能移動、休息。指定**小隊**（[npcs](npcs.md) 的 `squad`）的人時整隊一起入隊，不會只進來一部分 |
| `condition` | `condition`：`punished`、`blessed`、`shaken`、`fed_light`、`well_rested`、`fed_well`、`fed_fine`、`fed_feast`、`fed_legend`、`cheered`、`tipsy`、`honed`、`relaxed`；`add`：`false` 時拿掉 | 主角的非戰鬥狀態 |
| `hp` | `ratio`：−0.9～1 | 主角生命值的比例（`amount` 不收） |
| `start_story` | `story`：特殊任務 id | 開始另一個特殊任務（要存在，不能是自己） |
| `perk` | `perk`、`options`：特質 id（最多 6 個）、`direct`：`true` 直接學會 | 給一次學特質的機會；種族特質與不存在的拿掉 |
| `lose_perk` | `perk`：特質 id | 失去特質 |
| `tattoo` | `template`：刺青圖樣 id（可加 `place`、`by`）；或 `kind`（`plain`／`oath`）、`name`（最多 20 字）、`text`（最多 160 字）、`attrs`（誓約的加減） | 誓約的加減不合規則整項拿掉（[TATTOOS](../../docs/TATTOOS.md) 第 5 節） |
| `remove_tattoo` | `place`：部位；或 `kind`：`plain`／`oath` | 洗掉刺青 |
| `enslave_player` | `master`：固定 NPC 的 id；或 `random`：`{ "tag": "<身分標籤>" }`；`contract`：`labor`、`combat`、`arcane`、`brothel`（不寫＝`labor`） | 主角淪為奴隸（[STORY_QUESTS](../../docs/STORY_QUESTS.md) 第 2 節） |

### 2.6 旗標

- **名稱**：英文小寫與底線，前面加這條任務的簡稱，避免和別的任務撞名（`sewer_app_started`、`sewer_app_lead`）。最多 40 字；空白會換成 `_`，`story:` 前綴會被去掉。
- **開頭旗標**（`start_flags`）不能和任何任務一樣，內建的查 `data/rules/stories.json` 的 `start_flags`（例如 `relic_started`、`wagon_found`、`ledger_rumor`）；內建任務的旗標用了 `dthr_`、`whcr_`、`lil_`、`rwar_`、`mabb_`、`isa_`、`doct_`、`snk_`、`aya_`、`rv_`、`epic_`、`ser_`、`port_`、`spr_`、`ame_`、`cw_`、`cave_`、`wl_`、`annex_`、`spy_`、`def_`、`lena_`、`val_`、`eve_`、`vsec_`、`lis_`、`valk_`、`ign_`、`noc_`、`mor_`、`law_`、`trl_`、`god_`、`lila_`、`rot_`、`hm_`、`era_`、`kag_`、`ore_`、`brew_`、`smith_`、`wt_`、`wat_`、`smg_`、`sin_`、`acc_`、`shd_`、`fog_`、`vault_`、`reef_`、`nip_`、`scs_`、`rite_`、`bab_`、`pit_`、`echo_`、`gnt_`、`emb_`、`brc_`、`ghs_`、`msr_`、`thc_`、`vh_`、`tfc_`、`skl_`、`ecc_`、`qst_`、`luc_`、`cas_`、`twin_`、`noel_`、`zero_`、`kar_`、`oboro_`、`belv_`、`eil_`、`pru_`、`ila_`、`mimi_`、`stella_`、`noir_`、`pom_`、`marg_`、`liese_`、`clara_`、`isab_`、`brun_`、`kara_`、`ren_`、`mat_`、`ith_`、`ana_`、`ele_`、`lisr_`、`sak_`、`group_`、`pol_` 這些簡稱，自建的不要用同樣的前綴。
- 旗標是**全域**的：其他任務的 `requires`、固定 NPC 的 `requires` 與 `stages` 都讀同一個旗標，所以可以用來串接任務、讓角色搬家或消失（見 [npcs](npcs.md) 2.3 節）。
- `ai:` 開頭的名稱讀 AI 判定寫下的旗標（`ai:答應幫忙`），不算「沒有地方設定」。
- 任務點只在任務進行中才會出現；沒有 `requires` 的任務點任務一開始就解鎖。習慣上第一個任務點需要開頭旗標，之後每個任務點需要前一個設定的旗標。

## 3. 可以引用什麼

被引用的要先存在：內建的，或同一個檔案裡的自建項目（任務最後整理、最後檢查，所以同一個包裡的固定 NPC、怪物、物品、特殊地圖、地標、商店、特質、技能、其他任務都認得）。引用不存在的東西多半是**錯誤**（整條不收）。

| 引用 | 欄位 | 去哪裡查 |
|---|---|---|
| 地點 | `start.location`、`at.location`、`travel_to` | `data/world/geography.json` 的 `locations`（`type` 是 `dungeon` 的是地下城） |
| 設施 | `at.cell` | [npcs](npcs.md) 第 3.2 節的表；`data/world/maps.json` |
| 地標 | `at.cell` | `data/world/landmarks.json`（要和 `at.location` 同一個地點） |
| 固定 NPC | `start.npc`、`at.npc`、`allies`、`foes`、`join`、`leave`、效果的 `npc`、`master` | `data/world/npcs.json`，或同一個包的 `npcs`（[npcs](npcs.md)） |
| 怪物 | `enemies` | `data/rules/enemies.json`，或同一個包的 `enemies` |
| 物品 | 效果 `item` 的 `name` | `data/rules/items.json`，或同一個包的 `items`（key 是物品名稱） |
| 底材、材料 | 效果 `gear` 的 `spec` | `data/rules/gear.json` |
| 特殊地圖 | `at.special_map`、`special_map` | `data/world/special_maps.json`，或同一個包的 `specialMaps` |
| 特質 | 效果 `perk`、`lose_perk` | `data/rules/perks.json` |
| 能力 | 效果 `ability` | `data/rules/abilities.json` |
| 刺青圖樣、部位 | 效果 `tattoo`、`remove_tattoo` | `data/rules/tattoos.json` |
| 特殊任務 | 效果 `start_story` | `data/rules/stories.json`，或同一個包的 `stories` |
| 勢力 | 效果 `reputation` | `geography.json` 的 `factions` |
| 地區 | `start.regions` | `geography.json` 的 `regions` |

## 4. 最小範例

河谷鎮公會的一個跑腿委託，一個任務點就完成：

```json
{
  "type": "elondia-content",
  "stories": {
    "mod_story_notice_board": {
      "custom": true,
      "title": "酒館的跑腿",
      "summary": "河谷鎮公會貼出的小委託：替酒館老闆送一封信。",
      "rank": "F",
      "start": { "kind": "guild", "location": "rivervale", "text": "公會的告示板上貼著一張字跡潦草的委託：替酒館老闆跑一趟腿。" },
      "start_flags": ["notice_started"],
      "nodes": [
        {
          "id": "deliver",
          "title": "到河谷鎮的酒館找老闆",
          "text": "酒館老闆接過信，鬆了一口氣，從櫃檯下摸出幾枚銅幣。",
          "at": { "where": "cell", "location": "rivervale", "cell": "tavern" },
          "requires": { "flags": ["notice_started"] },
          "kind": "story",
          "success": { "text": "老闆謝過你，說以後有事還會找你。", "complete": true }
        }
      ],
      "rewards": [{ "type": "money", "amount": 40 }]
    }
  }
}
```

## 5. 完整範例

委託人是 [npcs](npcs.md) 完整範例的捕鼠人葛蕾塔（`mod_npc_rhine_ratcatcher`），要和那份 `npcs` 放在同一個檔案裡。四個任務點依序示範劇情（同行）、判定（特殊地圖的確切格子、失敗可再試）、戰鬥（失敗就任務失敗）、選擇（有檢定的選項）。最後的 🚩`sewer_app_done` 讓葛蕾塔改成固定待在下城區（她的 `stages`）。

```json
{
  "type": "elondia-content",
  "stories": {
    "mod_story_sewer_apprentice": {
      "custom": true,
      "title": "下水道裡的學徒",
      "summary": "捕鼠人葛蕾塔的學徒在萊茵堡的下水道失蹤了，她請你一起下去找人。",
      "rank": "E",
      "merit": 6,
      "time_limit": 7,
      "start": {
        "kind": "npc",
        "npc": "mod_npc_rhine_ratcatcher",
        "min_affinity": 0,
        "text": "葛蕾塔把捕鼠夾往桌上一摔：我的學徒三天沒回來了，衛兵說一個捕鼠的不值得派人。你敢不敢跟我下去？"
      },
      "start_flags": ["sewer_app_started"],
      "nodes": [
        {
          "id": "ask",
          "title": "到萊茵堡的酒館打聽學徒的下落",
          "text": "酒保說，學徒失蹤前一晚還來買過燈油，說要去蓄水池那邊看「會發光的東西」。",
          "at": { "where": "cell", "location": "rhineburg", "cell": "tavern" },
          "requires": { "flags": ["sewer_app_started"] },
          "kind": "story",
          "success": { "text": "葛蕾塔提起防風燈：走吧，我帶路。", "set_flags": ["sewer_app_lead"], "join": "mod_npc_rhine_ratcatcher" }
        },
        {
          "id": "search",
          "title": "在萊茵堡下水道找學徒留下的記號",
          "text": "排水溝邊的磚牆上有一道新的粉筆記號，指向更深的水道。",
          "at": { "where": "special", "special_map": "sm_rhineburg_sewer", "x": 6, "y": 3 },
          "requires": { "flags": ["sewer_app_lead"] },
          "kind": "check",
          "check": { "attr": "int", "dc": 12 },
          "success": { "text": "記號一路通往古蓄水池的入口。", "set_flags": ["sewer_app_trail"] },
          "fail": { "text": "你在污水裡摸索了半天，只扭傷了腳。", "effects": [{ "type": "hp", "ratio": -0.1 }], "retry": true }
        },
        {
          "id": "nest",
          "title": "在古蓄水池救出學徒",
          "text": "蓄水池的角落堆著啃過的骨頭，學徒縮在高台上，底下是一群紅了眼的巨鼠。",
          "at": { "where": "special", "special_map": "sm_rhineburg_cistern" },
          "requires": { "flags": ["sewer_app_trail"] },
          "kind": "combat",
          "enemies": [["giant_rat", 3], ["ghoul", 1]],
          "success": { "text": "最後一隻巨鼠倒下，學徒哭著撲進葛蕾塔懷裡。", "set_flags": ["sewer_app_found"] },
          "fail": { "text": "你們被鼠群逼退，等再回來時高台上已經空了。", "leave": "mod_npc_rhine_ratcatcher", "fail_quest": true }
        },
        {
          "id": "home",
          "title": "把學徒送回萊茵堡的旅店",
          "text": "學徒裹著毯子喝熱湯，葛蕾塔第一次對你露出笑容。她問你，要不要收下行會給的謝禮。",
          "at": { "where": "cell", "location": "rhineburg", "cell": "inn" },
          "requires": { "flags": ["sewer_app_found"] },
          "kind": "choice",
          "options": [
            {
              "label": "收下謝禮",
              "success": {
                "text": "葛蕾塔把一袋錢塞給你：「別客氣，這是你應得的。」",
                "effects": [{ "type": "money", "amount": 80 }, { "type": "affinity", "npc": "mod_npc_rhine_ratcatcher", "delta": 10, "reason": "救回了學徒" }],
                "set_flags": ["sewer_app_done"],
                "leave": "mod_npc_rhine_ratcatcher",
                "complete": true
              }
            },
            {
              "label": "請她把錢留給學徒養傷",
              "check": { "attr": "cha", "dc": 13 },
              "success": {
                "text": "葛蕾塔愣了一下，用力拍你的背：「以後下水道的事，找我。」",
                "effects": [
                  { "type": "affinity", "npc": "mod_npc_rhine_ratcatcher", "delta": 20, "reason": "把謝禮留給學徒" },
                  { "type": "memory", "summary": "在萊茵堡下水道和葛蕾塔一起救回她的學徒，把謝禮留給了學徒。", "importance": 2 },
                  { "type": "reputation", "faction": "rhine_empire", "delta": 1 }
                ],
                "set_flags": ["sewer_app_done"],
                "leave": "mod_npc_rhine_ratcatcher",
                "complete": true
              },
              "fail": {
                "text": "葛蕾塔以為你嫌錢少，臉一沉，把錢袋丟在桌上就走了。",
                "effects": [{ "type": "money", "amount": 80 }, { "type": "affinity", "npc": "mod_npc_rhine_ratcatcher", "delta": -5, "reason": "誤會了你的好意" }],
                "set_flags": ["sewer_app_done"],
                "leave": "mod_npc_rhine_ratcatcher",
                "complete": true
              }
            }
          ]
        }
      ],
      "rewards": [{ "type": "xp", "amount": 150 }, { "type": "item", "name": "治療藥劑", "qty": 1 }]
    }
  }
}
```

旗標的流向：

| 旗標 | 誰設定 | 誰需要 |
|---|---|---|
| `sewer_app_started` | 任務開始 | `ask` |
| `sewer_app_lead` | `ask` | `search` |
| `sewer_app_trail` | `search` 成功 | `nest` |
| `sewer_app_found` | `nest` 勝利 | `home` |
| `sewer_app_done` | `home` 的三個結果 | 葛蕾塔的 `stages`（任務之外） |

- `search` 的 (6, 3) 是下水道第 3 列 `#..R.#..M.#` 的 `.`；`nest` 沒寫格子，⭐ 隨機放在古蓄水池的一格空地。
- `search` 失敗有 `retry`：扣血之後任務點還在，可以再試。`nest` 落敗就 `fail_quest`，同行的葛蕾塔離隊。
- 每一條路都會走到 `complete`，所以沒有錯誤；所有需要的旗標都有人設定，所以沒有提醒。

## 6. 常見錯誤

### 6.1 整理時默默改掉的（世界檢查的「整理時改了」）

| 寫法 | 整理後 |
|---|---|
| `title` 超過 30 字、任務點的 `title` 超過 40 字、`text` 超過 600 字、結果的 `text` 超過 400 字 | 截斷 |
| `rank` 不是 F～S | 拿掉（不限） |
| `merit` 超過 100、`time_limit` 超過 365 | 夾到上限 |
| `start.kind` 不存在 | 變 `guild` |
| 開頭寫了不屬於這種開頭的欄位（`npc` 開頭寫 `location`、`guild` 開頭寫 `chance`……） | 拿掉 |
| 旗標名稱有空白、`story:` 前綴 | 空白換成 `_`、去掉前綴 |
| 任務點的 `id` 有 `-` 或中文、和別的任務點重複 | 換成 `_`；重複的補 `_` |
| `kind` 不存在 | 變 `story` |
| `story` 任務點寫了 `fail`；`choice` 任務點本身寫了 `success`／`fail` | 拿掉（選擇的結果寫在選項裡） |
| 沒有 `check` 的選項寫了 `fail` | 拿掉 |
| `check.attr` 寫 `wis`、`con` 這類不存在的屬性；`dc` 超過 40 | `attr` 變 `int`；`dc` 夾到 40 |
| `check` 任務點沒寫 `check` | 補成智力 DC 12（檢查**不會**提醒） |
| 不是 `combat` 的任務點寫了 `enemies`、`foes` | 拿掉 |
| `enemies` 的數量超過 6 | 夾到 6 |
| `at.where` 不存在 | 變 `settlement` |
| `at.cell` 不是設施、`shop_` 或這個地點的地標 | 變 `tavern` |
| `at.layer` 寫錯 | 變 `outskirts` |
| `at.x`、`at.y` 超出地圖、不是整數，或地圖是隨機地圖 | 拿掉 |
| `road`、`side`、`special` 寫了 `at.location` | 拿掉 |
| 結果同時寫 `complete` 與 `fail_quest` | 只留 `complete` |
| 結果的 `side_map`、`special_map`、`travel_to` 不存在 | 拿掉 |
| 效果的 `type` 不在 2.5 節的表裡（`flag`、`meet`、`intel`……） | 整項拿掉（`flag`、`meet`、`intel`、`join_party` 會另外提醒替代的寫法） |
| 效果 `xp` 寫 `target`；`hp` 寫 `amount`；`companion` 的 `npc` 是一份規格、`mode` 是 `slave` | `target` 拿掉；`hp` 整項拿掉；`companion` 整項拿掉、`slave` 變 `voluntary` |
| 效果 `ability` 的能力不存在；寫了 `chance` | 變成三選一；`chance` 拿掉 |
| 效果的數值超出範圍（`affinity` ±50、`reputation` ±20、`hp` −0.9～1……） | 夾住；數值是 0 的整項拿掉 |

### 6.2 錯誤：整條任務不匯入

`storyCheck` 的錯誤。世界檢查列在「❌ 錯誤 → 特殊任務」，一條任務的所有錯誤寫在同一行。

- 沒有任何結果寫 `complete`。
- `npc` 開頭的 `start.npc` 沒寫或不存在。
- `guild` 開頭沒寫 `location`；那座城沒有冒險者公會。
- `informant` 開頭的城沒有情報商（沒有情報商的：`windhammer`、`snowridge`、`sunscorch`、`rotmarsh`、`bone_hills`、`mosswhisper`、`windspeak`、`stilltide_oasis`）。
- 開頭旗標和別的任務一樣（包括內建任務的開頭旗標，例如 `relic_started`、`dthr_ambush`）。
- 效果裡的物品（得到的）、裝備的底材或材料、角色（`affinity`、`companion`）、要開始的任務、主人、特質不存在；`start_story` 開始的是自己。
- 任務點沒有地點：`settlement`、`cell`、`outskirts`、`dungeon` 沒寫 `location`。
- `special` 的特殊地圖沒寫或不存在（「特殊地圖不存在」）。
- `npc` 任務點的角色不存在。
- 地點類型不對：`outskirts` 選了地下城、`dungeon` 選了聚落、`settlement`／`cell` 選了地下城。
- `cell` 的設施不存在，或那個地點沒有這種設施（例如風錘村沒有神殿）。
- `combat` 沒有 `enemies` 也沒有 `foes`；怪物、敵對角色不存在。
- `allies` 的角色不存在；同一個角色同時在 `allies` 與 `foes`。
- `choice` 沒有選項。
- `join`、`leave` 的角色不存在。

### 6.3 提醒：會匯入，但要確認

- 旗標 🚩X 在任務裡沒有地方設定：別的任務也沒有設定它、也不是 `ai:` 開頭時，需要它的任務點永遠不會出現。真的由別的任務設定時，那條任務要在同一個世界裡。
- `manual` 開頭，但沒有任何任務用 `start_story` 開啟它。
- 特殊地圖指定的格子不行（入口、通道端點、牆、水、出口、安全房、商店），遊戲裡會隨機放。

整理與檢查都不管、要自己對的：`reputation` 的 `faction` 是不是勢力 id；戰鬥任務點的 `allies` 與 `foes` 用冒險者（普通人不是戰鬥用的角色，見 [NPC_SYSTEM](../../docs/NPC_SYSTEM.md) 第 3 節）；`side` 任務點要有**同一個任務**的結果先用 `side_map` 帶玩家進去。其他執行時才會出事的寫法見 6.4 節。

### 6.4 執行時的坑（世界檢查抓不到）

這些寫法會通過檢查、正常匯入，但玩起來會卡住、失敗或很煩。逐條對照自己的任務。

**走到任務點會擋人**

| 坑 | 會怎樣 | 怎麼寫 |
|---|---|---|
| 不寫 `urgent`（不緊急）＝可以稍候；寫 `urgent: true`＝只能處理或放棄 | 把普通的任務點設成緊急，玩家走到那裡只能做或整條放棄 | 只有旅途上（`road`）、臨時地圖裡（`side`）這種過了就沒有的場面才設緊急 |
| `settlement` 任務點 | 一進那座城（任何區塊）就跳出來、擋住移動，按「稍候」之後要**離開這座城**再回來才會再出現 | 結局的選擇這種「在哪裡都行」的才用 `settlement`；要玩家找人或到某處的用 `npc`、`cell` |
| `npc` 任務點 | 那個人走到你旁邊就擋住你 | 正常；但不要把同一個人同時當兩條任務的任務點，玩家會一直被擋 |
| 判定沒寫 `fail`（失敗可以再試） | 每試一次花 1 小時、寫一篇日誌；試失敗後要離開再回來才會再擋 | 想讓任務繼續就寫 `fail`（設同一個旗標、結果差一點）；真的要重試才省略 |
| 檢定的好感門檻（`check.affinity.min`）沒寫 `fail` | 好感不夠時每按一次就「直接失敗、沒有擲骰」一次 | 寫一個 `fail`，或把門檻改成任務點的 `requires.affinity`（不夠就先不出現） |

**旅途與臨時地圖**

| 坑 | 會怎樣 | 怎麼寫 |
|---|---|---|
| `road` 任務點不只在開頭那段路 | 解鎖之後，**之後任何一趟旅途**都會在路上觸發；結果沒有推進旗標（`retry`、判定沒寫 `fail`）時，每趟旅途都再來一次 | `road` 任務點的每個結果都要設定新旗標或結束任務；第一個 `road` 任務點以外，盡量改用地點固定的任務點 |
| `side` 任務點要在同一次進去時做完 | 從臨時地圖離開（出口）就等於放棄任務；地圖不會留著 | 臨時地圖裡的任務點一路接到底（例如 劇情 → 戰鬥 → 完成），不要在裡面放需要外面的旗標才解鎖的任務點，也不要讓玩家需要出去準備 |
| 用別的任務或旅途事件的洞窟 | 不會有這個任務的 ⭐ | `side_map` 寫在**這個任務**的結果裡 |

**角色死了、被制伏、敵對**

| 坑 | 會怎樣 | 怎麼寫 |
|---|---|---|
| 任務需要的角色死了 | 任務直接失敗。「需要的」＝開頭的 `start.npc`、任務同行的人，以及還沒結束的任務點的 `at.npc`、`join`、`companion` | 玩家可以偷襲、處決任何冒險者（不受雇用的統治者也是；只有普通人與店主、職員不能攻擊）；重要的委託人做成普通人，或接受「殺了他任務就沒了」 |
| `foes` 的角色在任務戰鬥裡被打倒 | **死亡**（任務戰鬥不會制伏，不能放過）；他的其他任務接不到、需要他的任務失敗，`stages` 也沒意義了 | 會被打倒的對手用專門的角色；不要讓同一個人既是這條任務的 `foes`，又是別條任務的委託人或之後要入隊的人 |
| 戰鬥任務點的 `foes` 全都已經死了或被制伏、又沒有 `enemies` | 不打，直接算勝利 | 正常；需要「一定要打一場」時加 `enemies` |
| 開頭的角色敵對（被攻擊過） | 不再發這個任務 | 無法避免；重要任務線的開頭可以改用公會或情報商 |
| 被制伏、等處置的角色 | 不能發任務、不能當任務點、不能入隊；參考他好感的檢定與選項先不出現 | 不用處理：處置完（放過）就恢復 |

**固定 NPC 的出沒**

| 坑 | 會怎樣 | 怎麼寫 |
|---|---|---|
| `at.npc`、`start.npc` 的角色有 `requires`（或 `stages` 搬走了） | 條件不符時他不在任何地方，任務點永遠不會出現（`allies` 不受影響，`at.npc` 會） | 任務進行中需要他時，確認他的 `requires` 一定成立；搬家用 `stages` 時，任務點的 `at.location` 不寫（跟著角色走） |
| 角色是小隊的隊員（`squad`） | 大部分日子跟著隊長走，不在自己的活躍地點；寫了 `at.location` 時可能很少遇到 | 對小隊的隊員不要寫 `at.location`；或改成找隊長 |
| `companion` 指定小隊的人 | 整隊一起入隊（放不下時整隊等玩家騰位子或放棄） | 想只帶一個人時用 `join`（任務同行），或不要讓他屬於小隊 |
| 任務同行（`join`）已經 2 人 | 第 3 人加不進來，任務照常往下走 | 同一時間最多 2 個 `join`，用 `leave` 先送走一個 |
| 最後才 `companion`，但玩家隊伍滿了 | 事件視窗跳出「想加入隊伍」，玩家要騰出位子或放棄才能繼續移動 | 正常；結局的 `text` 可以先鋪陳「他想跟著你」，玩家比較不會錯愕 |

**其他**

- `time_limit` 從接任務開始算，包括旅途；天數要夠來回（[GUILD](../../docs/GUILD.md) 第 0 節）。
- 改了已經有人在玩的任務（刪掉或改名完成過的任務點、改旗標），存檔的進度會對不上：在內容頁籤儲存時，目前存檔正在進行這個任務就會擋下來並說明原因；重新匯入的世界包不會檢查，任務點的 `id` 發布之後就不要改。

## 7. 相關的系統文件

- [STORY_QUESTS](../../docs/STORY_QUESTS.md)：特殊任務的規則、劇情旗標、任務同行、淪為奴隸、編輯器
- [EFFECTS](../../docs/EFFECTS.md)：所有效果的種類（特殊任務只收 2.5 節那幾種）
- [SPECIAL_MAPS](../../docs/SPECIAL_MAPS.md)：第 3 節傳送與離開、第 6 節任務點與確切的格子
- [TRAVEL_EVENTS](../../docs/TRAVEL_EVENTS.md)：旅途開頭、臨時地圖、情報商開頭
- [CONTENT_DEPENDENCIES](../../docs/CONTENT_DEPENDENCIES.md) 第 4 節：錯誤與提醒的完整說明
- [GUILD](../../docs/GUILD.md)：公會階級、功績
- [TATTOOS](../../docs/TATTOOS.md)、[PERKS](../../docs/PERKS.md)：刺青與特質的效果
- 固定 NPC 的寫法：[npcs](npcs.md)
