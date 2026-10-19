# ElondiaRPG — 埃隆迪亞大陸

以 UI 操作數值、行動與戰鬥的奇幻 RPG。每次行動、事件或戰鬥結束後，遊戲引擎輸出一份結構化報告，再交給 AI 寫成事件的詳細經過。

![埃隆迪亞大陸地圖](assets/map/elondia-map.webp)

## 目前內容

| 路徑 | 說明 |
|---|---|
| [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md) | 遊戲設計草案：架構、遊戲迴圈、系統對照、AI 敘事管線、待決定事項 |
| [`docs/WORLD_NOTES.md`](docs/WORLD_NOTES.md) | 世界書與地圖之間的不一致與缺漏 |
| [`schemas/report.schema.json`](schemas/report.schema.json) | 事件報告格式（JSON Schema） |
| [`examples/reports/`](examples/reports/) | 範例報告：戰鬥、旅行 |
| [`data/world/geography.json`](data/world/geography.json) | 區域、勢力、地點、路線天數 |
| [`data/rules/progression.json`](data/rules/progression.json) | 等級、生命層級、技能品質、公會階級、職業、種族、親密值 |
| [`data/rules/economy.json`](data/rules/economy.json) | 貨幣、任務報酬、食宿、交通、服務價格（以銅幣計） |
| [`data/worldbook/elondia.worldbook.json`](data/worldbook/elondia.worldbook.json) | 原始世界書（SillyTavern 格式） |

尚未選定技術棧，見設計文件第 7 節。
