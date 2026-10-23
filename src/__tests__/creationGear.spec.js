import { describe, expect, it } from 'vitest';
import { creationCost, creationGear, creationSlots, gearRules, startingGear } from '@/engine/gear';
import { pcOf } from '@/engine/party';
import { newGame } from '@/engine/state';
const game = (opts = {}) => newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 4, birthplace: 'rhineburg', ...opts });
describe('creation gear slots', () => {
    it('lists the class template slots from its lists, and every other slot as optional', () => {
        const slots = creationSlots('fighter');
        const main = slots.find((s) => s.slot === 'main_hand');
        expect(main).toEqual({ slot: 'main_hand', template: true, bases: gearRules.classes.fighter.main });
        expect(slots.find((s) => s.slot === 'head')).toMatchObject({ template: false });
        expect(slots.find((s) => s.slot === 'piercing_1').bases).toContain('earring_hawk');
        // 武僧沒有主手清單，也不能拿副手
        const monk = creationSlots('monk').map((s) => s.slot);
        expect(monk).not.toContain('main_hand');
        expect(monk).not.toContain('off_hand');
    });
    it('keeps armour pieces no heavier than the class wears', () => {
        const head = (cls) => creationSlots(cls).find((s) => s.slot === 'head').bases;
        expect(head('fighter')).toEqual(expect.arrayContaining(['helm', 'leather_cap', 'hood']));
        expect(head('rogue')).not.toContain('helm');
        expect(head('wizard')).toEqual(['hood']);
    });
});
describe('creation gear budget', () => {
    it('costs one point per tier above the free template, and the tier for extra gear', () => {
        expect(creationCost('fighter', {})).toBe(0);
        expect(creationCost('fighter', { main_hand: { base: 'warhammer', tier: 1 } })).toBe(0);
        expect(creationCost('fighter', { main_hand: { base: 'longsword', tier: 3 }, head: { base: 'helm', tier: 1 } })).toBe(3);
    });
    it('swaps template bases for free and fills the rest from the class start', () => {
        const gear = creationGear('fighter', { main_hand: { base: 'mace', tier: 1 } }, 0);
        expect(gear.main_hand.spec).toEqual({ base: 'mace', material: 'iron' });
        expect(gear.off_hand.spec.base).toBe('shield');
        expect(gear.body.spec.base).toBe('chain');
        expect(Object.keys(creationGear('fighter', {}, 0)).sort()).toEqual(Object.keys(startingGear('fighter')).sort());
    });
    it('adds extra pieces and better materials within the budget', () => {
        const gear = creationGear('fighter', { body: { base: 'plate', tier: 2 }, ring_1: { base: 'ring_guard', tier: 2 } }, 3);
        expect(gear.body.spec).toEqual({ base: 'plate', material: 'steel' });
        expect(gear.ring_1.spec).toEqual({ base: 'ring_guard', material: 'silver' });
        expect(() => creationGear('fighter', { body: { base: 'plate', tier: 3 }, ring_1: { base: 'ring_guard', tier: 2 } }, 3)).toThrow('預算不夠');
    });
    it('rejects bases outside the lists, tiers above the cap and blocked slots', () => {
        expect(() => creationGear('fighter', { main_hand: { base: 'longbow', tier: 1 } }, 9)).toThrow('不能選');
        expect(() => creationGear('wizard', { head: { base: 'helm', tier: 1 } }, 9)).toThrow('不能選');
        expect(() => creationGear('fighter', { main_hand: { base: 'longsword', tier: gearRules.creation.max_tier + 1 } }, 20)).toThrow('最多到第');
        expect(() => creationGear('monk', { main_hand: { base: 'dagger', tier: 1 } }, 9)).toThrow('不能選');
    });
    it('drops the off hand under a two-handed weapon, without charging for it', () => {
        const barb = creationSlots('barbarian').map((s) => s.slot);
        expect(barb).not.toContain('off_hand');
        const druid = creationGear('druid', { main_hand: { base: 'spellstaff', tier: 2 } }, 1);
        expect(druid.main_hand.spec).toEqual({ base: 'spellstaff', material: 'yew' });
        expect(druid.off_hand).toBeUndefined();
    });
});
describe('new game with chosen gear', () => {
    it('equips the choice and updates the weapon and armour', () => {
        const pc = pcOf(game({ gear: { main_hand: { base: 'warhammer', tier: 2 }, body: { base: 'plate', tier: 1 }, feet: { base: 'boots', tier: 1 } }, gearBudget: 3 }));
        expect(pc.gear.main_hand.spec).toEqual({ base: 'warhammer', material: 'steel' });
        expect(pc.gear.feet.spec.base).toBe('boots');
        expect(pc.armor).toBe(gearRules.bases.plate.armor);
        expect(pc.weapon).toBe(gearRules.bases.warhammer.weapon);
    });
    it('uses the default budget when none is given, and keeps the class start without a choice', () => {
        expect(() => game({ gear: { head: { base: 'helm', tier: 3 }, feet: { base: 'boots', tier: 1 } } })).toThrow('預算不夠');
        expect(pcOf(game()).gear).toEqual(startingGear('fighter'));
    });
});
