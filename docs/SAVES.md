# 存檔

程式：`src/stores/saves.ts`（儲存位置、檔案格式）、`src/stores/game.ts`（存檔、讀檔、匯出、匯入）、`src/components/SaveDialog.vue`。

## 1. 存在哪裡

| 資料 | 位置 | 說明 |
|---|---|---|
| 進行中的遊戲 | IndexedDB `elondia` 的 `current`（`state`、`narrations`、`usage` 三筆 JSON 文字） | 每次動作後自動保存 |
| 存檔欄位（手動、快速、自動 ×3） | IndexedDB `elondia` 的 `slot_meta`、`slot_data` | 欄位存了當時的自訂內容 |
| 形象圖 | IndexedDB `elondia-portraits` | 依「種子:角色 id」保存，見 [PORTRAITS.md](PORTRAITS.md) |
| 自訂內容、模型來源、插圖設定、提示詞 | localStorage（`elondia.content`、`elondia.settings`、`elondia.image`、`elondia.prompts`） | 跟著瀏覽器走，所有存檔共用 |

瀏覽器不支援 IndexedDB 時（或打不開時）改存在 localStorage。

### 進行中的遊戲

- 以前存在 localStorage（`elondia.save`、`elondia.narrations`、`elondia.usage`，上限約 5MB，玩久了會滿）。新版啟動時（`main.ts` 的 `preloadCurrent`，掛上畫面之前）把它們搬進 IndexedDB，成功後刪掉 localStorage 的舊資料。
- 寫入是非同步的：寫到一半又有新的動作時，只保留最新的一份，這次寫完再寫（不會排一長串）。
- **寫入失敗不再默默略過**：畫面上方一直顯示「自動保存失敗」的警告（空間不足時會說明），直到下一次保存成功；這段期間關掉或重新整理頁面，瀏覽器會先詢問。警告建議先匯出存檔，或刪掉用不到的存檔欄位與形象圖。

## 2. 匯出

「💾 存讀檔」的「📤 匯出目前進度」或欄位的「匯出」。下方可以勾選要附上的東西：

- **自訂內容**（預設勾選）：整份「🛠️ 內容」的自訂資料。存檔欄位匯出的是存檔當時的內容；舊的欄位沒有記下時，用這個瀏覽器目前的內容。
  附上整份而不是只挑存檔「用到的」：自訂內容彼此串在一起（特殊任務用到固定 NPC、怪物、物品，NPC 與怪物又用到技能、裝備底材），而且存檔之後才會遇到的任務、出沒的 NPC、商店的商品也都屬於這個存檔的世界；只挑一部分很容易漏掉。自訂內容通常只有幾十 KB。
- **形象圖**（預設不勾）：這一局（種子）所有角色的圖，轉成 data URL。圖片很大，檔案會變大很多。

檔案格式（JSON）：

```json
{
  "state": { "...": "遊戲狀態" },
  "narrations": { "日誌 id": { "text": "…", "status": "done" } },
  "usage": { "日誌 id": { "input": 0, "output": 0, "calls": 0 } },
  "content": { "version": 1, "enemies": {}, "items": {}, "bases": {}, "materials": {}, "npcs": {}, "stories": {}, "abilities": {} },
  "portraits": { "pc": { "data": "data:image/png;base64,…", "prompt": "…", "service": "novelai", "time": 0 } }
}
```

`content` 與 `portraits` 都是選填的，舊版匯出的檔案照樣可以匯入。

## 3. 匯入

匯入的存檔會加到列表（手動存檔），不會直接讀取。檔案附有自訂內容或形象圖時，先顯示匯入面板：

- **合併自訂內容**（預設勾選）：
  - 這個瀏覽器沒有的項目：新增。
  - 和這個瀏覽器不同的項目：逐項勾選要不要換成存檔裡的版本，沒勾的保留自己的。
  - 相同的略過；這個瀏覽器其他的自訂內容不會變動（不是「取代全部」，那是「🛠️ 內容」頁籤的匯入）。
  - 不合併時提醒：存檔用到的自訂怪物、物品、角色或任務可能不會出現或無法使用（讀檔時的容錯見 [CONTENT_DEPENDENCIES.md](CONTENT_DEPENDENCIES.md)）。
- **還原形象圖**（預設勾選）：同一個角色已經有圖時換成檔案裡的。圖片不會留在存檔欄位裡。

## 4. 清理形象圖

刪除存檔欄位、覆寫存檔欄位（包括自動存檔輪替）、開新遊戲時，收集進行中的遊戲與所有存檔欄位的種子（舊的欄位摘要沒有種子時讀整份存檔），不屬於任何一個的形象圖刪除。讀不到存檔列表時不清理。
