# 艾隆迪亞擴充

> ⚠️ **固定 NPC 已經併入內建世界**（`data/world/npcs.json`，id 從 `mod_npc_…` 改成 `npc_…`，並依作者的設定修改：晨曦王國改由羅曼諾夫王室統治、奧托三世改寫、諾克緹絲與莫菲的個性……）。這個世界包的任務還在用舊的 id 與舊的設定，匯入後會和內建角色重複（例如阿德萊德二世與國王亞歷山大並存）。新的故事線規劃見 [design/elondia-storylines](../../design/elondia-storylines.md)，之後會照那份重做任務；在那之前不建議匯入這個包。

> 在原版艾隆迪亞上補齊各地的固定 NPC 與特殊任務，並把新的人與事寫進世界書。照 [WORLD_GUIDE](../../WORLD_GUIDE.md) 做的完整範例；之後要不要併入內建，玩過再決定（[PLAN](../../PLAN.md) 決定 2）。

## 內容

| 種類 | 數量 | 規劃清單 | 資料 |
|---|---|---|---|
| 固定 NPC | 85 位：26 個聚落、44 個地標都有人；統治者與機構首長不能雇用 | [npcs.md](npcs.md) | `parts/npcs-<地區>.json` |
| 特殊任務 | 37 條：主線「龍影之兆」5 章、地區故事線 13 條、內建角色任務線 6 條、人物任務 9 條、地下城傳說 4 條 | [stories.md](stories.md) | `parts/stories.json` |
| 世界書 | 改寫 7 條（6 個區域條目加上重要人物與傳聞、勢力概述加上各勢力現任首領），新增 17 條（主線、16 位統治者與勢力首領） | | `parts/prompts.json` |

檢查結果見 [check-report.md](check-report.md)。

## 匯入

遊戲首頁「🌍 世界管理」→「📥 匯入成新的世界」，選 `world.json`。會建立「艾隆迪亞擴充」世界與同名的提示詞組，兩者綁在一起。開新遊戲時選這個世界；主線從萊茵堡的塞拉菲娜・維斯開始（E 級）。

## 重新產生

資料全部由 `scripts/` 的腳本產生，**改腳本，不要手改 `parts/` 與 `world.json`**。在專案根目錄：

```
python3 worldgen/worlds/elondia-plus/scripts/gen_npcs.py      # parts/npcs-*.json
python3 worldgen/worlds/elondia-plus/scripts/gen_stories.py   # parts/stories.json
python3 worldgen/worlds/elondia-plus/scripts/gen_prompts.py   # parts/prompts.json（讀 NPC、任務、npcs.md 與內建世界書）
node worldgen/tools/build-world.mjs elondia-plus              # world.json
WORLD=worldgen/worlds/elondia-plus/world.json npx vitest run src/__tests__/worldCheck.spec.ts
```

`gen_prompts.py` 必須在 NPC 與任務之後跑；內建世界書更新時也要重跑一次（改寫的條目是從原文接上新段落）。`src/__tests__/elondiaPlus.spec.ts` 會確認 `world.json` 能完整匯入、世界書條目會被觸發。
