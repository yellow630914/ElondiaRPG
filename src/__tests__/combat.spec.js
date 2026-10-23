import { describe, expect, it } from 'vitest';
import { abilityApCost, act, combatant, currentActor, defenseMult, startCombat, unusableReason, wantsToFlee, } from '@/engine/combat';
import { apMaxFor, apRegenFor, baseAttrs, createPlayer, luckyThreshold, maxHpFor, slotMaxFor, evadeFloor, learnable, } from '@/engine/character';
import { abilities, ATTR_IDS, classes, combatClasses, damageTypes, enemies, statuses, dungeonEncounters, weaponDef, armorDef, } from '@/engine/data';
import { newGame } from '@/engine/state';
function stateWith(classId, level = 1, seed = 1) {
    const state = newGame({ name: '測試者', race: 'human', classId, seed });
    const pc = state.party[0];
    pc.level = level;
    pc.maxHp = maxHpFor(level, pc.attrs);
    pc.hp = pc.maxHp;
    return state;
}
/** 把目前行動者換成指定的隊員（測試用：不必等先攻順序） */
function makeCurrent(state, id) {
    const combat = state.combat;
    combat.turn = combat.order.indexOf(id);
    return combatant(combat, id);
}
describe('data integrity', () => {
    const typeIds = new Set(damageTypes.types.map((t) => t.id));
    it('references only existing statuses, damage types and classes', () => {
        for (const a of Object.values(abilities)) {
            for (const ap of a.apply ?? [])
                expect(statuses[ap.status], `${a.id} → ${ap.status}`).toBeDefined();
            for (const d of a.damage ?? [])
                if (d.type)
                    expect(typeIds.has(d.type), `${a.id} → ${d.type}`).toBe(true);
            for (const c of a.classes)
                expect(c === 'monster' || !!classes[c], `${a.id} → ${c}`).toBe(true);
            if (a.type === 'spell')
                expect(a.circle, a.id).toBeGreaterThanOrEqual(1);
            if (a.type === 'skill' && !a.classes.includes('monster'))
                expect(a.unlock, a.id).toBeGreaterThanOrEqual(1);
        }
        for (const s of Object.values(statuses)) {
            if (s.dot)
                expect(typeIds.has(s.dot.type)).toBe(true);
            if (s.pulse)
                expect(typeIds.has(s.pulse.type)).toBe(true);
            if (s.on_hit?.status)
                expect(statuses[s.on_hit.status]).toBeDefined();
        }
    });
    it('gives every class valid starting gear and abilities', () => {
        for (const [id, cls] of Object.entries(combatClasses)) {
            expect([...cls.priority].sort()).toEqual([...ATTR_IDS].sort());
            expect(weaponDef(cls.weapon).name).not.toBe('徒手');
            expect(armorDef(cls.armor)).toBeDefined();
            for (const a of cls.start)
                expect(abilities[a]?.classes, `${id} → ${a}`).toContain(id);
        }
    });
    it('references existing enemies in encounter tables', () => {
        for (const table of Object.values(dungeonEncounters)) {
            for (const group of [...table.outskirts, ...table.shallow, ...table.middle, ...table.deep, table.boss]) {
                for (const [id] of group)
                    expect(enemies[id], id).toBeDefined();
            }
        }
        for (const e of Object.values(enemies))
            for (const a of e.abilities ?? [])
                expect(abilities[a]?.classes).toContain('monster');
    });
});
describe('resources', () => {
    it('derives HP from level, STR and FAI', () => {
        const attrs = { str: 16, dex: 10, int: 10, fai: 14, cha: 10 };
        // 8 + 1 × (4 + 3 + 2)
        expect(maxHpFor(1, attrs)).toBe(17);
        expect(maxHpFor(5, attrs)).toBe(53);
        // 低力量低信仰每級仍至少 1
        expect(maxHpFor(3, { ...attrs, str: 1, fai: 1 })).toBe(11);
    });
    it('derives AP from level, DEX and CHA', () => {
        expect(apMaxFor(1, { str: 10, dex: 16, int: 10, fai: 10, cha: 14 })).toBe(5);
        expect(apMaxFor(10, { str: 10, dex: 16, int: 10, fai: 10, cha: 14 })).toBe(7);
        expect(apMaxFor(1, { str: 10, dex: 6, int: 10, fai: 10, cha: 6 })).toBe(3);
        expect(apRegenFor(1)).toBe(2);
        expect(apRegenFor(12)).toBe(4);
    });
    it('uses the slot table aligned with the worldbook and adds INT/FAI bonus slots', () => {
        const plain = { str: 10, dex: 10, int: 10, fai: 10, cha: 10 };
        expect(slotMaxFor('wizard', 1, plain)).toEqual([2]);
        expect(slotMaxFor('wizard', 5, plain)).toEqual([4, 3, 2]);
        expect(slotMaxFor('wizard', 10, plain)).toEqual([4, 3, 3, 3, 1]);
        expect(slotMaxFor('wizard', 20, plain)).toEqual([4, 3, 3, 3, 3, 2, 2, 1, 1]);
        // 半施法者以 ceil(等級/2) 查表、最高 5 環
        expect(slotMaxFor('paladin', 1, plain)).toEqual([2]);
        expect(slotMaxFor('paladin', 20, plain)).toEqual([4, 3, 3, 3, 1]);
        expect(slotMaxFor('fighter', 20, plain)).toEqual([]);
        // mod(智力) + mod(信仰) = 3 + 2 = 5：1 環 +1、2 環 +1
        expect(slotMaxFor('wizard', 3, { ...plain, int: 16, fai: 14 })).toEqual([5, 3]);
    });
    it('lowers the lucky-strike threshold with DEX and CHA, and raises the evade floor with DEX', () => {
        expect(luckyThreshold({ str: 10, dex: 10, int: 10, fai: 10, cha: 10 })).toBe(20);
        expect(luckyThreshold({ str: 10, dex: 18, int: 10, fai: 10, cha: 14 })).toBe(18);
        expect(luckyThreshold({ str: 10, dex: 30, int: 10, fai: 10, cha: 30 })).toBe(16);
        expect(luckyThreshold({ str: 10, dex: 18, int: 10, fai: 10, cha: 14 }, 3)).toBe(15);
        expect(evadeFloor({ str: 10, dex: 18, int: 10, fai: 10, cha: 10 })).toBe(5);
    });
    it('builds attributes from the class priority plus racial bonus', () => {
        expect(baseAttrs('wizard', 'elf')).toEqual({ int: 16, dex: 16, fai: 13, cha: 12, str: 10 });
        const pc = createPlayer('a', 'dwarf', 'fighter', { str: 5, dex: 1 });
        // 力量 15 + 2（矮人）+ 1（自由點數受上限 18 限制）
        expect(pc.attrs.str).toBe(18);
        expect(pc.attrs.dex).toBe(15);
    });
});
describe('combat rules', () => {
    it('lets a layer boss be controlled for one turn at most, then shrugs off control until it has acted', () => {
        const state = stateWith('fighter', 20, 5);
        startCombat(state, [['crypt_general', 1], ['goblin', 1]]);
        const combat = state.combat;
        const boss = combat.combatants.find((c) => c.defId === 'crypt_general');
        const goblin = combat.combatants.find((c) => c.defId === 'goblin');
        expect(boss.boss).toBe(true);
        expect(goblin.boss).toBeUndefined();
        boss.hp = boss.maxHp = 5000;
        boss.attrs.str = 1;
        boss.weapon = { ...boss.weapon, dice: '1d1' };
        const pc = makeCurrent(state, 'pc');
        pc.abilities.push('shield_bash');
        let stuns = 0;
        let resisted = 0;
        for (let i = 0; i < 12 && combat.status === 'ongoing'; i++) {
            makeCurrent(state, 'pc').ap = 30;
            const before = combat.timeline.length;
            act(state, { type: 'ability', ability: 'shield_bash', target: boss.id });
            for (const t of combat.timeline.slice(before)) {
                for (const e of t.effects ?? []) {
                    if (e.target !== boss.id)
                        continue;
                    if (e.type === 'status_add')
                        stuns++;
                    if (e.type === 'note' && e.text?.includes('層主抵抗了控制'))
                        resisted++;
                }
            }
            const stun = boss.statuses.find((x) => x.id === 'stunned');
            if (stun)
                expect(stun.turns).toBe(1);
        }
        // 主角的回合沒結束，層主一直沒行動：只會被暈一次，之後的都被抵抗
        expect(stuns).toBe(1);
        expect(resisted).toBeGreaterThan(0);
    });
    it('never lets a layer boss flee', () => {
        const state = stateWith('fighter', 5);
        startCombat(state, [['crypt_general', 1], ['goblin', 1]]);
        for (const c of state.combat.combatants.filter((x) => x.side === 'enemy')) {
            c.ai = { flee_below: 0.9 };
            c.hp = 1;
        }
        const [boss, goblin] = ['crypt_general', 'goblin'].map((id) => state.combat.combatants.find((c) => c.defId === id));
        expect(wantsToFlee(boss)).toBe(false);
        expect(wantsToFlee(goblin)).toBe(true);
    });
    it('applies damage-type affinities: skeletons resist piercing but are weak to bludgeoning', () => {
        const state = stateWith('fighter');
        state.location = 'whisper_crypt';
        startCombat(state, [['skeleton', 1]]);
        const skeleton = state.combat.combatants.find((c) => c.side === 'enemy');
        expect(defenseMult(skeleton, 'piercing')).toBe(0.5);
        expect(defenseMult(skeleton, 'bludgeoning')).toBe(1.5);
        expect(defenseMult(skeleton, 'poison')).toBe(0);
        expect(defenseMult(skeleton, 'fire')).toBe(1);
    });
    it('spends AP on attacks and slots on spells, and limits cantrips to once per turn', () => {
        const state = stateWith('wizard');
        startCombat(state, [['giant_rat', 3]]);
        const pc = makeCurrent(state, 'pc');
        pc.ap = 10;
        const rat = state.combat.combatants.find((c) => c.side === 'enemy' && c.hp > 0);
        act(state, { type: 'ability', ability: 'fire_bolt', target: rat.id });
        expect(pc.ap).toBe(10);
        expect(unusableReason(state.combat, pc, 'ray_of_frost')).toBe('本回合已用過戲法');
        const slotsBefore = pc.slots[0];
        act(state, { type: 'ability', ability: 'magic_missile' });
        if (state.combat.status === 'ongoing') {
            expect(pc.slots[0]).toBe(slotsBefore - 1);
            expect(pc.ap).toBe(10 - abilityApCost(abilities.magic_missile));
        }
    });
    it('always hits a stunned target', () => {
        const state = stateWith('fighter');
        startCombat(state, [['goblin', 1]]);
        const goblin = state.combat.combatants.find((c) => c.side === 'enemy');
        goblin.hp = 999;
        goblin.maxHp = 999;
        const pc = makeCurrent(state, 'pc');
        for (let i = 0; i < 20; i++) {
            goblin.statuses = [{ id: 'stunned', turns: 5, source: 'pc' }];
            pc.ap = 10;
            makeCurrent(state, 'pc');
            act(state, { type: 'attack', target: goblin.id });
            const entry = state.combat.timeline.filter((t) => t.actor === 'pc').at(-1);
            expect(['success', 'critical', 'fumble']).toContain(entry.result);
            if (entry.result !== 'fumble')
                expect(entry.roll?.dc).toBe(0);
        }
    });
    it('logs the damage actually taken, after armor', () => {
        const state = stateWith('fighter');
        startCombat(state, [['goblin', 1]]);
        const goblin = state.combat.combatants.find((c) => c.side === 'enemy');
        goblin.hp = 999;
        goblin.maxHp = 999;
        goblin.armorDr = 3;
        const pc = makeCurrent(state, 'pc');
        for (let i = 0; i < 20; i++) {
            goblin.statuses = [{ id: 'stunned', turns: 5, source: 'pc' }];
            pc.ap = 10;
            makeCurrent(state, 'pc');
            const before = goblin.hp;
            act(state, { type: 'attack', target: goblin.id });
            const entry = state.combat.timeline.filter((t) => t.actor === 'pc').at(-1);
            const logged = (entry.effects ?? []).filter((e) => e.type === 'damage' && e.target === goblin.id).reduce((n, e) => n + (e.amount ?? 0), 0);
            expect(logged).toBe(before - goblin.hp);
        }
    });
    it('drops the previous concentration spell when casting a new one', () => {
        const state = stateWith('cleric', 3);
        startCombat(state, [['goblin', 2]]);
        const pc = makeCurrent(state, 'pc');
        pc.abilities.push('bless', 'bane');
        pc.ap = 20;
        act(state, { type: 'ability', ability: 'bless' });
        expect(pc.statuses.some((s) => s.id === 'blessed')).toBe(true);
        makeCurrent(state, 'pc');
        pc.ap = 20;
        act(state, { type: 'ability', ability: 'bane' });
        expect(pc.concentration).toBe('bane');
        expect(pc.statuses.some((s) => s.id === 'blessed')).toBe(false);
    });
    it('lets every ability in the data resolve without errors', () => {
        let used = 0;
        for (const a of Object.values(abilities)) {
            const classId = a.classes.find((c) => c !== 'monster') ?? 'fighter';
            const state = stateWith(classId, 20, used + 1);
            // 不用層主：層主的傷害加成可能在輪到主角之前就把人打倒
            startCombat(state, [['crypt_wight', 1], ['goblin', 2]]);
            const pc = makeCurrent(state, 'pc');
            pc.hp = Math.floor(pc.maxHp / 2);
            pc.abilities.push(a.id);
            pc.ap = 30;
            pc.slots = [9, 9, 9, 9, 9, 9, 9, 9, 9];
            pc.slotMax = [9, 9, 9, 9, 9, 9, 9, 9, 9];
            if (a.recover_slot)
                pc.slots[0] = 0;
            for (const e of state.combat.combatants)
                if (e.side === 'enemy')
                    e.hp = e.maxHp = 500;
            const reason = unusableReason(state.combat, pc, a.id);
            expect(reason, a.id).toBeNull();
            const target = a.target === 'enemy' ? state.combat.combatants.find((c) => c.side === 'enemy').id
                : a.target === 'ally' || a.target === 'ally_or_downed' ? 'pc' : undefined;
            const before = state.combat.timeline.length;
            act(state, { type: 'ability', ability: a.id, ...(target ? { target } : {}) });
            expect(state.combat.timeline.length, a.id).toBeGreaterThan(before);
            used++;
        }
        expect(used).toBe(Object.keys(abilities).length);
    });
    it('runs full fights for every class without getting stuck', () => {
        for (const classId of Object.keys(combatClasses)) {
            const state = stateWith(classId, 3, 42);
            startCombat(state, [['goblin', 2]]);
            for (let i = 0; i < 300 && state.combat.status === 'ongoing'; i++) {
                const actor = currentActor(state.combat);
                const usable = actor.abilities.filter((id) => unusableReason(state.combat, actor, id) === null);
                const foe = state.combat.combatants.find((c) => c.side === 'enemy' && c.hp > 0 && !c.fled);
                const pick = usable[i % (usable.length + 1)];
                if (pick) {
                    const a = abilities[pick];
                    const target = a.target === 'enemy' ? foe.id : a.target === 'ally' || a.target === 'ally_or_downed' ? actor.id : undefined;
                    act(state, { type: 'ability', ability: pick, ...(target ? { target } : {}) });
                }
                else if (actor.ap >= 2) {
                    act(state, { type: 'attack', target: foe.id });
                }
                else {
                    act(state, { type: 'end_turn' });
                }
            }
            expect(state.combat.status, classId).not.toBe('ongoing');
        }
    });
    it('offers only abilities within the level and quality cap', () => {
        const state = stateWith('wizard', 1);
        const options = learnable(state.party[0]);
        expect(options.every((a) => a.type !== 'spell' || (a.circle ?? 1) <= 1)).toBe(true);
        expect(options.some((a) => a.id === 'fireball')).toBe(false);
    });
});
