import { afterEach, describe, expect, it } from 'vitest';
import { npcs as namedNpcs } from '@/engine/data';
import { enterLocation } from '@/engine/grid';
import { applyContent, emptyMods, newNpc, normalizeMods, sanitizeNpc } from '@/engine/mods';
import { npcRecord, npcSpot } from '@/engine/npcs';
import { canPromote, markPromoted, npcModFromState } from '@/engine/promoteNpc';
import { ensureRelationship, setAffinity } from '@/engine/social';
import { setFlag } from '@/engine/storyFlags';
import { newGame } from '@/engine/state';
import { fixedKeeper, keeperFor, shopState } from '@/engine/trade';
afterEach(() => applyContent(emptyMods()));
function game() {
    const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 3, birthplace: 'rhineburg' });
    enterLocation(state);
    return state;
}
function withKeeper(keeper, location = 'rhineburg', extra = {}) {
    applyContent(normalizeMods({ ...emptyMods(), npcs: { mod_npc_smith: { ...newNpc('mod_npc_smith'), name: '鐵砧老韓', location, kind: 'commoner', keeper, ...extra } } }));
}
describe('fixed NPC shopkeepers', () => {
    it('only keep shop types that have a fixed shop', () => {
        expect(sanitizeNpc('x', { ...newNpc('x'), keeper: 'smithy' }, true).keeper).toBe('smithy');
        expect(sanitizeNpc('x', { ...newNpc('x'), keeper: 'wanderer' }, true).keeper).toBeUndefined();
        expect(sanitizeNpc('x', { ...newNpc('x'), keeper: 'nope' }, true).keeper).toBeUndefined();
    });
    it('run the shop in their home town and stand in it', () => {
        withKeeper('smithy');
        const state = game();
        expect(shopState(state, 'smithy').keeper).toBe('mod_npc_smith');
        expect(npcSpot(npcRecord(state, 'mod_npc_smith'))).toBe('smithy');
        // 其他店照樣是生成的店主
        expect(shopState(state, 'tailor').keeper).toBe('keeper_rhineburg_tailor');
    });
    it('hand the shop back to a generated keeper while away or before their story flags', () => {
        withKeeper('smithy', 'rhineburg', { requires: { flags: ['smith_back'] } });
        const state = game();
        expect(keeperFor(state, 'smithy')).toBe('keeper_rhineburg_smithy');
        setFlag(state, 'smith_back');
        expect(keeperFor(state, 'smithy')).toBe('mod_npc_smith');
        state.party.push({ ...state.party[0], id: 'mod_npc_smith', isPlayer: false });
        expect(fixedKeeper(state, 'smithy')).toBeUndefined();
    });
    it('do nothing in another town', () => {
        withKeeper('smithy', 'dawnlight');
        expect(keeperFor(game(), 'smithy')).toBe('keeper_rhineburg_smithy');
    });
});
describe('saving a generated person as a fixed NPC', () => {
    it('keeps their stats and id, and a generated keeper becomes that shop’s keeper', () => {
        const state = game();
        const id = keeperFor(state, 'jeweler');
        expect(canPromote(state, id)).toBe(true);
        const rec = npcRecord(state, id);
        ensureRelationship(state, rec);
        setAffinity(state, id, 10);
        const mod = npcModFromState(state, id);
        expect(mod).toMatchObject({ id, name: rec.name, location: 'rhineburg', keeper: 'jeweler', custom: true });
        expect(mod.attrs).toBeTruthy();
        expect(mod.abilities ?? []).toBeInstanceOf(Array);
        applyContent(normalizeMods({ ...emptyMods(), npcs: { [id]: mod } }));
        markPromoted(state, id);
        expect(namedNpcs.some((n) => n.id === id)).toBe(true);
        expect(canPromote(state, id)).toBe(false);
        expect(state.npcs[id].generated).toBeUndefined();
        expect(state.relationships[id].affinity).toBe(10);
        expect(keeperFor(state, 'jeweler')).toBe(id);
    });
    it('refuses the player and existing fixed NPCs', () => {
        const state = game();
        expect(canPromote(state, 'pc')).toBe(false);
        if (namedNpcs[0])
            expect(canPromote(state, namedNpcs[0].id)).toBe(false);
        expect(() => npcModFromState(state, 'pc')).toThrow();
    });
});
