# 艾隆迪亞內建內容的產生腳本

內建世界（`data/`）大部分的特殊任務、獨特裝備、地下城事件與寄生物是這些腳本產生的。**一律在 repo 根目錄執行**（路徑都是相對於 repo 根目錄），例如 `python3 worldgen/scripts/elondia/story_batch1.py`。

## 可以重跑（重跑會得到目前的資料）

改內容時改這些腳本、再重跑，不要直接改產生出來的 JSON（直接改的話，下次重跑會被蓋掉）。

| 腳本 | 寫進 | 說明 |
|---|---|---|
| `story_batch1.py` | `data/rules/stories.json` | 所有特殊任務：匯入 `story_batch2`～`story_batch30`，再套用 `epic_places.place_epics`（史詩頭目戰的特殊地圖）、`uniq23.place_gear`（任務的獨特裝備）、`adult_scenes26.place_scenes`（親密場景）、`lust_skills_s6.place_skills`（打工線的獨特技能，接在結局的獎勵物品後面），最後接上 `lust_park_s7.PARK_STORIES`（緋夢樂園的集章任務）。以 git 的 `2fa8ee9` 版的 stories.json 為底，後面接上這些批次 |
| `uniq23.py` | `data/rules/items.json` | 任務的獨特裝備 149 件 |
| `dungeon_events24.py` | `data/rules/travel_events.json`、`companions.json` | 地下城的色情事件與它們的非戰鬥狀態 |
| `parasites25.py` | `data/rules/parasites.json`、`items.json`、`companions.json`、`travel_events.json` | 寄生物的規則、物品、發作事件 |
| `work26.py` | `data/rules/items.json`、`data/world/npcs.json`、`landmarks.json` | 打工任務線（成人向）的獨特色情裝備、委託人與地標：自己的五條線，加上 `story_batch27.py`、`story_batch28.py` 匯出的 `ITEMS27`～`30`、`NPCS27`～`30`、`LANDMARKS27`～`30`（任務本身在 `story_batch26`～`30`；制服的表在 `story_batch26.py` 的 `DRESS` 與 `DRESS29`、`DRESS30`） |
| `town_events26.py` | `data/rules/travel_events.json` | 城鎮的成人向事件（搜身盤查、被下藥的酒、賭局的代價、被搭訕、被偷摸） |
| `dragon_text27.py` | `data/rules/enemies.json`、`data/worldbook/elondia.worldbook.json` | 巨龍不可名狀：投影與守衛的描述、世界書「高維巨龍」條目的不可溝通原則與三條龍的動機（可以重跑，改過的不再改） |
| `npc_looks27.py` | `data/world/npcs.json` | 固定 NPC 的外貌細節（資料在 `npc_looks27.json`；要排在 `work26.py` 之後，因為 work26 會重寫打工線的委託人） |
| `lust_park_s7.py` | `data/rules/abilities.json`、`enemies.json`、`items.json`、`lewd.json`、`data/world/geography.json`、`maps.json`、`special_maps.json`、`landmarks.json`、`npcs.json` | 魅魔的遊樂園「緋夢樂園」（慾望戰鬥 S7，[LUST_PARK](../../../docs/LUST_PARK.md)）：怪物、技能、物品、五個園區、入口廣場、售票亭、接待員、園區的規則；集章任務由 `story_batch1.py` 匯入。要排在 `interiors23.py`、`epic_places.py`、`uniq23.py`、`work26.py`、`npc_looks27.py` 之後（它們會重寫同一個檔案）。可以重跑；怪物的生命與攻擊加成在 `TUNE` |
| `lust_s8.py` | `data/rules/items.json`、`statuses.json`、`companions.json`、`lewd.json`、`gear.json`、`tattoos.json`、`abilities.json`、`parasites.json`、`slavery.json` | 慾望戰鬥 S8 的資料（[LEWD_STATS](../../../docs/LEWD_STATS.md) 第 13 節起）：消耗品、料理、征服掉落、輔料的魅惑方向、淫紋、寄生物的階段、印記的順從累積、鑰匙與戰鬥中的拘束。要排在 `lust_park_s7.py` 之後。可以重跑 |
| `lust_s9.py` | `data/rules/gear.json`、`items.json`、`lewd.json`、`shops.json`、`enemies.json`、`travel_events.json` | 慾望戰鬥 S9 的資料（[LEWD_STATS](../../../docs/LEWD_STATS.md) 第 7、27 節、[ADULT_EVENTS](../../../docs/ADULT_EVENTS.md) 第 4 節）：封住嘴巴、16 件拘束具、商店每天另外上架的拘束具、寶箱與其他來源；24 件地下城事件、20 件魅氣濃的城鎮事件（也寫 `travel_events.json`）。要排在 `lust_s8.py` 之後。可以重跑 |
| `docgear24.py` | `docs/ITEMS.md` 3.1.1 節 | 任務的獨特裝備表 |
| `../../tools/flowdoc/flowdoc.py` | `worldgen/design/ElondiaQuestFlows.html` | 任務線走向（上面任何一個改過之後都要重跑） |
| `../../tools/guide/guide.py` | `docs/guide/` | 給玩家的遊戲攻略，同步到 wiki（`data/` 改過之後都要重跑；沒重跑時測試 `guide.spec.ts` 會失敗） |

建議的順序：`uniq23.py` → `dungeon_events24.py` → `parasites25.py` → `town_events26.py` → `work26.py` → `npc_looks27.py` → `lust_park_s7.py` → `lust_s8.py` → `lust_s9.py` → `story_batch1.py` → `docgear24.py` → `flowdoc.py` → `guide.py`。

## 一次性（已經套用過，留作紀錄）

其他腳本是當初做資料轉換、平衡調整、合併分支用的，已經套用在目前的資料上。多半不能直接重跑（會重複套用、或依賴當時的檔案狀態），要參考做法時再讀：

- 角色與 NPC：`gen_npcs.py`、`gen_stories.py`（elondia-plus 世界包的草稿）、`merge_npcs.py`（併進內建 npcs.json，`npcs.before.json` 是當時的底）、`npc_stages_b1.py`、`add_part2.py`、`npcfmt.py`、`rooms23.py`、`npc_noattack24.py`
- 地標與特殊地圖：`landmarks23.py`、`interiors23.py`（`special_maps.base.json` 是當時的底）、`lm.py`、`links.py`
- 怪物與平衡：`abyss.py`、`abyss_items.py`、`build_abyss.py`、`doc_abyss.py`、`mkboss23.py`（`boss23.json`）、`story_enemies.py`、`boss_rounds.py`、`bossedit.py`、`tune*.py`、`assign_ult.py`、`levels.py`、`add_skills.py`
- 合併分支：`port_p209_gear.py`、`port_p209_text.py`
- 其他：`events.py`（主人事件）、`lore_update.py`、`wb.py`（世界書）、`ed*.py`、`e1.py`、`fsum.py`、`msum.py`、`ml.py`、`short.py`、`story_groups.json`
