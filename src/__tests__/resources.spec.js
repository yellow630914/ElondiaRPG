import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020';
import schema from '../../schemas/report.schema.json';
import { prepareAction, resolveAction, sanitizeJudgment } from '@/engine/actions';
import { slotsLeft } from '@/engine/character';
import { act, combatItems, finishCombat, startCombat } from '@/engine/combat';
import { abilityDef } from '@/engine/data';
import { applyEffects } from '@/engine/effects';
import { enterLocation, standOn } from '@/engine/grid';
import { startNegotiation } from '@/engine/negotiation';
import { addHours, commitReport, newGame } from '@/engine/state';
import { acceptQuest, guildQuests, recruit } from '@/engine/town';
const validate = new Ajv2020({ strict: false }).compile(schema);
function expectValid(report) {
    if (!validate(report))
        throw new Error(JSON.stringify(validate.errors, null, 2));
}
function game(seed = 1, classId = 'fighter') {
    const state = newGame({ name: '艾倫', race: 'human', classId, seed });
    enterLocation(state);
    return state;
}
function event(state) {
    return {
        schema_version: '0.1', report_id: `r-test-${state.nextReportNo++}`, kind: 'event',
        time: { start: { ...state.time }, end: addHours(state.time, 1) },
        location: { at: state.location }, party: [], outcome: { result: 'success', summary: '事件' }, changes: {},
    };
}
describe('items in combat', () => {
    it('drinks a potion during combat and removes it from the pack when combat ends', () => {
        const state = game(1);
        state.inventory.push({ name: '微弱治療藥劑', qty: 2 });
        const pc = state.party[0];
        pc.hp = 3;
        state.location = 'snake_creek';
        startCombat(state, [['giant_rat', 1]]);
        const before = state.combat.combatants.find((c) => c.id === 'pc').hp;
        // 輪到隊員時才能行動；老鼠先手時 startCombat 已經跑完敵人回合
        act(state, { type: 'item', item: '微弱治療藥劑', target: 'pc' });
        const me = state.combat.combatants.find((c) => c.id === 'pc');
        const used = state.combat.timeline.find((t) => t.action === '使用微弱治療藥劑');
        expect(used.effects?.[0]?.type).toBe('heal');
        expect(me.hp).toBeGreaterThan(0);
        expect(before).toBeGreaterThan(0);
        expect(combatItems(state).find((i) => i.name === '微弱治療藥劑')?.qty).toBe(1);
        expect(state.inventory.find((i) => i.name === '微弱治療藥劑')?.qty).toBe(2);
        state.combat.status = 'fled';
        const report = finishCombat(state);
        expectValid(report);
        expect(report.changes.items_lost).toEqual([{ name: '微弱治療藥劑', qty: 1 }]);
        expect(state.inventory.find((i) => i.name === '微弱治療藥劑')?.qty).toBe(1);
    });
    it('refuses items you do not have', () => {
        const state = game(2);
        state.location = 'snake_creek';
        startCombat(state, [['giant_rat', 1]]);
        expect(() => act(state, { type: 'item', item: '微弱治療藥劑', target: 'pc' })).toThrow('沒有');
    });
});
describe('resource effects', () => {
    it('spends and restores spell slots and hit dice through the reward template', () => {
        const state = game(3, 'wizard');
        const pc = state.party[0];
        const report = event(state);
        const slots = slotsLeft(pc)[0];
        applyEffects(state, report, [
            { type: 'slot', target: 'pc', delta: -9 },
            { type: 'hit_dice', target: 'pc', delta: -1 },
            { type: 'hp', target: 'pc', amount: -3 },
        ]);
        commitReport(state, report);
        expectValid(report);
        expect(slotsLeft(pc)[0]).toBe(0);
        expect(pc.hitDiceUsed).toBe(1);
        expect(report.changes.resources?.map((r) => r.kind)).toEqual([...Array(slots).fill('slot'), 'hit_dice']);
        const r2 = event(state);
        applyEffects(state, r2, [{ type: 'slot', target: 'pc', delta: 1 }, { type: 'hit_dice', target: 'pc', delta: 5 }]);
        expect(slotsLeft(pc)[0]).toBe(1);
        expect(pc.hitDiceUsed).toBe(0);
    });
    it('spends a spell slot to help an active action, e.g. a charm spell in a negotiation', () => {
        const state = game(4, 'wizard');
        const pc = state.party[0];
        const spell = pc.abilities.find((id) => abilityDef(id).type === 'spell');
        standOn(state, 'guild');
        const quest = guildQuests(state).find((q) => q.rank === 'F');
        const n = startNegotiation(state, 'quest_reward', { quest: quest.id });
        const slots = slotsLeft(pc)[0];
        const p = prepareAction(state, { kind: 'negotiation', target: n.id, text: '施法讓職員放鬆戒心', use: { member: 'pc', ability: spell } });
        expect(slotsLeft(pc)[0]).toBe(slots - 1);
        expect(p.situational.find((x) => x.label.includes(abilityDef(spell).name))?.value).toBe(3);
        const report = resolveAction(state, null);
        expectValid(report);
        expect(report.changes.resources).toEqual([{ actor: 'pc', kind: 'slot', delta: -1, detail: `1 環（${abilityDef(spell).name}）` }]);
        pc.slotsUsed = [99];
        expect(() => prepareAction(state, { kind: 'free', text: '再施一次', use: { member: 'pc', ability: spell } })).toThrow('法術環');
        expect(state.pendingAction).toBeUndefined();
    });
    it('lets the AI hurt or heal within limits', () => {
        const state = game(5);
        recruit(state, 'npc_lina');
        const p = prepareAction(state, { kind: 'free', text: '翻牆進倉庫' });
        const j = sanitizeJudgment(state, p, { degree: 'fail', effects: [
                { type: 'hp', target: 'pc', amount: -999 },
                { type: 'hp', target: 'pc', amount: -1 },
                { type: 'hp', target: 'npc_lina', amount: 999 },
            ] });
        const pc = state.party[0];
        const lina = state.party[1];
        expect(j.effects).toEqual([
            { type: 'hp', target: 'pc', amount: -Math.ceil(pc.maxHp * 0.3) },
            { type: 'hp', target: 'npc_lina', amount: Math.ceil(lina.maxHp * 0.2) },
        ]);
        const hp = pc.hp;
        resolveAction(state, j);
        expect(pc.hp).toBe(hp - Math.ceil(pc.maxHp * 0.3));
    });
});
describe('guild board', () => {
    it('posts a new board every day, keeping accepted and negotiated quests', () => {
        const state = game(6);
        standOn(state, 'guild');
        const day1 = guildQuests(state);
        expect(guildQuests(state).map((q) => q.id)).toEqual(day1.map((q) => q.id));
        const [accepted, negotiated, ignored] = day1.filter((q) => q.rank === 'F');
        acceptQuest(state, accepted.id);
        negotiated.flags = { negotiated: true };
        state.time.day += 1;
        const day2 = guildQuests(state);
        const ids = day2.map((q) => q.id);
        expect(ids).toContain(accepted.id);
        expect(ids).toContain(negotiated.id);
        expect(ids).not.toContain(ignored.id);
        expect(day2.some((q) => q.id.includes(`-${state.time.day}-`))).toBe(true);
    });
});
