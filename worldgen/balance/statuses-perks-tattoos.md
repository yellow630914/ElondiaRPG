# 狀態、特質、刺青的平衡

> 欄位與寫法見 [guides/statuses-perks-tattoos](../guides/statuses-perks-tattoos.md)；規則見 [PERKS](../../docs/PERKS.md)、[TATTOOS](../../docs/TATTOOS.md)、[COMBAT_SYSTEM](../../docs/COMBAT_SYSTEM.md)。

## 1. 特質（工具會檢查）

- 強度用 `perks.ts` 的 `perkPower` 估：**不能超過內建最強（4.5）**。內建一般特質 36 個，強度 1～4.5、中位數 2.5；缺陷 12 個，約 -2.5～-3.5。
- 新特質對準 2～3；4 以上的要有取得門檻（特殊任務的獎勵、訓練要很多錢與時間）。
- 缺陷約 -3：抵銷一個一般特質。

## 2. 狀態（自己對照）

- 和同類的內建狀態比數值與持續回合（`data/rules/statuses.json`）。命中、迴避、豁免、傷害的加減一般是 ±1～3；減傷 ±1～2；持續 1～3 回合。
- 每回合的持續傷害約是同級一般攻擊的一半。
- 控制類（不能行動、不能施法）持續最多 2 回合，而且要有豁免；層主吃控制只有 1 回合（系統自動）。

## 3. 刺青與印記

- **誓約印記**：屬性有加有減、加總為 0、每項不超過上限（整理時檢查，不合的不會匯入）。
- **奴隸印記**：數值有範圍（談判、逃離 DC 5～35……，見 [guides/statuses-perks-tattoos](../guides/statuses-perks-tattoos.md)）。新的印記要放進「印記設定」才會出現在市場或刻印。
