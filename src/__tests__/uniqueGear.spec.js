import { describe, expect, it } from 'vitest';
import { itemDef, itemRules } from '@/engine/data';
import { gearRules, gearSummary, sanitizeGearSpec } from '@/engine/gear';
import { enterLocation } from '@/engine/grid';
import { equipItem } from '@/engine/inventory';
import { sanitizeItem } from '@/engine/mods';
import { checkModifiers } from '@/engine/perks';
import { addItem, newGame } from '@/engine/state';
import { applyAiDeals, shopState } from '@/engine/trade';
const uniques = () => itemRules.items.filter((i) => i.gear?.unique);
describe('unique gear', () => {
    it('has a dozen unique items, all low to mid level, each with one check bonus', () => {
        expect(uniques().length).toBeGreaterThanOrEqual(12);
        for (const i of uniques()) {
            expect(gearRules.materials[i.gear.material].tier, i.name).toBeLessThanOrEqual(3);
            expect(i.gear.unique.bonus).toBeGreaterThanOrEqual(1);
            expect(gearSummary(i.gear), i.name).toContain('獨特：');
        }
    });
    it('cannot be bought: no shop lists them and AI deals cannot sell them', () => {
        const state = newGame({ name: '艾倫', race: 'human', classId: 'rogue', seed: 2 });
        enterLocation(state);
        const names = new Set(uniques().map((i) => i.name));
        for (const type of ['general', 'smithy', 'tailor', 'jeweler', 'magic', 'tavern']) {
            expect(shopState(state, type).deals.some((d) => names.has(d.title)), type).toBe(false);
        }
        const added = applyAiDeals(state, 'general', { deals: [{ title: '好東西', gives: [{ type: 'money', amount: 999 }], gets: [{ type: 'item', name: '盜賊公會的舊手套' }], stock: 1 }] });
        expect(added).toBe(0);
    });
    it('only comes from chests or special events, never from crafting or AI gear', () => {
        const inChests = new Set(Object.values(gearRules.chests).flatMap((c) => (c.items ?? []).map(([n]) => n)));
        for (const i of uniques())
            expect(inChests.has(i.name), i.name).toBe(true);
        // AI 給的裝備（打造、事件、商店特製）整理之後沒有獨特加值
        const spec = sanitizeGearSpec({ base: 'bracers', material: 'leather', unique: { check: { contexts: ['lock'] }, bonus: 3 } }, { maxLevel: 20 });
        expect(spec.unique).toBeUndefined();
    });
    it('adds its check bonus, and several stack with each other and with perks', () => {
        const state = newGame({ name: '艾倫', race: 'human', classId: 'rogue', seed: 2, perks: ['light_fingers'] });
        addItem(state.inventory, '盜賊公會的舊手套', 1);
        equipItem(state, '盜賊公會的舊手套', 'pc');
        const pc = state.party[0];
        const mods = checkModifiers(pc, { context: 'lock', attr: 'dex' });
        expect(mods).toContainEqual({ label: '獨特裝備【盜賊公會的舊手套】', value: 2 });
        expect(mods).toContainEqual({ label: '特質【妙手空空】', value: 2 });
        // 兩件都對城門盤查有效：疊加
        addItem(state.inventory, '走私客的腳鍊', 1);
        equipItem(state, '走私客的腳鍊', 'pc');
        pc.gear.piercing_1 = { name: '測試耳環', spec: { base: 'earring_hawk', material: 'copper', unique: { check: { contexts: ['gate'] }, bonus: 1 } } };
        const gate = checkModifiers(pc, { context: 'gate', attr: 'cha' }).filter((m) => m.label.startsWith('獨特裝備'));
        expect(gate.reduce((s, m) => s + m.value, 0)).toBe(3);
        // 不適用的檢定沒有加值
        expect(checkModifiers(pc, { context: 'travel', attr: 'str' }).some((m) => m.label.startsWith('獨特裝備'))).toBe(false);
    });
    it('can be authored in the content editor, held to one check of +1 to +3', () => {
        const out = sanitizeItem('自訂獨特', { category: 'equipment', price_cc: 10, tags: [], gear: { base: 'boots', material: 'leather', unique: { check: { contexts: ['stealth', 'nope'] }, bonus: 9 } } }, true);
        expect(out.gear.unique).toEqual({ check: { contexts: ['stealth'] }, bonus: 3 });
        expect(itemDef('夜行者的軟靴').gear.unique).toEqual({ check: { contexts: ['stealth'] }, bonus: 2 });
    });
});
