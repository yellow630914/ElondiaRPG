// homes.ts 先載入（在 masterHome.ts 之前）也不會碰到還沒初始化的變數
import { homeById } from '@/engine/homes';
import { describe, expect, it } from 'vitest';
import { enterLocation } from '@/engine/grid';
import { newGame } from '@/engine/state';
describe('module load order', () => {
    it('works when homes.ts is the first engine module loaded', () => {
        const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 1, birthplace: 'rhineburg' });
        enterLocation(state);
        expect(homeById(state, 'nope')).toBeUndefined();
    });
});
