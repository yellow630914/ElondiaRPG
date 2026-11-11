// 慾望戰鬥的平衡模擬（docs/COMBAT_SYSTEM.md 第 8.5 節）：把隊伍裡的一個人換成走慾望路線的角色，和一般隊伍比較。
// 慾望路線的打法用腳本（玩家實際會怎麼按），不是敵人 AI：
// - burst：先用自己增加慾望的技能（自我挑逗、寬衣、淫念冥想）把慾望堆到快滿，再引爆
// - charm：寬衣加成之後，用魅惑攻擊把敵人的慾望堆到高潮（高潮扣最大生命的百分比）
// 平常的測試只抽樣（lustBalance.spec.ts），完整的報告用 LUST_REPORT=路徑 跑。
import { abilityDef, dungeonEncounters, enemies, type EncounterGroup } from '@/engine/data'
import { act, chooseAction, currentActor, effectiveLustMax, isActive, startCombat, usableAbilities, type Combatant } from '@/engine/combat'
import { Rng } from '@/engine/rng'
import { newGame } from '@/engine/state'
import type { Character, Difficulty, GameOptions } from '@/engine/types'
import type { CombatState } from '@/engine/combat'
import { AREA_PARTIES, bossIds, minionArea, simParty } from './balanceSim'

/** 慾望路線的配置 */
export type LustProfile = 'none' | 'books' | 'school' | 'max'
export type LustPolicy = 'ai' | 'burst' | 'charm'

/** 戰鬥用得到的色情技能（技能書與老師都買得到的；寄生物、泌乳這類有條件的不算） */
const LUST_KIT = [
  'lust_self_tease', 'lust_disrobe', 'lust_meditate', 'lust_hot_spring',
  'burst_flame', 'burst_impact', 'burst_lightning', 'burst_bliss', 'burst_tide',
  'lust_glance', 'lust_perfume', 'lust_kiss', 'lust_arcane_stim', 'lust_boat_song', 'lust_courtship_mark',
]

/** 把一個角色改成慾望路線：學會等級夠的色情技能；school 另外修縱欲派、肉體派（入門＋進階），忍耐、淫亂、敏感練到 60 */
export function makeLustBuild(c: Character, profile: LustProfile) {
  if (profile === 'none') return
  const learn = LUST_KIT.filter((id) => (abilityDef(id).unlock ?? 1) <= c.level)
  // 放在最後：攜帶上限滿了時先帶最近學會的
  c.abilities = [...c.abilities.filter((id) => !learn.includes(id)), ...learn]
  c.loadout = undefined
  if (profile === 'school' || profile === 'max') {
    c.perks = [...(c.perks ?? []), 'school_indulgence', 'school_flesh', ...(c.level >= 5 ? ['wanton_blaze', 'afterglow_memory'] : [])]
    c.lewd = profile === 'max' ? { lewdness: 80, sensitivity: 60, endurance: 100, submission: 20 } : { lewdness: 60, sensitivity: 60, endurance: 60, submission: 20 }
    if (profile === 'max' && c.level >= 5) c.abilities.push('lust_endure')
  }
}

const has = (combat: CombatState, me: Combatant, id: string) => usableAbilities(combat, me.id).some((a) => a.id === id)
const apOf = (id: string) => abilityDef(id).ap ?? 1

/** 自己增加的慾望會不會讓自己高潮（留 1 點） */
function safeGain(me: Combatant, flat: number) {
  const self = me.lustMods?.self ?? 1
  return (me.lust ?? 0) + Math.round(flat * self) < effectiveLustMax(me)
}

/** 慾望路線的一步：回傳要做的事（null 交給一般 AI） */
function lustStep(combat: CombatState, me: Combatant, policy: LustPolicy, foes: Combatant[]): { ability: string; target?: string } | null {
  if (policy === 'ai') return null
  const ratio = (me.lust ?? 0) / Math.max(1, effectiveLustMax(me))
  const weakest = [...foes].sort((a, b) => a.hp - b.hp)[0]!
  const toughest = [...foes].sort((a, b) => b.hp - a.hp)[0]!
  if (policy === 'burst') {
    if (has(combat, me, 'lust_hot_spring')) return { ability: 'lust_hot_spring' }
    if (ratio < 0.3 && has(combat, me, 'lust_endure') && !me.statuses.some((s) => s.id === 'enduring') && me.ap >= 3) return { ability: 'lust_endure' }
    // 夠了就引爆：兩個以上敵人用全體的，不然單體
    if (ratio >= 0.7) {
      const aoe = foes.length >= 2 ? ['burst_tide', 'burst_bliss', 'burst_lightning'].find((id) => has(combat, me, id) && me.ap >= apOf(id)) : undefined
      const single = ['burst_flame', 'burst_impact'].find((id) => has(combat, me, id) && me.ap >= apOf(id))
      const pick = aoe ?? single
      if (pick) return { ability: pick, ...(abilityDef(pick).target === 'enemy' ? { target: toughest.id } : {}) }
    }
    // 堆慾望（自己的慾望不會因此高潮）；行動點不夠引爆的話留到下一回合
    for (const [id, flat] of [['lust_meditate', 30], ['lust_self_tease', 15], ['lust_disrobe', 20]] as const) {
      if (has(combat, me, id) && me.ap >= apOf(id) && safeGain(me, flat)) return { ability: id }
    }
    return null
  }
  // charm：寬衣加成這一回合造成的慾望，再用魅惑攻擊；目標挑最接近高潮的
  const close = [...foes].filter((f) => f.lustMax !== undefined).sort((a, b) => (b.lust ?? 0) / (b.lustMax ?? 1) - (a.lust ?? 0) / (a.lustMax ?? 1))[0] ?? weakest
  const disrobed = me.statuses.some((s) => s.id === 'disrobed')
  if (!disrobed && me.ap >= 3 && has(combat, me, 'lust_disrobe') && safeGain(me, 20)) return { ability: 'lust_disrobe' }
  if (foes.length >= 2) {
    const aoe = ['lust_boat_song', 'lust_perfume'].find((id) => has(combat, me, id) && me.ap >= apOf(id))
    if (aoe) return { ability: aoe }
  }
  const single = ['lust_kiss', 'lust_arcane_stim', 'lust_glance'].find((id) => has(combat, me, id) && me.ap >= apOf(id))
  if (single) return { ability: single, target: close.id }
  // 慾望夠了也可以引爆
  if (ratio >= 0.7) {
    const b = ['burst_flame', 'burst_impact'].find((id) => has(combat, me, id) && me.ap >= apOf(id))
    if (b) return { ability: b, target: toughest.id }
  }
  return null
}

export interface LustFightResult {
  win: boolean; rounds: number; hpLeft: number; downedEver: number
  /** 慾望路線那個人造成的傷害（含敵人高潮的真實傷害）占全隊的比例 */
  share: number
  /** 敵人高潮的真實傷害占全隊造成的傷害 */
  climaxShare: number
  /** 引爆單次的最高傷害 */
  bestBurst: number
}

/** 一場戰鬥：classes 是隊伍，lustSlot 那一位走慾望路線（-1 表示沒有人） */
export function lustFight(group: EncounterGroup, level: number, seed: number, classes: string[], lustSlot: number, profile: LustProfile, policy: LustPolicy,
  difficulty: Difficulty = 'normal', options: Partial<GameOptions> = {}): LustFightResult {
  const state = newGame({ name: 'x', race: 'human', classId: 'fighter', seed, options: { defeatLoot: 'half', difficulty, skillLoadout: 0, ...options } })
  state.party = simParty(level, seed, classes)
  if (lustSlot >= 0) makeLustBuild(state.party[lustSlot]!, profile)
  const rng = new Rng(seed * 7 + 1)
  const combat = startCombat(state, group)
  const lustId = lustSlot >= 0 ? state.party[lustSlot]!.id : ''
  for (let guard = 0; combat.status === 'ongoing' && combat.round <= 30 && guard < 3000; guard++) {
    const actor = currentActor(combat)
    if (!actor || actor.side !== 'party') break
    const foes = combat.combatants.filter((c) => c.side === 'enemy' && isActive(c))
    const target = [...foes].sort((a, b) => a.hp - b.hp)[0]
    if (!target) break
    const step = actor.id === lustId ? lustStep(combat, actor, policy, foes) : null
    if (step) {
      act(state, { type: 'ability', ...step })
      continue
    }
    const plan = chooseAction(combat, rng, actor, target, false)
    if (plan) act(state, { type: 'ability', ability: plan.ability.id, ...(plan.target ? { target: plan.target } : plan.ability.target === 'enemy' ? { target: target.id } : {}) })
    else if (actor.ap >= 2) act(state, { type: 'attack', target: target.id })
    else act(state, { type: 'end_turn' })
  }
  const members = combat.combatants.filter((c) => c.side === 'party')
  const enemyIds = new Set(combat.combatants.filter((c) => c.side === 'enemy').map((c) => c.id))
  let total = 0
  let mine = 0
  let climax = 0
  let bestBurst = 0
  const downed = new Set<string>()
  for (const t of combat.timeline) {
    for (const e of t.effects ?? []) {
      const amount = (e as { amount?: number }).amount ?? 0
      if (e.type !== 'damage') continue
      if (!enemyIds.has(e.target ?? '')) continue
      total += amount
      const isClimax = (e as { text?: string }).text === '高潮・真實傷害'
      if (isClimax) climax += amount
      // 高潮的真實傷害記在造成慾望的那一位（這一步的出手者）
      if (t.actor === lustId) mine += amount
      if (t.actor === lustId && /情焰|電光|衝擊|極樂之光|墮落之潮/.test(t.action ?? '') && !isClimax) bestBurst = Math.max(bestBurst, amount)
    }
  }
  for (const m of members) if (m.hp <= 0) downed.add(m.id)
  return {
    win: combat.status === 'victory', rounds: combat.round,
    hpLeft: members.reduce((s, c) => s + Math.max(0, c.hp), 0) / members.reduce((s, c) => s + c.maxHp, 0),
    downedEver: downed.size, share: total ? mine / total : 0, climaxShare: total ? climax / total : 0, bestBurst,
  }
}

export interface LustRow {
  scenario: string; label: string; level: number; profile: LustProfile; policy: LustPolicy; difficulty: Difficulty
  win: number; rounds: number; hpAll: number; share: number; climaxShare: number; bestBurst: number
}

function summarize(rs: LustFightResult[]) {
  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0)
  const r2 = (n: number) => Math.round(n * 100) / 100
  return {
    win: r2(rs.filter((r) => r.win).length / rs.length), rounds: r2(avg(rs.map((r) => r.rounds))),
    hpAll: r2(avg(rs.map((r) => (r.win ? r.hpLeft : 0)))), share: r2(avg(rs.map((r) => r.share))), climaxShare: r2(avg(rs.map((r) => r.climaxShare))),
    bestBurst: Math.round(Math.max(0, ...rs.map((r) => r.bestBurst))),
  }
}

/** 比較用的配置：一般（同一個位置換成吟遊詩人照 AI 打）、只買技能書、修流派；打法 burst／charm */
export const VARIANTS: { profile: LustProfile; policy: LustPolicy }[] = [
  { profile: 'none', policy: 'ai' },
  { profile: 'books', policy: 'burst' },
  { profile: 'books', policy: 'charm' },
  { profile: 'school', policy: 'burst' },
  { profile: 'school', policy: 'charm' },
  { profile: 'max', policy: 'burst' },
]

/** 層主戰：4 人隊伍（戰士、遊蕩者、牧師、吟遊詩人），吟遊詩人走慾望路線 */
export function lustBossRows(trials: number, difficulty: Difficulty, filter?: (dungeon: string, layer: string, level: number) => boolean, options: Partial<GameOptions> = {}): LustRow[] {
  const rows: LustRow[] = []
  for (const [dungeon, enc] of Object.entries(dungeonEncounters)) {
    for (const [layer, group] of Object.entries(enc.bosses ?? {})) {
      const boss = group?.[0]?.[0]
      if (!group || !boss || !enemies[boss]) continue
      const level = enemies[boss]!.level
      if (filter && !filter(dungeon, layer, level)) continue
      for (const v of VARIANTS) {
        const rs = Array.from({ length: trials }, (_, t) => lustFight(group, level, 2000 + t, ['fighter', 'rogue', 'cleric', 'bard'], 3, v.profile, v.policy, difficulty, options))
        rows.push({ scenario: 'boss', label: `${dungeon}/${layer} ${enemies[boss]!.name}`, level, ...v, difficulty, ...summarize(rs) })
      }
    }
  }
  return rows
}

/** 小怪：每種兩隻，依出現區域的隊伍（郊外 1 人、周邊 2 人、淺層 3 人、中層以下 4 人），最後一位換成吟遊詩人走慾望路線 */
export function lustMinionRows(trials: number, difficulty: Difficulty, filter?: (id: string) => boolean, options: Partial<GameOptions> = {}): LustRow[] {
  const bosses = bossIds()
  const rows: LustRow[] = []
  for (const m of Object.values(enemies)) {
    if (bosses.has(m.id) || (filter && !filter(m.id))) continue
    const area = minionArea(m.id)
    const parties = AREA_PARTIES[area].map((p) => [...p.slice(0, -1), 'bard'])
    for (const v of VARIANTS) {
      const rs = parties.flatMap((classes) => Array.from({ length: trials }, (_, t) => lustFight([[m.id, 2]], m.level, 4000 + t, classes, classes.length - 1, v.profile, v.policy, difficulty, options)))
      rows.push({ scenario: `minion:${area}`, label: m.name, level: m.level, ...v, difficulty, ...summarize(rs) })
    }
  }
  return rows
}
