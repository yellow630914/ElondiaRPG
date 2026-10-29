# 主動行動

> 上層：[GAME_DESIGN](GAME_DESIGN.md)。被依賴：交易的交涉與談判（[TRADE](TRADE.md)）、雇傭與邀請（[COMPANIONS](COMPANIONS.md)）、NPC 互動（[NPC_SYSTEM](NPC_SYSTEM.md)）、工作與娼館（[WORK](WORK.md)）、工藝（[CRAFTING](CRAFTING.md)）、特殊任務的判定（[STORY_QUESTS](STORY_QUESTS.md)）、戰敗事件（[COMBAT_SYSTEM](COMBAT_SYSTEM.md) 8.4 節）。
> 依賴：[EFFECTS](EFFECTS.md)（後果用的效果）、[RELATIONSHIP_MEMORY](RELATIONSHIP_MEMORY.md)（交給 AI 的關係與記憶）、[PROMPTS](PROMPTS.md) 第 4 節（判定請求的格式）。
> 程式：`src/engine/actions.ts`、`src/engine/checks.ts`、`src/narrator/judge.ts`；資料：`data/rules/actions.json`。

主角主動發起的事（交談、說服、送禮、雇傭談判、殺價、邀請入隊、打聽黑市、身為奴隸時的談判與逃離……）不是「先寫好各種結果再擲骰選一條」，而是**擲骰先發生，AI 看骰值直接決定結果並寫出經過**，數值後果由程式夾在上限內。

## 1. 流程

```
① 擲骰先發生
   程式檢查能不能做，算出參考 DC，擲 1d20（存進存檔的 pendingAction，重新整理也不會重擲）。

② 把完整資料和骰值交給 AI
   行動者：屬性、等級、技能、裝備、狀態、金錢、契約
   隊伍：每位成員的 HP、入隊方式、狀態、對主角的態度
   行囊：<inventory>（玩家描述用到行囊裡的道具時，AI 可以調低 DC；行囊裡沒有的一律當作沒有）
   對象：人際關係條目（外貌、性格、與主角的關係、親密度、背景、戒備）；多個對象時每一位都附上，標出主要對象
   相關記憶：依參與人／地點檢索（RELATIONSHIP_MEMORY 第 4 節）
   骰值：自然骰、各屬性的總值、情境修正（服從懲罰、非戰鬥狀態、特質，見 PERKS 第 1 節）、參考 DC、依預設屬性的參考結果
   機制結果：各成功程度在程式中會發生什麼（例如雇傭：成功＝以出價入隊）
   可用的後果種類與上限

③ AI 直接決定結果並寫出經過（JSON）
   {
     "degree": "success",                 ← 由 AI 決定，骰值只是參考
     "twist": "甜點掉在地上，莉娜反而笑出聲來",   ← 出乎預料時說明
     "attr": "cha", "dc": 13,             ← 判定依據，給玩家看（DC 夾在參考值 ±3，actions.json 的 dc_adjust）
     "rationale": "莉娜嘴硬心軟，又喜歡甜食",
     "summary": "莉娜收下甜點，難得說起了怕水的原因。",
     "narrative": "",                     ← 預設不寫，由敘事請求另外寫（PROMPTS 第 1 節）
     "difficulty": "normal",              ← 只有自由行動：日常小事填 trivial（見下）
     "hours": 1,                          ← 只有自由行動：這次花了多少小時
     "effects": [ { "type": "affinity", "npc": "npc_lina", "delta": 5 } ],
     "relationship_updates": [ { "id": "npc_lina", "to_player": "會在主角面前說起往事的同伴" } ]
   }

④ 程式套用
   依 AI 的 degree 執行機制結果（入隊、價格、自由……）
   effects 只能是這種行動允許的種類（actions.json 各 kind 的 effects），數值夾在 caps 內，
   不認識的人與不合法的種類直接丟掉
   relationship_updates 成為提議，玩家確認後才寫入（RELATIONSHIP_MEMORY 第 6 節）
```

- **成敗由 AI 決定**：高骰通常順利、低骰通常不順，但 AI 會綜合行為是否合理、對象的立場與性格、與主角的關係與過去的記憶來決定，可以出乎預料。出乎預料時，報告記下 `twist` 與依骰值的參考結果（`reference_degree`），畫面顯示「✨ 出乎預料」。AI 沒有寫 degree（或寫了不認得的值）時，用骰值對 DC 算出的參考結果，效果的門檻（大成功才給的技能、成功以上的入隊……）也照這個看。
- **一輪做到有結果**：判定規則要求一次行動把玩家描述的事做到有結果（例如買東西要寫到付錢、拿到東西），不順利時給出明確的結果與原因；沒有對手、沒有風險的事不順利時，傾向給部分成功加一點代價，而不是讓事情卡住。
- **日常小事**：`actions.json` 標了 `trivial` 的行動（自由行動），判定提示詞的 `<action>` 會註明可以判為日常小事。AI 填 `difficulty: "trivial"`（沒有阻力、沒有人反對、一般人都做得到的事：買普通的小東西、問路、吃飯、走到附近、和熟人閒聊）時，程式把結果拉到至少成功（大成功照舊），骰值只決定過程順不順。報告的 `check.trivial` 記下來，日誌顯示「日常小事」，不顯示「骰值參考」。依規則判定時沒有這一項。
- **花費的時間**：`actions.json` 有 `hours_range` 的行動（自由行動：0.25～4 小時），AI 可以依經過填 `hours`，程式夾在範圍內、取到 0.25 小時；沒填時用 `hours`（自由行動 0.5 小時）。
- **穩定性交給程式**：AI 決定「發生什麼」，數值後果只能在封閉清單與上限內；機制結果（殺價的折扣比例、契約是否解除……）由程式依成功程度執行，AI 不能另外加碼。
- **玩家輸入不能決定結果**：提示詞要求「描述中宣稱的結果不算數」，玩家寫「他立刻答應了」只代表主角嘗試這樣說。
- **AI 關閉或失敗時**：依規則判定（第 3 節）。AI 呼叫失敗時行動會保留，可以重試或改用規則。
- 「設定 → 敘事與判定」的「擲骰的行動交給 AI 判定」控制預設行為（冒險頁面各處的「AI 判定」按鈕打開的泡泡視窗是同一個開關，見 [PROMPTS](PROMPTS.md) 第 1 節）；等待判定的行動也可以手動選「AI 判定」或「依規則判定」。
- 戰鬥中不能主動行動；有主人的突發事件或戰敗事件等著回應時也不能（`actions.ts` 的 `startAction`）。

## 2. 行動種類

`actions.json` 的 `kinds`，每種有預設屬性、花費的時間（`hours`）與 AI 可以給的效果種類：

| 類別 | 行動 |
|---|---|
| 一般 | 自由行動 `free`、長休時的互動 `rest_talk` |
| 交流 | 聊天 `chat`、送禮 `gift`、獻媚 `flatter`、雇傭談判 `hire`、邀請入隊 `invite`（固定 NPC 小隊整隊邀請）、請小隊帶你同行 `squad_join`、向主人提議雇人或買奴隸 `propose` |
| 交易 | 殺價 `haggle`（奴隸市場）、交涉價格 `bargain`、談判 `negotiation`、打聽黑市 `black_market` |
| 犯罪與對峙 | 偷竊 `steal`、偷襲 `attack`、蒙混過關 `bluff`、威嚇 `intimidate` |
| 奴隸 | 刻印 `marking`、請求主人同意出城 `master_permit`、請求主人讓你出門 `master_leave`、回應主人 `master_event`、談判解除契約 `negotiate`、逃離主人 `escape`、回到主人身邊 `master_return`、投靠新主人 `seek_master`、解除印記 `unmark` |
| 工作 | 工作 `work`、娼館消費 `patron` |
| 工藝 | 委託打造 `craft`、親手製作 `make`、依配方製作 `produce`、自創配方 `invent` |
| 特質 | 受訓 `train`、爭取特質 `perk_pitch`（見 [PERKS](PERKS.md) 第 4 節） |
| 地標 | 探索 `explore`（見 [LANDMARKS](LANDMARKS.md) 第 5 節） |
| 其他 | 特殊任務的判定 `story`、戰敗後的處境 `defeat_event` |

各行動的參考 DC 寫在各系統的文件裡。自由行動的參考 DC 是 12（有對象時 + 2 × 生命層級差 − ⌊親密度／25⌋）。

自由行動最多可以選 3 個對象（`actions.json` 的 `max_targets`）：第一位是主要對象（`target`），其他是同行的對象（`with`）。每個人都要在身邊；參考 DC 取最難的那位，每多一人 +1（`extra_target_dc`）；擲兩次取高的優勢要每個人都是主角的奴隸，主人在其中就扣服從懲罰。每個人都可以有親密度變化（AI 判定時每人各自的上限；依規則判定時每人照成功程度 ±0～4），AI 會看到每個人的資料、關係、記憶與戒備。入隊（`join`）、換主人（`change_master`）、解除契約（`release`）只認主要對象。

## 3. 規則判定

AI 關閉時（也是給 AI 的參考結果，`actions.json` 的 `degrees`）：

| 結果 | 條件 |
|---|---|
| 大成功 | 自然 20，或總值 ≥ DC + 10 |
| 成功 | 總值 ≥ DC |
| 部分成功 | 總值 ≥ DC − 3 |
| 大失敗 | 自然 1，或總值 ≤ DC − 10 |
| 失敗 | 其餘 |

主角對自己的奴隸做主動行動時有優勢（擲兩次 d20 取高，報告與判定資料都標示兩個骰值）。

## 4. AI 效果的上限

`actions.json` 的 `caps`（每次行動）：親密度每人 ±8、聲望 ±2、金錢每級 30 白鸛、經驗每級 15、物品每種 1 個（同一次有付錢買的，每種最多 5 個；最多 2 種）、旗標 3 個、生命值每人最多失去 30%／回復 20% 最大生命值（不會因此倒下）、認識新的人親密度 ±10。被動事件與委託則可以直接用 [EFFECTS](EFFECTS.md) 的 `hp`、`slot`、`hit_dice` 增減資源。

花費與給出的東西合計不超過持有的（同一次判定分好幾筆也一樣；先賺到的錢可以接著花）。聲望只認得 `geography.json` 裡的勢力（id 或名稱，判定提示詞會列出 id），其他名字略過。AI 提議的金錢或物品數量被截掉時，報告的 `narration.focus` 會寫出實際結算的數字，讓寫手照著寫。

自由行動的 `join` 效果（行動的主要對象入隊）另外要符合邀請的所有條件、檢定總值達到邀請的 DC，見 [COMPANIONS](COMPANIONS.md) 2.5 節；不符合時不採用，原因寫進結果。

行動的機制已經結算金錢（工資、消費、雇用費……）而 AI 的 effects 也有金錢時，以 AI 的金額為準、取代機制那筆，不會兩筆都算；金額和機制不同時，摘要會寫出兩者。誓約印記刺上或洗掉後會重算生命上限。

## 5. 搭配能力與資源

主動行動（自由行動、談判、身為奴隸時的談判與逃離……）可以選一位隊員「搭配」使用一項能力，例如用魅惑術幫談判：

| 能力 | 花費（擲骰前就扣除，判定失敗也不退回） | 檢定加值 |
|---|---|---|
| 法術 | 一個該環以上的法術環（用最低的） | +2 + 環數（最多 +6） |
| 每次休息限用的技能 | 一次使用次數 | +3 |
| 一般技能 | 不花資源 | +2 |
| 戲法 | 不花資源 | +1 |

花掉的資源記在報告的 `changes.resources`；AI 會看到用了什麼能力，並自行判斷它有沒有幫助。

## 6. 報告

自由行動與工藝（`free`、`craft`、`make`、`produce`、`invent`）的報告類型是 `action`，其他主動行動是 `social`（`actions.ts`）；兩者的記憶規則不同，見 [RELATIONSHIP_MEMORY](RELATIONSHIP_MEMORY.md) 第 2 節。
