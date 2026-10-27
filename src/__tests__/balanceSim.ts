// 戰鬥耐打度的模擬（docs/MONSTERS.md「耐打度」）：4 人隊伍（戰士、遊蕩者、牧師、法師）用和怪物同等級的角色
// （依職業學的技能、依等級生成的裝備），打一隻去掉弱點（保留抗性）與特徵、血量無限的怪物，量平均每一擊的傷害與每回合的傷害。
// 隊員的打法：能用的傷害技能挑環數最高的，沒有就普通攻擊，行動點不夠就結束回合。
import { abilities, abilityDef, dungeonEncounters, enemies, geography, wildEncounters, type EncounterGroup } from '@/engine/data'
import { builtinAbility } from '@/engine/mods'
import { createNpc } from '@/engine/character'
import { act, chooseAction, currentActor, isActive, startCombat, usableAbilities, type Combatant } from '@/engine/combat'
import { Rng } from '@/engine/rng'
import { newGame } from '@/engine/state'
import type { Difficulty } from '@/engine/types'

export const PARTY = ['fighter', 'rogue', 'cleric', 'wizard']
const ROUNDS = 3
/** 算成「一拳一個小朋友」的門檻：生命在最大值的這個比例以上，被敵人一次出手直接打倒 */
export const ONE_SHOT_FROM = 0.9

/** 模擬用的隊伍（測試也用） */
export function simParty(level: number, seed: number, classes: string[] = PARTY) {
  const rng = new Rng(seed)
  // 自建的玩家能力不給模擬隊伍學（不然升級時抽到的能力會變，比較的基準跟著動）；改過的內建能力照用
  const extra = Object.entries(abilities).filter(([id]) => !builtinAbility(id))
  for (const [id] of extra) delete abilities[id]
  try {
    return classes.map((cls, i) => {
      const c = createNpc({ id: `p${i}`, name: cls, race: 'human', class: cls, level, location: 'soriel', hire_cc: 0, personality: '' } as never, rng)
      if (i === 0) c.isPlayer = true
      return c
    })
  } finally {
    for (const [id, a] of extra) abilities[id] = a
  }
}

const hitsEnemy = (id: string) => {
  const a = abilityDef(id)
  return !!a.damage?.length && ['enemy', 'all_enemies', 'random_enemies'].includes(a.target)
}

/** 一場模擬（ROUNDS 回合）：造成的傷害與有傷害的出手次數 */
function trial(monster: string, level: number, seed: number) {
  const state = newGame({ name: 'x', race: 'human', classId: 'fighter', seed })
  state.party = simParty(level, seed)
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
  /** 整場倒下過的平均人數（被救起來的也算） */
  downedEver: number
  /** 平均「最痛的一拳」占隊員最大生命的比例 */
  worstHit: number
  /** 有人被敵人一次出手從幾乎滿血直接打倒的場次比例（「一拳一個小朋友」） */
  oneShot: number
}

function fight(group: EncounterGroup, level: number, seed: number, classes: string[] = PARTY, difficulty: Difficulty = 'normal') {
  const state = newGame({ name: 'x', race: 'human', classId: 'fighter', seed, options: { defeatLoot: 'half', difficulty } })
  state.party = simParty(level, seed, classes)
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
  // 「一拳一個小朋友」：照戰報重播每個人的生命（傷害與治療的量都是實際數字），量三件事——
  // worstHit：敵人一次出手對同一個隊員造成的傷害（多段加起來）占他最大生命的最高比例；
  // oneShot：有沒有人被一次出手從幾乎滿血（ONE_SHOT_FROM 以上）直接打倒；
  // downedEver：整場倒下過的人數（被救起來的也算，收場時的 downed 不算他們）。
  const maxHp = Object.fromEntries(members.map((c) => [c.id, c.maxHp]))
  const hp = { ...Object.fromEntries(members.map((c) => [c.id, combat.startHp[c.id] ?? c.maxHp])) }
  const downedEver = new Set<string>()
  let worstHit = 0
  let oneShot = false
  for (const t of combat.timeline) {
    const enemy = combat.combatants.find((c) => c.id === t.actor)?.side === 'enemy'
    const dealt: Record<string, number> = {}
    for (const e of t.effects ?? []) {
      const id = e.target ?? ''
      if (!maxHp[id]) continue
      const amount = (e as { amount?: number }).amount ?? 0
      if (e.type === 'damage') dealt[id] = (dealt[id] ?? 0) + amount
      else if (e.type === 'heal') hp[id] = Math.min(maxHp[id]!, (hp[id] ?? 0) + amount)
    }
    for (const [id, dmg] of Object.entries(dealt)) {
      const before = hp[id] ?? 0
      hp[id] = Math.max(0, before - dmg)
      if (hp[id] === 0) downedEver.add(id)
      if (!enemy) continue
      worstHit = Math.max(worstHit, dmg / maxHp[id]!)
      if (hp[id] === 0 && before >= maxHp[id]! * ONE_SHOT_FROM) oneShot = true
    }
  }
  return {
    win: combat.status === 'victory',
    rounds: combat.round,
    hpLeft: members.reduce((s, c) => s + Math.max(0, c.hp), 0) / members.reduce((s, c) => s + c.maxHp, 0),
    downed: members.filter((c) => c.hp <= 0).length,
    downedEver: downedEver.size,
    worstHit,
    oneShot,
  }
}

/** 特殊任務的戰鬥（例如頭目＋手下）：4 人隊伍、隊伍等級 level，回傳勝率、平均回合、贏的場次剩下的生命（hpLeft）與輸了算 0 的平均（hpAll） */
export function groupFight(group: EncounterGroup, level: number, trials: number, difficulty: Difficulty = 'normal') {
  const rs = Array.from({ length: trials }, (_, t) => fight(group, level, 5000 + t, PARTY, difficulty))
  const wins = rs.filter((r) => r.win)
  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0)
  const r2 = (n: number) => Math.round(n * 100) / 100
  return {
    win: r2(wins.length / trials), rounds: r2(avg(rs.map((r) => r.rounds))), hpLeft: r2(avg(wins.map((r) => r.hpLeft))),
    hpAll: r2(avg(rs.map((r) => (r.win ? r.hpLeft : 0)))), downed: r2(avg(wins.map((r) => r.downed))),
    downedEver: r2(avg(rs.map((r) => r.downedEver))), worstHit: r2(avg(rs.map((r) => r.worstHit))), oneShot: r2(rs.filter((r) => r.oneShot).length / trials),
  }
}

/** 每座地下城每一層的層主戰（隊伍等級 = 層主等級 + levelOffset） */
export function bossFights(trials: number, levelOffset = 0, only?: { dungeon: string; layer: string }, difficulty: Difficulty = 'normal'): FightRow[] {
  const rows: FightRow[] = []
  for (const [dungeon, enc] of Object.entries(dungeonEncounters)) {
    if (only && dungeon !== only.dungeon) continue
    for (const [layer, group] of Object.entries(enc.bosses ?? {})) {
      if (only && layer !== only.layer) continue
      const boss = group?.[0]?.[0]
      if (!group || !boss || !enemies[boss]) continue
      const level = Math.max(1, enemies[boss]!.level + levelOffset)
      const rs = Array.from({ length: trials }, (_, t) => fight(group, level, 2000 + t, PARTY, difficulty))
      const wins = rs.filter((r) => r.win)
      const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0)
      const r2 = (n: number) => Math.round(n * 100) / 100
      rows.push({
        dungeon, layer, boss, name: enemies[boss]!.name, bossLevel: enemies[boss]!.level, partyLevel: level, hp: enemies[boss]!.hp,
        win: r2(wins.length / trials), rounds: r2(avg(rs.map((r) => r.rounds))),
        hpLeft: r2(avg(wins.map((r) => r.hpLeft))), hpAll: r2(avg(rs.map((r) => (r.win ? r.hpLeft : 0)))), downed: r2(avg(wins.map((r) => r.downed))),
        downedEver: r2(avg(rs.map((r) => r.downedEver))), worstHit: r2(avg(rs.map((r) => r.worstHit))), oneShot: r2(rs.filter((r) => r.oneShot).length / trials),
      })
    }
  }
  return rows
}

export interface GroupRow { dungeon: string; layer: string; group: string; level: number; win: number; rounds: number; hpLeft: number; downed: number; downedEver: number; worstHit: number; oneShot: number }

/** 抽測一般遭遇：每座地下城每一層抽 perLayer 組（隊伍等級 = 那一組怪物的最高等級 + levelOffset） */
export function layerFights(trials: number, perLayer = 2, levelOffset = 0, difficulty: Difficulty = 'normal'): GroupRow[] {
  const rows: GroupRow[] = []
  const rng = new Rng(77)
  for (const [dungeon, enc] of Object.entries(dungeonEncounters)) {
    for (const layer of ['outskirts', 'shallow', 'middle', 'deep', 'abyss'] as const) {
      const table = enc[layer] ?? []
      const picks = [...table].sort(() => rng.next() - 0.5).slice(0, perLayer)
      for (const group of picks) {
        const level = Math.max(1, Math.max(...group.map(([id]) => enemies[id]?.level ?? 1)) + levelOffset)
        const rs = Array.from({ length: trials }, (_, t) => fight(group, level, 3000 + t, PARTY, difficulty))
        const wins = rs.filter((r) => r.win)
        const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0)
        const r2 = (n: number) => Math.round(n * 100) / 100
        rows.push({
          dungeon, layer, group: group.map(([id, n]) => `${enemies[id]?.name ?? id}×${n}`).join('、'), level,
          win: r2(wins.length / trials), rounds: r2(avg(rs.map((r) => r.rounds))), hpLeft: r2(avg(wins.map((r) => r.hpLeft))), downed: r2(avg(wins.map((r) => r.downed))),
          downedEver: r2(avg(rs.map((r) => r.downedEver))), worstHit: r2(avg(rs.map((r) => r.worstHit))), oneShot: r2(rs.filter((r) => r.oneShot).length / trials),
        })
      }
    }
  }
  return rows
}

/**
 * 小怪輸出的測試隊伍：依怪物出現的最淺區域（郊外 1 人、周邊 2 人固定一名戰士、淺層 3 人固定一名牧師），
 * 其餘隊員從遊蕩者、戰士、法師輪替；只在中層以下出現的照 4 人隊伍。
 */
export const AREA_PARTIES = {
  wild: [['rogue'], ['fighter'], ['wizard']],
  outskirts: [['fighter', 'rogue'], ['fighter', 'fighter'], ['fighter', 'wizard']],
  shallow: [['cleric', 'rogue', 'fighter'], ['cleric', 'rogue', 'wizard'], ['cleric', 'fighter', 'wizard']],
  full: [PARTY],
} as const
export type MinionArea = keyof typeof AREA_PARTIES

/** 怪物出現的最淺區域：城郊遭遇表算郊外，再來是地下城的周邊、淺層 */
export function minionArea(id: string): MinionArea {
  const has = (groups: EncounterGroup[] | undefined) => !!groups?.some((g) => g.some(([m]) => m === id))
  if (geography.regions.some((r) => has(wildEncounters(r.id)))) return 'wild'
  const tables = Object.values(dungeonEncounters)
  if (tables.some((e) => has(e.outskirts))) return 'outskirts'
  if (tables.some((e) => has(e.shallow))) return 'shallow'
  return 'full'
}

export interface MinionRow { id: string; name: string; level: number; area: MinionArea; win: number; rounds: number; hpLeft: number; downedEver: number; worstHit: number; oneShot: number }

/** 每種小怪兩隻一組，打同等級、依出現區域組成的隊伍（每種隊伍各 trials 場）：調整小怪輸出用（目標每場掉的生命：城郊 25～35%、周邊 20～30%、淺層 15～20%、中層以下 10～15%） */
export function minionFight(id: string, trials: number, difficulty: Difficulty = 'normal'): MinionRow {
  const m = enemies[id]!
  const area = minionArea(id)
  const rs = AREA_PARTIES[area].flatMap((classes) => Array.from({ length: trials }, (_, t) => fight([[m.id, 2]], m.level, 4000 + t, [...classes], difficulty)))
  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0)
  const r2 = (n: number) => Math.round(n * 1000) / 1000
  // 輸了算剩 0
  return {
    id: m.id, name: m.name, level: m.level, area, win: r2(rs.filter((r) => r.win).length / rs.length), rounds: r2(avg(rs.map((r) => r.rounds))),
    hpLeft: r2(avg(rs.map((r) => (r.win ? r.hpLeft : 0)))),
    downedEver: r2(avg(rs.map((r) => r.downedEver))), worstHit: r2(avg(rs.map((r) => r.worstHit))), oneShot: r2(rs.filter((r) => r.oneShot).length / rs.length),
  }
}

export function minionFights(trials: number, difficulty: Difficulty = 'normal'): MinionRow[] {
  const bosses = bossIds()
  return Object.values(enemies).filter((m) => !bosses.has(m.id)).map((m) => minionFight(m.id, trials, difficulty))
}
