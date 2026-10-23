// 戰鬥耐打度的模擬（docs/MONSTERS.md「耐打度」）：4 人隊伍（戰士、遊蕩者、牧師、法師）用和怪物同等級的角色
// （依職業學的技能、依等級生成的裝備），打一隻去掉弱點與特徵、血量無限的怪物，量平均每一擊的傷害與每回合的傷害。
// 隊員的打法：能用的傷害技能挑環數最高的，沒有就普通攻擊，行動點不夠就結束回合。
import { abilityDef, dungeonEncounters, enemies, type EncounterGroup } from '@/engine/data'
import { createNpc } from '@/engine/character'
import { act, currentActor, startCombat, usableAbilities, type Combatant } from '@/engine/combat'
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
  e.resist = Object.fromEntries(Object.entries(def.resist ?? {}).filter(([, v]) => (v as number) > 0))
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
