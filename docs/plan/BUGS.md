# Bug

> 上層：[計畫與追蹤](README.md)。
> 這裡記**程式沒有照規則或文件運作**的問題：會出錯、當掉、算錯、資料讀錯、畫面顯示和實際結果不一致。規則本身不合理（程式照設計在跑，但設計有問題）記到 [LOGIC_ISSUES](LOGIC_ISSUES.md)。
> 修好之後從這裡刪掉，在[已完成](roadmap/COMPLETED.md)記一行，並更新對應的系統文件。

## 1. 待修

| # | 問題 | 現況 | 相關 |
|---|---|---|---|
| B15 | **「travel」情境的檢定加值都沒有作用** | 2026-10-28 拿掉舊的 `travel()`（01cc499）之後，沒有任何檢定再用 `context: 'travel'`；旅途事件用的是 `road`。所以這些寫在 `travel` 的加值現在都不會生效：特質識途老馬、野外求生，缺陷怕水、路痴、懼高；旅人身分標籤（`npc_tags.json` 的 `pc_effects`）；拘束具雙面效應的限制行走、遮住視線（`lewd.json` 的 `two_face.kinds`）；豐饒祭花冠的獨特加值。要決定：把 `travel` 併進 `road`（改資料），或旅途事件的檢定同時算兩個情境（改 `road.ts`）。`perks.ts` 的 `EXPLORE_CONTEXTS`、`bindRulesMods.ts` 的 `BIND_CONTEXTS` 也要跟著改 | [PERKS](../PERKS.md) 第 1 節、[TRAVEL_EVENTS](../TRAVEL_EVENTS.md) |
| B16 | **城鎮事件、旅途事件等待中還能休息** | `rest.ts` 的 `restEventBlock` 沒檢查 `townEvent`、`roadEvent`：城鎮的選擇事件等待中時能短休、能在旅店長休；旅途事件等待中時能短休，只有紮營會擋（`longRestBlocked`）。移動有擋（`grid.ts`），`components/events/eventQueue.ts` 的註解也說這類事件不處理就不能移動、休息 | [EVENTS](../EVENTS.md)、[DUNGEON_DESIGN](../DUNGEON_DESIGN.md) |
| B17 | **自建技能被事件或 NPC 教的時候還能刪** | `mods.ts` 的 `abilityUsage` 沒看固定 NPC（娼婦）的 `teaches`，也沒看主奴、娼館事件的 `teaches`；刪掉後這些地方留著不存在的技能 id | [CONTENT_DEPENDENCIES](../CONTENT_DEPENDENCIES.md) |
| B18 | **12 件第三級材料的淫服在村莊也買得到** | `worldgen/scripts/elondia/lust_s9.py` 產生的月影絲、魔獸皮、金製服裝（微比基尼、吊帶泳衣、舞孃紗衣、開胸晚禮服、超短裙、水晶高跟鞋、吊襪腰帶、開胸胸罩、無襠皮褲、乳膠長手套、魅魔角頭飾、身體鍊）沒寫 `min_location: "city"`，其他 110 件第三級制式品都有。要在產生腳本補上再重新產生 | [ITEMS](../ITEMS.md)、[TRADE](../TRADE.md) |

## 2. 待確認是不是 Bug

| # | 問題 | 現況 | 相關 |
|---|---|---|---|
| B19 | **寶箱永遠開不出通用的打造材料** | 寶箱的打造材料由 `gear.ts` 的 `forgeItemFor` 挑那一級最便宜的一件（註解寫明），所以開出來的都是怪物素材（沙丘豺皮、樹蛛絲……），金錠、硬化獸皮、絲綢布匹、古樹心材、世界樹的枝條、魔獸毛皮、月影絲不會出現。要確認是不是刻意的 | [ITEMS](../ITEMS.md) 第 4.4 節 |
| B14 | **形象圖同一毫秒的兩版會互相蓋掉** | 各版的 key 是 `種子:角色id~時間（毫秒）`（`stores/portraits.ts` 的 `versionKey`）。2026-10-29 跑全部測試時，`imageStudio.spec` 的「微調」測試偶發失敗一次（生成與微調在同一毫秒，只剩一版），之後連跑多次沒有重現。實際遊玩時兩次生成不會在同一毫秒，但匯入、測試這類連續寫入可能碰到 | [PORTRAITS](../PORTRAITS.md) 第 4 節 |
