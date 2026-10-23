import { afterEach, describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020';
import schema from '../../schemas/report.schema.json';
import { finishCombat } from '@/engine/combat';
import { currentArea, enterLocation, goOutskirts, standOn } from '@/engine/grid';
import { applyContent, emptyMods, newNpc, normalizeMods, sanitizeNpc } from '@/engine/mods';
import { npcRecord } from '@/engine/npcs';
import { adventurersInTown, peopleHere } from '@/engine/population';
import { newGame } from '@/engine/state';
import { playNode, startStory } from '@/engine/story';
import { clearFlag, setFlag } from '@/engine/storyFlags';
import { newStory, sanitizeStory, storyIssues } from '@/engine/storyMods';
const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
const valid = (r) => expect(validate(r), JSON.stringify(validate.errors)).toBe(true);
afterEach(() => applyContent(emptyMods()));
function mods(patch) {
    return normalizeMods({ ...emptyMods(), ...patch });
}
function game() {
    const state = newGame({ name: '測試者', race: 'human', classId: 'fighter', seed: 7, birthplace: 'soriel' });
    enterLocation(state);
    return state;
}
describe('fixed NPC stages', () => {
    const mover = {
        ...newNpc('mod_npc_m'), name: '搬家的劍士',
        stages: [{ requires: { flags: ['m_moved'] }, location: 'rhineburg', haunts: [{ location: 'rhineburg', zone: 'town', weight: 1 }] }],
    };
    it('moves to another town when the flag is set, as the same character, and back when it clears', () => {
        applyContent(mods({ npcs: { mod_npc_m: mover } }));
        const state = game();
        const inTown = () => adventurersInTown(state).some((r) => r.id === 'mod_npc_m');
        expect(inTown()).toBe(true);
        setFlag(state, 'm_moved');
        const rec = npcRecord(state, 'mod_npc_m');
        expect(rec).toMatchObject({ location: 'rhineburg', stage: 0 });
        expect(state.npcs?.mod_npc_m).toBe(rec);
        expect(inTown()).toBe(false);
        state.location = 'rhineburg';
        enterLocation(state);
        expect(inTown()).toBe(true);
        clearFlag(state, 'm_moved');
        const back = npcRecord(state, 'mod_npc_m');
        expect(back).toBe(rec);
        expect(back.location).toBe('soriel');
        expect(back.stage).toBeUndefined();
        expect(back.haunts?.[0]?.location).toBe('soriel');
    });
    it('drops stages without any flag and keeps the stage in a settlement', () => {
        const out = sanitizeNpc('x', {
            ...mover,
            stages: [
                { requires: {}, location: 'rhineburg' },
                { requires: { flags: ['ok'] }, location: 'whisper_crypt', haunts: [{ location: 'whisper_crypt', zone: 'dungeon', weight: 1 }] },
            ],
        }, true);
        expect(out.stages).toHaveLength(1);
        expect(out.stages[0]).toMatchObject({ requires: { flags: ['ok'] }, location: 'soriel' });
        expect(out.stages[0].haunts?.[0]?.location).toBe('whisper_crypt');
    });
});
describe('allies on special quest points', () => {
    // 營救：酒館碰面（友方在設施上）→ 近郊的戰鬥（友方站在 ⭐ 旁邊、一起作戰）→ 成功後同行 → 回公會完成
    const captive = { ...newNpc('mod_npc_r'), name: '被困的人', haunts: [], requires: { flags: ['never_set'] } };
    const rescue = {
        ...newStory('rescue'),
        start_flags: ['r_started'],
        nodes: [
            { id: 'meet', title: '在酒館碰面', text: '', at: { where: 'cell', location: 'soriel', cell: 'tavern' }, kind: 'story', allies: ['mod_npc_r'], requires: { flags: ['r_started'] }, success: { set_flags: ['r_met'] } },
            { id: 'free', title: '擊退追兵', text: '', at: { where: 'outskirts', location: 'soriel' }, kind: 'combat', enemies: [['bandit', 1]], allies: ['mod_npc_r'], requires: { flags: ['r_met'] }, success: { join: 'mod_npc_r', set_flags: ['r_rescued'] } },
            { id: 'report', title: '回公會報告', text: '', at: { where: 'cell', location: 'soriel', cell: 'guild' }, kind: 'story', requires: { flags: ['r_rescued'] }, success: { leave: 'mod_npc_r', complete: true } },
        ],
    };
    it('keeps allies when saving and points out missing ones', () => {
        const s = sanitizeStory('rescue', rescue, true);
        expect(s.nodes[0].allies).toEqual(['mod_npc_r']);
        expect(storyIssues(s).some((i) => i.includes('友方角色 mod_npc_r 不存在'))).toBe(true);
        applyContent(mods({ npcs: { mod_npc_r: captive } }));
        expect(storyIssues(s)).toEqual([]);
    });
    it('places allies on the facility and beside the marker, fights with them, then they join and leave', () => {
        applyContent(mods({ npcs: { mod_npc_r: captive }, stories: { rescue } }));
        const state = game();
        const seen = () => peopleHere(state).find((p) => p.rec.id === 'mod_npc_r');
        expect(seen()).toBeUndefined();
        startStory(state, 'rescue');
        // 1. 酒館：站在設施上（不管自己的出現條件）
        standOn(state, 'tavern');
        expect(seen()?.dist).toBe(0);
        const r1 = playNode(state, 'rescue:meet');
        valid(r1);
        expect(r1.others?.some((o) => o.name === '被困的人')).toBe(true);
        // 2. 近郊的 ⭐ 旁邊；一起作戰
        standOn(state, 'gate');
        goOutskirts(state);
        const area = currentArea(state);
        const i = area.cells.findIndex((c) => c.storyNode === 'rescue:free');
        state.position = { area: area.key, x: i % area.width, y: Math.floor(i / area.width) };
        expect(seen()?.dist).toBe(1);
        playNode(state, 'rescue:free');
        const ally = state.combat.combatants.find((c) => c.npcId === 'mod_npc_r');
        expect(ally).toMatchObject({ side: 'party', ally: true });
        for (const c of state.combat.combatants)
            if (c.side === 'enemy')
                c.hp = 0;
        state.combat.status = 'victory';
        const r2 = finishCombat(state);
        valid(r2);
        expect(r2.others?.find((o) => o.id === 'mod_npc_r')?.status).toContain('同行的友方');
        expect(state.party.find((m) => m.id === 'mod_npc_r')?.bond).toBe('guest');
        // 3. 回公會完成，同行的人離開
        state.location = 'soriel';
        enterLocation(state);
        standOn(state, 'guild');
        const r3 = playNode(state, 'rescue:report');
        valid(r3);
        expect(state.stories?.rescue?.status).toBe('completed');
        expect(state.party.some((m) => m.id === 'mod_npc_r')).toBe(false);
        expect(seen()).toBeUndefined();
    });
});
