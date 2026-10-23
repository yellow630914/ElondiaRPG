// 戰鬥耐打度的模擬（docs/MONSTERS.md「耐打度」）：4 人隊伍（戰士、遊蕩者、牧師、法師）用和怪物同等級的角色
// （依職業學的技能、依等級生成的裝備），打一隻去掉弱點（保留抗性）與特徵、血量無限的怪物，量平均每一擊的傷害與每回合的傷害。
// 隊員的打法：能用的傷害技能挑環數最高的，沒有就普通攻擊，行動點不夠就結束回合。
import { abilityDef, dungeonEncounters, enemies, type EncounterGroup } from '@/engine/data'
import { createNpc } from '@/engine/character'
import { act, chooseAction, currentActor, isActive, startCombat, usableAbilities, type Combatant } from '@/engine/combat'
import { Rng } from '@/engine/rng'
import { newGame } from '@/engine/state'

export const PARTY = ['fighter', 'rogue', 'cleric', 'wizard']
const ROUNDS = 3

function party(level: number, seed: number) {
  const rng = new Rng(seed)
  return PARTY.map((cls, i) => {
    const c = createNpc({ id: `p${i}`, name: cls, race: 'human', class: cls, level, location: 'soriel', hire_cc: 0, personality: '' } as never, rng)
    if (i === 0) c.isPlayer = true
    return c
  })
}

const hitsEnemy = (id: string) => {
  const a = abilityDef(id)
  return !!a.damage?.length && ['enemy', 'all_enemies', 'random_enemies'].includes(a.target)
}

/** 一場模擬（ROUNDS 回合）：造成的傷害與有傷害的出手次數 */
function trial(monster: string, level: number, seed: number) {
  const state = newGame({ name: 'x', race: 'human', classId: 'fighter', seed })
  state.party = party(level, seed)
  const combat = startCombat(state, [[monster, 1]] as EncounterGroup)
  const e = combat.combatants.find((c) => c.side === 'enemy')!
  const def = enemies[monster]!
  // 去掉弱點與特徵，血量無限，也不會傷人
  e.hp = e.maxHp = 1e7
  e.attrs = { ...def.attrs }
  e.armorDr = def.dr
  e.armorEvade = def.evade
  // 抗性留著（負數），弱點拿掉（正數）
  e.resist = Object.fromEntries(Object.entries(def.resist ?? {}).filter(([, v]) => (v as number) < 0))
  e.statuses = []
  e.baseMods = {}
  e.weapon = { ...e.weapon, dice: '1d1' }
  e.abilities = []
  let dmg = 0
  let hits = 0
  for (let guard = 0; combat.status === 'ongoing' && combat.round <= ROUNDS && guard < 500; guard++) {
    const actor = currentActor(combat) as Combatant | null
    if (!actor || actor.side !== 'party') break
    for (const p of combat.combatants) if (p.side === 'party') p.hp = p.maxHp
    const best = usableAbilities(combat, actor.id).filter((a) => hitsEnemy(a.id)).sort((a, b) => (b.circle ?? 0) - (a.circle ?? 0))[0]
    const before = combat.timeline.length
    if (best) act(state, { type: 'ability', ability: best.id, target: e.id })
    else if (actor.ap >= 2) act(state, { type: 'attack', target: e.id })
    else act(state, { type: 'end_turn' })
    for (const t of combat.timeline.slice(before)) {
      if (t.actor !== actor.id) continue
      const d = (t.effects ?? []).filter((x) => x.type === 'damage' && x.target === e.id).reduce((s, x) => s + ((x as { amount?: number }).amount ?? 0), 0)
      if (d > 0) {
        dmg += d
        hits += 1
      }
    }
  }
  return { dmg, hits }
}

export interface Durability { id: string; name: string; level: number; hp: number; boss: boolean; perHit: number; perRound: number; hitsToKill: number; roundsToKill: number }

/** 各地下城各層的層主 */
export function bossIds(): Set<string> {
  const out = new Set<string>()
  for (const v of Object.values(dungeonEncounters)) for (const g of Object.values(v.bosses ?? {})) if (g?.[0]) out.add(g[0][0])
  return out
}

/** 一隻怪物要挨幾下（隊伍和怪物同等級） */
export function durability(monster: string, trials: number, boss = bossIds().has(monster)): Durability {
  const m = enemies[monster]!
  let dmg = 0
  let hits = 0
  for (let t = 0; t < trials; t++) {
    const r = trial(monster, m.level, 1000 + t)
    dmg += r.dmg
    hits += r.hits
  }
  const perHit = hits ? dmg / hits : 0
  const perRound = dmg / trials / ROUNDS
  const r1 = (n: number) => Math.round(n * 10) / 10
  return { id: m.id, name: m.name, level: m.level, hp: m.hp, boss, perHit: r1(perHit), perRound: r1(perRound), hitsToKill: r1(m.hp / perHit), roundsToKill: Math.round((m.hp / perRound) * 100) / 100 }
}

// ---- 完整戰鬥（docs/MONSTERS.md「層主戰」）：4 人隊伍打層主那一組遭遇（層主 + 護衛），雙方都照 AI 打 ----
// 隊員用敵人 AI 的打分數選行動（治療、增益、傷害技能），目標挑生命最低的敵人；滿血、法術環全滿、沒有道具。

export interface FightRow {
  dungeon: string; layer: string; boss: string; name: string; bossLevel: number; partyLevel: number; hp: number
  /** 勝率 */
  win: number
  /** 平均回合數 */
  rounds: number
  /** 獲勝時隊伍剩下的生命比例（全隊合計） */
  hpLeft: number
  /** 所有場次的平均剩下生命（輸了算 0）：調整層主輸出用的指標 */
  hpAll: number
  /** 獲勝時平均倒下幾人 */
  downed: number
}

function fight(group: EncounterGroup, level: number, seed: number) {
  const state = newGame({ name: 'x', race: 'human', classId: 'fighter', seed })
  state.party = party(level, seed)
  const rng = new Rng(seed * 7 + 1)
  const combat = startCombat(state, group)
  for (let guard = 0; combat.status === 'ongoing' && combat.round <= 30 && guard < 3000; guard++) {
    const actor = currentActor(combat)
    if (!actor || actor.side !== 'party') break
    const foes = combat.combatants.filter((c) => c.side === 'enemy' && isActive(c))
    const target = foes.sort((a, b) => a.hp - b.hp)[0]
    if (!target) break
    const plan = chooseAction(combat, rng, actor, target, false)
    if (plan) act(state, { type: 'ability', ability: plan.ability.id, ...(plan.target ? { target: plan.target } : plan.ability.target === 'enemy' ? { target: target.id } : {}) })
    else if (actor.ap >= 2) act(state, { type: 'attack', target: target.id })
    else act(state, { type: 'end_turn' })
  }
  const members = combat.combatants.filter((c) => c.side === 'party')
  return {
    win: combat.status === 'victory',
    rounds: combat.round,
    hpLeft: members.reduce((s, c) => s + Math.max(0, c.hp), 0) / members.reduce((s, c) => s + c.maxHp, 0),
    downed: members.filter((c) => c.hp <= 0).length,
  }
}

/** 每座地下城每一層的層主戰（隊伍等級 = 層主等級 + levelOffset） */
export function bossFights(trials: number, levelOffset = 0): FightRow[] {
  const rows: FightRow[] = []
  for (const [dungeon, enc] of Object.entries(dungeonEncounters)) {
    for (const [layer, group] of Object.entries(enc.bosses ?? {})) {
      const boss = group?.[0]?.[0]
      if (!group || !boss || !enemies[boss]) continue
      const level = Math.max(1, enemies[boss]!.level + levelOffset)
      const rs = Array.from({ length: trials }, (_, t) => fight(group, level, 2000 + t))
      const wins = rs.filter((r) => r.win)
      const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0)
      const r2 = (n: number) => Math.round(n * 100) / 100
      rows.push({
        dungeon, layer, boss, name: enemies[boss]!.name, bossLevel: enemies[boss]!.level, partyLevel: level, hp: enemies[boss]!.hp,
        win: r2(wins.length / trials), rounds: r2(avg(rs.map((r) => r.rounds))),
        hpLeft: r2(avg(wins.map((r) => r.hpLeft))), hpAll: r2(avg(rs.map((r) => (r.win ? r.hpLeft : 0)))), downed: r2(avg(wins.map((r) => r.downed))),
      })
    }
  }
  return rows
}

export interface GroupRow { dungeon: string; layer: string; group: string; level: number; win: number; rounds: number; hpLeft: number; downed: number }

/** 抽測一般遭遇：每座地下城每一層抽 perLayer 組（隊伍等級 = 那一組怪物的最高等級 + levelOffset） */
export function layerFights(trials: number, perLayer = 2, levelOffset = 0): GroupRow[] {
  const rows: GroupRow[] = []
  const rng = new Rng(77)
  for (const [dungeon, enc] of Object.entries(dungeonEncounters)) {
    for (const layer of ['outskirts', 'shallow', 'middle', 'deep', 'abyss'] as const) {
      const table = enc[layer] ?? []
      const picks = [...table].sort(() => rng.next() - 0.5).slice(0, perLayer)
      for (const group of picks) {
        const level = Math.max(1, Math.max(...group.map(([id]) => enemies[id]?.level ?? 1)) + levelOffset)
        const rs = Array.from({ length: trials }, (_, t) => fight(group, level, 3000 + t))
        const wins = rs.filter((r) => r.win)
        const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0)
        const r2 = (n: number) => Math.round(n * 100) / 100
        rows.push({
          dungeon, layer, group: group.map(([id, n]) => `${enemies[id]?.name ?? id}×${n}`).join('、'), level,
          win: r2(wins.length / trials), rounds: r2(avg(rs.map((r) => r.rounds))), hpLeft: r2(avg(wins.map((r) => r.hpLeft))), downed: r2(avg(wins.map((r) => r.downed))),
        })
      }
    }
  }
  return rows
}

export interface MinionRow { id: string; name: string; level: number; win: number; rounds: number; hpLeft: number }

/** 每種小怪兩隻一組，打同等級的隊伍：調整小怪輸出用（目標每場掉 10～15% 生命） */
export function minionFights(trials: number): MinionRow[] {
  const bosses = bossIds()
  return Object.values(enemies).filter((m) => !bosses.has(m.id)).map((m) => {
    const rs = Array.from({ length: trials }, (_, t) => fight([[m.id, 2]], m.level, 4000 + t))
    const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0)
    const r2 = (n: number) => Math.round(n * 1000) / 1000
    // 輸了算剩 0
    return { id: m.id, name: m.name, level: m.level, win: r2(rs.filter((r) => r.win).length / trials), rounds: r2(avg(rs.map((r) => r.rounds))), hpLeft: r2(avg(rs.map((r) => (r.win ? r.hpLeft : 0)))) }
  })
}
