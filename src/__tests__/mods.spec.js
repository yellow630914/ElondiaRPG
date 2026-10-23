import { afterEach, describe, expect, it } from 'vitest';
import { editableWorld } from './testWorld';
import { finishCombat, startCombat } from '@/engine/combat';
import { dungeonEncounters, enemies, equipment, itemDef, itemRules, wildEncounters } from '@/engine/data';
import { gearRules, gearStats } from '@/engine/gear';
import { applyContent, builtinEnemy, emptyMods, itemSources, newBase, newEnemy, newMaterial, normalizeMods, placementsOf, sanitizeEnemy, sanitizeItem, } from '@/engine/mods';
import { newGame } from '@/engine/state';
afterEach(() => {
    applyContent(emptyMods());
});
function mods(patch) {
    return normalizeMods({ ...emptyMods(), ...patch });
}
describe('custom monsters', () => {
    it('adds a monster with skills, loot and placements, and removes it again', () => {
        const m = newEnemy('mod_enemy_x');
        m.name = '泥沼巨蛙';
        m.abilities = ['venom_bite', 'fireball', 'nonsense'];
        m.loot = [{ item: '藥草', chance: 1, qty: 2 }];
        m.spawns = [{ table: 'wild:central', count: 2, weight: 3 }, { table: 'boss:snake_creek:shallow', count: 1 }];
        const before = wildEncounters('central').length;
        applyContent(mods({ enemies: { mod_enemy_x: m } }));
        expect(enemies.mod_enemy_x.name).toBe('泥沼巨蛙');
        // 怪物沒有法術環：法術與不存在的能力會被拿掉
        expect(enemies.mod_enemy_x.abilities).toEqual(['venom_bite']);
        expect(wildEncounters('central').length).toBe(before + 3);
        expect(dungeonEncounters.snake_creek.bosses.shallow).toEqual([['mod_enemy_x', 1]]);
        expect(placementsOf('mod_enemy_x').map((p) => p.key)).toEqual(['wild:central', 'boss:snake_creek:shallow']);
        const state = newGame({ name: '測試者', race: 'human', classId: 'fighter', seed: 1 });
        startCombat(state, [['mod_enemy_x', 1]]);
        for (const c of state.combat.combatants)
            if (c.side === 'enemy')
                c.hp = 0;
        state.combat.status = 'victory';
        expect(finishCombat(state).changes.items_gained).toContainEqual({ name: '藥草', qty: 2, owner: 'pc' });
        applyContent(emptyMods());
        expect(enemies.mod_enemy_x).toBeUndefined();
        expect(wildEncounters('central').length).toBe(before);
        expect(dungeonEncounters.snake_creek.bosses.shallow[0][0]).toBe('smuggler_boss');
    });
    it('edits a built-in monster and can take it out of a table without emptying it', () => {
        const goblin = { ...enemies.goblin, hp: 99, exclude: ['wild:central'] };
        applyContent(mods({ enemies: { goblin } }));
        expect(enemies.goblin.hp).toBe(99);
        expect(wildEncounters('central').some((g) => g.some(([id]) => id === 'goblin'))).toBe(false);
        applyContent(emptyMods());
        expect(enemies.goblin.hp).toBe(builtinEnemy('goblin').hp);
    });
    it('clamps numbers and drops unknown references', () => {
        const e = sanitizeEnemy('x', { name: '', level: 999, hp: -5, weapon: { dice: 'abc', type: 'nope', attr: 'str' }, resist: { fire: -5, bogus: 1 } }, true);
        expect(e).toMatchObject({ name: '未命名的怪物', level: 30, hp: 1, weapon: { dice: '1d6', type: 'slashing' }, resist: { fire: -1 }, custom: true });
    });
    it('keeps HP gates only for skills the monster has, clamped to 1-99', () => {
        const e = sanitizeEnemy('x', { abilities: ['rend', 'charge'], ability_hp_below: { rend: 150, charge: 30, venom_bite: 40 } }, true);
        expect(e.ability_hp_below).toEqual({ rend: 99, charge: 30 });
        expect(sanitizeEnemy('x', { abilities: ['rend'], ability_hp_below: { venom_bite: 40 } }, true).ability_hp_below).toBeUndefined();
    });
});
describe('custom items and gear', () => {
    it('adds an item sold in shops, dropped by a monster, found in chests and given by events', () => {
        const it = sanitizeItem('月光果', { category: 'consumable', price_cc: 80, tags: ['general'], use: { heal: '2d6' }, event: true, chests: { deep: 0.5 }, gather: ['wild'] }, true);
        const wolf = { ...enemies.wolf, loot: [...(enemies.wolf.loot ?? []), { item: '月光果', chance: 0.3 }] };
        applyContent(mods({ items: { 月光果: it }, enemies: { wolf } }));
        expect(itemDef('月光果')).toMatchObject({ price_cc: 80, use: { heal: '2d6' }, event: true });
        const src = itemSources('月光果');
        expect(src.drops).toEqual([{ enemy: 'wolf', chance: 0.3, qty: 1 }]);
        expect(src.chests).toEqual({ deep: 0.5 });
        expect(src.gather).toEqual(['wild']);
        applyContent(emptyMods());
        expect(itemDef('月光果')).toBeUndefined();
        expect(itemSources('月光果').chests).toEqual({});
    });
    it('edits a built-in item without renaming it', () => {
        applyContent(mods({ items: { 乾糧: sanitizeItem('乾糧', { ...itemDef('乾糧'), price_cc: 7 }, false) } }));
        expect(itemDef('乾糧').price_cc).toBe(7);
        expect(itemRules.items.filter((i) => i.name === '乾糧')).toHaveLength(1);
    });
    it('generates standard gear for a custom base and material, and edits built-in weapon damage', () => {
        const b = { ...newBase(), name: '太刀', weaponDef: { name: '太刀', dice: '1d10', type: 'slashing', attr: 'dex' } };
        const m = { ...newMaterial(), name: '玉鋼', kind: 'metal' };
        const longsword = { ...gearRules.bases.longsword, weaponDef: { ...equipment.weapons.longsword, dice: '1d12' } };
        applyContent(mods({ bases: { mod_base_t: b, longsword }, materials: { mod_mat_y: m } }));
        expect(itemDef('鐵太刀')?.gear).toEqual({ base: 'mod_base_t', material: 'iron' });
        expect(itemDef('玉鋼太刀')).toBeDefined();
        expect(itemDef('玉鋼長劍')).toBeDefined();
        expect(equipment.weapons[gearStats({ base: 'mod_base_t', material: 'iron' }).weapon].dice).toBe('1d10');
        expect(equipment.weapons.longsword.dice).toBe('1d12');
        applyContent(emptyMods());
        expect(itemDef('鐵太刀')).toBeUndefined();
        expect(equipment.weapons.longsword.dice).toBe('1d8');
    });
});
describe('content store', () => {
    it('applies right away, protects built-ins and keeps references on rename', async () => {
        const { createPinia, setActivePinia } = await import('pinia');
        localStorage.clear();
        setActivePinia(createPinia());
        const c = editableWorld();
        c.saveEnemy('goblin', { ...enemies.goblin, hp: 77 });
        expect(enemies.goblin.hp).toBe(77);
        c.restoreEnemy('goblin');
        expect(enemies.goblin.hp).toBe(builtinEnemy('goblin').hp);
        expect(() => c.deleteEnemy('goblin')).toThrow('不能刪除');
        expect(() => c.deleteItem('乾糧')).toThrow('不能刪除');
        c.saveItem('星露', { category: 'material', price_cc: 5, tags: [], custom: true });
        c.setItemDrops('星露', [{ enemy: 'wolf', chance: 0.4, qty: 1 }]);
        expect(enemies.wolf.loot).toContainEqual({ item: '星露', chance: 0.4 });
        c.saveItem('星露', { ...itemDef('星露') }, '星之露');
        expect(itemDef('星露')).toBeUndefined();
        expect(enemies.wolf.loot).toContainEqual({ item: '星之露', chance: 0.4 });
        expect(() => c.saveItem('乾糧', { category: 'food', price_cc: 1, tags: [], custom: true })).toThrow('已經有');
        expect(() => c.saveItem('新東西', { category: 'food', price_cc: 1, tags: [], custom: true }, '乾糧')).toThrow('已經有');
        c.deleteItem('星之露');
        expect(enemies.wolf.loot?.some((l) => l.item === '星之露')).toBe(false);
        const saved = JSON.parse(localStorage.getItem('elondia.worlds'));
        expect(saved.worlds.find((w) => w.id === saved.active).mods.items['星之露']).toBeUndefined();
        c.resetAll();
    });
});
describe('content filters', () => {
    it('indexes where monsters appear and how items are obtained', async () => {
        const { enemyPlaceIndex, itemSourceIndex } = await import('@/engine/mods');
        const places = enemyPlaceIndex();
        expect(places.get('wolf')?.has('wild:north')).toBe(true);
        expect(places.get('smuggler_boss')?.has('dungeon:snake_creek')).toBe(true);
        const sources = itemSourceIndex();
        expect(sources.get('藥草')?.has('gather:wild')).toBe(true);
        expect(sources.get('狼皮')?.has('drop')).toBe(true);
        expect(sources.get('鐵礦石')?.has('gather:dungeon')).toBe(true);
        expect([...sources.values()].every((s) => s.size > 0)).toBe(true);
    });
});
