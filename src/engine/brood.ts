// 怪物的苗床（成人向，docs/FAMILY.md 第 13 節）。怪物不會讓人懷孕；牠們留在主角體內的卵、種、幼蟲是寄生物的一類「苗床」
// （parasites.json 的 category: brood，brood.kind 是 egg 卵生、live 胎生、parasite 寄生），沿用寄生物的侵蝕度、階段、
// 被動效果、雙面效應、發作事件與解咒。這裡處理苗床自己的部分：
// - 誰會變成苗床：內容篩選「怪物的苗床」打開；懷孕中不會；胎生要有子宮、同時只有一個胎生；同一種最多一個。
//   非自願的來源（戰敗、戰鬥中被植入）還要「主角非自願」打開。
// - 色情戰敗事件沒能擺脫、吃了大虧時，圍上來的怪物有 brood 就擲（× 存檔規則「苗床的機率」）。
// - 侵蝕度每天照長（發作被擋掉也長，parasiteEvents.ts）；長到「支配」時跳出產下的事件（state.pendingBroodBirth），一定會產下。
// - 產下：卵生排出魔物卵；胎生像生產一樣（神殿或自己），生下的魔物幼體當場處理（放回巢穴、交給魔物學者、交給神殿淨化），
//   產後虛弱、泌乳 15 天；寄生排出蟲蛻，或修了獸蟲派的人選擇共生（得到特質）。魔物幼體不是嬰兒，不進 state.children。
// - 魔法物品店的「取出」：卵生、寄生比較便宜的拿掉方式（胎生只能解咒）。

import { tagsAllowed } from './content'
import { pcEventReport } from './dungeonEvents'
import { applyEffects } from './effects'
import { gameRule } from './gameRules'
import { currentCell } from './grid'
import { addLactation } from './lactation'
import { formatMoney } from './money'
import { activeParasites, parasiteDef, parasiteOf, parasiteRules, parasitesOf, stageOf, type BroodDef, type BroodKind, type BroodRules } from './parasites'
import { isFugitive, pcOf } from './party'
import { checkModifiers } from './perks'
import { canCarry, personOf } from './pregnancy'
import { familyRules } from './pregMarks'
import { attrParts, rollBreakdown, sumParts } from './rollParts'
import { roll as diceRoll, withBonus } from './rng'
import { hasSchool } from './schools'
import { addHours, commitReport, withRng } from './state'
import { enemies, isSettlement, locationById, type AttrId, type Degree } from './data'
import { hasTemple } from './children'
import type { Character, GameState, Report } from './types'

const TAG = '苗床'

export const broodRules = (): BroodRules => parasiteRules.brood_rules ?? {
  defeat: { fail: 0.3, fumble: 0.6 }, extract: { dc: 12, price: 200, attr: 'int' }, egg_check: { attr: 'str', dc: 12 },
  parasite_check: { attr: 'fai', dc: 12 }, live_lactation_days: 15, title_births: 3,
}

export function broodOf(id: string): BroodDef | undefined {
  const d = parasiteDef(id)
  return d?.category === 'brood' ? d.brood : undefined
}

export const BROOD_KIND_NAME: Record<BroodKind, string> = { egg: '卵生', live: '胎生', parasite: '寄生' }

/** 身上的苗床（主角） */
export function broodsOf(c: Pick<Character, 'parasites'>): { id: string; brood: BroodDef }[] {
  return parasitesOf(c).flatMap((p) => {
    const b = broodOf(p.id)
    return b ? [{ id: p.id, brood: b }] : []
  })
}

/** 有沒有胎生的苗床（懷孕的受孕判定也看這個） */
export function hasLiveBrood(c: Pick<Character, 'parasites'>): boolean {
  return broodsOf(c).some((b) => b.brood.kind === 'live')
}

/**
 * 主角現在不能變成這個苗床的原因（可以時為 undefined）：篩選、懷孕、子宮、同時只有一個胎生、已經有了。
 * unwilling：非自願的來源（戰敗、戰鬥中被植入）還要「主角非自願」打開
 */
export function broodBlock(state: GameState, id: string, unwilling = false): string | undefined {
  const b = broodOf(id)
  if (!b) return '不是苗床'
  if (!tagsAllowed(['monster_brood'])) return '內容篩選關掉了「怪物的苗床」'
  if (unwilling && !tagsAllowed(['pc_unwilling'])) return '內容篩選關掉了「主角非自願」'
  const pc = pcOf(state)
  if (state.pregnancies?.pc) return '懷孕中'
  if (parasiteOf(pc, id)) return '已經有了'
  if (b.kind === 'live') {
    if (!canCarry(personOf(state, 'pc')!)) return '身體沒有子宮'
    if (hasLiveBrood(pc)) return '已經有一個胎生的苗床'
  }
  return undefined
}

/** 讓主角變成苗床（透過效果「寄生物」寄生，報告裡記一筆）；不行時回傳空字串 */
export function giveBrood(state: GameState, report: Report, id: string, unwilling = false): string {
  if (broodBlock(state, id, unwilling)) return ''
  const notes = applyEffects(state, report, [{ type: 'parasite', parasite: id, op: 'add' }])
  return notes.join('；')
}

/**
 * 色情戰敗事件的結果（defeat.ts）：主角自己被圍住、沒能擺脫或吃了大虧時，圍上來的第一隻有 brood 的怪物擲一次。
 * 固定種子（報告 id），重讀結果一樣
 */
export function defeatBrood(state: GameState, report: Report, monsters: (string | undefined)[], degree: Degree): string {
  if (degree !== 'fail' && degree !== 'fumble') return ''
  const enemy = monsters.map((m) => (m ? enemyBrood(m) : undefined)).find(Boolean)
  if (!enemy) return ''
  const chance = (degree === 'fail' ? broodRules().defeat.fail : broodRules().defeat.fumble) * gameRule(state, 'broodMult')
  if (chance <= 0 || broodBlock(state, enemy, true)) return ''
  if (!withRng(state, (rng) => rng.chance(chance))) return ''
  const note = giveBrood(state, report, enemy, true)
  return note ? `${note}。` : ''
}

/** 怪物資料寫的苗床（幼體怪物不寫，見 brood.spec.ts） */
function enemyBrood(monster: string): string | undefined {
  const id = enemies[monster]?.brood
  return id && broodOf(id) ? id : undefined
}

// ---- 每次寄生物的結算（parasiteEvents.ts 的 maybeParasiteEvent）：泌乳、產下 ----

/** 苗床的結算：胎生共生以上泌乳；長到支配的苗床跳出產下的事件（一次一個）。回傳有沒有開始事件 */
export function broodTick(state: GameState): boolean {
  const pc = pcOf(state)
  syncBroodLactation(state)
  if (state.pendingBroodBirth && !parasiteOf(pc, state.pendingBroodBirth.parasite)) delete state.pendingBroodBirth
  if (state.pendingBroodBirth || !tagsAllowed(['monster_brood'])) return false
  const due = activeParasites(pc).find((p) => broodOf(p.id) && stageOf(p.corruption) >= parasiteRules.stages.length - 1)
  if (!due) return false
  state.pendingBroodBirth = { parasite: due.id }
  return true
}

/** 胎生的苗床長到共生以上時泌乳（沒有期限、ref 是苗床）；苗床不在了就拿掉。產下後的泌乳有期限，不動 */
export function syncBroodLactation(state: GameState) {
  const pc = pcOf(state)
  const live = broodsOf(pc).filter((b) => b.brood.kind === 'live' && stageOf(parasiteOf(pc, b.id)!.corruption) >= 2).map((b) => b.id)
  const list = state.lactation?.pc
  if (list) {
    const left = list.filter((s) => s.kind !== 'brood' || s.until !== undefined || (s.ref !== undefined && live.includes(s.ref)))
    if (left.length !== list.length) {
      if (left.length) state.lactation!.pc = left
      else delete state.lactation!.pc
    }
  }
  for (const id of live) addLactation(state, 'pc', { kind: 'brood', ref: id })
}

// ---- 產下 ----

export type BroodHow = 'push' | 'help' | 'submit' | 'temple' | 'self' | 'expel' | 'symbiosis'
export type OffspringFate = 'nest' | 'scholar' | 'temple'
export interface BroodOption { id: BroodHow; label: string; disabled?: string }

function inSettlement(state: GameState): boolean {
  return !state.road && !state.expedition && isSettlement(locationById(state.location))
}

/** 隊伍裡和主角最親的夥伴（幫忙產卵） */
function closestMate(state: GameState): Character | undefined {
  return state.party.filter((m) => !m.isPlayer).sort((a, b) => (state.relationships?.[b.id]?.affinity ?? 0) - (state.relationships?.[a.id]?.affinity ?? 0))[0]
}

export function broodBirthOptions(state: GameState): BroodOption[] {
  const ev = state.pendingBroodBirth
  const b = ev ? broodOf(ev.parasite) : undefined
  if (!ev || !b) return []
  const r = broodRules()
  if (b.kind === 'egg') {
    const mate = closestMate(state)
    return [
      { id: 'push', label: `自己用力（${attrLabel(r.egg_check.attr)} DC ${r.egg_check.dc}）` },
      { id: 'help', label: mate ? `請${mate.name}幫忙` : '請隊友幫忙', ...(mate ? {} : { disabled: '隊伍裡沒有別人' }) },
      { id: 'submit', label: '放鬆身體，任它們出來' },
    ]
  }
  if (b.kind === 'live') {
    const birth = familyRules.birth as { temple_cc: number; dc: number; wild_dc: number }
    const out: BroodOption[] = []
    if (inSettlement(state) && hasTemple(state.location)) out.push({ id: 'temple', label: `去神殿（${formatMoney(birth.temple_cc)}，一定順利）`, ...(state.money_cc < birth.temple_cc ? { disabled: '金錢不足' } : {}) })
    out.push({ id: 'self', label: `自己生（信仰 DC ${inSettlement(state) ? birth.dc : birth.wild_dc}）` })
    return out
  }
  const pc = pcOf(state)
  return [
    { id: 'expel', label: `把它排出來（${attrLabel(r.parasite_check.attr)} DC ${r.parasite_check.dc}）` },
    ...(b.symbiosis ? [{ id: 'symbiosis' as const, label: '讓它留下來共生（獸蟲派）', ...(hasSchool(pc, 'beast') ? {} : { disabled: '要修了獸蟲派入門' }) }] : []),
  ]
}

const ATTR_LABEL: Record<AttrId, string> = { str: '力量', dex: '靈巧', int: '智力', fai: '信仰', cha: '魅力' }
function attrLabel(a: AttrId): string {
  return ATTR_LABEL[a] ?? a
}

export const OFFSPRING_FATES: Record<OffspringFate, string> = { nest: '放回巢穴', scholar: '交給魔物學者', temple: '交給神殿淨化' }

function check(state: GameState, report: Report, attr: AttrId, dc: number, label: string): boolean {
  const pc = pcOf(state)
  const parts = [...attrParts(pc, attr), ...checkModifiers(pc, { context: 'action', attr })]
  const dice = withBonus('1d20', sumParts(parts))
  const r = withRng(state, (rng) => diceRoll(rng, dice))
  const natural = r.rolls[0] ?? r.total
  const ok = natural === 20 || (natural !== 1 && r.total >= dc)
  report.timeline = [{ seq: 1, time: { ...state.time }, actor: 'pc', action: label, roll: { dice, value: r.total, dc, ...rollBreakdown(natural, parts) }, result: ok ? 'success' : 'fail' }]
  return ok
}

function rollRange(state: GameState, [lo, hi]: [number, number]): number {
  return withRng(state, (rng) => rng.int(lo, Math.max(lo, hi)))
}

/** 回應產下的事件：how 是怎麼產下（看種類），fate 是胎生的幼體怎麼處理 */
export function answerBroodBirth(state: GameState, how: BroodHow, fate: OffspringFate = 'nest'): Report {
  const ev = state.pendingBroodBirth
  const def = ev ? parasiteDef(ev.parasite) : undefined
  const b = ev ? broodOf(ev.parasite) : undefined
  if (!ev || !def || !b) throw new Error('現在沒有要產下的東西')
  const opt = broodBirthOptions(state).find((o) => o.id === how)
  if (!opt || opt.disabled) throw new Error(opt?.disabled ?? '不能這樣做')
  const report = pcEventReport(state, b.kind === 'egg' ? '產卵' : b.kind === 'live' ? '產仔' : '破繭', TAG)
  report.time.end = addHours(state.time, b.kind === 'live' ? 6 : 2)
  const lines: string[] = []
  const effects: Parameters<typeof applyEffects>[2] = []
  const yields = () => (b.yields ?? []).map((y) => ({ type: 'item' as const, name: y.item, qty: rollRange(state, y.qty) }))
  if (b.kind === 'egg') {
    const mate = closestMate(state)
    if (how === 'push') {
      const r = broodRules().egg_check
      const ok = check(state, report, r.attr, r.dc, '把卵推出來')
      lines.push(ok ? `你咬著牙，一顆一顆把${def.name}推了出來。` : '卵卡得很緊，你耗盡了力氣才把它們一顆一顆排出來。')
      if (!ok) effects.push({ type: 'condition', target: 'pc', condition: 'drained', add: true })
    } else if (how === 'help' && mate) {
      lines.push(`${mate.name}握著你的手、替你揉著肚子，你一顆一顆把${def.name}排了出來。`)
      effects.push({ type: 'affinity', npc: mate.id, delta: 1, reason: '陪著產卵' })
    } else {
      lines.push(`你放鬆身體，任${def.name}一顆接一顆滑出來，每一顆都讓你渾身發顫。`)
      report.narration = { ...report.narration, length: 'medium', adult_scene: `主角在高潮裡把體內的${def.name}一顆一顆產了下來` }
    }
    effects.push(...yields())
  } else if (b.kind === 'live') {
    const birth = familyRules.birth as { temple_cc: number; dc: number; wild_dc: number }
    const post = familyRules.postpartum as { days: number; fail_days: number }
    let ok = true
    if (how === 'temple') {
      effects.push({ type: 'money', amount: -birth.temple_cc })
      lines.push(`神殿的修女替你接生（奉獻 ${formatMoney(birth.temple_cc)}）。`)
    } else {
      ok = check(state, report, 'fai', inSettlement(state) ? birth.dc : birth.wild_dc, '產下魔物的幼體')
      lines.push(ok ? '你熬過了一陣一陣的收縮，平安地產下了牠們。' : '生得很辛苦，好在你撐了過來。')
    }
    const o = b.offspring ?? { name: '魔物的幼體', count: [1, 2] as [number, number], value_cc: 50 }
    const n = rollRange(state, o.count)
    lines.push(`生下了 ${n} 隻${o.name}。`)
    if (fate === 'scholar') {
      effects.push({ type: 'money', amount: n * o.value_cc })
      lines.push(`交給魔物學者研究，換到 ${formatMoney(n * o.value_cc)}。`)
    } else if (fate === 'temple') {
      effects.push({ type: 'reputation', faction: 'local', delta: 1 })
      lines.push('交給神殿淨化，修女們為牠們祈禱。')
    } else lines.push('你把牠們放回了巢穴附近，牠們很快就鑽進了暗處。')
    const days = ok ? post.days : post.fail_days
    ;(state.postpartum ??= {}).pc = state.time.day + days - 1
    lines.push(`產後虛弱 ${days} 天。`)
    addLactation(state, 'pc', { kind: 'brood', ref: '產後', until: state.time.day + broodRules().live_lactation_days })
    state.broodBirths = (state.broodBirths ?? 0) + 1
    report.narration = { ...report.narration, length: 'medium', focus: [`主角產下了 ${n} 隻${o.name}（一般的描寫，不是親密場景）`] }
  } else if (how === 'symbiosis' && b.symbiosis) {
    lines.push(`你沒有把${def.name}排出來，而是讓它在體內安頓下來，和你一起呼吸。`)
    effects.push({ type: 'perk', perk: b.symbiosis, direct: true })
  } else {
    const r = broodRules().parasite_check
    const ok = check(state, report, r.attr, r.dc, `把${def.name}排出來`)
    lines.push(ok ? `你屏住呼吸，把${def.name}排了出來，牠留下一層蛻殼就不動了。` : `${def.name}掙扎了很久才出來，你累得說不出話。`)
    if (!ok) effects.push({ type: 'condition', target: 'pc', condition: 'drained', add: true })
    effects.push(...yields())
  }
  effects.push({ type: 'parasite', parasite: ev.parasite, op: 'remove' })
  delete state.pendingBroodBirth
  const notes = applyEffects(state, report, effects.filter((e) => e.type !== 'item' || e.qty > 0))
  syncBroodLactation(state)
  report.outcome = { result: 'neutral', summary: [...lines, ...notes.filter((n) => n.includes('特質'))].join(''), tags: [TAG] }
  return commitReport(state, report)
}

// ---- 魔法物品店的取出（卵生、寄生） ----

export interface ExtractOffer { id: string; name: string; dc: number; price: number }

/** 這裡（魔法物品店）能取出的苗床 */
export function extractOffers(state: GameState): ExtractOffer[] {
  if (currentCell(state).kind !== 'magic') return []
  const r = broodRules().extract
  return broodsOf(pcOf(state)).filter((b) => b.brood.kind !== 'live').map((b) => ({ id: b.id, name: parasiteDef(b.id)!.name, dc: r.dc, price: r.price }))
}

/** 取出：付錢、擲智力；成功拿掉，失敗侵蝕度 +5 */
export function extractBrood(state: GameState, id: string): Report {
  const offer = extractOffers(state).find((o) => o.id === id)
  if (!offer) throw new Error('這裡取不出這個東西')
  if (isFugitive(state)) throw new Error('店主認出了你身上的契約印記，不肯幫你')
  if (state.money_cc < offer.price) throw new Error(`錢不夠（要 ${formatMoney(offer.price)}）`)
  const report = pcEventReport(state, '取出', TAG)
  report.kind = 'trade'
  report.time.end = addHours(state.time, 1)
  const ok = check(state, report, broodRules().extract.attr, offer.dc, `請鍊金師取出${offer.name}`)
  const effects: Parameters<typeof applyEffects>[2] = [{ type: 'money', amount: -offer.price }]
  effects.push(ok ? { type: 'parasite', parasite: id, op: 'remove' } : { type: 'corruption', parasite: id, delta: 5 })
  const notes = applyEffects(state, report, effects)
  report.outcome = { result: ok ? 'success' : 'failure', summary: `花了 ${formatMoney(offer.price)} 請鍊金師取出${offer.name}。${ok ? '取乾淨了。' : `沒取出來，${notes.at(-1) ?? ''}。`}`, tags: [TAG] }
  return commitReport(state, report)
}
