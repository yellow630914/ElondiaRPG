# UI 改版實作計畫（v2）

視覺方向見樣稿 `docs/mockups/ui-v2.html`：HD-2D 風，深色皮革底、金色雕花框、羊皮紙對話框、像素圖示與地圖格。
素材管線見 `tools/pixel/README.md`，立繪規格見 `docs/comfy/portrait-spec.md`。

分 8 個階段，每個階段各自 commit、跑型別檢查與測試、截圖確認後再進下一階段。
**P0～P2、P4 不依賴美術素材，可以馬上開始**；P3、P5、P6 要等 ComfyUI 的素材。

---

## P0 設計系統（純前端）

| 檔案 | 內容 |
|---|---|
| `src/style.css` | 顏色 token（皮革、金、羊皮紙、墨色、稀有度色）、字級（xs～xl）、`.frame` 金框、`.parchment` 羊皮紙、按鈕／Chip／條的樣式 |
| `index.html` | 載入 Noto Serif TC（內文）、霞鶩文楷 TC（敘事正文），沒網路時退回系統字型 |
| `src/components/ui/Hint.vue` | 「?」說明：滑鼠移上去或點擊時顯示羊皮紙小框，取代各處的整段說明與原生 `title` |
| `src/components/ui/GameIcon.vue` | 介面圖示（Pixelarticons，MIT），用 SVG sprite；取代介面上的 emoji |
| `src/components/ui/Chip.vue`、`StatGrid.vue` | 標籤與 key-value 表格 |
| `src/components/AppDialog.vue` | 改成羊皮紙樣式；加 `tabs` 插槽供分頁對話框使用 |
| `data/credits.json`＋`src/components/CreditsDialog.vue` | 素材授權清單；首頁底部「素材授權與致謝」打開 |

內容資料裡的 emoji（種族、職業、標籤、商店的 `emoji` 欄位）**保留**：自訂世界會用到，介面上有對應圖示時用圖示，沒有時退回 emoji。

## P1 版面

| 檔案 | 內容 |
|---|---|
| `src/App.vue` | 頂部改 HUD（時間、地點、金錢）與圖示按鈕列；隊伍／行囊／關係／筆記／工藝改成日誌上方的工具列（戰鬥時也在） |
| `src/components/PartyStrip.vue`（新） | 地圖下方的迷你隊伍卡：頭像、名字、HP、狀態，4 個快捷鈕直接開角色詳情的對應分頁 |
| `src/components/RestPanel.vue` | 說明改 Hint；生命骰縮成一行 Chip；短休、長休並排；長休互動預設收起 |
| `src/components/ActionPanel.vue` | 說明改 Hint；對象與能力同一排；文字框 1 行、輸入時長高 |
| `src/components/LogView.vue`、`ReportCard.vue` | 依類型加色條與圖示；擲骰結果用 d20＋修正值 Chip；敘事放羊皮紙；重寫經過、複製提示詞、報告 JSON 收進「⋯」；tokens 用量縮成一個 Chip |
| `src/components/PeoplePanel.vue` | 名單列加頭像（P6 之前用名字首字印章）；常用互動放第一排，獻媚／偷竊／偷襲收進「⋯」 |
| `src/components/PlacePanel.vue` | 「啟程旅行」改成表格，地下城層級用色塊；完整清單移到世界地圖對話框 |
| `src/components/AreaMap.vue` | 地圖格改像素圖塊（程式生成，見下方問題 1）；有人的格子用「人形圖示＋人數」徽章，顏色表示身分 |

## P2 隊伍對話框

| 檔案 | 內容 |
|---|---|
| `src/components/party/PartyCards.vue`（新，取代 `PartyView.vue` 的第一層） | 角色卡：形象圖、HP／EXP、五屬性方塊、行動點、法術環、施法屬性；特質／裝備／刺青／能力／設定各一行加「詳情 ›」；升級時卡片頂端出現提醒條 |
| `src/components/party/CharacterDialog.vue`（新） | 分頁對話框：屬性與戰鬥／特質／裝備／刺青／角色設定／能力，頂部切換角色 |
| `src/components/party/PaperDoll.vue`（新） | 紙娃娃：14 個欄位排在人形剪影兩側；點欄位列出行囊中能裝的物品並比較數值；穿脫用現有的 `game.equipItem`／`unequipItem`，不改遊戲邏輯 |
| `src/components/party/TattooMap.vue`（新） | 刺青部位圖：沿用剪影（正面／背面），在部位上打點 |

請離隊伍、離隊方式、契約、升級選能力都保留，搬到對應的分頁或卡片上。

## P3 物品圖示（改資料與邏輯）

| 檔案 | 內容 |
|---|---|
| `src/assets/icons/*.png` | 挑好的 32×32 圖示（`process.py --export` 的輸出） |
| `data/rules/items.json` | 材料新增 `kind`（草藥、礦石、毛皮、骨牙…約 27 種，先依名稱關鍵字自動分類，再人工抽查）；任何物品可加選填的 `icon` |
| `data/rules/gear.json` | 每種底材加 `icon`（例如 `longsword` → `gear_longsword`，四種戒指共用 `gear_ring`）；材質加換色用的 4 階色 |
| `src/engine/icons.ts`（新） | `itemIcon(state, name)`：物品的 `icon` → 裝備底材＋材質換色 → 材料 `kind` → 消耗品等依名稱規則 → 分類預設 |
| `src/components/ui/ItemIcon.vue`（新） | 顯示圖示；需要換色時用 canvas 把 ramp 的 4 階換成材質色，結果快取 |
| `src/components/items/itemInfo.ts`、`InventoryView.vue`、`ShopDialog.vue` 等 | 改用 `ItemIcon`，取代 `CATEGORY_ICON` 的 emoji |
| `src/narrator/judge.ts` | AI 自創物品的提示詞附上可用的圖示代號，讓 AI 回傳 `icon` |
| `src/components/content/ItemEditor.vue`、`GearEditor.vue` | 圖示選擇器 |
| `src/engine/types.ts` | `customItems` 加選填 `icon`（舊存檔沒有就走預設，不需要遷移） |

## P4 店名與描述（改資料與邏輯）

| 檔案 | 內容 |
|---|---|
| `data/rules/shops.json` | 新增 `naming`：各地區的字庫與店名格式（例如中央平原偏聖環教廷風、北境偏粗獷） |
| `data/world/geography.json` | 地點可選填 `shops: { tavern: { name, desc } }` 手寫覆寫（先寫王都與主要城市） |
| `src/engine/shopNames.ts`（新） | `shopTitle(state, shopId)`：手寫覆寫 → AI 潤飾結果 → 依地點 ID 當種子的規則生成（同一間店每次都一樣） |
| `src/engine/trade.ts` | 商店狀態加 `title`、`desc`、`greeting`；報告的場景名稱改用店名 |
| `src/narrator/judge.ts`（`buildShopPrompt`）、`src/stores/game.ts`（`flavorShop`） | AI 生成交易清單時順便回傳店名、一句描述、老闆的招呼語（每間店只生成一次，存進存檔） |
| `src/components/PlacePanel.vue`、`ShopDialog.vue` | 顯示店名與描述 |

存檔新增的都是選填欄位，舊存檔讀進來時用規則生成補上，不需要遷移。

## P5 建築選單

| 檔案 | 內容 |
|---|---|
| `src/components/place/BuildingPanel.vue`（新） | 場景橫幅＋店名＋老闆招呼語＋功能選單；選單項目打開對應的羊皮紙對話框 |
| `src/components/TavernPanel.vue` | 拆成用餐、招募（候選冒險者卡片）、等待組隊、邀請熟人、黑市五個子畫面 |
| 公會、商店、神殿 | 套用同一個 BuildingPanel |
| `src/assets/scenes/*.png` | 9 種店型的場景圖（ComfyUI），沒有圖時用金框色塊 |

招募候選人和右側「這裡的人」的雇用合併成同一個元件。

## P6 模組化像素立繪（改資料與邏輯）—— 擱置

先不做。沒有玩家生成的形象圖時，頭像維持顯示名字首字印章（`src/components/ui/Avatar.vue`）。下面是原本的規劃，留著備查。

| 檔案 | 內容 |
|---|---|
| `src/engine/traits.ts`、`npcs.ts` | `rollLook` 已經抽出各部件（`detail.parts`、`features`），改成存進 NPC 的 `look`（`body`、`parts`、`features`、`outfit`） |
| `src/engine/types.ts` | `NpcRecord`、`Character` 加 `look` |
| `data/world/portrait_parts.json`（新） | 關鍵字 → 圖層的對照表（髮型、髮色、眼型、臉部小部件、種族部件、服裝、膚色） |
| `src/engine/portrait.ts`（新） | 由 `look` 算出圖層清單與調色盤 |
| `src/components/ui/PixelPortrait.vue`（新） | canvas 疊圖、換色、加白色外描邊，結果快取 |
| `src/components/PortraitBox.vue` | 顯示順序：玩家生成的形象圖 → 像素立繪 → 名字首字印章 |
| `src/components/NewGameView.vue` | 捏臉面板：選身形、髮型、髮色、眼型、瞳色、膚色、臉部小部件，即時預覽；外貌文字由選擇自動產生，可以再補寫 |
| `data/world/npcs.json` | 具名 NPC 從外貌文字的關鍵字解析出 `look`，必要時手動補 |
| `src/engine/state.ts` | 存檔格式 +1：舊存檔的 NPC 沒有 `look` 時，從外貌文字解析關鍵字，解析不到的部位用 ID 當種子補 |

## P7 全介面掃過

戰鬥畫面、筆記、關係、行囊、商店對話框、開新遊戲、存讀檔、設定等，逐一套用設計系統，把剩下的整段說明改成 Hint。「提示詞」「世界」分頁只套顏色，不重新設計。

---

## 測試

- 新增單元測試：`itemIcon` 的查找順序、材料 `kind` 的自動分類、`shopTitle` 的三層與穩定性、`look` 的儲存與舊存檔遷移、立繪的關鍵字對照。
- 每個階段跑 `pnpm type-check` 和 `pnpm test:unit`，並用 Playwright 截圖比對樣稿。

## 需要決定的問題

1. **地圖格**：先用程式生成的像素圖塊（樣稿那種），之後再考慮用 ComfyUI 生成一套 tileset？
2. **字型**：從 Google Fonts 載入，沒網路時退回系統字型。中文字型自己打包會有 10MB 以上，不建議。
3. **順序**：先做 P0＋P1，做完截圖給你看，再繼續 P2？
