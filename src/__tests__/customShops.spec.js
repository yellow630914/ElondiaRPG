import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { perkDef, shopRules, workRules } from '@/engine/data';
import { craftKindsHere } from '@/engine/craft';
import { blockKeys, CELL_ICON, cellName, currentCell, enterLocation, getArea, settlementArea, standOn } from '@/engine/grid';
import { applyContent, emptyMods, newNpc, normalizeMods } from '@/engine/mods';
import { npcSpot } from '@/engine/npcs';
import { builtinCells, computePlacements, newShop, sanitizeShopMod } from '@/engine/shopMods';
import { newGame } from '@/engine/state';
import { keeperFor, shopState, shopTypeForCell } from '@/engine/trade';
import { jobHere } from '@/engine/work';
import { useContent } from '@/stores/content';
import { editableWorld } from './testWorld';
beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
});
afterEach(() => applyContent(emptyMods()));
const game = () => {
    const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 3, birthplace: 'rhineburg' });
    enterLocation(state);
    return state;
};
/** 萊茵堡第一個區塊的空地（道路），跳過前幾格 */
function floor(skip = 0, loc = 'rhineburg') {
    const area = settlementArea(blockKeys(loc)[0], false);
    const cells = area.cells.map((c, i) => ({ c, i })).filter((x) => x.c.kind === 'floor');
    const i = cells[skip].i;
    return { area: area.key, x: i % area.width, y: Math.floor(i / area.width) };
}
const ID = 'shop_test1';
const kindAt = (r) => {
    const a = settlementArea(r.area);
    return a.cells[r.y * a.width + r.x].kind;
};
describe('custom shops', () => {
    it('are placed on the map and work like a shop: deals, work, crafting, keeper', () => {
        const spot = floor(3);
        const m = sanitizeShopMod(ID, {
            ...newShop(), name: '藥草小鋪', emoji: '🌱', catalog: 'temple', fixed: [{ item: '黑麵包', stock: 4 }],
            work: { attr: 'int', dc: 13, rate_cc: 5, desc: '整理藥草' }, craft: ['cloth', 'bogus'], places: [spot, spot],
        });
        expect(m).toMatchObject({ custom: true, name: '藥草小鋪', catalog: 'temple', craft: ['cloth'], places: [spot] });
        applyContent(normalizeMods({ ...emptyMods(), shops: { [ID]: m } }));
        expect(shopRules.types[ID]).toMatchObject({ name: '藥草小鋪', cell: ID, custom: true });
        expect(CELL_ICON[ID]).toBe('🌱');
        expect(cellName(ID)).toBe('藥草小鋪');
        expect(kindAt(spot)).toBe(ID);
        const state = game();
        expect(standOn(state, ID)).toBe(true);
        expect(currentCell(state).kind).toBe(ID);
        expect(shopTypeForCell(ID)).toBe(ID);
        const deals = shopState(state, ID).deals;
        expect(deals.find((d) => d.id === 'item:黑麵包')?.stock).toBe(4);
        expect(deals.length).toBeGreaterThan(1);
        expect(jobHere(state)).toMatchObject({ attr: 'int', dc: 13, rate_cc: 5, name: '藥草小鋪幫工' });
        expect(craftKindsHere(state)).toEqual(['cloth']);
        const keeper = keeperFor(state, ID);
        expect(keeper).toBe(`keeper_rhineburg_${ID}`);
        expect(npcSpot({ id: keeper })).toBe(ID);
        applyContent(emptyMods());
        expect(shopRules.types[ID]).toBeUndefined();
        expect(workRules.jobs[ID]).toBeUndefined();
        expect(kindAt(spot)).toBe('floor');
    });
    it('only sell the fixed list when no catalog is picked', () => {
        applyContent(normalizeMods({ ...emptyMods(), shops: { [ID]: { ...newShop(), catalog: '', fixed: [{ item: '黑麵包', stock: 2 }], places: [floor(3)] } } }));
        const state = game();
        standOn(state, ID);
        expect(shopState(state, ID).deals.map((d) => d.id)).toEqual(['item:黑麵包']);
    });
    it('can be deleted only when no fixed NPC keeps it, and leave the perks they trained', () => {
        const c = editableWorld();
        c.saveShop(ID, { ...newShop(), places: [floor(3)] });
        c.setShopTraining(ID, ['artisan']);
        expect(perkDef('artisan').train.cells).toContain(ID);
        c.saveNpc('mod_npc_k', { ...newNpc('mod_npc_k'), location: 'rhineburg', keeper: ID });
        expect(() => c.deleteShop(ID)).toThrow('擔任店主');
        c.deleteNpc('mod_npc_k');
        c.deleteShop(ID);
        expect(shopRules.types[ID]).toBeUndefined();
        expect(perkDef('artisan').train.cells).not.toContain(ID);
        expect(useContent().mods.perks.artisan).toBeUndefined();
        expect(() => c.deleteShop('smithy')).toThrow('內建');
    });
});
describe('moving built-in shops', () => {
    it('moves the shop to an empty cell of the same settlement, and refuses walls and other settlements', () => {
        const from = builtinCells('smithy').find((r) => r.area.startsWith('rhineburg/'));
        const to = floor(5);
        const m = sanitizeShopMod('smithy', { moves: [{ from, to }, { from, to: floor(0, 'soriel') }] });
        expect(m.moves).toEqual([{ from, to }]);
        applyContent(normalizeMods({ ...emptyMods(), shops: { smithy: m } }));
        expect(kindAt(from)).toBe('floor');
        expect(kindAt(to)).toBe('smithy');
        // 舊存檔：地圖即時建立，所以照樣看得到
        const state = game();
        expect(getArea(state, to.area).cells[to.y * getArea(state, to.area).width + to.x].kind).toBe('smithy');
        applyContent(emptyMods());
        expect(kindAt(from)).toBe('smithy');
        // 搬到牆上：擺不上去，留在原地；內容頁籤存的時候直接擋下
        const area = settlementArea(from.area, false);
        const wall = area.cells.findIndex((c) => c.kind === 'wall');
        const bad = { area: from.area, x: wall % area.width, y: Math.floor(wall / area.width) };
        const r = computePlacements({ smithy: { moves: [{ from, to: bad }] } });
        expect(r.rejected[0]).toMatchObject({ shop: 'smithy', reason: '那一格不是空地（道路）' });
        expect(r.overrides).toEqual({});
        const c = editableWorld();
        expect(() => c.saveShop('smithy', { moves: [{ from, to: bad }] })).toThrow('擺不上去');
        // 自建的店不能擺在別的店移過去的格子
        c.saveShop('smithy', { moves: [{ from, to }] });
        expect(() => c.saveShop(ID, { ...newShop(), places: [to] })).toThrow('擺不上去');
        c.restoreShop('smithy');
        expect(kindAt(from)).toBe('smithy');
    });
});
