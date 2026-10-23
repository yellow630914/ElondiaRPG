import { afterEach, describe, expect, it } from 'vitest';
import { dungeonDepth, dungeonEncounters, locationById } from '@/engine/data';
import { generateLayer } from '@/engine/grid';
import { layerRanks } from '@/engine/materialQuests';
import { newGame } from '@/engine/state';
import { withRng } from '@/engine/state';
const enc = dungeonEncounters.snake_creek;
const saved = { abyss: enc.abyss, bosses: { ...enc.bosses } };
afterEach(() => {
    if (saved.abyss)
        enc.abyss = saved.abyss;
    else
        delete enc.abyss;
    enc.bosses = { ...saved.bosses };
});
const layer = (n) => {
    const state = newGame({ name: 'x', race: 'human', classId: 'fighter', seed: 4 });
    return withRng(state, (rng) => generateLayer(state, locationById('snake_creek'), n, rng));
};
const bossCell = (a) => a.cells.find((c) => c.kind === 'boss');
describe('the abyss layer', () => {
    it('without abyss data, the deep layer is still the last one with the final boss', () => {
        delete enc.abyss;
        expect(dungeonDepth('snake_creek')).toBe(4);
        const deep = bossCell(layer(3));
        expect(deep.then).toBeUndefined();
    });
    it('with abyss data, the deep boss guards the stairs and the abyss holds the final boss', () => {
        enc.abyss = [[['giant_rat', 2]]];
        enc.bosses = { ...enc.bosses, abyss: [['goblin', 1]] };
        expect(dungeonDepth('snake_creek')).toBe(5);
        const deep = bossCell(layer(3));
        expect(deep.then).toBe('stairs_down');
        const abyss = layer(4);
        expect(abyss.name).toContain('底層');
        expect(bossCell(abyss)).toMatchObject({ group: [['goblin', 1]] });
        expect(bossCell(abyss).then).toBeUndefined();
        expect(abyss.cells.some((c) => c.kind === 'stairs_down')).toBe(false);
        expect(layerRanks('snake_creek').map((r) => r.layer)).toContain('abyss');
    });
});
