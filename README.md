# ElondiaRPG — 埃隆迪亞大陸

以 UI 操作數值、行動與戰鬥的奇幻 RPG 網頁遊戲。每次行動、事件或戰鬥結束後，遊戲引擎輸出一份結構化報告，再交給 AI 寫成事件的詳細經過。

![埃隆迪亞大陸地圖](assets/map/elondia-map.webp)

## 執行

需要 Node.js 22.18 以上。

```bash
npm install
npm run dev        # 開發伺服器
npm run test:unit  # 測試
npm run build      # 型別檢查 + 建置到 dist/
```

開啟後在「設定」頁選擇 AI 服務並填入自己的 API key（Anthropic、OpenAI、Google Gemini，或 OpenRouter / DeepSeek / Ollama 等 OpenAI 相容格式）。不設定 AI 也能玩，日誌會顯示引擎產生的文字戰報。

> `.npmrc` 設定了 `legacy-peer-deps`，用來避開 npm 10 在解析 vitest 選用依賴時的錯誤。

## 目前可以做什麼

- 建立角色（6 種族、10 職業），從索里耶爾出發
- 依世界書路程在地圖上移動，消耗天數、食宿與乾糧，旅途有天候檢定與事件
- 旅店休息、購買乾糧、在酒館招募 NPC 隊友（最多 4 人）
- 冒險者公會委託：F 級在城內與近郊（戰鬥、檢定、送貨），E 級以上在冒險區域
- 逐回合手動戰鬥：攻擊、技能、防禦、撤退；戰後產生戰報、分配經驗、升級三選一技能
- 每份報告都可以交給 AI 生成敘事（串流顯示），或複製提示詞自行使用
- 自動存檔在瀏覽器，可匯出 / 匯入

## 文件與資料

| 路徑 | 說明 |
|---|---|
| [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md) | 遊戲設計：架構、戰鬥與旅行規則、AI 敘事管線、待決定事項 |
| [`docs/DUNGEON_DESIGN.md`](docs/DUNGEON_DESIGN.md) | 地下城分層探索提案（周邊 → 淺層 → 中層 → 深層） |
| [`docs/WORLD_NOTES.md`](docs/WORLD_NOTES.md) | 世界書與地圖之間的不一致與缺漏 |
| [`schemas/report.schema.json`](schemas/report.schema.json) | 事件報告格式（JSON Schema） |
| [`examples/reports/`](examples/reports/) | 範例報告：戰鬥、旅行 |
| [`data/world/`](data/world/) | 區域、勢力、地點、路線天數、可招募 NPC |
| [`data/rules/`](data/rules/) | 等級、經濟、戰鬥、技能、敵人 |
| [`data/worldbook/elondia.worldbook.json`](data/worldbook/elondia.worldbook.json) | 原始世界書（SillyTavern 格式） |
