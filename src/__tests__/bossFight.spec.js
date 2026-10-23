import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { bossFights, layerFights } from './balanceSim';
// 層主戰的完整模擬（docs/MONSTERS.md「層主戰」）。很慢，只在 FIGHT_REPORT=路徑 時跑，把結果寫成 JSON；
// FIGHT_TRIALS 是每一組的場數（預設 20），FIGHT_LEVEL 是隊伍等級和層主（或那一組怪物最高等級）的差（預設 0）；
// FIGHT_MINIONS=1 改成抽測一般遭遇（每座地下城每一層抽兩組）。
describe.skipIf(!process.env.FIGHT_REPORT)('boss fights', () => {
    it('simulates every layer boss against a party of its level', () => {
        const trials = Number(process.env.FIGHT_TRIALS ?? 20);
        const offset = Number(process.env.FIGHT_LEVEL ?? 0);
        const rows = process.env.FIGHT_MINIONS ? layerFights(trials, 2, offset) : bossFights(trials, offset);
        writeFileSync(process.env.FIGHT_REPORT, JSON.stringify(rows, null, 1));
        expect(rows.length).toBeGreaterThan(0);
    }, 3_600_000);
});
