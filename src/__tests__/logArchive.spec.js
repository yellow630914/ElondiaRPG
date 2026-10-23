import { describe, expect, it } from 'vitest';
import { newGame } from '@/engine/state';
import { ARCHIVE_BATCH, ARCHIVE_USAGE, archiveOldReports, mergeUsage } from '@/stores/logArchive';
function game(n) {
    const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 3, birthplace: 'soriel' });
    state.reports = Array.from({ length: n }, (_, i) => ({
        schema_version: '0.1', report_id: `r${i}`, kind: i % 2 ? 'trade' : 'event',
        time: { start: { day: 1 + i, hour: 8, minute: 0 }, end: { day: 1 + i, hour: 9, minute: 0 } },
        location: { at: 'soriel', region: 'x', scene: `場景 ${i}` },
        party: [{ id: 'pc', name: '艾倫' }], outcome: { result: 'success', summary: `第 ${i} 件事` }, changes: { money_cc: 1 },
    }));
    return state;
}
const total = (usage) => Object.values(usage).reduce((t, e) => t + e.input + e.output, 0);
const part = (feature, input, output) => ({ feature, source: '來源 1', provider: 'anthropic', model: 'm', input, output, calls: 1 });
describe('archiving old log entries', () => {
    it('waits until the log is a whole batch over the limit', () => {
        const state = game(100 + ARCHIVE_BATCH - 1);
        expect(archiveOldReports(state, 100, {}, {})).toBe(0);
        expect(state.reports).toHaveLength(100 + ARCHIVE_BATCH - 1);
        expect(state.logArchive).toBeUndefined();
    });
    it('keeps the newest reports and turns older ones into short entries with their story', () => {
        const state = game(100 + ARCHIVE_BATCH);
        const narrations = {
            r0: { text: '很久以前的故事', status: 'done' },
            r2: { text: '', status: 'done', placeholder: true, judgeThinking: '…' },
            [`r${100 + ARCHIVE_BATCH - 1}`]: { text: '最新的故事', status: 'done' },
        };
        const usage = {
            r0: { input: 100, output: 50, calls: 2, by: [part('narration', 60, 40), part('judge', 40, 10)] },
            r1: { input: 30, output: 5, calls: 1 },
            _other: { input: 7, output: 3, calls: 1 },
        };
        const before = total(usage);
        expect(archiveOldReports(state, 100, narrations, usage)).toBe(ARCHIVE_BATCH);
        expect(state.reports).toHaveLength(100);
        expect(state.reports[0].report_id).toBe(`r${ARCHIVE_BATCH}`);
        expect(state.logArchive).toHaveLength(ARCHIVE_BATCH);
        expect(state.logArchive[0]).toEqual({ id: 'r0', kind: 'event', time: { day: 1, hour: 8, minute: 0 }, scene: '場景 0', summary: '第 0 件事', story: '很久以前的故事', tokens: 150 });
        // 只有判定思考、還沒有敘事的：不留經過
        expect(state.logArchive[2].story).toBeUndefined();
        // 敘事與每則的用量拿掉，用量併進封存的合計，本局的合計不變
        expect(narrations.r0).toBeUndefined();
        expect(narrations[`r${100 + ARCHIVE_BATCH - 1}`]?.text).toBe('最新的故事');
        expect(usage.r0).toBeUndefined();
        expect(usage[ARCHIVE_USAGE]).toMatchObject({ input: 130, output: 55, calls: 3 });
        expect(usage._other).toEqual({ input: 7, output: 3, calls: 1 });
        expect(total(usage)).toBe(before);
        // 依來源分開的明細也留著（舊紀錄沒有明細的歸在「未記錄來源」）
        expect(usage[ARCHIVE_USAGE].by).toEqual([
            part('narration', 60, 40), part('judge', 40, 10),
            { feature: 'narration', source: '', provider: '', model: '', input: 30, output: 5, calls: 1 },
        ]);
    });
    it('adds to the archive on later passes', () => {
        const state = game(100 + ARCHIVE_BATCH);
        const usage = { r0: { input: 1, output: 1, calls: 1 } };
        archiveOldReports(state, 100, {}, usage);
        state.reports.push(...game(ARCHIVE_BATCH).reports.map((r, i) => ({ ...r, report_id: `n${i}` })));
        usage[`r${ARCHIVE_BATCH}`] = { input: 2, output: 2, calls: 1 };
        archiveOldReports(state, 100, {}, usage);
        expect(state.logArchive).toHaveLength(ARCHIVE_BATCH * 2);
        expect(usage[ARCHIVE_USAGE]).toMatchObject({ input: 3, output: 3, calls: 2 });
    });
    it('merges cached input counts', () => {
        const into = { input: 0, output: 0, calls: 0 };
        mergeUsage(into, { input: 10, output: 2, calls: 1, cached: 6, by: [{ ...part('narration', 10, 2), cached: 6 }] });
        expect(into.cached).toBe(6);
        expect(into.by[0].cached).toBe(6);
    });
});
