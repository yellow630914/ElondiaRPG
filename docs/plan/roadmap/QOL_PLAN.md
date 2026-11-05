# 小改進計畫：提示詞與正則、設定匯出、規則說明

> 上層：[ROADMAP](../ROADMAP.md) R17。
> 2026-11-05 依玩家回饋（Discord、[issue #62](https://github.com/yellow630914/ElondiaRPG/issues/62)）決定要做。這份計畫只寫還沒做的部分；做完的項目寫進對應的系統文件（[PROMPTS](../../PROMPTS.md)、[COMBAT_SYSTEM](../../COMBAT_SYSTEM.md)、[ACTIONS](../../ACTIONS.md)、[SAVES](../../SAVES.md)……），從這裡刪掉，最後整份刪掉並在[已完成](COMPLETED.md)記一段。

## 1. 提示詞與正則（Q1）

情況（2026-11-05，Discord）：玩家用自己的破限預設（例如「貓神」），模型會在正文裡輸出 `<think_nya>…</think_nya>` 這類思考區塊，整段原樣顯示在冒險日誌的羊皮紙框裡。

現況：

- 敘事是串流進來的，每收到一段就接到 `entry.text` 後面（`src/stores/game.ts` 的 `narrate()`、`continueNarration()`）。開了 AI 判定時，敘事在 JSON 的 `narrative` 欄位裡，走另一條路（同一檔的判定流程）。
- 程式只會濾掉兩種東西：API 欄位裡的思考內容（`thinking_delta`、`reasoning_content`、`part.thought`，見 `src/narrator/providers.ts`），以及 `<relationship_updates>`（`src/narrator/judge.ts` 的 `visibleNarration`、`splitSuggestions`）。正文裡的 `<think…>` 標籤沒有任何處理。
- 畫面用文字插值顯示（`src/components/ReportCard.vue`），所以標籤會原樣印出來。
- 沒有任何讓使用者自訂的文字過濾。

### 1.1 已決定

- 頂端頁籤「提示詞」改名為「**提示詞與正則**」（`src/App.vue` 的頁籤清單），正則放在這一頁裡，自己一個區塊或頁籤。
- 支援匯入 SillyTavern 的 regex 腳本，匯入時**轉成我們自己的格式**（1.4 節），不直接沿用酒館的格式。

### 1.2 規則格式

每一條：名稱、開關、尋找（正規表示式本體與旗標）、取代成（可用 `$1`、`$&`）、套用範圍（正文敘事、AI 判定的敘事）、順序。

- 跟著提示詞組存（`elondia.promptSets`）：切換提示詞組時正則一起換，和酒館「正則綁預設」的習慣一致；頁籤底部的「匯出、匯入全部設定」一起帶。
- **內建一條預設規則**：刪掉 `<think…>…</think…>` 與 `<thinking>…</thinking>`（不分大小寫，標籤名稱以 think 開頭的都算），預設開啟、可以關掉。
- 編輯時就檢查語法，有錯的規則標紅、不套用，不會讓整段敘事出錯。

### 1.3 套用時機與效能

正則在串流時每收到一段就跑一次會很耗效能（全部規則 × 越來越長的全文），所以分成兩段：

1. **編譯一次**：規則改動時才編譯成 `RegExp` 並快取，平常不重新編譯。
2. **串流中**：
   - 內建的思考標籤用便宜的方法處理：沿用 `visibleNarration` 隱藏半截標籤的做法，遇到還沒閉合的 `<think…>` 就把後面的文字先藏起來。
   - 使用者的規則最多每 300 毫秒套用一次，而且只套在畫面上顯示的文字，不寫回。
3. **收完整段時**：在 `splitSuggestions` 把 `<relationship_updates>` 拆出來之後，對正文套用一次全部規則，**結果寫回存檔**。之後畫面顯示、送回給 AI 的對話歷史都是處理過的文字，不再重跑。
4. AI 判定的路徑：`judgment.narrative` 存進 `narrations` 前套用一次。
5. 舊存檔已經存下的文字不自動重跑。可以考慮在正則區塊放一顆「對目前日誌重新套用」的按鈕（選做）。

### 1.4 匯入 SillyTavern 的 regex

- 接受酒館匯出的單一腳本 JSON、腳本陣列，以及預設或角色卡裡附帶的 `regex_scripts`（`TavernPresetDialog` 匯入預設時一併列出，讓玩家勾選）。
- 欄位對照：
  - `scriptName` → 名稱；`disabled` → 開關。
  - `findRegex`（`/pattern/flags` 字串）→ 拆成本體與旗標；不是斜線格式的當作純文字比對。
  - `replaceString` → 取代成；`{{match}}` 換成 `$&`。
  - `placement` 有「AI 輸出」的才匯入；只套用在使用者輸入、斜線指令等的略過。
  - `trimStrings`：轉成額外的刪除步驟。
  - `markdownOnly`、`promptOnly`、`runOnEdit`、`substituteRegex`、`minDepth`、`maxDepth` 這些我們沒有對應的功能，略過。
- 匯入後列出「轉換了幾條、略過了幾條、各自為什麼」，不默默丟掉。

## 2. 設定匯出與匯入（issue #62 第 2 條）

情況：玩家想在公司和家裡不同的電腦上接續玩。

現況：

- 存檔可以匯出、匯入（[SAVES](../../SAVES.md) 第 2 節）。
- 提示詞設定可以在提示詞頁籤匯出、匯入（[PROMPTS](../../PROMPTS.md)）。
- **設定頁的內容（AI 來源、模型、各種開關，localStorage 的 `elondia.settings`）沒有匯出的方法。**

做法：

- 設定頁加「匯出設定」「匯入設定」，一個檔案包含設定、提示詞組與正則。
- **API 金鑰預設不帶**；要帶的話另外勾選，並提醒檔案裡會有金鑰。
- 匯入前先顯示要取代的內容，並請玩家確認。

## 3. 遊戲內規則說明（issue #62 第 19、21 條）

情況：玩家不知道雇傭期限、費用怎麼結算、戰利品要不要分成，也不知道當街攻擊別人會有什麼後果。

現況：規則寫在系統文件裡（雇傭見 [COMPANIONS](../../COMPANIONS.md) 2.1 節；警戒、通緝與罰金見 [NPC_SYSTEM](../../NPC_SYSTEM.md) 第 9 節），遊戲畫面上沒有說明。

做法：

- 酒館的雇傭畫面、隊伍面板的雇傭夥伴加上 `Hint`，照**現有的規則**寫出期限、費用怎麼結算、戰利品怎麼分。
- 警戒、通緝的狀態（`GuardStatus.vue`）和偷襲、偷竊這類行動旁邊，寫出會被怎麼處罰、怎麼解除。
- 只把現有規則寫出來，不新增規則。寫的時候發現規則本身有缺漏，記到 [LOGIC_ISSUES](../LOGIC_ISSUES.md)。

## 4. 工項與順序

Q-1 首頁版本號、Q-2 骰面判定的存檔規則、Q-3 戰鬥過回合提醒已完成（2026-11-05，見[已完成](COMPLETED.md)）。

| # | 工項 | 規模 |
|---|---|---|
| Q-4 | 提示詞與正則：格式、套用、內建規則、頁籤改名（1.2、1.3 節） | 中 |
| Q-5 | 匯入 SillyTavern 的 regex（1.4 節） | 小 |
| Q-6 | 設定匯出與匯入（第 2 節） | 小 |
| Q-7 | 遊戲內規則說明（第 3 節） | 小 |
