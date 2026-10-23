// 戰鬥耐打度的模擬（docs/MONSTERS.md「耐打度」）：4 人隊伍（戰士、遊蕩者、牧師、法師）用和怪物同等級的角色
// （依職業學的技能、依等級生成的裝備），打一隻去掉弱點（保留抗性）與特徵、血量無限的怪物，量平均每一擊的傷害與每回合的傷害。
// 隊員的打法：能用的傷害技能挑環數最高的，沒有就普通攻擊，行動點不夠就結束回合。
import { abilityDef, dungeonEncounters, enemies } from '@/engine/data';
import { createNpc } from '@/engine/character';
import { act, chooseAction, currentActor, isActive, startCombat, usableAbilities } from '@/engine/combat';
import { Rng } from '@/engine/rng';
import { newGame } from '@/engine/state';
export const PARTY = ['fighter', 'rogue', 'cleric', 'wizard'];
const ROUNDS = 3;
function party(level, seed) {
    const rng = new Rng(seed);
    return PARTY.map((cls, i) => {
        const c = createNpc({ id: `p${i}`, name: cls, race: 'human', class: cls, level, location: 'soriel', hire_cc: 0, personality: '' }, rng);
        if (i === 0)
            c.isPlayer = true;
        return c;
    });
}
const hitsEnemy = (id) => {
    const a = abilityDef(id);
    return !!a.damage?.length && ['enemy', 'all_enemies', 'random_enemies'].includes(a.target);
};
/** 一場模擬（ROUNDS 回合）：造成的傷害與有傷害的出手次數 */
function trial(monster, level, seed) {
    const state = newGame({ name: 'x', race: 'human', classId: 'fighter', seed });
    state.party = party(level, seed);
    const combat = startCombat(state, [[monster, 1]]);
    const e = combat.combatants.find((c) => c.side === 'enemy');
    const def = enemies[monster];
    // 去掉弱點與特徵，血量無限，也不會傷人
    e.hp = e.maxHp = 1e7;
    e.attrs = { ...def.attrs };
    e.armorDr = def.dr;
    e.armorEvade = def.evade;
    // 抗性留著（負數），弱點拿掉（正數）
    e.resist = Object.fromEntries(Object.entries(def.resist ?? {}).filter(([, v]) => v < 0));
    e.statuses = [];
    e.baseMods = {};
    e.weapon = { ...e.weapon, dice: '1d1' };
    e.abilities = [];
    let dmg = 0;
    let hits = 0;
    for (let guard = 0; combat.status === 'ongoing' && combat.round <= ROUNDS && guard < 500; guard++) {
        const actor = currentActor(combat);
        if (!actor || actor.side !== 'party')
            break;
        for (const p of combat.combatants)
            if (p.side === 'party')
                p.hp = p.maxHp;
        const best = usableAbilities(combat, actor.id).filter((a) => hitsEnemy(a.id)).sort((a, b) => (b.circle ?? 0) - (a.circle ?? 0))[0];
        const before = combat.timeline.length;
        if (best)
            act(state, { type: 'ability', ability: best.id, target: e.id });
        else if (actor.ap >= 2)
            act(state, { type: 'attack', target: e.id });
        else
            act(state, { type: 'end_turn' });
        for (const t of combat.timeline.slice(before)) {
            if (t.actor !== actor.id)
                continue;
            const d = (t.effects ?? []).filter((x) => x.type === 'damage' && x.target === e.id).reduce((s, x) => s + (x.amount ?? 0), 0);
            if (d > 0) {
                dmg += d;
                hits += 1;
            }
        }
    }
    return { dmg, hits };
}
/** 各地下城各層的層主 */
export function bossIds() {
    const out = new Set();
    for (const v of Object.values(dungeonEncounters))
        for (const g of Object.values(v.bosses ?? {}))
            if (g?.[0])
                out.add(g[0][0]);
    return out;
}
/** 一隻怪物要挨幾下（隊伍和怪物同等級） */
export function durability(monster, trials, boss = bossIds().has(monster)) {
    const m = enemies[monster];
    let dmg = 0;
    let hits = 0;
    for (let t = 0; t < trials; t++) {
        const r = trial(monster, m.level, 1000 + t);
        dmg += r.dmg;
        hits += r.hits;
    }
    const perHit = hits ? dmg / hits : 0;
    const perRound = dmg / trials / ROUNDS;
    const r1 = (n) => Math.round(n * 10) / 10;
    return { id: m.id, name: m.name, level: m.level, hp: m.hp, boss, perHit: r1(perHit), perRound: r1(perRound), hitsToKill: r1(m.hp / perHit), roundsToKill: Math.round((m.hp / perRound) * 100) / 100 };
}
function fight(group, level, seed) {
    const state = newGame({ name: 'x', race: 'human', classId: 'fighter', seed });
    state.party = party(level, seed);
    const rng = new Rng(seed * 7 + 1);
    const combat = startCombat(state, group);
    for (let guard = 0; combat.status === 'ongoing' && combat.round <= 30 && guard < 3000; guard++) {
        const actor = currentActor(combat);
        if (!actor || actor.side !== 'party')
            break;
        const foes = combat.combatants.filter((c) => c.side === 'enemy' && isActive(c));
        const target = foes.sort((a, b) => a.hp - b.hp)[0];
        if (!target)
            break;
        const plan = chooseAction(combat, rng, actor, target, false);
        if (plan)
            act(state, { type: 'ability', ability: plan.ability.id, ...(plan.target ? { target: plan.target } : plan.ability.target === 'enemy' ? { target: target.id } : {}) });
        else if (actor.ap >= 2)
            act(state, { type: 'attack', target: target.id });
        else
            act(state, { type: 'end_turn' });
    }
    const members = combat.combatants.filter((c) => c.side === 'party');
    return {
        win: combat.status === 'victory',
        rounds: combat.round,
        hpLeft: members.reduce((s, c) => s + Math.max(0, c.hp), 0) / members.reduce((s, c) => s + c.maxHp, 0),
        downed: members.filter((c) => c.hp <= 0).length,
    };
}
/** 每座地下城每一層的層主戰（隊伍等級 = 層主等級 + levelOffset） */
export function bossFights(trials, levelOffset = 0) {
    const rows = [];
    for (const [dungeon, enc] of Object.entries(dungeonEncounters)) {
        for (const [layer, group] of Object.entries(enc.bosses ?? {})) {
            const boss = group?.[0]?.[0];
            if (!group || !boss || !enemies[boss])
                continue;
            const level = Math.max(1, enemies[boss].level + levelOffset);
            const rs = Array.from({ length: trials }, (_, t) => fight(group, level, 2000 + t));
            const wins = rs.filter((r) => r.win);
            const avg = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
            const r2 = (n) => Math.round(n * 100) / 100;
            rows.push({
                dungeon, layer, boss, name: enemies[boss].name, bossLevel: enemies[boss].level, partyLevel: level, hp: enemies[boss].hp,
                win: r2(wins.length / trials), rounds: r2(avg(rs.map((r) => r.rounds))),
                hpLeft: r2(avg(wins.map((r) => r.hpLeft))), hpAll: r2(avg(rs.map((r) => (r.win ? r.hpLeft : 0)))), downed: r2(avg(wins.map((r) => r.downed))),
            });
        }
    }
    return rows;
}
/** 抽測一般遭遇：每座地下城每一層抽 perLayer 組（隊伍等級 = 那一組怪物的最高等級 + levelOffset） */
export function layerFights(trials, perLayer = 2, levelOffset = 0) {
    const rows = [];
    const rng = new Rng(77);
    for (const [dungeon, enc] of Object.entries(dungeonEncounters)) {
        for (const layer of ['outskirts', 'shallow', 'middle', 'deep', 'abyss']) {
            const table = enc[layer] ?? [];
            const picks = [...table].sort(() => rng.next() - 0.5).slice(0, perLayer);
            for (const group of picks) {
                const level = Math.max(1, Math.max(...group.map(([id]) => enemies[id]?.level ?? 1)) + levelOffset);
                const rs = Array.from({ length: trials }, (_, t) => fight(group, level, 3000 + t));
                const wins = rs.filter((r) => r.win);
                const avg = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
                const r2 = (n) => Math.round(n * 100) / 100;
                rows.push({
                    dungeon, layer, group: group.map(([id, n]) => `${enemies[id]?.name ?? id}×${n}`).join('、'), level,
                    win: r2(wins.length / trials), rounds: r2(avg(rs.map((r) => r.rounds))), hpLeft: r2(avg(wins.map((r) => r.hpLeft))), downed: r2(avg(wins.map((r) => r.downed))),
                });
            }
        }
    }
    return rows;
}
