import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import Ajv2020 from 'ajv/dist/2020';
import schema from '../../schemas/report.schema.json';
import { prepareAction, resolveAction } from '@/engine/actions';
import mapsJson from '@data/world/maps.json';
import { geography, landmarks, landmarkTypes, townQuestTemplates } from '@/engine/data';
import { CELL_ICON, cellName, currentCell, enterLocation, getArea, questRunnableHere, settlementArea, standOn } from '@/engine/grid';
import { acceptQuest, guildQuests, questScene, questSpot } from '@/engine/town';
import { builtinLandmark, newLandmark, sanitizeLandmarkMod } from '@/engine/landmarkMods';
import { applyExplore, blockedReason, closedHere, landmarkHere, setupExplore, visitLandmark, withLandmark } from '@/engine/landmarks';
import { trainablePerks } from '@/engine/perks';
import { setFlag } from '@/engine/storyFlags';
import { jobHere } from '@/engine/work';
import { applyContent, emptyMods, newNpc, normalizeMods } from '@/engine/mods';
import { npcRecord } from '@/engine/npcs';
import { fixedCell } from '@/engine/population';
import { computePlacements } from '@/engine/shopMods';
import { newGame } from '@/engine/state';
import { newStory, sanitizeStory } from '@/engine/storyMods';
import { useContent } from '@/stores/content';
import { editableWorld } from './testWorld';
beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
});
afterEach(() => applyContent(emptyMods()));
const game = (birthplace = 'rhineburg') => {
    const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 3, birthplace });
    enterLocation(state);
    return state;
};
const kindAt = (r) => {
    const a = settlementArea(r.area);
    return a.cells[r.y * a.width + r.x].kind;
};
const maps = mapsJson;
describe('built-in landmarks', () => {
    it('sit on a road cell of their own settlement, one cell each, with known types', () => {
        const list = Object.values(landmarks);
        expect(list.length).toBeGreaterThanOrEqual(40);
        const cells = new Set();
        for (const l of list) {
            expect(l.id).toMatch(/^lm_[a-z0-9_]+$/);
            expect(geography.locations.find((x) => x.id === l.location)?.type).not.toBe('dungeon');
            const [loc, block] = l.at.area.split('/');
            expect(loc).toBe(l.location);
            const grid = maps.maps[loc].blocks.find((b) => b.id === block).grid;
            expect(grid[l.at.y][l.at.x], l.id).toBe('.');
            expect(cells.has(`${l.at.area}:${l.at.x},${l.at.y}`)).toBe(false);
            cells.add(`${l.at.area}:${l.at.x},${l.at.y}`);
            expect(l.types.length).toBeGreaterThan(0);
            for (const t of l.types)
                expect(landmarkTypes[t], `${l.id} ${t}`).toBeDefined();
            expect(kindAt(l.at)).toBe(l.id);
            expect(cellName(l.id)).toBe(l.name);
            expect(CELL_ICON[l.id]).toBe(l.emoji);
        }
    });
    it('give the action scene the landmark mood when standing there', () => {
        const state = game();
        expect(standOn(state, 'lm_knight_academy')).toBe(true);
        expect(landmarkHere(state)?.name).toBe('騎士學院');
        expect(withLandmark(state, '萊茵堡')).toContain('騎士學院（');
        standOn(state, 'inn');
        expect(withLandmark(state, '萊茵堡')).toBe('萊茵堡');
    });
    it('cannot be covered by a shop placement', () => {
        const at = landmarks.lm_knight_academy.at;
        const r = computePlacements({ shop_x: { custom: true, name: '店', places: [at] } });
        expect(r.rejected[0]).toMatchObject({ reason: '那一格不是空地（道路）' });
    });
});
describe('editing landmarks', () => {
    it('moves a built-in landmark inside its settlement, refuses walls, and restores it', () => {
        const c = editableWorld();
        const from = landmarks.lm_knight_academy.at;
        const area = settlementArea(from.area);
        const floor = area.cells.findIndex((x, i) => x.kind === 'floor' && i !== from.y * area.width + from.x);
        const to = { area: from.area, x: floor % area.width, y: Math.floor(floor / area.width) };
        c.saveLandmark('lm_knight_academy', { ...builtinLandmark('lm_knight_academy'), at: to, name: '王立騎士學院' });
        expect(kindAt(from)).toBe('floor');
        expect(kindAt(to)).toBe('lm_knight_academy');
        expect(landmarks.lm_knight_academy.name).toBe('王立騎士學院');
        // 換聚落不算（內建的不能搬到別的聚落）、牆上不行
        const wall = area.cells.findIndex((x) => x.kind === 'wall');
        expect(() => c.saveLandmark('lm_knight_academy', { ...landmarks.lm_knight_academy, at: { area: from.area, x: wall % area.width, y: Math.floor(wall / area.width) } })).toThrow('不是空地');
        c.saveLandmark('lm_knight_academy', { ...landmarks.lm_knight_academy, at: { area: 'soriel/pilgrim', x: 1, y: 1 } });
        expect(landmarks.lm_knight_academy.location).toBe('rhineburg');
        c.restoreLandmark('lm_knight_academy');
        expect(kindAt(from)).toBe('lm_knight_academy');
        expect(useContent().mods.landmarks.lm_knight_academy).toBeUndefined();
    });
    it('custom landmarks: fixed NPCs stay there, story nodes target them, and both block deletion', () => {
        const c = editableWorld();
        const id = 'lm_test1';
        c.saveLandmark(id, { ...newLandmark(id, 'soriel'), name: '許願池', types: ['monument', 'bogus'] });
        expect(landmarks[id]).toMatchObject({ name: '許願池', location: 'soriel', types: ['monument'] });
        expect(kindAt(landmarks[id].at)).toBe(id);
        // 固定 NPC 待在地標：站在地標那一格，地標搬家時跟著走
        c.saveNpc('mod_npc_lm', { ...newNpc('mod_npc_lm'), location: 'soriel', landmark: id });
        const state = game('soriel');
        expect(fixedCell(npcRecord(state, 'mod_npc_lm'))).toEqual(landmarks[id].at);
        expect(() => c.deleteLandmark(id)).toThrow('待在這裡');
        c.deleteNpc('mod_npc_lm');
        // 特殊任務的任務點
        const s = newStory('mod_story_lm');
        s.nodes[0] = { ...s.nodes[0], at: { where: 'cell', location: 'soriel', cell: id } };
        expect(sanitizeStory('mod_story_lm', s, true).nodes[0].at.cell).toBe(id);
        // 別的地點的地標不收
        expect(sanitizeStory('mod_story_lm', { ...s, nodes: [{ ...s.nodes[0], at: { where: 'cell', location: 'rhineburg', cell: id } }] }, true).nodes[0].at.cell).toBe('tavern');
        c.saveStory('mod_story_lm', s);
        expect(() => c.deleteLandmark(id)).toThrow('任務點');
        c.deleteStory('mod_story_lm');
        c.deleteLandmark(id);
        expect(landmarks[id]).toBeUndefined();
        expect(() => c.deleteLandmark('lm_knight_academy')).toThrow('內建');
    });
    it('survive normalizing a saved world, and old saves see the moved map', () => {
        const at = newLandmark('lm_test2', 'rhineburg').at;
        const mods = normalizeMods({ ...emptyMods(), landmarks: { lm_test2: { ...newLandmark('lm_test2', 'rhineburg'), name: '噴泉' }, bad: { name: 'x' } } });
        expect(Object.keys(mods.landmarks)).toEqual(['lm_test2']);
        applyContent(mods);
        const state = game();
        expect(getArea(state, at.area).cells[at.y * getArea(state, at.area).width + at.x].kind).toBe('lm_test2');
        expect(standOn(state, 'lm_test2')).toBe(true);
        expect(currentCell(state).kind).toBe('lm_test2');
    });
});
describe('guild quests at landmarks', () => {
    it('pick a landmark of a matching type in town, name it in the title, and run there', () => {
        const state = game();
        let quest = guildQuests(state).find((q) => q.landmark);
        for (let d = 2; !quest && d < 60; d++) {
            state.quests = [];
            state.time.day = d;
            quest = guildQuests(state).find((q) => q.landmark);
        }
        expect(quest).toBeDefined();
        const l = landmarks[quest.landmark];
        const tpl = townQuestTemplates[quest.template];
        expect(l.location).toBe('rhineburg');
        expect(l.types.some((t) => tpl.landmark.includes(t))).toBe(true);
        expect(quest.title).toContain(l.name);
        expect(questSpot(quest)).toBe(l.id);
        expect(questScene(quest)).toContain(l.name);
        acceptQuest(state, quest.id);
        expect(questRunnableHere(state, { ...quest, spot: questSpot(quest) })).toBe(false);
        standOn(state, l.id);
        expect(questRunnableHere(state, { ...quest, spot: questSpot(quest) })).toBe(true);
    });
    it('are not posted in towns without a matching landmark', () => {
        // 河谷鎮只有古蹟、市集、自然類的地標：沒有學院與軍事的委託
        const state = game('rivervale');
        for (let d = 1; d < 40; d++) {
            state.quests = [];
            state.time.day = d;
            for (const q of guildQuests(state))
                expect(['lm_scholar_errand', 'lm_sparring', 'lm_ore_delivery']).not.toContain(q.template);
        }
    });
});
describe('landmark functions', () => {
    const at = (state, id, hour = 10) => {
        state.time.hour = hour;
        expect(standOn(state, id)).toBe(true);
    };
    it('open only when the conditions hold', () => {
        const state = game('dawnlight');
        at(state, 'lm_dawn_sanctum', 22);
        expect(closedHere(state)).toContain('只在白天');
        state.time.hour = 10;
        expect(closedHere(state)).toBeUndefined();
        // 聲望不夠、逃亡奴隸
        const s2 = game('rhineburg');
        at(s2, 'lm_imperial_armory');
        expect(closedHere(s2)).toContain('聲望');
        s2.reputation.rhine_empire = 10;
        expect(closedHere(s2)).toBeUndefined();
        s2.party[0].status.push('fugitive');
        expect(closedHere(s2)).toContain('契約印記');
        // 劇情旗標
        applyContent(normalizeMods({ ...emptyMods(), landmarks: { lm_old_stone_bridge: { ...builtinLandmark('lm_old_stone_bridge'), open: { flags: ['bridge_open'] } } } }));
        const s3 = game('rivervale');
        at(s3, 'lm_old_stone_bridge');
        expect(closedHere(s3)).toContain('現在不開放');
        setFlag(s3, 'bridge_open');
        expect(closedHere(s3)).toBeUndefined();
    });
    it('visit: pay, gain the effects, then wait for the cooldown', () => {
        const state = game('dawnlight');
        at(state, 'lm_dawn_sanctum');
        state.money_cc = 100;
        visitLandmark(state);
        expect(state.money_cc).toBe(80);
        expect(state.party[0].status).toContain('blessed');
        expect(blockedReason(state, 'visit')).toContain('天後');
        state.time.day += 1;
        expect(blockedReason(state, 'visit')).toBeUndefined();
        state.money_cc = 5;
        expect(blockedReason(state, 'visit')).toContain('錢不夠');
        expect(() => visitLandmark(state)).toThrow('錢不夠');
    });
    it('explore: a check whose success gives the effects, then a cooldown', () => {
        const state = game('albena');
        at(state, 'lm_free_market');
        const setup = setupExplore(state);
        expect(setup).toMatchObject({ attr: 'cha', dc: 13, hours: 2 });
        const money = state.money_cc;
        const report = { changes: {} };
        applyExplore(state, report, 'success');
        expect(report.changes.money_cc).toBe(40);
        expect(blockedReason(state, 'explore')).toContain('3 天後');
        expect(() => setupExplore(state)).toThrow('天後');
        expect(state.money_cc).toBe(money);
    });
    it('work and training at landmarks, closed landmarks have neither', () => {
        const state = game('ashport');
        at(state, 'lm_greysail_pier');
        expect(jobHere(state)).toMatchObject({ name: '灰帆碼頭的雜務', attr: 'str', dc: 11 });
        const s2 = game();
        at(s2, 'lm_knight_academy');
        expect(trainablePerks(s2.party[0], 'lm_knight_academy').map((p) => p.id)).toContain('brawler');
        expect(jobHere(s2)).toBeDefined();
        s2.party[0].status.push('fugitive');
        expect(jobHere(s2)).toBeUndefined();
    });
    it('sanitize keeps only landmark-safe effects, and the built-in data is already clean', () => {
        const m = sanitizeLandmarkMod('lm_dawn_sanctum', {
            ...builtinLandmark('lm_dawn_sanctum'),
            visit: { title: '祈禱', effects: [{ type: 'enslave_player', contract: 'x' }, { type: 'condition', target: 'pc', condition: 'blessed', add: true }], hours: 99 },
            explore: { title: '', attr: 'int', dc: 12, hours: 1, effects: [] },
            work: { attr: 'bogus', dc: 50, rate_cc: 9, desc: '' },
        });
        expect(m.visit).toEqual({ title: '祈禱', effects: [{ type: 'condition', target: 'pc', condition: 'blessed', add: true }], hours: 24 });
        expect(m.explore).toBeUndefined();
        expect(m.work).toEqual({ attr: 'cha', dc: 30, rate_cc: 9, desc: '在這裡幫忙。' });
        for (const l of Object.values(landmarks))
            expect(sanitizeLandmarkMod(l.id, l), l.id).toEqual(l);
    });
    it('explore runs as an action and its report matches the schema', () => {
        const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
        const state = game('albena');
        at(state, 'lm_free_market');
        const money = state.money_cc;
        prepareAction(state, { kind: 'explore', text: '' });
        expect(state.pendingAction.scene).toContain('自由集市');
        state.pendingAction.natural = 20;
        const r = resolveAction(state, null);
        expect(validate(r), JSON.stringify(validate.errors)).toBe(true);
        expect(state.money_cc).toBeGreaterThan(money);
        expect(state.landmarks?.lm_free_market?.explored).toBe(state.time.day);
    });
});
