import { describe, expect, it } from 'vitest';
import before from './fixtures/race_combat.json';
import { attributeRules, choosablePerks, classes } from '@/engine/data';
import { gearAffinities } from '@/engine/character';
import { startCombat } from '@/engine/combat';
import { sanitizeItem, sanitizeNpc } from '@/engine/mods';
import { grantPerk, learnablePerks, losePerk, offerPerks, perksOf, racePerks, rollNpcPerks } from '@/engine/perks';
import { Rng } from '@/engine/rng';
import { newGame } from '@/engine/state';
/** 改成種族特質之前存下的數值（race_combat.json）：每個種族 × 職業的抗性、增傷、戰鬥修正與仇恨 */
const snapshot = before;
describe('race talents as race perks', () => {
    it('gives every race exactly one race perk, computed from the race', () => {
        for (const race of Object.keys(attributeRules.races)) {
            expect(racePerks(race).map((p) => p.id), race).toEqual([`race_${race}`]);
            const pc = newGame({ name: 'x', race, classId: 'fighter', seed: 1, birthplace: 'soriel' }).party[0];
            // 不寫進存檔，但一直算在特質裡
            expect(pc.perks ?? []).not.toContain(`race_${race}`);
            expect(perksOf(pc)[0].id).toBe(`race_${race}`);
        }
        // 人類的適應力（全屬性 +1）已經是種族加值：特質本身沒有效果
        expect(racePerks('human')[0].effects).toEqual([]);
    });
    it('keeps resistances, evasion, lucky hits and threat exactly as before', () => {
        let n = 0;
        for (const race of Object.keys(attributeRules.races)) {
            for (const cls of Object.keys(classes)) {
                const s = newGame({ name: 'x', race, classId: cls, seed: 1, birthplace: 'soriel' });
                const c = s.party[0];
                const g = gearAffinities(c);
                s.location = 'snake_creek';
                try {
                    startCombat(s, [['giant_rat', 1]]);
                }
                catch {
                    continue;
                }
                const cb = s.combat.combatants.find((x) => x.id === 'pc');
                const now = { g, threat: cb.threat, threatMult: cb.threatMult, resist: cb.resist, offense: cb.offense, baseMods: cb.baseMods };
                expect(JSON.parse(JSON.stringify(now)), `${race}/${cls}`).toEqual(snapshot[`${race}/${cls}`]);
                n++;
            }
        }
        expect(n).toBe(Object.keys(snapshot).length);
    });
    it('cannot be chosen, offered, trained, read from a book, granted or lost', () => {
        const ids = Object.keys(attributeRules.races).map((r) => `race_${r}`);
        expect(choosablePerks().some((p) => ids.includes(p.id))).toBe(false);
        const pc = newGame({ name: 'x', race: 'elf', classId: 'fighter', seed: 1, birthplace: 'soriel', perks: ['race_dwarf'] }).party[0];
        expect(pc.perks ?? []).not.toContain('race_dwarf');
        expect(learnablePerks(pc).some((p) => ids.includes(p.id))).toBe(false);
        expect(offerPerks(pc, '測試', ['race_dwarf'], false)).toBeUndefined();
        expect(grantPerk(pc, 'race_dwarf')).toBeUndefined();
        expect(losePerk(pc, 'race_elf')).toBeUndefined();
        expect(perksOf(pc).some((p) => p.id === 'race_elf')).toBe(true);
        const rng = new Rng(3);
        for (let i = 0; i < 200; i++)
            expect(rollNpcPerks(rng, { race: 'dwarf' }).some((id) => ids.includes(id))).toBe(false);
        const book = sanitizeItem('書', { name: '書', category: 'consumable', price_cc: 10, use: { perks: ['race_elf', 'brawler'] } }, true);
        expect(book.use?.perks).toEqual(['brawler']);
        expect(sanitizeNpc('mod_npc_x', { name: '測試', race: 'elf', perks: ['race_elf', 'brawler'] }, true).perks).toEqual(['brawler']);
    });
});
