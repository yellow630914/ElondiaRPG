import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { prepareAction, resolveAction } from '@/engine/actions';
import { offerSelf } from '@/engine/companions';
import { itemDef, shopRules, slaveryRules, stories } from '@/engine/data';
import { canStart, storyRankOk } from '@/engine/story';
import { recruit } from '@/engine/town';
import { currentArea, enterLocation, standOn } from '@/engine/grid';
import { applyContent, emptyMods, newNpc } from '@/engine/mods';
import { isFugitive, leaderOf, playerEscapes } from '@/engine/party';
import { longRest, longRestBlocked, restChecks, setLongRestGap, shortRest } from '@/engine/rest';
import { chooseMark } from '@/engine/slavery';
import { addHours, masterTake, newGame } from '@/engine/state';
import { useContent } from '@/stores/content';
import { formatMoney } from '@/engine/money';
import { buyDeal, locationMult, shopKey, shopPlace, shopState } from '@/engine/trade';
import { answerRoadEvent, enterSide, leaveSide, startJourney } from '@/engine/road';
import { allNpcs, areaOf, peopleHere } from '@/engine/population';
import { npcRecord, npcSpot } from '@/engine/npcs';
import { editableWorld } from './testWorld';
import { contractOf } from '@/engine/tattoos';
beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
});
afterEach(() => {
    applyContent(emptyMods());
    setLongRestGap(16);
});
function game(seed = 1, location = 'soriel') {
    const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed, birthplace: location });
    enterLocation(state);
    return state;
}
function blankReport(state) {
    return {
        schema_version: '0.1', report_id: `r-test-${state.nextReportNo++}`, kind: 'rest',
        time: { start: { ...state.time }, end: addHours(state.time, 8) },
        location: { at: state.location }, party: [], outcome: { result: 'success' }, changes: {},
    };
}
/** 賣掉自己、刻好印記、主人帶著走的主角（和 companions.spec 同樣的做法） */
function enslaved() {
    for (let seed = 1; seed < 60; seed++) {
        const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed });
        state.party[0].attrs.cha = 16;
        state.location = 'rhineburg';
        enterLocation(state);
        offerSelf(state, 'public');
        if (!contractOf(state.party[0]) || !leaderOf(state))
            continue;
        prepareAction(state, { kind: 'marking', text: '' });
        state.pendingAction.natural = 10;
        resolveAction(state, null);
        chooseMark(state, state.pendingMark.allowed[0]);
        return state;
    }
    throw new Error('nobody bought');
}
describe('B3: a long rest waits for pending events, like a short rest', () => {
    it('blocks the long rest while marking, a master event, a defeat event or a standoff is pending', () => {
        const state = game();
        standOn(state, 'inn');
        expect(longRestBlocked(state, 'inn')).toBeNull();
        const cases = [
            ['pendingMark', { intended: 'labor' }, '刻印'],
            ['pendingMasterEvent', { id: 'x' }, '主人的要求'],
            ['pendingDefeat', { foes: [] }, '眼前的處境'],
            ['standoff', { npcs: [] }, '對峙'],
        ];
        for (const [key, value, text] of cases) {
            ;
            state[key] = value;
            expect(longRestBlocked(state, 'inn'), String(key)).toContain(text);
            expect(() => longRest(state, 'inn')).toThrow(text);
            expect(() => shortRest(state)).toThrow(text);
            delete state[key];
        }
    });
});
describe('B4: nothing but the marking itself before the mark is cut', () => {
    it('refuses other actions while marking is pending', () => {
        const state = game();
        state.pendingMark = { intended: 'labor' };
        expect(() => prepareAction(state, { kind: 'chat', target: 'npc_lina', text: '聊天' })).toThrow('刻印');
        expect(() => prepareAction(state, { kind: 'free', text: '四處看看' })).toThrow('刻印');
        expect(() => prepareAction(state, { kind: 'marking', text: '' })).not.toThrow('先完成契約印記的刻印');
    });
});
describe('B5: selling yourself with a mark on you', () => {
    it('shows what you actually keep after the new master takes a cut', () => {
        const state = enslaved();
        // 逃離主人（逃亡中、隊伍只剩主角），再登記出售：買家成為新主人、逃亡解除，賣身錢照新契約抽成
        playerEscapes(state);
        for (let tries = 0; tries < 40; tries++) {
            const before = state.money_cc;
            const r = offerSelf(state, 'public');
            if (!r.outcome.tags?.includes('換了主人'))
                continue;
            const gained = state.money_cc - before;
            expect(r.outcome.summary).toContain('你只拿到');
            expect(r.outcome.summary).toContain('其餘被抽走');
            expect(r.outcome.summary).toContain(formatMoney(gained));
            expect(gained).toBe(r.changes.money_cc);
            return;
        }
        throw new Error('no buyer for a marked player');
    });
    it('takes the income share only from a master-owned, non-fugitive player', () => {
        const state = enslaved();
        const cut = masterTake(state, 1000);
        expect(cut).toBeGreaterThanOrEqual(0);
        playerEscapes(state);
        expect(masterTake(state, 1000)).toBe(0);
    });
});
describe('B6: being tracked down while resting', () => {
    it('reads the place multiplier from slavery.json: inns are risky, your own house is safer', () => {
        expect(slaveryRules.track_place_mult).toMatchObject({ inn: 1.5, home: 0.5 });
        const state = enslaved();
        // 逃亡中、契約一定找得到：家裡的倍率改成 0 就不會被找到，旅店照樣會
        playerEscapes(state);
        contractOf(state.party[0]).terms = { ...contractOf(state.party[0]).terms, recapture_chance: 1, functions: ['tracking'] };
        const keep = { ...slaveryRules.track_place_mult };
        slaveryRules.track_place_mult.home = 0;
        try {
            if (!isFugitive(state))
                return;
            expect(restChecks(state, blankReport(state), 'home').join('')).not.toContain('找到了你');
            expect(restChecks(state, blankReport(state), 'inn').join('')).toContain('找到了你');
        }
        finally {
            Object.assign(slaveryRules.track_place_mult, keep);
        }
    });
});
describe('B7: renaming a custom fuel', () => {
    it('updates the lamps that burn it', () => {
        const c = editableWorld();
        c.saveItem('魚油', { category: 'gear', price_cc: 3, tags: [], custom: true, burns: 30 });
        c.saveItem('魚油燈', { category: 'gear', price_cc: 30, tags: [], custom: true, tool: { kind: 'light', bonus: 1, fuel: '魚油' } });
        c.saveItem('魚油', { ...itemDef('魚油') }, '鯨油');
        expect(itemDef('魚油燈').tool.fuel).toBe('鯨油');
    });
});
describe('B11: the long-rest gap', () => {
    it('counts down and can be changed in the settings', () => {
        const state = game();
        standOn(state, 'inn');
        longRest(state, 'inn');
        expect(longRestBlocked(state, 'inn')).toMatch(/^還要 16 小時才能再長休/);
        state.time = addHours(state.time, 5.5);
        expect(longRestBlocked(state, 'inn')).toMatch(/^還要 10 小時 30 分才能再長休/);
        setLongRestGap(4);
        expect(longRestBlocked(state, 'inn')).toBeNull();
        setLongRestGap(99);
        expect(longRestBlocked(state, 'inn')).toContain('至少隔 24 小時');
        // 設定欄清空：用預設的 16 小時，不是 0
        setLongRestGap('');
        expect(longRestBlocked(state, 'inn')).toContain('至少隔 16 小時');
    });
});
describe('B13: flag suggestions', () => {
    it('include the flags in fixed NPC stages', () => {
        const c = editableWorld();
        c.saveNpc('mod_npc_s', { ...newNpc('mod_npc_s'), stages: [{ requires: { flags: ['moved_to_port'], flags_none: ['still_home'] }, location: 'tidehaven' }] });
        const flags = useContent().knownFlags();
        expect(flags).toContain('moved_to_port');
        expect(flags).toContain('still_home');
    });
});
describe('L7: the suggested rank of a special quest is checked when taking it', () => {
    it('works like guild quests: same rank or lower, one higher with a party', () => {
        const state = game();
        const def = { ...stories.find((s) => s.id === 'overturned_wagon'), rank: 'E' };
        expect(state.guild.rank).toBe('F');
        expect(storyRankOk(state, def)).toBe(false);
        expect(canStart(state, def)).toBe(false);
        recruit(state, 'npc_lina');
        expect(storyRankOk(state, def)).toBe(true);
        expect(storyRankOk(state, { rank: 'D' })).toBe(false);
        state.guild.rank = 'C';
        expect(storyRankOk(state, { rank: 'D' })).toBe(true);
        expect(storyRankOk(state, {})).toBe(true);
    });
});
describe('L5: buying a rumor from the bartender is just atmosphere', () => {
    it('raises the bartender\'s affinity and leaves a memory, with no flag and no real lead', () => {
        const state = game(2);
        const shop = shopState(state, 'tavern');
        const report = buyDeal(state, 'tavern', 'special:rumor');
        expect(state.flags?.rumor).toBeUndefined();
        expect(state.relationships[shop.keeper].affinity).toBe(2);
        expect(report.kind).toBe('social');
        expect(report.narration?.focus?.join('')).toContain('雞毛蒜皮');
        expect(report.narration?.focus?.join('')).toContain('不要寫出有用的情報');
        expect(JSON.stringify(state.memories ?? {})).toContain('街頭巷尾的閒話');
        // 每天只有一份
        expect(() => buyDeal(state, 'tavern', 'special:rumor')).toThrow('沒有了');
    });
});
describe('L4: the waystation general store is its own shop', () => {
    it('has its own key, keeper, stock and remote prices, and the keeper stays out of the town', () => {
        const state = game();
        const town = shopState(state, 'general');
        const townKey = shopKey(state, 'general');
        const townMult = locationMult(state);
        startJourney(state, 'rivervale');
        state.roadEvent = { x: state.position.x, template: 'waystation' };
        answerRoadEvent(state, 0);
        expect(shopPlace(state).waystation).toBe(true);
        const key = shopKey(state, 'general');
        expect(key).not.toBe(townKey);
        const shop = shopState(state, 'general');
        expect(shop.keeper).not.toBe(town.keeper);
        expect(locationMult(state)).toBe(shopRules.location_price_mult.outpost);
        expect(locationMult(state)).not.toBe(townMult);
        // 店主站在驛站的店裡
        const at = peopleHere(state).find((p) => p.rec.id === shop.keeper);
        expect(at && currentArea(state).cells[at.y * currentArea(state).width + at.x].kind).toBe('shop');
        // 在驛站買東西不會動到城裡的庫存
        const before = town.deals.find((d) => d.id === 'item:乾糧').stock;
        buyDeal(state, 'general', 'item:乾糧');
        expect(state.shops[townKey].deals.find((d) => d.id === 'item:乾糧').stock).toBe(before);
        leaveSide(state);
        // 回頭走同一條路線：同一間驛站、同一位店主
        const keeper = shop.keeper;
        state.road = { ...state.road, from: state.road.to, to: state.road.from };
        enterSide(state, 'waystation');
        expect(shopState(state, 'general').keeper).toBe(keeper);
        // 店主不會出現在出發城鎮的雜貨店
        leaveSide(state);
        delete state.road;
        state.location = 'soriel';
        enterLocation(state);
        expect(npcSpot(npcRecord(state, keeper))).toBe('waystation');
        expect(allNpcs(state).filter((r) => areaOf(state, r)?.startsWith('soriel')).map((r) => r.id)).not.toContain(keeper);
    });
});
