import { afterEach, describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020';
import schema from '../../schemas/report.schema.json';
import { prepareAction } from '@/engine/actions';
import { startCombat } from '@/engine/combat';
import { blockedMove, currentArea, currentCell, enterLocation, moveTo, pickLock, sight, standOn } from '@/engine/grid';
import { mod, proficiency } from '@/engine/character';
import { checkBonus, checkModifiers } from '@/engine/perks';
import { withBonus } from '@/engine/rng';
import { useItem } from '@/engine/inventory';
import { eatMeal, mealMenu } from '@/engine/meals';
import { applyContent, emptyMods, normalizeMods, sanitizeItem } from '@/engine/mods';
import { longRest } from '@/engine/rest';
import { addItem, newGame } from '@/engine/state';
import { bestTool, toolBonus } from '@/engine/tools';
import { inventoryLines } from '@/narrator/judge';
const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
const valid = (r) => expect(validate(r), JSON.stringify(validate.errors)).toBe(true);
afterEach(() => applyContent(emptyMods()));
function game() {
    const state = newGame({ name: '測試者', race: 'human', classId: 'fighter', seed: 9, birthplace: 'soriel' });
    enterLocation(state);
    state.money_cc = 5000;
    return state;
}
const pc = (state) => state.party.find((m) => m.isPlayer);
/** 進地下城，把主角旁邊的一格改成指定的內容，再走上去 */
function stepOntoDungeonCell(state, cell) {
    state.location = 'whisper_crypt';
    enterLocation(state);
    const area = currentArea(state);
    const p = state.position;
    const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dy]) => {
        const c = area.cells[(p.y + dy) * area.width + p.x + dx];
        return p.x + dx >= 0 && p.y + dy >= 0 && p.x + dx < area.width && p.y + dy < area.height && c && c.kind !== 'wall' && c.kind !== 'water';
    });
    const i = (p.y + dy) * area.width + p.x + dx;
    area.cells[i] = cell;
    return { area, i, result: moveTo(state, p.x + dx, p.y + dy) };
}
describe('food and drink', () => {
    it('keeps the best meal until the next long rest and carries temp HP into combat', () => {
        const state = game();
        addItem(state.inventory, '黑麵包', 2);
        addItem(state.inventory, '燉肉套餐', 1);
        valid(useItem(state, '乾糧', 'pc'));
        expect(pc(state).status).toContain('fed_light');
        // 同一等級（或更差）的不會再吃
        expect(() => useItem(state, '黑麵包', 'pc')).toThrow('吃得比這更好');
        valid(useItem(state, '燉肉套餐', 'pc'));
        expect(pc(state).status).toContain('fed_well');
        expect(pc(state).status).not.toContain('fed_light');
        startCombat(state, [['giant_rat', 1]]);
        expect(state.combat.combatants.find((c) => c.id === pc(state).id).tempHp).toBe(6);
        delete state.combat;
        standOn(state, 'inn');
        longRest(state, 'inn');
        expect(pc(state).status).not.toContain('fed_well');
    });
    it('cheers you up for charisma checks, then makes you tipsy', () => {
        const state = game();
        addItem(state.inventory, '麥酒', 2);
        useItem(state, '麥酒', 'pc');
        expect(pc(state).status).toContain('cheered');
        const p = prepareAction(state, { kind: 'free', text: '向路人搭話' });
        expect(p.attr).toBe('cha');
        expect(p.situational).toContainEqual({ label: '興致高昂（魅力）', value: 1 });
        delete state.pendingAction;
        useItem(state, '麥酒', 'pc');
        expect(pc(state).status).toContain('tipsy');
        expect(pc(state).status).not.toContain('cheered');
        startCombat(state, [['giant_rat', 1]]);
        expect(state.combat.combatants.find((c) => c.id === pc(state).id).baseMods.hit).toBe(-1);
    });
    it('feeds the whole party at the tavern', () => {
        const state = game();
        expect(() => eatMeal(state, 'tavern_stew_set')).toThrow('酒館');
        standOn(state, 'tavern');
        const menu = mealMenu(state);
        expect(menu.find((m) => m.id === 'noble_restaurant')?.unavailable).toBeUndefined();
        const meal = menu.find((m) => m.id === 'tavern_stew_set');
        const money = state.money_cc;
        const r = eatMeal(state, 'tavern_stew_set');
        valid(r);
        expect(state.money_cc).toBe(money - meal.total);
        expect(state.party.every((m) => m.status.includes('fed_well'))).toBe(true);
        expect(() => eatMeal(state, 'black_bread')).toThrow('吃得比這更好');
        // 小地方沒有貴族宴席
        state.location = 'rivervale';
        enterLocation(state);
        expect(mealMenu(state).find((m) => m.id === 'noble_restaurant')?.unavailable).toBeDefined();
    });
});
describe('tool templates', () => {
    it('uses the best tool of each kind', () => {
        const state = game();
        addItem(state.inventory, '偏遠地區簡易地圖', 1);
        addItem(state.inventory, '指南針', 1);
        expect(bestTool(state, 'travel')).toEqual({ name: '指南針', bonus: 2 });
        expect(toolBonus(state, 'lockpick')).toBe(0);
    });
    it('lights up more of a dungeon', () => {
        const state = game();
        state.location = 'whisper_crypt';
        enterLocation(state);
        // 周邊白天有光：1 格；淺層一片漆黑：沒有光源只看得到腳下
        expect(sight(state, currentArea(state))).toBe(1);
        const dark = { ...currentArea(state), layer: 1, lighting: undefined };
        expect(sight(state, dark)).toBe(0);
        addItem(state.inventory, '火把（10 根）', 1);
        expect(sight(state, dark)).toBe(2);
        addItem(state.inventory, '魔法照明石', 1);
        expect(sight(state, dark)).toBe(3);
    });
    it('adds proficiency to spotting traps and picking locks', () => {
        const state = game();
        const me = pc(state);
        me.level = 9;
        const trap = stepOntoDungeonCell(state, { kind: 'trap' }).result.report;
        expect(trap.timeline[0].roll.dice).toBe(withBonus('1d20', mod(me.attrs.dex) + proficiency(9) + checkBonus(me, { context: 'trap', attr: 'dex' })));
        const s2 = game();
        pc(s2).level = 9;
        stepOntoDungeonCell(s2, { kind: 'chest', level: 1, lock: 30 });
        for (const m of ['dex', 'str', 'int']) {
            const r = pickLock(s2, m);
            const extra = checkModifiers(pc(s2), { context: 'lock', attr: m }).reduce((s, x) => s + x.value, 0);
            expect(r.timeline[0].roll.dice, m).toBe(withBonus('1d20', mod(pc(s2).attrs[m]) + proficiency(9) + extra));
            if (!currentCell(s2).lock)
                break;
        }
    });
    it('adds the trap pole to spotting traps', () => {
        const state = game();
        addItem(state.inventory, '探路長竿', 1);
        const { result } = stepOntoDungeonCell(state, { kind: 'trap' });
        valid(result.report);
        expect(result.report.timeline[0].action).toContain('探路長竿 +2');
    });
    it('opens a locked chest by picking, forcing or working out the lock', () => {
        const state = game();
        addItem(state.inventory, '撬鎖工具組', 1);
        const { area, i, result } = stepOntoDungeonCell(state, { kind: 'chest', level: 1, lock: 1 });
        // 走上去不會自動開：等玩家選方式
        expect(result.report).toBeUndefined();
        let r = pickLock(state, 'dex');
        valid(r);
        expect(r.timeline[0].action).toContain('靈巧檢定・開鎖（撬鎖工具組 +3）');
        // 擲出 1 才會失敗：換力量、智力再試到成功
        for (let n = 0; n < 6 && !area.cells[i].done; n++)
            r = pickLock(state, n % 2 ? 'int' : 'str');
        expect(r.timeline[0].action).toMatch(/靈巧檢定・開鎖|力量檢定・硬撬|智力檢定・研究機關/);
        expect(area.cells[i].done).toBe(true);
        expect(area.cells[i].lock).toBeUndefined();
        expect(r.outcome.tags).toContain('上鎖');
        expect(() => pickLock(state, 'str')).toThrow('沒有上鎖');
    });
    it('forces a lock with strength, without the lockpick bonus', () => {
        const state = game();
        addItem(state.inventory, '撬鎖工具組', 1);
        const { area, i } = stepOntoDungeonCell(state, { kind: 'chest', level: 1, lock: 30 });
        const r = pickLock(state, 'str');
        valid(r);
        expect(r.timeline[0].action).toBe('力量檢定・硬撬');
        // 擲出 20 也會打開：重新放一個上鎖的寶箱再用智力
        area.cells[i] = { kind: 'chest', level: 1, lock: 30 };
        const r2 = pickLock(state, 'int');
        expect(r2.timeline[0].action).toBe('智力檢定・研究機關');
    });
    it('hones a weapon without using up the whetstone', () => {
        const state = game();
        addItem(state.inventory, '磨刀石', 1);
        useItem(state, '磨刀石', 'pc');
        expect(pc(state).status).toContain('honed');
        expect(state.inventory.find((i) => i.name === '磨刀石')?.qty).toBe(1);
        expect(() => useItem(state, '磨刀石', 'pc')).toThrow('磨利');
        startCombat(state, [['giant_rat', 1]]);
        expect(state.combat.combatants.find((c) => c.id === pc(state).id).baseMods.damage ?? 0).toBeGreaterThanOrEqual(1);
    });
    it('keeps templates on custom clutter and shows the inventory to the AI judge', () => {
        const lamp = sanitizeItem('長明燈籠', { category: 'gear', price_cc: 80, tags: ['general'], tool: { kind: 'light', bonus: 5 } }, true);
        expect(lamp.tool).toEqual({ kind: 'light', bonus: 2 });
        expect(sanitizeItem('麵包', { category: 'food', price_cc: 1, tags: [], tool: { kind: 'light' } }, true).tool).toBeUndefined();
        applyContent(normalizeMods({ ...emptyMods(), items: { 長明燈籠: lamp } }));
        const state = game();
        addItem(state.inventory, '撬鎖工具組', 1);
        addItem(state.inventory, '麻繩（50 呎）', 1);
        addItem(state.inventory, '長明燈籠', 1);
        expect(bestTool(state, 'light')).toEqual({ name: '長明燈籠', bonus: 2 });
        const text = inventoryLines(state);
        expect(text).toContain('撬鎖工具組×1（雜物；開鎖類：打開上鎖寶箱的檢定 +3');
        expect(text).toContain('麻繩（50 呎）×1（雜物）');
    });
    it('bumps into walls without an error', () => {
        const state = game();
        const area = currentArea(state);
        const p = state.position;
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        const wall = dirs.find(([dx, dy]) => {
            const x = p.x + dx;
            const y = p.y + dy;
            return x < 0 || y < 0 || x >= area.width || y >= area.height || ['wall', 'water'].includes(area.cells[y * area.width + x].kind);
        });
        if (wall)
            expect(blockedMove(state, wall[0], wall[1])).toBe('那邊走不過去');
        const open = dirs.find(([dx, dy]) => !blockedMove(state, dx, dy));
        expect(open).toBeDefined();
    });
});
