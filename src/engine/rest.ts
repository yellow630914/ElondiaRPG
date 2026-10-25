// 短休與長休（依 D&D 5e）。
//
// - 短休：1 小時，戰鬥以外幾乎都可以。每位隊員可以花生命骰回復生命值（每顆 = 生命骰 + mod(力量) + mod(信仰)，至少 1）。
//   荒野與地下城（安全房以外）有機率在休息時被襲擊。
// - 長休：8 小時，只能在旅店或安全點（地下城的安全房）。生命值與法術環全滿、每次休息的能力重置、
//   回復一半的生命骰（至少 1），解除「受罰」。兩次長休至少隔 long_rest_gap_hours 小時（預設 16，設定裡可以改）。
// - 每次休息結束時進行離隊檢查（見 restChecks）。

import { checkBonus } from './perks'
import { attrOf, mod, proficiency, snapshot } from './character'
import { encounterFor, startCombat, type CombatState } from './combat'
import { classDef, companionRules, homeRules, locationById, regionById, slaveryRules, wildEncounters, type DungeonLayerId } from './data'
import { currentArea, currentCell, DUNGEON_LAYERS } from './grid'
import { comfortOf, hasBed, homeOfArea } from './homes'
import { formatMoney } from './money'
import { clearInviteCooldowns } from './companions'
import { addAffinity, addCondition, isBound, isFugitive, leaderGroup, leaderOf, leaveParty, pcOf, punish, recapturePlayer, removeCondition } from './party'
import { roll, withBonus, type Rng } from './rng'
import { contractTerms } from './slavery'
import { bestTool } from './tools'
import { addHours, commitReport, newReportId, withRng } from './state'
import type { Character, GameState, GameTime, Report } from './types'
import { contractOf } from './tattoos'
import { gameRule } from './gameRules'
import { squadMates } from './squads'

export const INN_CC_PER_PERSON = 15

export function innCost(state: GameState): number {
  const mult = isFugitive(state) ? 2 : 1
  return INN_CC_PER_PERSON * state.party.length * mult
}

export function hitDie(c: Character): number {
  return classDef(c.class).hit_die
}

export function hitDiceLeft(c: Character): number {
  return Math.max(0, c.level - (c.hitDiceUsed ?? 0))
}

function hitDieBonus(c: Character): number {
  return mod(attrOf(c, 'str')) + mod(attrOf(c, 'fai'))
}

function minutesBetween(a: GameTime, b: GameTime): number {
  const t = (x: GameTime) => ((x.day - 1) * 24 + (x.hour ?? 0)) * 60 + (x.minute ?? 0)
  return t(b) - t(a)
}

// 兩次長休的最短間隔（小時）：預設 companions.json 的 long_rest_gap_hours，設定的「遊戲規則」可以改（引擎不讀設定，由畫面呼叫）
let longRestGap = companionRules.rest.long_rest_gap_hours

export function setLongRestGap(hours: number | string | null | undefined) {
  // 設定欄清空時（v-model.number 給的是空字串）用預設，不要當成 0 小時
  const h = hours === '' || hours === null || hours === undefined ? NaN : Number(hours)
  longRestGap = Number.isFinite(h) ? Math.max(0, Math.min(24, h)) : companionRules.rest.long_rest_gap_hours
}

export function longRestGapHours(): number {
  return longRestGap
}

/** 還要幾分鐘才能再長休（0＝現在就可以） */
export function longRestWait(state: GameState): number {
  if (!state.lastLongRest) return 0
  return Math.max(0, Math.ceil(longRestGap * 60 - minutesBetween(state.lastLongRest, state.time)))
}

/** 「還要 X 小時 Y 分」 */
export function waitText(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return [h ? `${h} 小時` : '', m ? `${m} 分` : ''].filter(Boolean).join(' ') || '0 分'
}

/** 擋住休息（短休、長休）的事件：對峙、刻印、主人的要求、戰敗事件；沒有時回傳 null */
export function restEventBlock(state: GameState): string | null {
  if (state.standoff) return '先處理眼前的對峙'
  if (state.pendingMark) return '先完成契約印記的刻印'
  if (state.pendingMasterEvent) return '先回應主人的要求'
  if (state.pendingDefeat) return '先應付眼前的處境'
  if (state.captives?.npcs.length) return '先決定怎麼處置被制伏的人'
  return null
}

/** 不能長休的原因；可以時回傳 null */
export function longRestBlocked(state: GameState, place: RestPlace): string | null {
  if (state.combat) return '戰鬥中'
  const event = restEventBlock(state)
  if (event) return event
  const cell = currentCell(state)
  if (place === 'home') {
    const home = homeOfArea(state, currentArea(state))
    if (!home) return '要在自己的房子裡'
    // 主人的家：睡在下人房，不用自己的床
    if (!home.master && !hasBed(home)) return '家裡還沒有床'
  }
  if (place === 'inn' && cell.kind !== 'inn') return '要在旅店才能長休'
  if (place === 'safe' && cell.kind !== 'safe') return '要在安全房才能長休'
  if (place === 'safe' && cell.done) return '這間安全房已經長休過了'
  const wait = longRestWait(state)
  if (wait > 0) return `還要 ${waitText(wait)}才能再長休（兩次長休至少隔 ${longRestGap} 小時）`
  return null
}

function restReport(state: GameState, hours: number, scene: string): Report {
  const start = { ...state.time }
  const loc = locationById(state.location)
  const pc = pcOf(state)
  return {
    schema_version: '0.1',
    report_id: newReportId(state),
    kind: 'rest',
    time: { start, end: addHours(start, hours) },
    location: { at: state.location, region: loc.region, scene },
    party: state.party.map((m) => snapshot(m, undefined, pc)),
    outcome: { result: 'success' },
    changes: {},
    narration: { pov: 'second_person', length: 'short' },
    lore_keys: [loc.name, regionById(loc.region).name],
  }
}

/** 在這裡休息被襲擊的機率（安全房 0；帳篷減半；套用存檔規則） */
export function ambushChance(state: GameState): number {
  const area = currentArea(state)
  if (currentCell(state).kind === 'safe') return 0
  // 存檔規則的倍率
  const base = Math.min(1, (companionRules.rest.ambush[area.kind] ?? 0) * gameRule(state, 'ambushMult'))
  // 露營類的工具（帳篷）：在城外紮營休息，被襲擊的機率減半
  return area.kind !== 'settlement' && area.kind !== 'home' && bestTool(state, 'camp') ? base / 2 : base
}

/** 自動決定要花幾顆生命骰：還差半顆骰以上的傷就繼續花 */
export function autoHitDice(c: Character): number {
  const avg = Math.floor(hitDie(c) / 2) + 1 + hitDieBonus(c)
  let missing = c.maxHp - c.hp
  let n = 0
  while (n < hitDiceLeft(c) && missing >= Math.max(1, Math.ceil(avg / 2))) {
    missing -= Math.max(1, avg)
    n++
  }
  return n
}

/**
 * 短休。spend 指定每位隊員花幾顆生命骰（不指定則自動）。
 * 被襲擊時開始戰鬥並回傳戰鬥狀態（沒有休息效果）。
 */
export function shortRest(state: GameState, spend?: Record<string, number>): Report | CombatState {
  if (state.combat) throw new Error('戰鬥中不能休息')
  const event = restEventBlock(state)
  if (event) throw new Error(event)
  const area = currentArea(state)
  const ambushed = withRng(state, (rng) => rng.chance(ambushChance(state)))
  if (ambushed) {
    const layer = area.layer !== undefined ? (DUNGEON_LAYERS[area.layer]?.id as DungeonLayerId) : undefined
    const group = withRng(state, (rng) => (layer ? encounterFor(state.location, rng, layer) : rng.pick(wildEncounters(locationById(state.location).region))))
    return startCombat(state, group, { scene: `${area.name}（短休時遭到襲擊）`, intent: '短休時遭到襲擊' })
  }
  const report = restReport(state, gameRule(state, 'shortRestHours'), `${area.name}・短休`)
  const lines: string[] = []
  withRng(state, (rng) => {
    for (const m of state.party) {
      const n = Math.max(0, Math.min(hitDiceLeft(m), Math.floor(spend?.[m.id] ?? autoHitDice(m))))
      if (n === 0 || m.hp <= 0) continue
      const before = m.hp
      for (let i = 0; i < n; i++) m.hp = Math.min(m.maxHp, m.hp + Math.max(1, roll(rng, `1d${hitDie(m)}`).total + hitDieBonus(m)))
      m.hitDiceUsed = (m.hitDiceUsed ?? 0) + n
      ;(report.changes.hit_dice ??= []).push({ actor: m.id, spent: n, healed: m.hp - before })
      const snap = report.party.find((p) => p.id === m.id)
      if (snap) snap.hp = [before, m.hp, m.maxHp]
      lines.push(`${m.name}花了 ${n} 顆生命骰，回復 ${m.hp - before} 點生命值`)
    }
  })
  const checks = restChecks(state, report, 'short')
  report.outcome = {
    result: 'success',
    summary: [`在${area.name}短暫休息了一個小時。`, lines.join('；'), ...checks].filter(Boolean).join(''),
    tags: ['短休'],
  }
  return commitReport(state, report)
}

/** 長休：旅店（付費，到隔天早上）或安全房（每人 1 份乾糧，8 小時）。 */
/** 長休的地方：旅店、地下城的安全房、自己的房子（要有床） */
export type RestPlace = 'inn' | 'safe' | 'home'

export function longRest(state: GameState, place: RestPlace): Report {
  const blocked = longRestBlocked(state, place)
  if (blocked) throw new Error(blocked)
  const area = currentArea(state)
  let hours = gameRule(state, 'longRestHours')
  let scene = `${area.name}的安全房`
  let costText = ''
  const report = restReport(state, hours, scene)
  if (place === 'inn') {
    const cost = innCost(state)
    if (state.money_cc < cost) throw new Error('旅費不足')
    hours = Math.max(hours, (24 - state.time.hour + 8) % 24 || 24)
    scene = `${locationById(state.location).name}的旅店`
    report.changes.money_cc = -cost
    costText = `，花費 ${formatMoney(cost)}${isFugitive(state) ? '（身上的印記讓老闆加了價）' : ''}`
  } else if (place === 'home') {
    const home = homeOfArea(state, area)!
    hours = Math.max(hours, (24 - state.time.hour + 8) % 24 || 24)
    scene = home.master ? `主人的家「${home.name}」` : `自己的房子「${home.name}」`
  } else {
    const need = state.party.length
    const have = state.inventory.find((i) => i.name === '乾糧')?.qty ?? 0
    if (have < need) throw new Error(`需要 ${need} 份乾糧`)
    report.changes.items_lost = [{ name: '乾糧', qty: need }]
    currentCell(state).done = true
    costText = `，消耗乾糧 ${need} 份`
  }
  report.time.end = addHours(report.time.start, hours)
  report.location.scene = scene
  for (const m of state.party) {
    const snap = report.party.find((p) => p.id === m.id)
    if (snap) snap.hp = [m.hp, m.maxHp, m.maxHp]
    m.hp = m.maxHp
    m.slotsUsed = []
    m.usesPerRest = {}
    const regained = Math.min(m.hitDiceUsed ?? 0, Math.max(1, Math.floor(m.level / 2)))
    if (regained > 0) {
      m.hitDiceUsed = (m.hitDiceUsed ?? 0) - regained
      ;(report.changes.hit_dice ??= []).push({ actor: m.id, regained })
    }
    for (const id of [...m.status]) {
      if (companionRules.conditions[id]?.clears === 'long_rest') removeCondition(m, id, report)
    }
  }
  // 在舒適的家裡睡：睡得香甜
  const home = place === 'home' ? homeOfArea(state, area) : undefined
  const rested = !!home && comfortOf(home) >= homeRules.comfort_rested
  if (rested) for (const m of state.party) addCondition(m, 'well_rested', report)
  clearInviteCooldowns(state)
  const checks = restChecks(state, report, place)
  state.lastLongRest = { ...report.time.end }
  report.outcome = {
    result: 'success',
    summary: [`在${scene}好好睡了一覺${costText}。`, ...(rested ? ['家裡佈置得很舒服，大家都睡得很香甜。'] : []), ...checks].join(''),
    tags: ['長休', ...(place === 'safe' ? ['安全房'] : place === 'home' ? ['在家'] : [])],
  }
  return commitReport(state, report)
}

// ---- 休息時的離隊檢查 ----

/**
 * 每次短休、長休都會檢查：
 * 1. 親密度 ≤ -20 的同伴離隊（奴隸除外）。若是主角跟著的隊長，整支隊伍丟下主角離開。
 * 2. 主角打算離開別人的隊伍：正式道別或偷偷離開（靈巧檢定）。
 * 3. 逃亡奴隸：契約有追蹤功能時，有機率被主人找到。
 * 回傳要加進報告簡述的句子。
 */
export function restChecks(state: GameState, report: Report, place: 'short' | RestPlace): string[] {
  const lines: string[] = []
  const threshold = companionRules.leave_threshold
  const leader = leaderOf(state)

  if (leader && !isBound(state) && (leader.affinity ?? 0) <= threshold) {
    const names = leaderGroup(state).map((m) => m.name).join('、')
    for (const m of leaderGroup(state)) leaveParty(state, m.id, report, '對主角不滿，丟下主角離開')
    lines.push(`${names}對你積怨已深，趁休息時收拾行李離開了。`)
    delete state.pendingLeave
  }
  for (const m of [...state.party]) {
    if (m.isPlayer || m.bond === 'slave' || m.bond === 'leader' || m.bond === 'guest') continue
    if ((m.affinity ?? 0) > threshold || !state.party.includes(m)) continue
    // 整隊入隊的小隊：一個人受夠了，整隊一起走
    const mates = squadMates(state, m).filter((x) => x !== m)
    leaveParty(state, m.id, report, '親密度過低')
    for (const x of mates) leaveParty(state, x.id, report, `跟著${m.name}離開`)
    lines.push(mates.length ? `${m.name}受夠了，在休息時帶著${mates.map((x) => x.name).join('、')}離開了隊伍。` : `${m.name}受夠了，在休息時離開了隊伍。`)
  }

  if (state.pendingLeave) {
    const mode = state.pendingLeave.mode
    delete state.pendingLeave
    const group = leaderGroup(state)
    const head = leaderOf(state)
    if (head && !isBound(state)) {
      lines.push(withRng(state, (rng) => leaveOthersParty(state, report, head, group, mode, rng)))
    }
  }

  const pc = pcOf(state)
  const contract = contractOf(pc)
  if (contract && isFugitive(state)) {
    const def = contractTerms(contract)
    if (def.functions.includes('tracking')) {
      // 被找到的機率依休息的地方（slavery.json 的 track_place_mult）：旅店高、自己的房子低
      const mult = slaveryRules.track_place_mult[place] ?? 1
      const caught = withRng(state, (rng) => rng.chance(def.recapture_chance * mult))
      if (caught) {
        // 被找到：直接帶回主人的家，之後嚴加看管
        const sent = recapturePlayer(state, report, slaveryRules.master_home.strict.found)
        lines.push(`${contract.masterName}循著契約印記找到了你。`, punish(state, 'heavy', report), sent)
      }
    }
  }
  return lines
}

function leaveOthersParty(state: GameState, report: Report, head: Character, group: Character[], mode: 'sneak' | 'formal', rng: Rng): string {
  const pc = pcOf(state)
  const rules = companionRules.leave_party
  let line: string
  let delta: number
  if (mode === 'formal') {
    delta = rules.affinity.formal
    line = `你向${head.name}正式道別，離開了這支隊伍。`
  } else {
    const dice = withBonus('1d20', mod(attrOf(pc, 'dex')) + proficiency(pc.level) + checkBonus(pc, { context: 'stealth', attr: 'dex' }))
    const r = roll(rng, dice)
    const dc = rules.sneak_base + Math.floor(head.level / 2)
    const ok = r.total >= dc
    ;(report.timeline ??= []).push({
      seq: (report.timeline?.length ?? 0) + 1, time: report.time.end, actor: pc.id, action: '趁夜偷偷離開',
      target: head.id, roll: { dice, value: r.total, dc }, result: ok ? 'success' : 'fail',
    })
    delta = ok ? rules.affinity.sneak_success : rules.affinity.sneak_fail
    line = ok ? `你趁著${head.name}睡著，悄悄離開了隊伍。` : `你想偷偷離開，卻被${head.name}撞見，只好在尷尬中分道揚鑣。`
  }
  for (const m of group) {
    addAffinity(state, report, m.id, delta, mode === 'formal' ? '正式道別' : '不告而別')
    leaveParty(state, m.id, report, mode === 'formal' ? '主角正式道別' : '主角偷偷離開')
  }
  report.narration = { ...report.narration, focus: [...(report.narration?.focus ?? []), mode === 'formal' ? '主角與隊伍的道別' : '主角偷偷離開隊伍'] }
  return line
}
