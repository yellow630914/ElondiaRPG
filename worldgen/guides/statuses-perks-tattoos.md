# 狀態、特質、刺青與奴隸印記

> 這份指南講四種內容怎麼寫：戰鬥中的狀態（`statuses`）、特質與缺陷（`perks`）、刺青圖樣（`tattoos`）、奴隸印記與印記設定（`marks`、`markRules`）。檔案的外層、id 規則、套用順序見 [content-file](content-file.md)；數值該定多少見 [balance/statuses-perks-tattoos](../balance/statuses-perks-tattoos.md)。
> 系統文件：[COMBAT_SYSTEM](../../docs/COMBAT_SYSTEM.md) 第 8 節（狀態怎麼運作）、[PERKS](../../docs/PERKS.md)、[TATTOOS](../../docs/TATTOOS.md)、[COMPANIONS](../../docs/COMPANIONS.md) 第 4 節（奴隸印記的條款）。
> 程式：`src/engine/mods.ts`（`sanitizeStatus`、`sanitizePerkMod`、`perkEditorLimits`）、`src/engine/perks.ts`（`cleanPerkEffects`、`perkPower`）、`src/engine/tattooMods.ts`（`sanitizeTattooMod`、`sanitizeMarkMod`、`sanitizeMarkRules`）。

共通的規則：

- 範例都寫成內容檔（`{ "type": "elondia-content", ... }`）；放進世界包時，把區塊搬到 `content` 底下。
- 新的項目加 `"custom": true`。改內建的項目用原本的 id、不加 `custom`、寫整份。
- 匯入時每一筆都會整理：超出範圍的數值被夾住、不認得的欄位與引用被拿掉，**不會有任何提示**。寫完一定跑世界檢查，報告裡「整理時改了」的每一條都要改掉：

```
WORLD=worldgen/worlds/<代號>/world.json WORLD_TRIALS=6 npx vitest run src/__tests__/worldCheck.spec.ts
```

---

## 第一部分：狀態（`statuses`）

### 1.1 用途與放在哪裡

- 戰鬥中的增益（buff）與減益（debuff）：命中、迴避、減傷的加減，幸運骰、優劣勢、傷害倍率、持續傷害、控制……。
- 區塊：`statuses`。key：`mod_status_<英文小寫>`，例如 `mod_status_frost_ward`。
- **項目裡不要寫 `id`**（狀態的資料沒有這一欄，寫了會被當成多出來的欄位拿掉）。
- 狀態本身**沒有持續回合**：回合數由施加它的技能（`apply[].turns`）或物品（`use.status.turns`、`use.apply.turns`）決定，1～20 回合，在擁有者的回合開始時 -1。
- 狀態不會自己出現：要有技能或物品施加它（第 1.3 節）。
- 同一個狀態不會疊加：再被施加一次時，回合數取兩者較長的，次數（`charges`）重設。

### 1.2 欄位一覽

| 欄位 | 型別 | 範圍 | 說明 |
|---|---|---|---|
| `name` | 字串 | **最多 10 字** | 戰鬥畫面上的名字。超過的截掉 |
| `kind` | `"buff"`／`"debuff"` | | 增益或減益。減益會被「淨化」移除。其他值變成 `buff` |
| `mods` | 物件 | `hit` `evade` `save` `damage` `dr` `ap_regen` `crit`：整數 -10～10；`threat`：-1～2（小數兩位） | 數值修正：命中、迴避、豁免、武器傷害、減傷（對所有傷害屬性）、行動點回復、幸運一擊閾值（正數＝更容易）、仇恨倍率（0.2＝+20%）。0 會被拿掉，小數會被四捨五入 |
| `luck` | 字串 | `1d4`、`-1d6` 這種格式（骰子數最多 2 位，**不能加常數**） | 幸運骰：在 `luck_on` 的擲骰額外擲一顆，正的加、負的減。**要和 `luck_on` 一起寫**，少一個兩個都被拿掉 |
| `luck_on` | 陣列 | `attack` `evade` `save` | 幸運骰作用在哪些擲骰 |
| `advantage` | 陣列 | `attack` `evade` `save` | 這些擲骰有優勢 |
| `disadvantage` | 陣列 | `attack` `evade` `save` | 這些擲骰有劣勢 |
| `attacked_advantage` | `true` | | 攻擊這個角色的人有優勢 |
| `attacked_disadvantage` | `true` | | 攻擊這個角色的人有劣勢 |
| `resist` | 物件 | key：傷害屬性、群組或 `all`；值 -1～2（小數兩位） | 受到的傷害倍率加減：-0.5＝×0.5、0.25＝×1.25。累加到 0 以下是免疫 |
| `offense` | 物件 | 同上 | 造成的傷害倍率加減：0.25＝×1.25 |
| `dot` | `{ "dice", "type" }` | `dice`：`1d6`、`2d4+1`（`NdM`，可以加減常數）；`type`：傷害屬性（不能是群組） | 每回合開始時受到的持續傷害 |
| `hot` | 字串 | 同 `dice` 的格式 | 每回合開始時回復的生命 |
| `pulse` | `{ "dice", "type", "mod" }` | 同上；`mod: true` 加擁有者施法屬性的調整值 | 每回合對一個隨機敵人造成傷害 |
| `on_hit` | `{ "status", "turns" }` 或 `{ "dice", "type" }` | `status`：存在的狀態、**不能是自己**；`turns` 1～20（預設 2） | 武器命中時使目標得到另一個狀態，或附加傷害。兩種都寫時只留 `status` |
| `control` | 字串 | `stun` `silence` `no_cast` `taunt` `confuse` | 暈眩（跳過回合、無法迴避）、沉默（不能施法與戲法）、無法施法、嘲諷（只能攻擊施放者）、困惑（隨機攻擊任何人）。層主最多被控制 1 回合 |
| `special` | 字串 | `undying` `halve_next` `reduce_next` | 致命傷保留 1 HP、下一次受到的傷害減半、下一次物理傷害減去一個數值（數值由施加它的技能 `apply[].value` 決定） |
| `charges` | 整數 | 1～10 | 生效幾次後消失（例如幸運骰用了一次、命中附加觸發一次）。不寫＝持續到回合用完 |
| `custom` | `true` | | 新的狀態一定要寫 |

傷害屬性：`bludgeoning` 鈍擊、`piercing` 穿刺、`slashing` 斬擊、`fire` 火焰、`cold` 寒冰、`lightning` 閃電、`thunder` 雷鳴、`acid` 酸蝕、`poison` 毒素、`radiant` 神聖、`necrotic` 暗影、`force` 奧術、`psychic` 心靈。群組（`resist`、`offense` 才能用）：`physical`、`elemental`、`divine`、`arcane`，以及 `all`。

沒有描述欄位：說明由效果自動產生（戰鬥畫面滑過狀態看得到）。

### 1.3 可以引用什麼

**狀態引用別人**：只有 `on_hit.status`，要是內建的狀態（`data/rules/statuses.json`）或同一個檔案裡新增的狀態。

**誰引用狀態**（狀態要先存在，同一個檔案裡也可以）：

| 誰 | 欄位 | 寫法 |
|---|---|---|
| 技能（[abilities](abilities.md)） | `apply` | `[{ "status": "<id>", "turns": 3, "to": "self" }]`；`to`：`target` `self` `allies` `enemies`；`on`：`hit` `fail` `always`；`save`：豁免屬性 |
| 物品（[items-gear](items-gear.md)） | `use.status` | `{ "id": "<id>", "turns": 3 }`：使用的人得到 |
| | `use.apply` | `{ "status": "<id>", "turns": 2, "save": "dex", "dc": 13 }`：對敵人施加（可以有豁免） |
| | `use.cleanse` | `["<id>", ...]`：解除這些狀態 |
| 其他狀態 | `on_hit.status` | 見上表 |

技能與物品的其他欄位見各自的指南。

### 1.4 最小範例

```json
{
  "type": "elondia-content",
  "statuses": {
    "mod_status_frost_ward": {
      "name": "霜盾",
      "kind": "buff",
      "resist": { "cold": -0.5 },
      "custom": true
    }
  }
}
```

### 1.5 完整範例

一個會讓武器帶毒火的增益（命中附加另一個減益）、一個一次性的防護，再加上施加它們的技能與物品：

```json
{
  "type": "elondia-content",
  "statuses": {
    "mod_status_ember_rot": {
      "name": "餘燼蝕毒",
      "kind": "debuff",
      "mods": { "hit": -1, "ap_regen": -1 },
      "dot": { "dice": "1d6", "type": "fire" },
      "attacked_advantage": true,
      "custom": true
    },
    "mod_status_ember_edge": {
      "name": "餘燼之刃",
      "kind": "buff",
      "mods": { "damage": 1, "threat": 0.2 },
      "luck": "1d4",
      "luck_on": ["attack"],
      "offense": { "fire": 0.25 },
      "on_hit": { "status": "mod_status_ember_rot", "turns": 2 },
      "charges": 3,
      "custom": true
    },
    "mod_status_tide_shell": {
      "name": "潮殼",
      "kind": "buff",
      "special": "halve_next",
      "charges": 1,
      "custom": true
    }
  },
  "abilities": {
    "mod_ability_ember_edge": {
      "id": "mod_ability_ember_edge",
      "name": "燃刃",
      "type": "skill",
      "classes": ["fighter", "paladin"],
      "unlock": 3,
      "ap": 2,
      "target": "self",
      "resolve": "auto",
      "apply": [{ "status": "mod_status_ember_edge", "turns": 3, "to": "self" }],
      "desc": "讓武器帶上餘燼，接下來 3 次命中使目標中餘燼蝕毒。",
      "custom": true
    }
  },
  "items": {
    "餘燼瓶": {
      "category": "consumable",
      "price_cc": 80,
      "tags": ["magic"],
      "desc": "砸碎後冒出黏稠的火焰，目標靈巧豁免失敗就中餘燼蝕毒。",
      "use": { "apply": { "status": "mod_status_ember_rot", "turns": 3, "save": "dex", "dc": 13 } },
      "custom": true
    },
    "潮殼藥水": {
      "category": "consumable",
      "price_cc": 60,
      "tags": ["temple"],
      "desc": "喝下後下一次受到的傷害減半。",
      "use": { "status": { "id": "mod_status_tide_shell", "turns": 3 } },
      "custom": true
    }
  }
}
```

### 1.6 常見錯誤

整理時不會提示、直接改掉的寫法：

| 寫法 | 結果 |
|---|---|
| 寫了 `id`、`desc`、`turns` 或其他不在表上的欄位 | 拿掉 |
| `name` 超過 10 字 | 截掉 |
| `kind` 寫成 `"positive"` 之類 | 變成 `buff` |
| `mods` 裡寫小數（`1.5`）或 0 | 四捨五入；0 拿掉 |
| `mods` 超過 ±10、`threat` 超過 -1～2 | 夾在範圍內 |
| 只寫 `luck` 沒寫 `luck_on`（或反過來） | 兩個都拿掉 |
| `luck` 寫成 `1d4+1` | 拿掉（幸運骰不能加常數；`dot`、`hot`、`pulse` 可以） |
| `luck_on`、`advantage` 寫 `"damage"`、`"hit"` | 拿掉（只有 `attack`、`evade`、`save`） |
| `dot.type`、`pulse.type` 寫群組（`physical`）或不存在的屬性 | 整個 `dot`／`pulse` 拿掉 |
| `on_hit.status` 指到自己或不存在的狀態 | 拿掉（有 `dice` 時改留傷害） |
| `on_hit` 同時寫 `status` 和 `dice` | 只留 `status` |
| `control` 寫 `"sleep"`、`"fear"` 等不在清單的 | 拿掉（恐懼這類效果用 `disadvantage` 寫） |
| `charges: 0` | 拿掉 |
| 技能或物品引用不存在的狀態 id | 技能的那一項 `apply`、物品的那一項使用效果被拿掉 |

### 1.7 相關的系統文件

- [COMBAT_SYSTEM](../../docs/COMBAT_SYSTEM.md) 第 8 節（BUFF 與 DEBUFF 的運作方式）、8.1 節（仇恨）、8.2 節（怪物與層主吃控制）。
- [CONTENT_EDITOR](../../docs/CONTENT_EDITOR.md) 3.55 節（狀態頁籤）。
- 內建的狀態：`data/rules/statuses.json`（數值可以拿來對照）。

---

## 第二部分：特質（`perks`）

### 2.1 用途與放在哪裡

- 角色身上一直生效的被動能力：讓某些檢定更容易、戰鬥修正、抗性與增傷。**缺陷**（`flaw: true`）是只有壞處的特質。主角、隊友、NPC 都有。
- 區塊：`perks`。key：`mod_perk_<英文小寫>`，缺陷建議 `mod_perk_flaw_<英文小寫>`。
- 項目裡的 `id` 可以不寫（整理時補上 key）；寫的話要和 key 一樣。
- 自建的特質不能是種族特質（`race` 只能沿用內建的）。

### 2.2 欄位一覽

| 欄位 | 型別 | 範圍 | 說明 |
|---|---|---|---|
| `name` | 字串 | **最多 12 字** | 名稱 |
| `desc` | 字串 | 最多 120 字 | 描述；不寫時依效果自動產生 |
| `effects` | 陣列 | 最多 6 個 | 效果（下表）。每個效果**只能是一種**：`check`、`combat`、`resist`、`offense` |
| `flaw` | `true` | | 缺陷。不是缺陷就**不要寫這一欄**（`false` 也算多寫） |
| `requires` | `{ "races", "classes" }` | 種族、職業 id | 只有這些種族或職業可以學。沒有限制就不要寫（空陣列也算多寫） |
| `exclusive` | 陣列 | 特質 id | 互斥的特質（寫一邊就夠，兩邊都會擋） |
| `train` | 物件 | 見下表 | 可以在哪裡受訓（缺陷：在哪裡花錢克服） |
| `npc` | `{ "weight", "tags", "classes" }` | `weight` 整數 1～10 | 生成的 NPC 抽到的權重；`tags`（NPC 標籤）×4、`classes`（職業）×3。不寫＝NPC 不會抽到 |
| `custom` | `true` | | 新的特質一定要寫 |

**效果**：

| 效果 | 寫法 | 範圍（一般特質） | 範圍（缺陷） |
|---|---|---|---|
| 檢定加值 | `{ "check": { 篩選 }, "bonus": 2 }` | 整數 +1～+5 | -5～+5 |
| 戰鬥修正 | `{ "combat": { "hit": 1 } }`：`hit` `evade` `save` `damage` `dr` `ap_regen` `crit` | 整數 +1～+3 | -3～+3 |
| 仇恨 | `{ "combat": { "threat": -0.1 } }` | -0.5～+0.5（小數兩位） | 同左 |
| 抗性 | `{ "resist": { "fire": -0.25 } }`：key 是傷害屬性、群組或 `all`，一個效果最多 4 個 key | -0.75～+0.5，**0.25 的倍數**（負的是抗性，正的是弱點） | 同左 |
| 增傷 | `{ "offense": { "radiant": 0.25 } }` | 0～+0.5，0.25 的倍數 | -0.5～+0.5 |

**檢定的篩選**（`check` 裡的欄位；同一欄是「或」，不同欄是「且」；`"check": {}`＝所有檢定）。每一欄最多 8 個：

| 篩選 | 可以寫的值 |
|---|---|
| `attrs` | `str` 力量、`dex` 靈巧、`int` 智力、`fai` 信仰、`cha` 魅力 |
| `contexts` | `action` 主動行動、`negotiation` 談判、`master_event` 回應主人、`gate` 城門盤查、`trap` 察覺陷阱、`lock` 開鎖、`travel` 旅行途中的危險、`road` 旅途上的事件、`quest` 執行委託、`retreat` 撤出地下城、`stealth` 潛行、`initiative` 戰鬥先攻、`save` 戰鬥中的豁免 |
| `kinds` | 主動行動的種類（`data/rules/actions.json` 的 `kinds`）：`hire` `haggle` `invite` `black_market` `negotiate` `escape` `bargain` `negotiation` `rest_talk` `chat` `gift` `flatter` `bluff` `intimidate` `steal` `attack` `master_permit` `master_leave` `marking` `master_event` `master_return` `seek_master` `work` `patron` `unmark` `story` `defeat_event` `craft` `make` `produce` `train` `explore` `perk_pitch` `invent` |
| `vs_tags` | 對象的標籤（`data/rules/npc_tags.json`）：`traveler` `merchant` `commoner` `slave` `noble` `royal` `priest` `bishop` `good` `villain` `prostitute` |

**`kinds` 與 `vs_tags` 不會被檢查**：寫錯的值會留著，但永遠不會成立，世界檢查也看不出來。一定照上表抄。

**受訓**（`train`）：

| 欄位 | 範圍 | 說明 |
|---|---|---|
| `cells` | `inn` `guild` `tavern` `shop` `temple` `smithy` `tailor` `jeweler` `magic` `informant` `tattoo` `carver` `brothel`，或自建商店的 id（`shop_…`）、地標的 id（`lm_…`） | 在哪些設施受訓。不在清單的拿掉；全部被拿掉時整個 `train` 拿掉 |
| `price_cc` | 0～1,000,000（預設 300） | 學費（白鸛幣） |
| `hours` | 1～72（預設 8） | 花幾小時 |
| `attr` | 五種屬性（預設 `str`） | 檢定的屬性 |
| `dc` | 5～30（預設 12） | 檢定的 DC |

**強度**（`perkPower`，世界檢查會算）：

- 檢定加值 × 範圍：所有檢定 4、每個屬性 1.5、每個情境 0.75、每個行動或標籤 0.5（同一欄寫幾個就乘幾個，最多 4；不同欄取最窄的）。
- 戰鬥修正：每點 ×2（`ap_regen` 每點 ×4；`threat` 不算）。
- 抗性、增傷：每 0.25 算 1；弱點、負的加值算負的。
- **一般特質不能超過 4.5**（內建最強：識途老馬、逆來順受）。世界檢查超過時是錯誤。新特質對準 2～3；缺陷對準 -2.5～-3.5。
- 例：`{ "check": { "contexts": ["road", "travel"] }, "bonus": 1 }` ＝ 1 × 1.5 ＝ 1.5；`{ "combat": { "hit": 1 } }` ＝ 2；`{ "check": {}, "bonus": 2 }` ＝ 8（太強）。

### 2.3 可以引用什麼

**特質引用別人**（要先存在）：

- `requires.races`：`human` `elf` `dwarf` `demon` `catfolk` `yulin`；`requires.classes`、`npc.classes`：`fighter` `barbarian` `paladin` `ranger` `rogue` `monk` `bard` `cleric` `druid` `wizard` `noncombatant`。
- `exclusive`：內建的特質 id（`data/rules/perks.json`；種族特質不行），或同一個檔案裡新增的特質。
- `train.cells`：自建商店、地標的 id 只檢查格式，**不檢查存不存在**：要確定那家店或那個地標真的在這個世界裡（[shops](shops.md)、[landmarks](landmarks.md)）。
- `npc.tags`：見上面的 `vs_tags` 清單。

**怎麼讓角色得到特質**（不寫這些地方，特質只會在建角與升級時出現）：

| 管道 | 寫在哪裡 | 寫法 |
|---|---|---|
| 建立角色、升級（3、6、9……級三選一） | 自動 | 一般特質都會列出（條件、互斥照算）。缺陷只在建角時能選 |
| 受訓 | 特質的 `train` | 見上表。缺陷有 `train` 時是「克服缺陷」 |
| 書籍 | 物品的 `use.perks`（[items-gear](items-gear.md)） | `["<id>", ...]`，最多 6 個；讀完得到一次機會 |
| 固定 NPC | NPC 的 `perks`（[npcs](npcs.md)） | `["<id>", ...]`；空陣列＝沒有特質；不寫＝依 id 隨機抽 |
| 生成的 NPC | 特質的 `npc` | `weight` 1～10 |
| 特殊任務、旅途與城鎮事件的結果 | `effects`（[stories](stories.md)、[events](events.md)） | `{ "type": "perk", "perk": "<id>", "options": ["<id>"] }`：一次機會，從這幾個選一個（最多 6 個）；加 `"direct": true` 直接學會。**缺陷一律直接染上** |
| 失去、克服 | 同上 | `{ "type": "lose_perk", "perk": "<id>" }` |

### 2.4 最小範例

```json
{
  "type": "elondia-content",
  "perks": {
    "mod_perk_tide_reader": {
      "name": "觀潮者",
      "effects": [{ "check": { "contexts": ["road", "travel"] }, "bonus": 1 }],
      "custom": true
    }
  }
}
```

強度 1.5。沒有 `train`、`npc`：只會在建角、升級時出現，或由事件、任務、書給。

### 2.5 完整範例

一個有條件、互斥、受訓與 NPC 權重的特質（強度 3），一個可以在神殿克服的缺陷（強度 -2.5），以及教前者的書：

```json
{
  "type": "elondia-content",
  "perks": {
    "mod_perk_ash_walker": {
      "name": "灰燼行者",
      "desc": "信仰檢定 +1；對神官的檢定 +1；火焰傷害 ×0.75；比較不容易被盯上。",
      "effects": [
        { "check": { "attrs": ["fai"] }, "bonus": 1 },
        { "check": { "vs_tags": ["priest"] }, "bonus": 1 },
        { "resist": { "fire": -0.25 } },
        { "combat": { "threat": -0.1 } }
      ],
      "requires": { "classes": ["cleric", "paladin", "druid"] },
      "exclusive": ["fire_born"],
      "train": { "cells": ["temple"], "price_cc": 400, "hours": 8, "attr": "fai", "dc": 13 },
      "npc": { "weight": 2, "tags": ["priest"], "classes": ["cleric"] },
      "custom": true
    },
    "mod_perk_flaw_ash_lung": {
      "name": "灰肺",
      "desc": "力量檢定 -1；毒素傷害 ×1.25。",
      "flaw": true,
      "effects": [
        { "check": { "attrs": ["str"] }, "bonus": -1 },
        { "resist": { "poison": 0.25 } }
      ],
      "train": { "cells": ["temple"], "price_cc": 300, "hours": 8, "attr": "fai", "dc": 13 },
      "npc": { "weight": 1, "tags": ["commoner"] },
      "custom": true
    }
  },
  "items": {
    "灰燼禱文抄本": {
      "category": "consumable",
      "price_cc": 120,
      "tags": ["temple"],
      "desc": "一本被火燒過邊角的禱文，讀完有機會學會【灰燼行者】。",
      "use": { "perks": ["mod_perk_ash_walker"] },
      "custom": true
    }
  }
}
```

在事件或特殊任務的結果裡給這兩個特質（片段，放在結果的 `effects`）：

```jsonc
{ "type": "perk", "perk": "mod_perk_ash_walker", "options": ["devout"] }   // 二選一的機會
{ "type": "perk", "perk": "mod_perk_flaw_ash_lung" }                      // 缺陷：直接染上
{ "type": "lose_perk", "perk": "mod_perk_flaw_ash_lung" }                 // 克服
```

### 2.6 常見錯誤

| 寫法 | 結果 |
|---|---|
| `"flaw": false`、`"requires": { "races": [], "classes": [] }`、`"exclusive": []` | 拿掉（等於沒寫，報告不會列出來） |
| `name` 超過 12 字、`desc` 超過 120 字 | 截掉 |
| 一般特質寫負的 `bonus` 或負的戰鬥修正 | 那個效果拿掉（不會翻成正的）。要負的就加 `"flaw": true` |
| `bonus` 超過 5、戰鬥修正超過 3 | 夾到 5、3 |
| 一個效果同時寫 `check` 和 `combat`（或 `resist`……） | 只留第一種（依 `check` → `combat` → `resist` → `offense` 的順序），其他拿掉。拆成兩個效果 |
| `resist` 寫 `-0.3`、`-0.1` | 變成 0.25 的倍數（-0.25、0 → 拿掉） |
| `resist` 寫 `-1`（免疫） | 夾到 -0.75 |
| 一般特質寫負的 `offense` | 夾到 0 → 拿掉 |
| 戰鬥修正寫小數（`1.5`） | 四捨五入 |
| `effects` 超過 6 個 | 後面的拿掉 |
| `train.cells` 寫 `gate`、`road` 等不能受訓的地方 | 拿掉 |
| `train.cells` 寫不存在的 `shop_…`、`lm_…` | **留著**，但沒有地方可以受訓（不會被發現） |
| `kinds`、`vs_tags` 寫錯 | **留著**，但永遠不成立（不會被發現） |
| `npc.weight: 0` | 整個 `npc` 拿掉 |
| `npc.tags`、`requires`、`npc.classes` 寫不存在的標籤、種族、職業 | 那一項拿掉 |
| 寫 `race` | 自建的特質拿掉 `race` |
| 一般特質強度超過 4.5 | 不會被改，但世界檢查是**錯誤**：減少效果或縮小範圍 |
| 事件、任務的 `perk` 效果指到不存在或種族特質 | 那一項效果拿掉 |

### 2.7 相關的系統文件

- [PERKS](../../docs/PERKS.md)：被動效果怎麼生效（第 1 節）、強度（第 2 節）、缺陷（3.2 節）、取得與失去（第 4 節）、NPC（第 5 節）。
- [CONTENT_EDITOR](../../docs/CONTENT_EDITOR.md) 3.6 節（特質頁籤）、[EFFECTS](../../docs/EFFECTS.md)（`perk`、`lose_perk`）、[STORY_QUESTS](../../docs/STORY_QUESTS.md)（特殊任務的效果）。
- 內建的特質與強度：`data/rules/perks.json`、PERKS 第 3 節的表。

---

## 第三部分：刺青與奴隸印記（`tattoos`、`marks`、`markRules`）

### 3.1 用途與放在哪裡

| 區塊 | 內容 | key |
|---|---|---|
| `tattoos` | 刺青圖樣：普通刺青（只是外觀）與誓約印記（屬性有加有減、加總為 0） | `mod_tattoo_<英文小寫>`，誓約建議 `mod_tattoo_oath_<英文小寫>` |
| `marks` | 奴隸印記的模板（契約的條款） | `mod_mark_<英文小寫>` |
| `markRules` | 印記的用途與權重：預設的印記、老鴇刻的、刻印的輕重順序、市場與自賣的權重 | 只有一筆，key 一定是 `rules` |

- 三種都**不要寫 `id`** 欄位。
- 角色身上的刺青與印記是刺上時存的一份：改模板只影響之後刺的。
- 新的刺青圖樣會出現在刺青店（普通刺青）與刻印師（誓約印記）的圖樣清單裡，玩家可以自己挑；事件與特殊任務可以用 `tattoo` 效果直接刺上。
- 新的奴隸印記要加進 `markRules`，或由特殊任務的 `enslave_player` 指定，才會出現。

### 3.2 欄位一覽

**刺青圖樣**（`tattoos`）：

| 欄位 | 型別 | 範圍 | 說明 |
|---|---|---|---|
| `kind` | `"plain"`／`"oath"` | | 普通刺青或誓約印記。其他值變成 `plain` |
| `name` | 字串 | 最多 12 字 | 名稱 |
| `desc` | 字串 | 最多 160 字 | 外觀（AI 會讀到） |
| `places` | 陣列 | `neck` 頸部、`left_arm` 左臂、`right_arm` 右臂、`chest` 胸口、`back` 背部、`belly` 小腹、`hips` 臀部、`left_thigh` 左大腿、`right_thigh` 右大腿、`left_calf` 左小腿、`right_calf` 右小腿 | 建議的部位（效果沒指定部位時，從這裡挑空著的）。不寫＝任何部位 |
| `attrs` | 物件 | 只有 `oath`：`str` `dex` `int` `fai` `cha`，每項整數 ±1～±3 | 誓約的屬性加減：**最多 3 項、有加也有減、加總為 0**。不合規則時**整筆不收** |
| `custom` | `true` | | 新的圖樣一定要寫 |

**奴隸印記**（`marks`）。沒寫的欄位整理時補預設值：

| 欄位 | 型別 | 範圍（預設） | 說明 |
|---|---|---|---|
| `name` | 字串 | 最多 12 字 | 契約的名稱 |
| `mark` | 字串 | 最多 160 字 | 印記的外觀（AI 會讀到） |
| `place` | 部位 | 同上（`neck`） | 刻在哪裡；那個部位原本的刺青會被蓋掉 |
| `income_share` | 數字 | 0～1（0.5） | 奴隸賺的錢有多少歸主人。> 0 時有「收益歸屬」 |
| `negotiate_dc` | 整數 | 5～35（18） | 談判解除契約的 DC |
| `escape_dc` | 整數 | 5～35（17） | 逃離主人的 DC |
| `exit_dc` | 整數 | 5～30（12） | 請求主人同意出城的 DC |
| `recapture_chance` | 數字 | 0～0.8（0.1） | 逃亡期間每次休息被找到的機率。> 0 時有「追蹤」 |
| `escape_effects` | `{ "hp_ratio" }` | 0～0.9（0.1） | 逃離時印記反噬的生命比例。≥ 0.3 時有「距離束縛」 |
| `obedience_penalty` | 整數 | 0～10（2） | 對主人的檢定懲罰 |
| `side_effects` | 陣列 | 最多 4 項，每項最多 40 字 | 副作用的文字（AI 會讀到） |
| `spell_cap` | 整數 | 0～9 | 最多施放幾環法術（魔力封印）。沒有封印就不要寫 |
| `custom` | `true` | | 新的印記一定要寫 |

功能（身分標示、服從、收益歸屬、追蹤、距離束縛、魔力封印）依數值推得，不用另外寫。

**印記設定**（`markRules.rules`）。寫了就整份取代內建的設定，沒寫的部分用內建的值：

| 欄位 | 型別 | 範圍 | 說明 |
|---|---|---|---|
| `roles.default` | 印記 id | 存在的印記 | 買奴隸、AI 交易清單、劇情沒指定時用的印記（內建 `labor`） |
| `roles.madam` | 印記 id | 存在的印記 | 老鴇收下主角、主人是娼妓、自賣給老鴇時刻的（內建 `brothel`） |
| `market_contracts.public` | `{ 印記 id: 權重 }` | 0～100（小數兩位） | 公開奴隸市場上的印記（內建 `labor` 6、`combat` 3、`arcane` 1） |
| `market_contracts.black` | 同上 | 同上 | 黑市（內建 `labor` 4、`combat` 3、`arcane` 3） |
| `severity` | 陣列 | 存在的印記 | 刻印檢定由輕到重的順序（內建 `labor`、`combat`、`arcane`） |
| `self_sale` | `{ 印記 id: 權重 }` | 0～100（小數兩位） | 出售自己時的印記（內建 `labor` 6、`combat` 3、`arcane` 1） |

內建的印記 id：`labor` 勞役、`combat` 戰奴、`arcane` 魔導束縛、`brothel` 娼妓。

### 3.3 可以引用什麼

**刺青與印記引用別人**：`markRules` 裡的印記 id 要是內建的，或同一個檔案 `marks` 裡新增的。刺青圖樣不引用任何東西。

**誰引用它們**：

| 誰 | 寫法 |
|---|---|
| 事件、特殊任務的結果（[events](events.md)、[stories](stories.md)） | `{ "type": "tattoo", "template": "<圖樣 id>", "place": "left_calf", "by": "誰刺的" }`（`place`、`by` 選填；`by` 最多 20 字） |
| | 自己描述（不用圖樣）：`{ "type": "tattoo", "kind": "oath", "name": "…", "text": "外觀", "attrs": { "str": 2, "int": -2 } }`（`name` 最多 20 字、`text` 160 字） |
| | `{ "type": "remove_tattoo", "place": "chest" }` 或 `{ "type": "remove_tattoo", "kind": "plain" }`（奴隸印記洗不掉） |
| 特殊任務（只有特殊任務） | `{ "type": "enslave_player", "master": "<固定 NPC id>", "contract": "<印記 id>" }`，或 `"random": { "tag": "noble" }` 代替 `master` |
| 印記設定 | `roles`、`market_contracts`、`severity`、`self_sale` |

部位已經有刺青、沒有空位、誓約已經 2 個時不會刺（日誌寫「沒有刺上刺青」）。

### 3.4 最小範例

```json
{
  "type": "elondia-content",
  "tattoos": {
    "mod_tattoo_tide_shell": {
      "kind": "plain",
      "name": "潮貝",
      "desc": "一枚半開的貝殼，殼紋裡藏著細細的浪花。",
      "custom": true
    }
  }
}
```

### 3.5 完整範例

一個誓約印記（信仰 +2、靈巧 +1、魅力 -3），一個新的奴隸印記，並把它放進市場與刻印的順序：

```json
{
  "type": "elondia-content",
  "tattoos": {
    "mod_tattoo_oath_ember": {
      "kind": "oath",
      "name": "餘燼之誓",
      "desc": "胸口一圈暗紅的火痕，發誓以信仰承受火焰，代價是再也說不出好聽話。",
      "places": ["chest", "back"],
      "attrs": { "fai": 2, "dex": 1, "cha": -3 },
      "custom": true
    }
  },
  "marks": {
    "mod_mark_salt_bond": {
      "name": "鹽契",
      "mark": "左臂一道結晶般的白色鎖紋，沾到海水會微微發亮。",
      "place": "left_arm",
      "income_share": 0.7,
      "negotiate_dc": 19,
      "escape_dc": 18,
      "exit_dc": 13,
      "recapture_chance": 0.2,
      "escape_effects": { "hp_ratio": 0.2 },
      "obedience_penalty": 3,
      "side_effects": ["離海太遠時鎖紋發乾刺痛"],
      "custom": true
    }
  },
  "markRules": {
    "rules": {
      "roles": { "default": "labor", "madam": "brothel" },
      "market_contracts": {
        "public": { "labor": 6, "combat": 3, "arcane": 1, "mod_mark_salt_bond": 2 },
        "black": { "labor": 4, "combat": 3, "arcane": 3, "mod_mark_salt_bond": 2 }
      },
      "severity": ["labor", "mod_mark_salt_bond", "combat", "arcane"],
      "self_sale": { "labor": 6, "combat": 3, "arcane": 1 }
    }
  }
}
```

### 3.6 常見錯誤

| 寫法 | 結果 |
|---|---|
| 寫了 `id` 或其他不在表上的欄位（例如印記的 `desc`、`functions`） | 拿掉 |
| 誓約加總不是 0、只有加沒有減、超過 3 項、某項超過 ±3 或有小數 | **整筆不收**（報告是錯誤「整筆被拿掉」） |
| 普通刺青寫 `attrs` | 拿掉 |
| `places`、`place` 寫 `face`、`hand` 等不存在的部位 | 拿掉；印記的 `place` 變成 `neck` |
| 印記的數值超出範圍（例如 `income_share: 1.5`、`negotiate_dc: 40`） | 夾在範圍內 |
| 印記的 DC、`obedience_penalty` 寫小數 | 四捨五入 |
| `side_effects` 超過 4 項或某項超過 40 字 | 多的拿掉、長的截掉 |
| `markRules` 的 key 不是 `rules` | 整筆不收 |
| 權重寫超過兩位的小數（`0.125`） | 留兩位小數（`0.13`），依比例抽選；0 的拿掉 |
| 權重或順序裡寫不存在的印記 id | 那一項拿掉；全部被拿掉時改成預設的印記 |
| 只想加一種印記，卻只寫了 `market_contracts.public: { "mod_mark_x": 2 }` | 公開市場只剩這一種印記：要把內建的權重一起寫上 |
| `tattoo` 效果的 `template` 指到不存在的圖樣、又沒有 `name` | 那一項效果拿掉 |

### 3.7 相關的系統文件

- [TATTOOS](../../docs/TATTOOS.md)：部位與種類、奴隸印記、誓約印記、事件效果（第 5 節）、刺青店與洗刺青。
- [COMPANIONS](../../docs/COMPANIONS.md) 第 4 節（奴隸契約印記的條款與功能）、2.4 節（主角作為奴隸）、3.3 節（逃亡與解除印記）。
- [CONTENT_EDITOR](../../docs/CONTENT_EDITOR.md) 3.7 節（刺青頁籤）、[STORY_QUESTS](../../docs/STORY_QUESTS.md)（`enslave_player`）。
- 內建的資料：`data/rules/tattoos.json`（圖樣）、`data/rules/slavery.json`（`contracts`、`roles`、`market_contracts`、`marking.severity`、`self_sale.contract_weights`）。
