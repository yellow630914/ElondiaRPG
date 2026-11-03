// 特質的主動行動（見 docs/PERKS.md）：
// - train：在公會、神殿、酒館等設施，或向身邊的老師（固定 NPC 的 mentor）花錢花時間受訓；成功時得到一次學這個特質的機會（也可以改寫說法交給 AI）。
//   身上的缺陷有 train 時，受訓是克服它：成功就拿掉這個缺陷。
// - perk_pitch：在取得特質的機會上（升級、事件、特殊任務、訓練、物品），不選提供的特質，寫一段說法擲骰交給 AI；
//   AI 依說法合不合理決定成功程度並設計特質（perk 欄位），程式依成功程度把強度夾在提供的特質附近。只有這些場合可以用。

import { locationById, npcs as namedNpcs, perkDef, perkRules, type Degree, type PerkDef } from './data'
import { cellName, currentArea, currentCell } from './grid'
import { closedHere } from './landmarks'
import { formatMoney } from './money'
import { pcOf } from './party'
import { presentHere } from './population'
import { snapshot } from './character'
import {
  dropOffer, grantPerk, learnablePerks, losePerk, offerPerks, overcomablePerks, parsePitchTarget, perkPower, pitchCap, sanitizePerk, takeOffer, trainablePerks, trainingFee,
} from './perks'
import { addHours, commitReport, newReportId } from './state'
import type { Character, GameState, PerkOffer, Report } from './types'

function memberOf(state: GameState, id: string): Character {
  const m = state.party.find((x) => x.id === id)
  if (!m) throw new Error('隊伍中沒有這位角色')
  return m
}

// ---- 訓練 ----

type Train = NonNullable<PerkDef['train']>

/** 可以受訓的一項：在這個設施，或向身邊的老師（mentor）；blocked 是還不能學的原因（例如好感不夠） */
export interface TrainOption { def: PerkDef; train: Train; mentor?: { id: string; name: string }; blocked?: string }

/**
 * 現在可以受訓的特質：這一格的設施（克服缺陷排前面），加上身邊的老師會教的（docs/LEWD_STATS.md 第 6.1 節）。
 * 同一個特質設施和老師都能學時，用老師的（比較便宜、比較簡單）；老師的好感不夠時照樣列出、標上原因
 */
export function trainOptions(state: GameState): TrainOption[] {
  const pc = pcOf(state)
  const cell = currentCell(state).kind
  const out: TrainOption[] = closedHere(state) ? [] : [...overcomablePerks(pc, cell), ...trainablePerks(pc, cell)].map((def) => ({ def, train: def.train! }))
  const learnable = new Map(learnablePerks(pc).map((p) => [p.id, p]))
  const r = perkRules.mentor
  for (const n of namedNpcs) {
    if (!n.mentor?.perks.length || n.id === pc.id || !presentHere(state, n.id)) continue
    const need = n.mentor.affinity ?? r.affinity
    const affinity = state.party.find((m) => m.id === n.id)?.affinity ?? state.relationships?.[n.id]?.affinity ?? 0
    for (const id of n.mentor.perks) {
      const def = learnable.get(id)
      if (!def) continue
      const base = def.train ?? { ...r.default_train, cells: [] }
      const train: Train = {
        ...base,
        price_cc: Math.round(base.price_cc * (n.mentor.price_mult ?? r.price_mult)),
        dc: Math.max(5, base.dc + r.dc_delta),
      }
      const opt: TrainOption = { def, train, mentor: { id: n.id, name: n.name }, ...(affinity < need ? { blocked: `和${n.name}再熟一點才肯教（好感要 ${need}）` } : {}) }
      const i = out.findIndex((o) => o.def.id === id)
      if (i < 0) out.push(opt)
      else if (!opt.blocked && (out[i]!.blocked || out[i]!.train.price_cc > train.price_cc)) out[i] = opt
    }
  }
  return out
}

function trainDef(state: GameState, perkId?: string) {
  const opt = trainOptions(state).find((o) => o.def.id === perkId)
  if (!opt) {
    const closed = closedHere(state)
    if (closed) throw new Error(closed)
    throw new Error(perkId && perkDef(perkId)?.flaw ? '這裡沒辦法克服這個缺陷' : '這裡學不到這個特質')
  }
  if (opt.blocked) throw new Error(opt.blocked)
  return { ...opt, cell: currentCell(state).kind }
}

export function setupTrain(state: GameState, target?: string) {
  const { def, train, cell, mentor } = trainDef(state, target)
  if (state.money_cc < train.price_cc) throw new Error(`錢不夠（受訓要 ${formatMoney(train.price_cc)}）`)
  const fee = (d: Degree) => formatMoney(trainingFee(train.price_cc, d))
  const where = mentor ? `跟著${mentor.name}` : `${locationById(state.location).name}的${cellName(cell)}`
  return {
    attr: train.attr, dc: train.dc, hours: train.hours, situational: [],
    scene: `${where}・${def.flaw ? `克服缺陷【${def.name}】` : `學習特質【${def.name}】`}`,
    outcomes: def.flaw ? {
      critical: `克服了缺陷（學費打對折：${fee('critical')}）`, success: `克服了缺陷（學費 ${fee('success')}）`, partial: `克服了缺陷（學費 ${fee('partial')}）`,
      fail: `還是改不掉（學費收一半：${fee('fail')}）`, fumble: `還是改不掉（學費照收：${fee('fumble')}）`,
    } as Partial<Record<Degree, string>> : {
      critical: `學會的機會（學費打對折：${fee('critical')}）`, success: `學會的機會（學費 ${fee('success')}）`, partial: `學會的機會（學費 ${fee('partial')}）`,
      fail: `沒學會（學費收一半：${fee('fail')}）`, fumble: `沒學會（學費照收：${fee('fumble')}）`,
    } as Partial<Record<Degree, string>>,
  }
}

export function applyTrain(state: GameState, report: Report, target: string, degree: Degree): string {
  const { def, train, mentor } = trainDef(state, target)
  const fee = Math.min(state.money_cc, trainingFee(train.price_cc, degree))
  report.changes.money_cc = (report.changes.money_cc ?? 0) - fee
  if (def.flaw) {
    if (degree === 'fail' || degree === 'fumble') return `花了 ${formatMoney(fee)}，【${def.name}】的毛病還是改不掉。`
    losePerk(pcOf(state), def.id, report)
    return `花了 ${formatMoney(fee)}，克服了缺陷【${def.name}】。`
  }
  if (degree === 'fail' || degree === 'fumble') return `花了 ${formatMoney(fee)}，還是沒抓到【${def.name}】的訣竅。`
  // 學會的機會：可以直接學，也可以改寫說法交給 AI
  offerPerks(pcOf(state), mentor ? `跟著${mentor.name}受訓` : `在${currentArea(state).name}受訓`, [def.id])
  return `花了 ${formatMoney(fee)}，${mentor ? `在${mentor.name}的指導下` : ''}掌握了【${def.name}】的訣竅（在事件視窗選擇學會）。`
}

// ---- 說法 ----

function pitchOffer(state: GameState, target?: string): { member: Character; offer: PerkOffer } {
  const { member, offer } = parsePitchTarget(target)
  const m = memberOf(state, member)
  const o = m.perkOffers?.find((x) => x.id === offer)
  if (!o) throw new Error('沒有這個取得特質的機會')
  if (!o.pitch) throw new Error('這次機會只能從提供的特質選')
  if (o.pitched) throw new Error('這次機會已經試過說法了，只能從提供的特質選')
  return { member: m, offer: o }
}

export function setupPitch(state: GameState, target?: string) {
  const { member, offer } = pitchOffer(state, target)
  const p = perkRules.pitch
  const names = offer.options.map((id) => perkDef(id)?.name ?? id).join('、')
  return {
    attr: p.attr, dc: p.dc, hours: p.hours, situational: [],
    ...(member.isPlayer ? {} : { actor: member.id }),
    scene: `${offer.source}・爭取一個特質（提供的是：${names || '無'}）`,
    outcomes: {
      critical: '照說法設計特質，可以比提供的稍強', success: '照說法設計特質，和提供的一樣強', partial: '照說法設計特質，但比提供的弱一點',
      fail: '說法不被採用，只能從提供的特質選', fumble: '說法不被採用，只能從提供的特質選',
    } as Partial<Record<Degree, string>>,
  }
}

/** 套用說法：成功程度決定強度上限；AI 沒有設計特質時不採用 */
export function applyPitch(state: GameState, report: Report, target: string, degree: Degree, raw: unknown): string {
  const { member, offer } = pitchOffer(state, target)
  const delta = perkRules.pitch.power_delta[degree]
  if (delta === undefined) {
    offer.pitched = true
    return `說法沒有被採用，只能從提供的特質選${offer.options.length ? '' : '（沒有可以選的，這次機會作廢）'}。`
  }
  const cap = pitchCap(offer, delta)
  const def = sanitizePerk(raw, `c-${state.nextReportNo}-${member.id}`, cap)
  if (!def) return '沒有設計出特質（需要 AI 判定），這次機會保留，可以從提供的特質選。'
  grantPerk(member, def, report)
  member.perkOffers = (member.perkOffers ?? []).filter((o) => o.id !== offer.id)
  return `${member.name}學會了特質【${def.name}】：${def.desc}（強度 ${perkPower(def)}／上限 ${cap}）`
}

/** 沒有可以選、也不能再試說法的機會：拿掉 */
export function pruneOffers(c: Character) {
  c.perkOffers = (c.perkOffers ?? []).filter((o) => o.options.length || (o.pitch && !o.pitched))
}

// ---- 從機會選一個、放棄 ----

function perkReport(state: GameState, hours: number): Report {
  const start = { ...state.time }
  const loc = locationById(state.location)
  const pc = pcOf(state)
  return {
    schema_version: '0.1', report_id: newReportId(state), kind: 'event',
    time: { start, end: addHours(start, hours) },
    location: { at: loc.id, region: loc.region, scene: currentArea(state).name },
    party: state.party.map((m) => snapshot(m, undefined, pc)),
    outcome: { result: 'success', tags: ['特質'] },
    changes: {},
    narration: { pov: 'second_person', length: 'short' },
    lore_keys: [loc.name],
  }
}

/** 從機會裡選一個特質學會（記一則日誌） */
export function learnFromOffer(state: GameState, memberId: string, offerId: string, perkId: string): Report {
  const m = memberOf(state, memberId)
  const source = m.perkOffers?.find((o) => o.id === offerId)?.source ?? ''
  const report = perkReport(state, 0)
  const def = takeOffer(m, offerId, perkId, report)
  report.outcome.summary = `${m.name}${source ? `（${source}）` : ''}學會了特質【${def.name}】：${def.desc}`
  report.narration = { pov: 'second_person', length: 'short', focus: [`${m.name}學會【${def.name}】的契機`] }
  return commitReport(state, report)
}

/** 放棄這次機會 */
export function declineOffer(state: GameState, memberId: string, offerId: string) {
  dropOffer(memberOf(state, memberId), offerId)
}
