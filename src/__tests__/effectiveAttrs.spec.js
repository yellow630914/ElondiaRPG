import { afterEach, describe, expect, it } from 'vitest';
import { prepareAction } from '@/engine/actions';
import { addAttrProvider, apMaxFor, attrOf, attrSources, attrsOf, maxHpFor, mod, recalc, slotsLeft, spendAttrPoint } from '@/engine/character';
import { startCombat } from '@/engine/combat';
import { attributeRules } from '@/engine/data';
import { enterLocation } from '@/engine/grid';
import { pcOf } from '@/engine/party';
import { newGame } from '@/engine/state';
const game = (classId = 'fighter') => {
    const state = newGame({ name: '艾倫', race: 'human', classId, seed: 4, birthplace: 'rhineburg' });
    enterLocation(state);
    return state;
};
let removers = [];
afterEach(() => {
    removers.forEach((r) => r());
    removers = [];
});
/** 只對主角生效的測試來源 */
const oath = (attrs) => removers.push(addAttrProvider((c) => (c.isPlayer ? [{ label: '測試誓約', attrs }] : [])));
describe('effective attributes', () => {
    it('equal the base attributes when nothing changes them', () => {
        const pc = pcOf(game());
        expect(attrsOf(pc)).toEqual(pc.attrs);
        expect(attrSources(pc)).toEqual([]);
    });
    it('add every source on top of the base, without touching it', () => {
        const pc = pcOf(game());
        const base = { ...pc.attrs };
        oath({ str: 3, int: -2, dex: -1 });
        expect(attrsOf(pc)).toEqual({ ...base, str: base.str + 3, int: base.int - 2, dex: base.dex - 1 });
        expect(attrOf(pc, 'str')).toBe(base.str + 3);
        expect(pc.attrs).toEqual(base);
        expect(attrSources(pc)).toEqual([{ label: '測試誓約', attrs: { str: 3, int: -2, dex: -1 } }]);
        // 移除來源就回到原本，不用扣回去
        removers.pop()();
        expect(attrsOf(pc)).toEqual(base);
    });
    it('stay inside the score range', () => {
        const pc = pcOf(game());
        oath({ str: 99, cha: -99 });
        expect(attrOf(pc, 'str')).toBe(attributeRules.score.max);
        expect(attrOf(pc, 'cha')).toBe(attributeRules.score.min);
    });
    it('drive hit points, action points and spell slots', () => {
        const pc = pcOf(game('cleric'));
        const slots = slotsLeft(pc);
        oath({ str: 4, fai: 4, int: 4, dex: 4, cha: 4 });
        recalc(pc);
        expect(pc.maxHp).toBe(maxHpFor(pc.level, attrsOf(pc)));
        expect(pc.maxHp).toBeGreaterThan(maxHpFor(pc.level, pc.attrs));
        expect(apMaxFor(pc.level, attrsOf(pc))).toBeGreaterThanOrEqual(apMaxFor(pc.level, pc.attrs));
        expect(slotsLeft(pc)[0]).toBeGreaterThanOrEqual(slots[0]);
    });
    it('are what checks and combat read', () => {
        const state = game();
        const pc = pcOf(state);
        oath({ cha: 4 });
        const p = prepareAction(state, { kind: 'free', text: '向路人打聽消息' });
        expect(p.modifiers.cha - p.modifiers.str).toBe(mod(pc.attrs.cha + 4) - mod(pc.attrs.str));
        const combat = startCombat(state, [['goblin', 1]]);
        expect(combat.combatants.find((x) => x.id === pc.id).attrs.cha).toBe(pc.attrs.cha + 4);
    });
    it('leave level-up points on the base attributes and their cap', () => {
        const pc = pcOf(game());
        oath({ str: 3 });
        pc.attrPoints = 1;
        pc.attrs.str = attributeRules.score.max - 1;
        spendAttrPoint(pc, 'str');
        expect(pc.attrs.str).toBe(attributeRules.score.max);
        expect(attrOf(pc, 'str')).toBe(attributeRules.score.max);
    });
});
