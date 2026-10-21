// 新增夥伴的五種方式與主角的奴隸身分。說明見 docs/COMPANIONS.md。
//
// 1. 酒館雇傭：候選名單受魅力、等級影響；玩家可自訂出價與談判方式，出價的權重最高，也可能免費雇到人。
// 2. 加入隊伍：在酒館等待別的隊伍邀請（或由事件邀請），魅力與等級加權，對方可能付錢給主角。
// 3. 買入奴隸：公開或不公開（黑市）的奴隸市場，主要看價格；殺價、魅惑等主動行動會影響價格。
// 4. 作為奴隸：主角在市場登記出售自己，被別人買入隊伍；主要看魅力與等級，很難主動影響。
// 5. 事件入隊：事件報酬（效果 companion，自願或奴隸），或主動邀請認識的人（需要親密度與魅力檢定）。
//
// 需要檢定的部分（雇傭談判、殺價、邀請、打聽黑市、談判解除契約、逃離）走主動行動（actions.ts），
// 這裡提供參考 DC、各成功程度的機制結果，以及套用結果的函式。

import type { AdultScene } from './content'
import { setupCraft, setupMake } from './craft'
import { isShopStaff } from './crafting'
import { setupStoryCheck } from './story'
import { setupDefeatEvent } from './defeat'
import { lifeTier, mod, snapshot } from './character'
import {
  actionRules, combatRules, companionRules, contractDef, locationById, npcPool, npcs as namedNpcs, regionById, slaveryRules,
  tagDef, type ActionKind, type AttrId, type Degree, type MarketDef, type NpcKind,
} from './data'
import type { Rng } from './rng'
import { formatMoney } from './money'
import { generateNpc, npcRecord, slavePrice, weightedPick } from './npcs'
import { hireable, presentHere } from './population'
import { setupStandoff } from './encounters'
import {
  atSafeSpot, contractTerms, masterNearby, remarkByMadam, setupMarking, setupMasterEvent, setupPermit, setupReturn, setupSeekMaster, setupUnmark, startMarking,
  type MarkChoice,
} from './slavery'
import { setupInteraction } from './interactions'
import {
  addAffinity, assertFree, enslavePlayer, freePlayer, freeSlave, changeMaster, isBound, isEnslaved, isFugitive, joinParty,
  leaderOf, partyRoom, pcOf, playerEscapes, punish, recapturePlayer, removeCondition, setHp,
} from './party'
import { negotiationSetup } from './negotiation'
import { setupPatron } from './brothel'
import { setupWork } from './work'
import { currentArea, currentCell } from './grid'
import { ensureRelationship } from './social'
import { bargainSetup } from './trade'
import { addHours, commitReport, newReportId, withRng } from './state'
import type { GameState, NpcRecord, PartyOffer, Report, SlaveListing, TavernCandidate } from './types'

function socialReport(state: GameState, hours: number, scene: string, kind: Report['kind'] = 'social'): Report {
  const start = { ...state.time }
  const loc = locationById(state.location)
  const pc = pcOf(state)
  return {
    schema_version: '0.1',
    report_id: newReportId(state),
    kind,
    time: { start, end: addHours(start, hours) },
    location: { at: state.location, region: loc.region, scene },
    party: state.party.map((m) => snapshot(m, undefined, pc)),
    outcome: { result: 'success' },
    changes: {},
    narration: { pov: 'second_person', length: 'short' },
    lore_keys: [loc.name, regionById(loc.region).name],
  }
}

function tavernScene(state: GameState) {
  return `${locationById(state.location).name}的酒館`
}

// ---- 1. 酒館雇傭 ----

/** 今天這座城鎮酒館的候選人（第一次查看時生成）。 */
export function tavernCandidates(state: GameState): TavernCandidate[] {
  const loc = state.location
  const today = state.time.day
  const taverns = (state.taverns ??= {})
  const existing = taverns[loc]?.day === today ? taverns[loc]!.candidates : []
  // 今天在城裡的冒險者（名單上的人與具名 NPC），保留今天談判過的狀態（拒絕、還價）
  const candidates = hireable(state).map((rec) => existing.find((c) => c.npc === rec.id) ?? { npc: rec.id, asking_cc: rec.hire_cc })
  taverns[loc] = { day: today, candidates, ...(taverns[loc]?.day === today && taverns[loc]?.flavored ? { flavored: true } : {}) }
  return candidates
}

export function candidate(state: GameState, npcId: string): TavernCandidate {
  const c = tavernCandidates(state).find((x) => x.npc === npcId)
  if (!c) throw new Error('酒館裡沒有這位冒險者')
  return c
}

/** 要價：部分成功後的還價優先 */
export function askingFor(c: TavernCandidate): number {
  return c.counter_cc ?? c.asking_cc
}

/** 雇傭談判的參考 DC：出價越低越難，對方等級比主角高也更難。 */
export function hireDc(state: GameState, npcId: string, offer: number): number {
  const c = candidate(state, npcId)
  const rec = npcRecord(state, npcId)!
  const h = companionRules.tavern.hire
  const asking = askingFor(c)
  const ratio = asking > 0 ? Math.max(0, Math.min(1, offer / asking)) : 1
  const dc = h.base + Math.ceil(h.fee_weight * (1 - ratio)) + h.level_gap * Math.max(0, rec.level - pcOf(state).level)
  return Math.max(h.min, Math.min(h.max, dc))
}

function assertCanHire(state: GameState, npcId: string, offer: number) {
  assertFree(state, '雇人')
  const c = candidate(state, npcId)
  if (c.declined) throw new Error('對方今天不想再談了')
  if (partyRoom(state) < 1) throw new Error(`隊伍最多 ${combatRules.party_max} 人`)
  if (offer < 0 || !Number.isFinite(offer)) throw new Error('出價錯誤')
  if (state.money_cc < offer) throw new Error('錢不夠')
}

/** 出價不低於要價：直接成交，不需檢定。 */
export function hireAtAsking(state: GameState, npcId: string, offer?: number): Report {
  const c = candidate(state, npcId)
  const fee = offer ?? askingFor(c)
  assertCanHire(state, npcId, fee)
  if (fee < askingFor(c)) throw new Error('出價低於要價，需要談判')
  const rec = npcRecord(state, npcId)!
  const report = socialReport(state, 1, tavernScene(state))
  joinParty(state, rec, 'hired', report, { reason: '雇傭' })
  report.changes.money_cc = -fee
  report.outcome.summary = `在酒館雇用了${rec.name}，支付 ${formatMoney(fee)}。`
  report.narration = { pov: 'second_person', length: 'short', focus: [`${rec.name}的第一印象與性格`] }
  return commitReport(state, report)
}

export function validateHire(state: GameState, npcId: string, offer: number) {
  assertCanHire(state, npcId, offer)
}

/** 雇傭談判的結果：成功以出價成交；部分成功對方還價；失敗今天不再談。 */
export function applyHire(state: GameState, report: Report, npcId: string, offer: number, degree: Degree): string {
  const c = candidate(state, npcId)
  const rec = npcRecord(state, npcId)!
  // 談過話就算認識了
  ensureRelationship(state, rec)
  switch (degree) {
    case 'critical':
    case 'success':
      if (state.money_cc < offer) return `${rec.name}答應了，但你已經付不出 ${formatMoney(offer)}。`
      joinParty(state, rec, 'hired', report, { reason: offer === 0 ? '免費同行' : '談判雇傭' })
      if (offer > 0) report.changes.money_cc = (report.changes.money_cc ?? 0) - offer
      if (degree === 'critical') addAffinity(state, report, npcId, 5, '談得很投機')
      return offer > 0 ? `${rec.name}接受了 ${formatMoney(offer)} 的報酬，加入隊伍。` : `${rec.name}答應不收錢同行。`
    case 'partial': {
      const counter = Math.max(offer, Math.round((offer + askingFor(c)) / 2 / 5) * 5)
      c.counter_cc = counter
      return `${rec.name}沒有答應，但願意以 ${formatMoney(counter)} 成交。`
    }
    case 'fail':
      c.declined = true
      addAffinity(state, report, npcId, -3, '出價太低')
      return `${rec.name}婉拒了，今天不想再談。`
    case 'fumble':
      c.declined = true
      addAffinity(state, report, npcId, -8, '覺得被羞辱')
      return `${rec.name}覺得被羞辱，冷著臉走開了。`
  }
}

// ---- 2. 加入別人的隊伍 ----

/** 等待組隊的機率 */
export function waitChance(state: GameState): number {
  const w = companionRules.wait_party
  const pc = pcOf(state)
  return Math.max(0.05, Math.min(w.max, w.base + w.per_cha_mod * mod(pc.attrs.cha) + w.per_level * pc.level))
}

export function partyOffersHere(state: GameState): PartyOffer[] {
  return (state.partyOffers ?? []).filter((o) => o.location === state.location && o.day === state.time.day)
}

/** 在酒館等別的隊伍來邀請。 */
export function waitForParty(state: GameState): Report {
  assertFree(state, '自己找隊伍')
  if (leaderOf(state)) throw new Error('你已經在別人的隊伍裡了')
  if (partyRoom(state) < 1) throw new Error('隊伍已滿，沒有人能帶上你們')
  const w = companionRules.wait_party
  const pc = pcOf(state)
  const report = socialReport(state, w.hours, tavernScene(state))
  const offer = withRng(state, (rng): PartyOffer | null => {
    if (!rng.chance(waitChance(state))) return null
    const level = Math.min(20, pc.level + rng.int(w.leader_level[0], w.leader_level[1]))
    const leader = generateNpc(state, rng, { level }, 'pty')
    const memberCount = rng.int(0, Math.min(2, partyRoom(state) - 1))
    const members = Array.from({ length: memberCount }, () => generateNpc(state, rng, { level: Math.max(1, level - rng.int(0, 2)) }, 'pty'))
    const payChance = w.pay_chance + w.pay_chance_per_cha_mod * Math.max(0, mod(pc.attrs.cha))
    const pay = rng.chance(payChance) ? Math.round((w.pay_per_level * pc.level * (1 + Math.max(0, mod(pc.attrs.cha)) * 0.25)) / 5) * 5 : 0
    return { id: `po-${leader.id}`, leader: leader.id, members: members.map((m) => m.id), pay_cc: pay, location: state.location, day: state.time.day }
  })
  if (offer) {
    ;(state.partyOffers ??= []).push(offer)
    const leader = npcRecord(state, offer.leader)!
    report.others = [leader, ...offer.members.map((id) => npcRecord(state, id)!)].map((r) => ({ id: r.id, name: r.name, race: r.race, class: r.class, level: r.level, personality: r.personality }))
    report.outcome.summary = `在酒館等了 ${w.hours} 小時，${leader.name}的隊伍${offer.members.length ? `（${offer.members.length + 1} 人）` : ''}邀請你同行${offer.pay_cc ? `，願意付 ${formatMoney(offer.pay_cc)}` : ''}。`
  } else {
    report.outcome = { result: 'neutral', summary: `在酒館等了 ${w.hours} 小時，沒有隊伍來搭話。` }
  }
  return commitReport(state, report)
}

export function acceptPartyOffer(state: GameState, offerId: string): Report {
  assertFree(state, '自己找隊伍')
  const offer = partyOffersHere(state).find((o) => o.id === offerId)
  if (!offer) throw new Error('邀請已經失效')
  if (leaderOf(state)) throw new Error('你已經在別人的隊伍裡了')
  if (partyRoom(state) < 1 + offer.members.length) throw new Error('隊伍人數太多，對方帶不下')
  const leader = npcRecord(state, offer.leader)!
  const report = socialReport(state, 0.5, tavernScene(state))
  joinParty(state, leader, 'leader', report, { group: leader.id, reason: '邀請主角同行' })
  for (const id of offer.members) joinParty(state, npcRecord(state, id)!, 'ally', report, { group: leader.id })
  if (offer.pay_cc) report.changes.money_cc = offer.pay_cc
  state.partyOffers = (state.partyOffers ?? []).filter((o) => o.id !== offerId)
  report.outcome.summary = `加入了${leader.name}的隊伍${offer.pay_cc ? `，收下 ${formatMoney(offer.pay_cc)}` : ''}。`
  report.narration = { pov: 'second_person', length: 'short', focus: [`${leader.name}與隊員的第一印象`] }
  return commitReport(state, report)
}

export function declinePartyOffer(state: GameState, offerId: string) {
  state.partyOffers = (state.partyOffers ?? []).filter((o) => o.id !== offerId)
}

/** 主角打算離開別人的隊伍：在下一次休息時進行。 */
export function requestLeave(state: GameState, mode: 'sneak' | 'formal' | null) {
  if (mode === null) {
    delete state.pendingLeave
    return
  }
  if (isBound(state)) throw new Error('身為奴隸，不能自行離隊；只能談判或逃離')
  if (!leaderOf(state)) throw new Error('你沒有跟著別人的隊伍')
  state.pendingLeave = { mode }
}

// ---- 5. 邀請認識的人 ----

/** 可以邀請的人：認識、不在隊伍、親密度足夠、今天人就在這座城鎮 */
export function invitable(state: GameState): NpcRecord[] {
  const inParty = new Set(state.party.map((m) => m.id))
  const min = companionRules.invite.min_affinity
  return Object.values(state.relationships ?? {})
    .filter((r) => !inParty.has(r.id) && r.affinity >= min && !state.flags[`invite_wait:${r.id}`])
    .map((r) => npcRecord(state, r.id))
    // 開店中的店主、公會職員：得顧店，不能邀請入隊
    .filter((rec): rec is NpcRecord => !!rec && presentHere(state, rec.id) && !isShopStaff(rec) && !rec.staying)
}

export function inviteDc(state: GameState, npcId: string): number {
  const rel = state.relationships?.[npcId]
  const rec = npcRecord(state, npcId)
  if (!rel || !rec) throw new Error('你不認識這個人')
  const i = companionRules.invite
  return i.base - Math.floor(rel.affinity / i.affinity_step) + i.level_gap * Math.max(0, rec.level - pcOf(state).level)
}

export function validateInvite(state: GameState, npcId: string) {
  assertFree(state, '邀請別人入隊')
  if (!invitable(state).some((r) => r.id === npcId)) throw new Error('現在無法邀請這個人')
  if (partyRoom(state) < 1) throw new Error(`隊伍最多 ${combatRules.party_max} 人`)
}

export function applyInvite(state: GameState, report: Report, npcId: string, degree: Degree): string {
  const rec = npcRecord(state, npcId)!
  if (degree === 'critical' || degree === 'success') {
    joinParty(state, rec, 'voluntary', report, { reason: '受邀' })
    if (degree === 'critical') addAffinity(state, report, npcId, 5, '很高興受到邀請')
    return `${rec.name}答應加入隊伍。`
  }
  // 被拒絕後，下次長休前不能再邀請
  ;(report.changes.flags ??= {})[`invite_wait:${npcId}`] = true
  if (degree === 'partial') return `${rec.name}有些心動，但說要再考慮一下。`
  addAffinity(state, report, npcId, degree === 'fumble' ? -8 : -3, '邀請被拒')
  return degree === 'fumble' ? `${rec.name}覺得被冒犯，斷然拒絕。` : `${rec.name}婉拒了邀請。`
}

/** 長休時清掉「再考慮一下」的冷卻 */
export function clearInviteCooldowns(state: GameState) {
  for (const k of Object.keys(state.flags)) if (k.startsWith('invite_wait:')) delete state.flags[k]
}

// ---- 3. 奴隸市場 ----

export type MarketKind = 'public' | 'black'

export function marketsHere(state: GameState): { kind: MarketKind; def: MarketDef }[] {
  const m = slaveryRules.markets[state.location]
  const list: { kind: MarketKind; def: MarketDef }[] = []
  if (m?.public) list.push({ kind: 'public', def: m.public })
  if (m?.black && state.flags[`black_market:${state.location}`]) list.push({ kind: 'black', def: m.black })
  return list
}

function marketDef(state: GameState, kind: MarketKind): MarketDef {
  const def = marketsHere(state).find((m) => m.kind === kind)?.def
  if (!def) throw new Error(kind === 'black' ? '你不知道這裡的黑市在哪' : '這裡沒有奴隸市場')
  return def
}

export function marketStock(state: GameState, kind: MarketKind): SlaveListing[] {
  const def = marketDef(state, kind)
  const key = `${state.location}/${kind}`
  const markets = (state.markets ??= {})
  const cur = markets[key]
  if (cur && cur.day === state.time.day) return cur.stock
  const pc = pcOf(state)
  const stock = withRng(state, (rng) => {
    const n = rng.int(def.stock[0], def.stock[1])
    return Array.from({ length: n }, (): SlaveListing => {
      let race = weightedPick(rng, def.races)
      if (kind === 'public' && slaveryRules.black_market_only.includes(race)) race = 'human'
      const level = Math.max(1, Math.min(20, pc.level + rng.int(-2, 1)))
      const rec = generateNpc(state, rng, { race, level, background: rng.pick(npcPool.slave_backgrounds) }, 'slv')
      const contract = weightedPick(rng, kind === 'black' ? { labor: 4, combat: 3, arcane: 3 } : { labor: 6, combat: 3, arcane: 1 })
      return { npc: rec.id, price_cc: slavePrice(rec, def.price_mult, rng), contract }
    })
  })
  markets[key] = { day: state.time.day, stock }
  return stock
}

function listing(state: GameState, kind: MarketKind, npcId: string): SlaveListing {
  const l = marketStock(state, kind).find((x) => x.npc === npcId)
  if (!l) throw new Error('市場上沒有這個人')
  return l
}

/** 買下奴隸；可以選擇要刻的印記（模板或自訂），沒選時用市場原本的 */
export function buySlave(state: GameState, kind: MarketKind, npcId: string, mark?: MarkChoice): Report {
  assertFree(state, '買奴隸')
  const l = listing(state, kind, npcId)
  if (partyRoom(state) < 1) throw new Error(`隊伍最多 ${combatRules.party_max} 人`)
  if (state.money_cc < l.price_cc) throw new Error('錢不夠')
  const def = marketDef(state, kind)
  const rec = npcRecord(state, npcId)!
  const report = socialReport(state, 1, def.name)
  const member = joinParty(state, rec, 'slave', report, { contract: mark ?? l.contract, reason: '買下' })
  report.changes.money_cc = -l.price_cc
  const markets = state.markets![`${state.location}/${kind}`]!
  markets.stock = markets.stock.filter((x) => x.npc !== npcId)
  const c = contractTerms(member.contract!)
  report.outcome.summary = `在${def.name}以 ${formatMoney(l.price_cc)} 買下${rec.name}，在頸上刻下${c.name}的印記：${c.mark}`
  report.narration = { pov: 'second_person', length: 'short', focus: [`${rec.name}的身世與第一印象`, '契約印記'] }
  if (kind === 'black') report.outcome.tags = ['黑市']
  return commitReport(state, report)
}

export function haggleDc(state: GameState, kind: MarketKind, npcId: string): number {
  const l = listing(state, kind, npcId)
  if (l.haggled) throw new Error('今天已經殺過價了')
  const h = slaveryRules.haggle
  return h.base + (kind === 'black' ? h.black_market_bonus : 0)
}

export function applyHaggle(state: GameState, report: Report, kind: MarketKind, npcId: string, degree: Degree): string {
  const l = listing(state, kind, npcId)
  const before = l.price_cc
  l.price_cc = Math.max(10, Math.round((l.price_cc * slaveryRules.haggle.price_factor[degree]) / 10) * 10)
  l.haggled = true
  report.location.scene = marketDef(state, kind).name
  if (l.price_cc < before) return `價格從 ${formatMoney(before)} 降到 ${formatMoney(l.price_cc)}。`
  if (l.price_cc > before) return `商人被惹惱了，價格漲到 ${formatMoney(l.price_cc)}。`
  return '商人不肯讓價。'
}

/** 黑市的打聽：不管這裡有沒有黑市都可以試；沒有黑市時成功也找不到。 */
export function applyBlackMarket(state: GameState, report: Report, degree: Degree): string {
  const exists = !!slaveryRules.markets[state.location]?.black
  if (degree === 'critical' || degree === 'success') {
    if (!exists) return '問了一圈，這裡似乎真的沒有地下的奴隸買賣。'
    ;(report.changes.flags ??= {})[`black_market:${state.location}`] = true
    return `打聽到了${slaveryRules.markets[state.location]!.black!.name}的位置。`
  }
  if (degree === 'partial') return '有人暗示了幾句，但還不夠找到地方。'
  if (degree === 'fumble') {
    ;(report.changes.reputation ??= []).push({ faction: locationById(state.location).faction ?? 'guild', delta: -1 })
    return '問得太露骨，被衛兵盯上了。'
  }
  return '沒人願意透露。'
}

// ---- 4. 主角作為奴隸 ----

export function selfSaleChance(state: GameState): number {
  const s = slaveryRules.self_sale
  const pc = pcOf(state)
  return Math.max(0.05, Math.min(s.max, s.base + s.per_cha_mod * mod(pc.attrs.cha) + s.per_level * pc.level))
}

/** 戰敗時逃開的隊員：回到聚落或安全房時，在這裡等著你，重新歸隊（生命值維持戰敗時的一半） */
export function rejoinAway(state: GameState): Report | undefined {
  const away = state.party.filter((m) => m.status.includes('away'))
  if (!away.length || state.combat) return undefined
  const area = currentArea(state)
  if (area.kind !== 'settlement' && area.kind !== 'home' && currentCell(state).kind !== 'safe') return undefined
  const report = socialReport(state, 0, area.name, 'event')
  for (const m of away) removeCondition(m, 'away', report)
  report.outcome = { result: 'neutral', summary: `${away.map((m) => m.name).join('、')}在這裡等著你，重新歸隊。`, tags: ['歸隊'] }
  report.narration = { pov: 'second_person', length: 'short', focus: ['重逢'] }
  return commitReport(state, report)
}

/** 市場上出價的買家是哪一種人：依市場的標籤權重，再挑這個標籤可能的 NPC 種類 */
export function pickBuyer(rng: Rng, kind: MarketKind): { tag: string; kind: NpcKind } {
  const t = slaveryRules.master_tags
  const tag = weightedPick(rng, Object.fromEntries(Object.entries(t.tags).map(([id, x]) => [id, x[kind]])))
  const kinds = (tagDef(tag)?.kinds ?? ['adventurer']) as NpcKind[]
  const npcKind = weightedPick(rng, Object.fromEntries(kinds.map((k) => [k, t.kinds[k].market]))) as NpcKind
  return { tag, kind: npcKind }
}

/**
 * 主角在市場登記出售自己。隊伍必須只剩主角。
 * 已經是奴隸（無主或逃亡）時也可以：買下的人成為新主人，印記沿用。
 * 買家的身分（標籤）影響成交機率（slavery.json 的 master_tags）。
 */
export function offerSelf(state: GameState, kind: MarketKind): Report {
  const def = marketDef(state, kind)
  if (isBound(state)) throw new Error('你已經有主人帶著了')
  if (state.pendingMark) throw new Error('先完成契約印記的刻印')
  if (state.party.length > 1) throw new Error('要先讓同伴離隊，才能登記出售自己')
  const s = slaveryRules.self_sale
  const pc = pcOf(state)
  const marked = isEnslaved(state)
  const report = socialReport(state, s.hours, def.name)
  const deal = withRng(state, (rng) => {
    const buyer = pickBuyer(rng, kind)
    const chance = Math.max(0.05, Math.min(s.max, selfSaleChance(state) + slaveryRules.master_tags.tags[buyer.tag]!.chance))
    if (!rng.chance(chance)) return null
    // 娼妓標籤的買家是老鴇（店主兼娼妓）
    const madam = buyer.tag === 'prostitute'
    const master = generateNpc(state, rng, {
      level: Math.min(20, pc.level + rng.int(1, 4)), kind: buyer.kind,
      tags: madam ? ['prostitute', 'merchant'] : [buyer.tag], ...(madam ? { occupation: '老鴇' } : {}),
    }, 'mst')
    const contract = madam ? 'brothel' : weightedPick(rng, s.contract_weights)
    const price = slavePrice(pc, def.price_mult, rng)
    return { master, contract, price }
  })
  if (!deal) {
    report.outcome = { result: 'neutral', summary: `在${def.name}站了 ${s.hours} 小時，沒有人出價。` }
    return commitReport(state, report)
  }
  const share = Math.round(deal.price * s.share)
  const who = `${tagDef(deal.master.tags?.[0] ?? '')?.name ?? ''}${deal.master.name}`
  if (marked) {
    // 已經刻著印記：買家成為新主人，印記沿用
    changeMaster(state, deal.master, report, `在${def.name}被買下`)
    remarkByMadam(state, deal.master)
    report.changes.money_cc = share
    report.outcome = {
      result: 'success',
      summary: `${who}以 ${formatMoney(deal.price)} 買下了你，成為你的新主人；你拿到 ${formatMoney(share)}。頸上的印記沿用。`,
      tags: ['換了主人'],
    }
    report.narration = { pov: 'second_person', length: 'medium', focus: ['新主人的模樣與態度'] }
    return commitReport(state, report)
  }
  enslavePlayer(state, deal.master, deal.contract, report)
  // 刻印前還有一次檢定：主角的表現決定最後刻上哪一種印記
  startMarking(state, deal.contract)
  report.changes.money_cc = share
  report.outcome = {
    result: 'success',
    summary: `${who}以 ${formatMoney(deal.price)} 買下了你，你拿到 ${formatMoney(share)} 的賣身錢。${deal.master.name}打算在你頸上刻下${contractDef(deal.contract).name}。`,
    tags: ['成為奴隸'],
  }
  report.narration = { pov: 'second_person', length: 'medium', focus: ['主人的模樣與態度', '即將刻下契約印記'] }
  return commitReport(state, report)
}

/** 主角的談判 DC：契約越強越難，主人的親密度越高越容易。 */
export function negotiateDc(state: GameState): number {
  const pc = pcOf(state)
  const fugitive = isFugitive(state) && !!pc.contract?.master
  if (!pc.contract || (!isBound(state) && !fugitive)) throw new Error('你不是被主人帶著的奴隸')
  const def = contractTerms(pc.contract)
  const masterAff = state.relationships?.[pc.contract.master]?.affinity ?? 0
  const bonus = state.flags['negotiate_bonus'] ? 2 : 0
  // 逃亡後當面談判：主人還在氣頭上
  const angry = fugitive ? slaveryRules.fugitive_master.negotiate_dc_bonus : 0
  return def.negotiate_dc - Math.floor(masterAff / slaveryRules.freedom.negotiate.affinity_step) - bonus + angry
}

export function escapeDc(state: GameState): number {
  const pc = pcOf(state)
  if (!pc.contract || !isBound(state)) throw new Error('你不是被主人帶著的奴隸')
  return contractTerms(pc.contract).escape_dc
}

/** 對主人的檢定都受到服從懲罰 */
export function obediencePenalty(state: GameState): number {
  const pc = pcOf(state)
  return pc.contract && isBound(state) ? pc.contract.obedience : 0
}

export function applyNegotiate(state: GameState, report: Report, degree: Degree): string {
  const pc = pcOf(state)
  const master = pc.contract!.masterName
  switch (degree) {
    case 'critical':
    case 'success':
      if (degree === 'critical') addAffinity(state, report, pc.contract!.master, 5, '被說服')
      freePlayer(state, report, '談判成功')
      delete state.flags['negotiate_bonus']
      ;(report.changes.flags ??= {}).negotiate_bonus = false
      return `${master}抹去了你頸上的契約印記，你恢復了自由。`
    case 'partial':
      ;(report.changes.flags ??= {}).negotiate_bonus = true
      return `${master}沒有答應，但似乎有些動搖（下次談判較容易）。`
    case 'fail':
      if (isFugitive(state)) {
        addAffinity(state, report, pc.contract!.master, -5, '逃跑後還想談條件')
        return `${master}拒絕了，轉身離開。`
      }
      return `${master}拒絕了。${punish(state, 'light', report)}`
    case 'fumble':
      if (isFugitive(state)) {
        recapturePlayer(state, report)
        return `${master}一把抓住了你。${punish(state, 'heavy', report)}`
      }
      return `${master}勃然大怒。${punish(state, 'heavy', report)}`
  }
}

export function applyEscape(state: GameState, report: Report, degree: Degree): string {
  const pc = pcOf(state)
  const def = contractTerms(pc.contract!)
  const master = pc.contract!.masterName
  if (degree === 'critical' || degree === 'success' || degree === 'partial') {
    const mult = degree === 'critical' ? 0.5 : degree === 'partial' ? 2 : 1
    const loss = Math.ceil(pc.maxHp * def.escape_hp_ratio * mult)
    playerEscapes(state, report)
    if (loss > 0) setHp(state, pc, pc.hp - loss, report)
    const pain = def.functions.includes('tether') ? '鎖鏈紋收緊，勒得你幾乎無法呼吸' : '印記一陣灼痛'
    return `你逃離了${master}${degree === 'partial' ? '，但付出了不小的代價' : ''}。${loss > 0 ? `${pain}，失去 ${loss} 點生命值。` : ''}契約仍在，你現在是逃亡奴隸。`
  }
  if (degree === 'fail') return `逃跑被${master}發現。${punish(state, 'light', report)}`
  return `逃跑被${master}當場抓住。${punish(state, 'heavy', report)}`
}

// ---- 主角的奴隸 ----

export function releaseSlave(state: GameState, npcId: string): Report {
  const m = state.party.find((x) => x.id === npcId && x.bond === 'slave')
  if (!m) throw new Error('隊伍中沒有這位奴隸')
  const report = socialReport(state, 0.5, locationById(state.location).name)
  freeSlave(state, npcId, report)
  report.outcome.summary = `解除了${m.name}的奴隸契約，抹去頸上的印記。`
  report.narration = { pov: 'second_person', length: 'short', focus: [`${m.name}的反應`] }
  return commitReport(state, report)
}

// ---- 給主動行動用：參考 DC 與各成功程度的機制結果 ----

export interface ActionSetup {
  dc: number
  targetName?: string
  /** 檢定的額外修正（負數為懲罰） */
  situational: { label: string; value: number }[]
  /** 各成功程度的機制結果（給 AI 與玩家參考） */
  outcomes: Partial<Record<Degree, string>>
  scene: string
  /** 預設屬性（沒有時用 actions.json 的設定） */
  attr?: AttrId
  /** 耗時（沒有時用 actions.json 的設定） */
  hours?: number
  /** 成人向：可能進入的親密場景（content.ts 的 adultScene） */
  adultScene?: AdultScene
  /** 擲檢定的人（沒有時是主角；例如由夥伴動手製作） */
  actor?: string
}

export function setupFor(state: GameState, kind: ActionKind, target?: string, offer?: number, item?: string): ActionSetup {
  const pc = pcOf(state)
  switch (kind) {
    case 'chat':
    case 'gift':
    case 'flatter':
    case 'steal':
    case 'attack':
      return setupInteraction(state, kind, target, item)
    case 'bluff':
    case 'intimidate':
      return setupStandoff(state, kind, actionRulesBase(kind))
    case 'hire': {
      const rec = npcRecord(state, target ?? '')
      if (!rec) throw new Error('酒館裡沒有這位冒險者')
      const o = offer ?? 0
      validateHire(state, rec.id, o)
      const c = candidate(state, rec.id)
      return {
        dc: hireDc(state, rec.id, o), targetName: rec.name, situational: [], scene: tavernScene(state),
        outcomes: {
          critical: `以 ${formatMoney(o)} 加入，對主角印象很好`,
          success: `以 ${formatMoney(o)} 加入`,
          partial: `還價到 ${formatMoney(Math.round((o + askingFor(c)) / 2 / 5) * 5)}`,
          fail: '婉拒，今天不再談（親密度 -3）',
          fumble: '覺得被羞辱（親密度 -8）',
        },
      }
    }
    case 'haggle': {
      const [mk, id] = (target ?? '').split(':') as [MarketKind, string]
      const rec = npcRecord(state, id)
      if (!rec) throw new Error('市場上沒有這個人')
      const f = slaveryRules.haggle.price_factor
      const pct = (x: number) => `${Math.round((x - 1) * 100)}%`
      return {
        dc: haggleDc(state, mk, id), targetName: `${rec.name}的賣家`, situational: [], scene: marketDef(state, mk).name,
        outcomes: { critical: `價格 ${pct(f.critical)}`, success: `價格 ${pct(f.success)}`, partial: `價格 ${pct(f.partial)}`, fail: '不讓價', fumble: `價格 +${Math.round((f.fumble - 1) * 100)}%` },
      }
    }
    case 'invite': {
      const rec = npcRecord(state, target ?? '')
      if (!rec) throw new Error('你不認識這個人')
      validateInvite(state, rec.id)
      return {
        dc: inviteDc(state, rec.id), targetName: rec.name, situational: [], scene: locationById(state.location).name,
        outcomes: { critical: '自願加入，親密度 +5', success: '自願加入', partial: '要再考慮（下次長休後才能再邀請）', fail: '婉拒（親密度 -3）', fumble: '被冒犯（親密度 -8）' },
      }
    }
    case 'black_market': {
      assertFree(state, '自己打聽黑市')
      const r = slaveryRules.black_market_search
      return {
        dc: r.dc, situational: [], scene: tavernScene(state),
        outcomes: { critical: '找到黑市（如果這裡有）', success: '找到黑市（如果這裡有）', partial: '得到一點線索', fail: '沒人透露', fumble: '被衛兵盯上（聲望 -1）' },
      }
    }
    case 'master_permit':
      return setupPermit(state)
    case 'marking':
      return setupMarking(state)
    case 'master_event':
      return setupMasterEvent(state)
    case 'master_return':
      return setupReturn(state)
    case 'seek_master':
      return setupSeekMaster(state, target)
    case 'unmark':
      return setupUnmark(state, target)
    case 'work':
      return setupWork(state, target)
    case 'patron':
      return setupPatron(state, target)
    case 'craft':
      return setupCraft(state, target)
    case 'make':
      return setupMake(state, target)
    case 'story':
      return setupStoryCheck(state, target)
    case 'defeat_event':
      return setupDefeatEvent(state, target)
    case 'negotiate': {
      if (isFugitive(state)) {
        // 逃亡奴隸找到了主人：當面談判，不必在安全的地方，但 DC 較高
        if (!masterNearby(state)) throw new Error(`${pc.contract?.masterName ?? '主人'}不在你身邊`)
        return {
          dc: negotiateDc(state), targetName: pc.contract!.masterName, situational: [],
          scene: `${locationById(state.location).name}・找到逃離的主人`,
          outcomes: { critical: '主人抹去契約，恢復自由（主人親密度 +5）', success: '主人抹去契約，恢復自由', partial: '主人動搖（下次談判 DC -2）', fail: '主人拒絕（親密度 -5）', fumble: '被主人當場抓回去，嚴厲懲罰' },
        }
      }
      if (!atSafeSpot(state)) throw new Error('和主人談判要在安全的地方（旅店、安全房或神殿）')
      const master = pc.contract?.masterName
      return {
        dc: negotiateDc(state), targetName: master, situational: [{ label: '契約的服從懲罰', value: -obediencePenalty(state) }],
        scene: locationById(state.location).name,
        outcomes: { critical: '主人抹去契約，恢復自由（主人親密度 +5）', success: '主人抹去契約，恢復自由', partial: '主人動搖（下次談判 DC -2）', fail: '輕度懲罰', fumble: '嚴厲懲罰，契約束縛加重' },
      }
    }
    case 'escape': {
      const def = contractTerms(pc.contract ?? { kind: 'labor' })
      return {
        dc: escapeDc(state), targetName: pc.contract?.masterName, situational: [{ label: '契約的服從懲罰', value: -obediencePenalty(state) }],
        scene: locationById(state.location).name,
        outcomes: {
          critical: `逃走，契約仍在（成為逃亡奴隸）；印記反噬減半`,
          success: `逃走，契約仍在（成為逃亡奴隸）；印記反噬 ${Math.round(def.escape_hp_ratio * 100)}% 生命值`,
          partial: `逃走但受重傷（印記反噬加倍）`,
          fail: '被發現，輕度懲罰',
          fumble: '當場被抓，嚴厲懲罰，契約束縛加重',
        },
      }
    }
    case 'bargain': {
      const b = bargainSetup(state, target ?? '')
      return { dc: b.dc, targetName: `${b.keeper.name}（${b.deal.title}）`, situational: [], scene: `${locationById(state.location).name}・${b.deal.title}`, outcomes: b.outcomes }
    }
    case 'negotiation': {
      const n = negotiationSetup(state, target ?? '')
      return { dc: n.dc, targetName: n.targetName, situational: [], scene: n.scene, outcomes: n.outcomes }
    }
    case 'rest_talk': {
      const last = state.lastLongRest
      const t = state.time
      if (!last || last.day !== t.day || last.hour !== t.hour || last.minute !== t.minute) throw new Error('要在長休時才能這麼做')
      const atInn = currentCell(state).kind === 'inn'
      if (target === 'guests' && !atInn) throw new Error('只有在旅店才有其他旅客')
      if (target && target !== 'guests' && !state.party.some((m) => m.id === target && !m.isPlayer)) throw new Error('隊伍裡沒有這個人')
      const rec = target && target !== 'guests' ? npcRecord(state, target) : undefined
      const rel = rec ? state.relationships?.[rec.id] : undefined
      const where = atInn ? `${locationById(state.location).name}的旅店` : currentArea(state).kind === 'home' ? `自己的房子（${currentArea(state).name}）` : `${currentArea(state).name}的安全房`
      return {
        dc: (actionRulesBase('rest_talk')) - (rel ? Math.floor(rel.affinity / 25) : 0),
        targetName: target === 'guests' ? '同旅館的旅客' : rec?.name ?? '夥伴們',
        situational: [],
        scene: `${where}・長休`,
        outcomes: target === 'guests'
          ? { critical: '和旅客相談甚歡，結識新朋友', success: '認識一位新朋友', partial: '聊了幾句', fail: '沒什麼交集', fumble: '起了點口角' }
          : { critical: '關係明顯拉近', success: '相處愉快', partial: '平淡地度過', fail: '有點尷尬', fumble: '鬧得不愉快' },
      }
    }
    case 'free': {
      if (target && !presentHere(state, target)) throw new Error('對方不在這裡')
      const rec = target ? npcRecord(state, target) : undefined
      // 對認識之前的人（例如店主）行動，就算認識了
      if (rec) ensureRelationship(state, rec)
      const rel = target ? state.relationships?.[target] : undefined
      const situational = isBound(state) && target && target === pc.contract?.master ? [{ label: '契約的服從懲罰', value: -obediencePenalty(state) }] : []
      let dc = 12
      if (rec) dc += 2 * Math.max(0, lifeTier(rec.level) - lifeTier(pc.level))
      if (rel) dc -= Math.floor(rel.affinity / 25)
      return { dc, ...(rec ? { targetName: rec.name } : {}), situational, scene: locationById(state.location).name, outcomes: {} }
    }
  }
}

function actionRulesBase(kind: ActionKind): number {
  return actionRules.kinds[kind].base ?? 12
}
