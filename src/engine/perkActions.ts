// 特質的主動行動（見 docs/PERKS.md）：
// - train：在公會、神殿、酒館等設施花錢花時間受訓；成功時得到一次學這個特質的機會（也可以改寫說法交給 AI）。
// - perk_pitch：在取得特質的機會上（升級、事件、特殊任務、訓練、物品），不選提供的特質，寫一段說法擲骰交給 AI；
//   AI 依說法合不合理決定成功程度並設計特質（perk 欄位），程式依成功程度把強度夾在提供的特質附近。只有這些場合可以用。

import { locationById, perkDef, perkRules, type Degree } from './data'
import { currentArea, currentCell, CELL_NAME } from './grid'
import { formatMoney } from './money'
import { pcOf } from './party'
import { snapshot } from './character'
import {
  dropOffer, grantPerk, offerPerks, parsePitchTarget, perkPower, pitchCap, sanitizePerk, takeOffer, trainablePerks, trainingFee,
} from './perks'
import { addHours, commitReport, newReportId } from './state'
import type { Character, GameState, PerkOffer, Report } from './types'

function memberOf(state: GameState, id: string): Character {
  const m = state.party.find((x) => x.id === id)
  if (!m) throw new Error('隊伍中沒有這位角色')
  return m
}

// ---- 訓練 ----

function trainDef(state: GameState, perkId?: string) {
  const cell = currentCell(state).kind
  const def = trainablePerks(pcOf(state), cell).find((p) => p.id === perkId)
  if (!def?.train) throw new Error('這裡學不到這個特質')
  return { def, train: def.train, cell }
}

export function setupTrain(state: GameState, target?: string) {
  const { def, train, cell } = trainDef(state, target)
  if (state.money_cc < train.price_cc) throw new Error(`錢不夠（受訓要 ${formatMoney(train.price_cc)}）`)
  const fee = (d: Degree) => formatMoney(trainingFee(train.price_cc, d))
  return {
    attr: train.attr, dc: train.dc, hours: train.hours, situational: [],
    scene: `${locationById(state.location).name}的${CELL_NAME[cell as keyof typeof CELL_NAME] ?? cell}・學習特質【${def.name}】`,
    outcomes: {
      critical: `學會的機會（學費打對折：${fee('critical')}）`, success: `學會的機會（學費 ${fee('success')}）`, partial: `學會的機會（學費 ${fee('partial')}）`,
      fail: `沒學會（學費收一半：${fee('fail')}）`, fumble: `沒學會（學費照收：${fee('fumble')}）`,
    } as Partial<Record<Degree, string>>,
  }
}

export function applyTrain(state: GameState, report: Report, target: string, degree: Degree): string {
  const { def, train } = trainDef(state, target)
  const fee = Math.min(state.money_cc, trainingFee(train.price_cc, degree))
  report.changes.money_cc = (report.changes.money_cc ?? 0) - fee
  if (degree === 'fail' || degree === 'fumble') return `花了 ${formatMoney(fee)}，還是沒抓到【${def.name}】的訣竅。`
  // 學會的機會：可以直接學，也可以改寫說法交給 AI
  offerPerks(pcOf(state), `在${currentArea(state).name}受訓`, [def.id])
  return `花了 ${formatMoney(fee)}，掌握了【${def.name}】的訣竅（在事件視窗選擇學會）。`
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
