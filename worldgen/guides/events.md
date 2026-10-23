# 旅途與城鎮事件

> 這份指南講旅途事件、城鎮事件（`travelEvents`）與事件的機率設定（`eventRules`）怎麼寫。檔案的外層、id 規則、套用順序見 [content-file](content-file.md)。
> 系統文件：[TRAVEL_EVENTS](../../docs/TRAVEL_EVENTS.md)（旅途、臨時地圖、城鎮事件）、[EFFECTS](../../docs/EFFECTS.md)（效果）、[STORY_QUESTS](../../docs/STORY_QUESTS.md)（結果的格式、劇情旗標）。
> 程式：`src/engine/travelEventMods.ts`（`sanitizeTravelEvent`、`sanitizeEventRules`）、`src/engine/storyMods.ts`（`sanitizeOutcome`、`sanitizeEffects`）、`src/engine/road.ts`（旅途）、`src/engine/townEvents.ts`（城鎮）。

## 1. 用途與放在哪裡

- **旅途事件**（`scope: "road"`，預設）：出發時依路段的機率擲好，放在旅途單行道的某一天（❔ 普通、✨ 高階）。高階事件可以把隊伍帶進臨時地圖（洞窟、遺跡、驛站）。
- **城鎮事件**（`scope: "town"`）：在聚落裡走上設施（旅店、酒館、神殿……）時，冷卻過了就有機率遇到。
- 兩種都有兩個 `kind`：
  - `check`：檢定，擲骰直接揭曉，成功與失敗各有結果（旅途事件的骰子出發時就擲好）。
  - `choice`：選擇，玩家選一個選項，選項可以有自己的檢定。
  - 高階（`tier: "advanced"`，只有旅途）的 `check`：先擲好的檢定，**成功之後接著出現選項**（例如要不要進洞窟）。
- 區塊：`travelEvents`。key：`mod_event_<英文小寫>`（最多 60 字）。項目裡的 `id` 可以不寫；寫的話要和 key 一樣。
- 事件的機率與冷卻：區塊 `eventRules`，只有一筆，key 一定是 `rules`（第 2.4 節）。
- 新的事件加 `"custom": true`；改內建的事件用原本的 id（`data/rules/travel_events.json` 的 `templates`）、不加 `custom`、寫整份。

旅途上每一天先擲路段的機率（`eventRules.chance`），中了再依權重（`weights`）決定種類：

| 種類 | 抽哪些事件 |
|---|---|
| `auto` | 一半機率抽 `tier: normal, kind: check` 的事件，一半是原本的天候求生檢定 |
| `choice` | `tier: normal, kind: choice` |
| `advanced` | `tier: advanced`（`check` 或 `choice`） |
| `combat` | 不用事件，是一場城郊遭遇（只在官道、山道、荒野、地底） |

只抽 `modes` 符合這段路、`requires` 在**出發時**成立的事件。旅途事件的檢定由隊伍裡那個屬性最高的人擲（加旅途類工具）；城鎮事件的檢定照主動行動的加值算。

## 2. 欄位一覽

### 2.1 事件

| 欄位 | 型別 | 範圍 | 說明 |
|---|---|---|---|
| `scope` | `"road"`／`"town"` | | 旅途或城鎮。不寫＝旅途 |
| `tier` | `"normal"`／`"advanced"` | 高階只有旅途 | 不寫＝普通 |
| `kind` | `"check"`／`"choice"` | | 檢定或選擇。其他值變成 `choice` |
| `title` | 字串 | **最多 20 字** | 標題 |
| `text` | 字串 | 最多 400 字 | 描述（玩家與 AI 都看得到）。不要空著 |
| `modes` | 陣列 | 只有旅途：`road` 官道、`trail` 山道、`wild` 荒野、`sea` 海路、`dive` 潛水、`underground` 地底 | 出現在哪些路段。不寫＝任何路段 |
| `cells` | 陣列 | 只有城鎮：`inn` 旅店、`guild` 公會、`tavern` 酒館、`shop` 雜貨店、`temple` 神殿、`gate` 城門、`brothel` 娼館、`smithy` 鐵匠鋪、`tailor` 裁縫店、`jeweler` 珠寶店、`magic` 魔法物品店、`informant` 情報商、`tattoo` 刺青店、`carver` 雕刻師，或自建商店的 id（`shop_…`，同一個檔案裡新增的也可以） | 走上哪些設施時會發生。不寫＝任何設施 |
| `location_types` | 陣列 | 只有城鎮：`capital` 主城、`city` 城市、`town` 城鎮、`village` 村莊、`port` 港口、`outpost` 哨站、`fortress` 要塞 | 聚落規模。不寫＝不限 |
| `locations` | 陣列 | 只有城鎮：聚落的地點 id（`data/world/geography.json`，地下城不行） | 只在這些地點。不寫＝不限 |
| `cooldown_days` | 整數 | 只有城鎮：0～60 | 同一事件隔幾天才會再出現。不寫＝`eventRules` 的 `repeat_days`（內建 10） |
| `category` | 字串 | `social` 人情、`trouble` 麻煩、`opportunity` 機會、`omen` 傳聞與異象、`commerce` 買賣 | 分類。城鎮事件依最近出現過的分類降低權重；旅途上只是標記 |
| `requires` | `{ "flags", "flags_none" }` | 旗標名稱，最多 40 字 | 這些旗標都成立、那些都不成立時才會出現（第 3 節） |
| `check` | `{ "attr", "dc" }` | `attr`：`str` `dex` `int` `fai` `cha`；`dc` 1～40 | `kind: check` 才用。沒寫時變成智力 DC 12 |
| `success` | 結果 | 第 2.3 節 | `kind: check` 成功時 |
| `fail` | 結果 | 第 2.3 節 | `kind: check` 失敗時 |
| `options` | 陣列 | 最多 5 個 | `kind: choice` 與高階的 `check` 才用（第 2.2 節）。`choice` 沒有選項時自動補一個「離開」 |
| `custom` | `true` | | 新的事件一定要寫 |

### 2.2 選項（`options` 的每一項）

| 欄位 | 型別 | 範圍 | 說明 |
|---|---|---|---|
| `label` | 字串 | 最多 30 字 | 選項的文字。有花費時寫在這裡（「塞 20 白鸛幣給衛兵」） |
| `check` | `{ "attr", "dc" }` | 同上 | 選這一項要過的檢定。不寫＝選了就成功 |
| `success` | 結果 | | 成功（或沒有檢定）時 |
| `fail` | 結果 | | 檢定失敗時。**沒有 `check` 時會被拿掉** |

### 2.3 結果（`success`、`fail`）

和特殊任務的結果相同，但**沒有** `join`、`leave`、`complete`、`fail_quest`、`retry`（寫了會被拿掉）。

| 欄位 | 型別 | 範圍 | 說明 |
|---|---|---|---|
| `text` | 字串 | 最多 400 字 | 發生的事 |
| `set_flags` | 陣列 | 旗標名稱 | 設定劇情旗標 |
| `clear_flags` | 陣列 | 旗標名稱 | 清除劇情旗標 |
| `effects` | 陣列 | 下表 | 效果 |
| `side_map` | 字串 | `cave` 神秘洞窟、`ruins` 遺跡廢墟、`waystation` 驛站 | 進入臨時地圖，從出口離開回到原本的位置（旅途的那一格，或城裡） |
| `special_map` | 字串 | 特殊地圖 id（內建 `sm_rhineburg_sewer`、`sm_rhineburg_cistern`，或自建的 `sm_…`，見 [special-maps](special-maps.md)） | 傳送到特殊地圖的入口 |
| `travel_to` | 字串 | 聚落的地點 id | 改去別的地點：旅途中直接抵達那裡（旅行報告註明改道），在城裡（或特殊地圖裡）時被帶過去 |

- 三種移動在報告提交之後才執行。**一個結果只會執行一種**，優先順序 `travel_to` → `side_map` → `special_map`；不要同時寫。
- `travel_to` 寫地下城的 id 會被拿掉：事件不能直接把隊伍送進地下城（特殊任務可以）。

**效果**（`effects` 的每一項；完整說明見 [EFFECTS](../../docs/EFFECTS.md)）：

| `type` | 寫法與範圍 |
|---|---|
| `money` | `{ "type": "money", "amount": -20 }`：整數，負的是花費 |
| `item` | `{ "type": "item", "name": "藥草", "qty": 2 }`：名稱最多 30 字，數量 -99～99（負的是失去）。**名稱不會被檢查**：要是內建或同一個檔案裡新增的物品 |
| `gear` | `{ "type": "gear", "spec": { "base": "…", "material": "…" }, "name": "…", "desc": "…" }`：底材與材料要存在、種類相符（[items-gear](items-gear.md)） |
| `xp` | `{ "type": "xp", "amount": 15 }`：0 以上 |
| `reputation` | `{ "type": "reputation", "faction": "holy_ring", "delta": 1 }`：-20～20；勢力 id 在 `data/world/geography.json` 的 `factions`，`local`＝所在地的勢力（沒有勢力的地方算冒險者公會） |
| `affinity` | `{ "type": "affinity", "npc": "<固定 NPC id>", "delta": 3, "reason": "…" }`：-50～50 |
| `memory` | `{ "type": "memory", "summary": "…", "importance": 2 }`：最多 200 字，重要度 1～3 |
| `ability` | `{ "type": "ability", "ability": "<技能 id>" }`；不存在的 id 會變成 `{ "choices": 3 }`（三選一） |
| `companion` | `{ "type": "companion", "npc": "<固定 NPC id>", "mode": "voluntary" }`：正式入隊；`mode` 是 `voluntary` 或 `hired` |
| `condition` | `{ "type": "condition", "target": "pc", "condition": "blessed", "add": true }`：非戰鬥狀態（`punished` `blessed` `shaken` `fed_light` `well_rested` `fed_well` `fed_fine` `fed_feast` `fed_legend` `cheered` `tipsy` `honed` `relaxed`）；`add: false` 是拿掉 |
| `hp` | `{ "type": "hp", "target": "pc", "ratio": -0.1 }`：比例 -0.9～1（只對主角，不會因此倒下） |
| `start_story` | `{ "type": "start_story", "story": "<特殊任務 id>" }` |
| `perk` | `{ "type": "perk", "perk": "<特質 id>", "options": ["<特質 id>"], "direct": true }`：學特質的機會；缺陷直接染上（[statuses-perks-tattoos](statuses-perks-tattoos.md) 第二部分） |
| `lose_perk` | `{ "type": "lose_perk", "perk": "<特質 id>" }` |
| `tattoo` | `{ "type": "tattoo", "template": "<圖樣 id>", "place": "left_calf", "by": "…" }`，或自己描述（同上第三部分） |
| `remove_tattoo` | `{ "type": "remove_tattoo", "place": "chest" }` 或 `{ "type": "remove_tattoo", "kind": "plain" }` |

其他種類（`flag`、`meet`、`intel`、`join_party`、`enslave_player`、`leave`……）會被拿掉，世界檢查會提醒並寫出替代的寫法：旗標用 `set_flags`／`clear_flags`；認識 NPC 用 `affinity`；情報用情報商或旅途事件開頭的特殊任務；`enslave_player`（主角淪為奴隸）只有特殊任務能用。

### 2.4 事件設定（`eventRules.rules`）

寫了就取代內建的設定；沒寫的欄位用內建的值（括號裡）。

| 欄位 | 型別 | 範圍 | 說明 |
|---|---|---|---|
| `chance.<路段>` | 數字 | 0～1 | 每天發生事件的機率（`road` 0.3、`trail` 0.45、`wild` 0.55、`sea` 0.3、`dive` 0.25、`underground` 0.4） |
| `weights.auto` `choice` `combat` `advanced` | 數字 | 0～20（小數一位） | 事件種類的權重（4、3、2、1.5） |
| `town.chance` | 數字 | 0～1 | 走上設施時遇到城鎮事件的機率（0.12） |
| `town.cooldown_hours` | 數字 | 0～168 | 兩次城鎮事件至少隔幾小時（12） |
| `town.repeat_days` | 整數 | 0～60 | 同一事件幾天內不重複（10） |
| `town.recent_penalty` | 數字 | 0～1 | 最近出現過的分類，每出現一次權重乘上這個數（0.35） |
| `town.recent_size` | 整數 | 0～10 | 記住最近幾次的分類（4） |

分類（`town.categories`）是固定的，不要寫。

## 3. 可以引用什麼

要先存在（內建的，或同一個檔案裡新增的）：

| 欄位 | 要存在的東西 | 查哪裡 |
|---|---|---|
| `locations`、`travel_to` | 地點 | `data/world/geography.json` |
| `cells` | 設施種類（上表）或自建商店 | [shops](shops.md) |
| `special_map` | 特殊地圖 | `data/world/special_maps.json`、[special-maps](special-maps.md) |
| `side_map` | 臨時地圖 | `data/rules/travel_events.json` 的 `side_maps` |
| `effects` 的 `item`、`gear` | 物品、底材、材料 | [items-gear](items-gear.md) |
| `ability` | 技能 | [abilities](abilities.md) |
| `perk`、`lose_perk`、`tattoo` | 特質、刺青圖樣 | [statuses-perks-tattoos](statuses-perks-tattoos.md) |
| `affinity`、`companion` | 固定 NPC | [npcs](npcs.md) |
| `start_story` | 特殊任務 | [stories](stories.md) |

**劇情旗標**（`requires`、`set_flags`、`clear_flags`）：

- 名稱自己取（英文小寫加底線，例如 `ash_crater_seen`），和特殊任務、固定 NPC 的旗標共用同一組。前後的空白去掉、中間的空白換成 `_`、開頭的 `story:` 拿掉、最多 40 字。
- `ai:` 開頭的名稱讀 AI 判定寫下的旗標（例如 `ai:答應幫忙`）。
- 要有的旗標要有人設定（某個事件、特殊任務的結果）；只用 `flags_none` 擋住「做過一次就不再出現」最常見。
- 旅途事件的 `requires` 在出發時檢查；城鎮事件在走上設施時檢查。

## 4. 最小範例

一個旅途的檢定事件、一個城鎮的選擇事件：

```json
{
  "type": "elondia-content",
  "travelEvents": {
    "mod_event_floating_crate": {
      "kind": "check",
      "modes": ["sea"],
      "title": "漂流的木箱",
      "text": "船舷邊漂著一只綁著繩子的木箱。",
      "check": { "attr": "dex", "dc": 12 },
      "success": { "text": "你用船鉤把木箱拖上甲板，裡面有幾枚銀幣。", "effects": [{ "type": "money", "amount": 30 }] },
      "fail": { "text": "木箱被浪捲走了。" },
      "custom": true
    },
    "mod_event_temple_beggar": {
      "scope": "town",
      "kind": "choice",
      "cells": ["temple"],
      "title": "神殿台階上的乞丐",
      "text": "一個老乞丐坐在神殿的台階上，向進出的人伸出碗。",
      "options": [
        { "label": "給他 5 白鸛幣", "success": { "text": "老人朝你點點頭。", "effects": [{ "type": "money", "amount": -5 }] } },
        { "label": "走開", "success": { "text": "你沒有停下腳步。" } }
      ],
      "custom": true
    }
  }
}
```

## 5. 完整範例

旅途的高階檢定事件（成功後選擇：進洞窟、有檢定的選項、離開），一個用到所有篩選與三種移動的城鎮事件，以及事件設定：

```json
{
  "type": "elondia-content",
  "travelEvents": {
    "mod_event_ash_crater": {
      "tier": "advanced",
      "kind": "check",
      "modes": ["wild", "trail"],
      "category": "omen",
      "requires": { "flags_none": ["ash_crater_sealed"] },
      "title": "冒煙的坑洞",
      "text": "荒地上有一個還在冒煙的坑洞，邊緣的土被燒成了玻璃。",
      "check": { "attr": "int", "dc": 13 },
      "success": { "text": "你注意到坑底有一道往下延伸的裂口，熱風從裡面吹出來。" },
      "fail": { "text": "煙太嗆了，你們繞了過去。" },
      "options": [
        { "label": "下去看看", "success": { "text": "你們沿著玻璃化的坡面滑進裂口。", "side_map": "cave", "set_flags": ["ash_crater_seen"] } },
        {
          "label": "取一點灰燼研究",
          "check": { "attr": "fai", "dc": 14 },
          "success": { "text": "灰燼在你掌心微微發燙，你彷彿聽見了祈禱聲。", "effects": [{ "type": "perk", "perk": "devout", "options": ["iron_will"] }] },
          "fail": { "text": "灰燼燙傷了你的手。", "effects": [{ "type": "hp", "target": "pc", "ratio": -0.1 }] }
        },
        { "label": "繼續趕路", "success": { "text": "坑洞的煙在身後越來越淡。" } }
      ],
      "custom": true
    },
    "mod_event_drunk_tattooist": {
      "scope": "town",
      "kind": "choice",
      "cells": ["tavern", "inn"],
      "location_types": ["capital"],
      "locations": ["rhineburg"],
      "category": "opportunity",
      "requires": { "flags": ["met_drunk_tattooist"], "flags_none": ["drunk_tattooist_gone"] },
      "cooldown_days": 20,
      "title": "醉醺醺的刺青師",
      "text": "角落裡一個滿手墨漬的刺青師喝得半醉，說今晚手癢，誰付得起酒錢就免費替誰刺一個。",
      "options": [
        {
          "label": "請他喝一輪（20 白鸛幣）",
          "success": {
            "text": "他醉眼惺忪地替你刺了海浪與錨，手居然一點也不抖。",
            "effects": [
              { "type": "money", "amount": -20 },
              { "type": "tattoo", "template": "anchor_wave", "place": "left_calf", "by": "萊茵堡的刺青師" }
            ]
          }
        },
        {
          "label": "問他知不知道下水道的入口",
          "check": { "attr": "cha", "dc": 14 },
          "success": { "text": "他壓低聲音，把你帶到後巷的一個鐵蓋前。", "special_map": "sm_rhineburg_sewer", "set_flags": ["sewer_hint"] },
          "fail": { "text": "他搖搖頭，又灌了一口酒。" }
        },
        {
          "label": "勸他早點回家",
          "success": { "text": "他嘟囔著說想回河谷鎮的老家，你陪他上了馬車。", "travel_to": "rivervale", "set_flags": ["drunk_tattooist_gone"] }
        }
      ],
      "custom": true
    }
  },
  "eventRules": {
    "rules": {
      "chance": { "road": 0.3, "trail": 0.45, "wild": 0.55, "sea": 0.35, "dive": 0.25, "underground": 0.4 },
      "weights": { "auto": 4, "choice": 3, "combat": 2, "advanced": 2 },
      "town": { "chance": 0.15, "cooldown_hours": 12, "repeat_days": 10, "recent_penalty": 0.35, "recent_size": 4 }
    }
  }
}
```

`location_types` 和 `locations` 同時寫時兩個都要符合（這裡 `capital` 是多寫的，只是示範）。`met_drunk_tattooist` 要由別的事件或特殊任務設定，否則這個事件永遠不會出現（世界檢查不會發現）。

## 6. 常見錯誤

整理時不會提示、直接改掉的寫法：

| 寫法 | 結果 |
|---|---|
| `title` 超過 20 字、`label` 超過 30 字、`text` 超過 400 字 | 截掉 |
| 城鎮事件寫 `tier: "advanced"` | 變成 `normal`（城鎮沒有高階） |
| 城鎮事件寫 `modes`；旅途事件寫 `cells`、`location_types`、`locations`、`cooldown_days` | 拿掉（`scope` 寫錯是最常見的原因） |
| `cells` 寫 `road`、`home`、地標 id | 拿掉 |
| `cells` 寫不存在的商店（`shop_…` 拼錯） | 拿掉。**全部被拿掉時 `cells` 變空＝任何設施都會發生**：檢查報告裡看到 `cells` 被改就要修 |
| 結果的效果寫 `enslave_player`、`travel_to` 寫地下城 | 拿掉（世界檢查會提醒） |
| `locations` 寫地下城或不存在的地點 | 拿掉 |
| `cooldown_days` 超過 60 | 夾到 60 |
| `category` 寫不在清單的分類 | 拿掉 |
| `check.attr` 寫錯、`check.dc` 超過 40 | 變成 `int`；夾到 40 |
| 普通（`tier: normal`）的 `kind: check` 寫 `options` | 拿掉（只有高階的檢定事件有選項） |
| `kind: choice` 寫 `check`、`success`、`fail` | 拿掉（寫在選項裡） |
| 選項沒有 `check` 卻寫 `fail` | 拿掉 |
| 超過 5 個選項 | 後面的拿掉 |
| 結果寫 `join`、`leave`、`complete`、`fail_quest`、`retry` | 拿掉 |
| `side_map` 寫 `cave`、`ruins`、`waystation` 以外的；`special_map` 指到不存在的地圖；`travel_to` 指到不存在的地點 | 拿掉 |
| 效果寫 `{ "type": "flag", … }` 或其他不在表上的種類 | 拿掉（旗標用 `set_flags`） |
| `hp` 寫 `amount` 或 `"target": "party"` | `amount` 拿掉（只收 `ratio`），`target` 一律是 `pc` |
| `ability` 指到不存在的技能 | 變成三選一的學習機會 |
| `perk` 指到不存在的特質 | 那一項效果拿掉 |
| `item` 的名稱打錯 | **留著**，遊戲裡給出一件沒有定義的物品（變成無法使用的雜物，不會被發現） |
| `requires` 的旗標從來沒有人設定 | **留著**，事件永遠不會出現（不會被發現） |
| `eventRules` 的 key 不是 `rules` | 整筆不收 |
| `eventRules` 的機率寫 2、百分比寫 30 | 夾到 1（機率寫 0～1 的小數） |
| `eventRules.town.categories` | 換回內建的分類 |

## 7. 相關的系統文件

- [TRAVEL_EVENTS](../../docs/TRAVEL_EVENTS.md)：旅途單行道（第 1 節）、出發時擲好的事件（第 2 節）、臨時地圖（第 3 節）、特殊事件（第 4 節）、城鎮事件（第 6 節）。
- [EFFECTS](../../docs/EFFECTS.md)：效果的種類。
- [STORY_QUESTS](../../docs/STORY_QUESTS.md)：結果的格式、劇情旗標、`perk` 與 `tattoo` 效果。
- [CONTENT_EDITOR](../../docs/CONTENT_EDITOR.md) 3.97 節（事件頁籤）。
- 內建的事件：`data/rules/travel_events.json` 的 `templates`（39 件，可以拿來對照語氣與數值）。
