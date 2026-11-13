// 行囊：使用消耗品、更換裝備（戰鬥以外）。

import { hasSchool } from './schools'
import { useLactationItem } from './lactation'
import { addLewd, lewdName } from './lewd'
import { pcWords } from './pcWords'
import { PARASITE_LOCK } from './parasites'
import { hasPerk, learnablePerks, offerPerks } from './perks'
import { abilityQuality, carryLearned, learnAbility, nextBookAbility, recalc, snapshot } from './character'
import { gameRule } from './gameRules'
import {
  abilities, attrName, classDef, raceName, companionRules, lewdRules, conditionName, damageTypeName, itemDef, itemRules, locationById, perkDef, regionById, shopRules, statusDef, stories, townQuestTemplates, TRAP_LOCK, CURSE_LOCK, lockedByThing,
  type ItemIntel, type ItemUse, type LewdKey, type LockGrade,
} from './data'
import { EXTRA_SLOTS, classWeaponBlock, gearKnown, gearRules, gearSpecOf, gearStats, missingWear, raceUnfitReason, registerGear, setExtraSlotCount, slotNameFor, slotOpen, slotsFor, syncGear, wearName } from './gear'
import { addIntel, intelPlace, makePoint, nearbyPlaces, placesAt } from './intel'
import { discoverLead, hiddenLeadFor, leadPoolOn } from './leads'
import type { Lead } from './types'
import { openFor } from './storyFlags'
import { gainCondition, pcOf } from './party'
import { toolDef } from './tools'
import { roll } from './rng'
import { addHours, addItem, commitReport, newReportId, withRng } from './state'
import { startStory } from './story'
import type { Character, EquippedGear, GameState, GearSlot, GearSpec, Report } from './types'
import { contractOf } from './tattoos'
import { npcRecord } from './npcs'
import { openWithKey } from './restraints'
import { checkLure, lureTitle, startLure } from './dungeonEvents'

function itemReport(state: GameState, hours: number): Report {
  const start = { ...state.time }
  const loc = locationById(state.location)
  const pc = pcOf(state)
  return {
    schema_version: '0.1',
    report_id: newReportId(state),
    kind: 'trade',
    time: { start, end: addHours(start, hours) },
    location: { at: state.location, region: loc.region, scene: loc.name },
    party: state.party.map((m) => snapshot(m, undefined, pc)),
    outcome: { result: 'success' },
    changes: {},
    lore_keys: [loc.name, regionById(loc.region).name],
  }
}

function member(state: GameState, id: string): Character {
  const m = state.party.find((x) => x.id === id)
  if (!m) throw new Error('隊伍中沒有這位角色')
  return m
}

function take(state: GameState, name: string) {
  if (!state.inventory.some((i) => i.name === name && i.qty > 0)) throw new Error(`沒有${name}`)
  if (state.combat) throw new Error('戰鬥中不能這麼做')
}

/** 情報物品：可以解讀（目錄裡的，或 AI 生成、登錄在存檔的） */
export function isIntelItem(state: Pick<GameState, 'customItems'> | undefined, name: string): boolean {
  return (itemDef(name)?.category ?? state?.customItems?.[name]?.category) === 'info'
}

/** 情報物品解讀之後的內容（一行說明） */
export function intelSummary(intel: ItemIntel | undefined): string {
  if (!intel || intel.kind === 'point') {
    const ev = intel?.event ? EVENT_NAME[intel.event] : '強敵、藏寶處或流浪商人'
    const loc = intel?.location ? locationById(intel.location) : undefined
    const where = !loc ? '附近' : intel?.layer ? intelPlace({ location: loc.id, layer: intel.layer }) : loc.type === 'dungeon' ? `${loc.name}的某一層` : `${loc.name}近郊`
    return `解讀：${where}的事件點（${ev}）`
  }
  if (intel.kind === 'story') return `解讀：特殊任務「${stories.find((s) => s.id === intel.story)?.title ?? intel.story}」的消息`
  return '解讀：進行中委託的線索（檢定 +5）'
}
const EVENT_NAME: Record<NonNullable<ItemIntel['event']>, string> = { combat: '盤踞的強敵', chest: '藏寶處', merchant: '流浪商人' }

/**
 * 解讀情報物品：和向情報商買情報一樣，記進冒險筆記（事件點）、開始特殊任務，或給進行中的委託線索。
 * 用掉這件物品；沒有用處時（任務已經開始、沒有要檢定的委託）不會用掉。
 */
export function readIntelItem(state: GameState, name: string): Report {
  take(state, name)
  if (!isIntelItem(state, name)) throw new Error('這不是情報')
  const spec: ItemIntel = itemDef(name)?.intel ?? { kind: 'point' }
  const report = itemReport(state, 0.25)
  report.kind = 'event'
  report.outcome.tags = ['情報']
  let text = ''
  let lead: Lead | undefined
  if (spec.kind === 'story') {
    const def = stories.find((s) => s.id === spec.story)
    if (!def) throw new Error('消息裡說的事已經不存在了')
    if (state.stories?.[def.id]) throw new Error(`「${def.title}」的事你已經知道了`)
    startStory(state, def.id)
    addIntel(state, { kind: 'story', story: def.id, title: def.title, text: pcWords(state, def.start.text ?? def.summary), source: name })
    text = `得知「${def.title}」的消息，開始了這個特殊任務`
  } else if (spec.kind === 'lead') {
    const quests = state.quests.filter((q) => q.status === 'accepted' && !q.flags?.lead && q.template && townQuestTemplates[q.template]?.dc !== undefined)
    const q = quests.find((x) => x.giver === state.location) ?? quests[0]
    if (!q) throw new Error('目前沒有用得到這條線索的委託')
    q.flags = { ...(q.flags ?? {}), lead: true }
    text = `找到委託「${q.title}」的線索（委託的檢定 +5）`
  } else if (leadPoolOn() && !spec.location && (lead = hiddenLeadFor(state, spec.event === 'chest' ? ['chest', 'relic'] : spec.event ? [spec.event] : undefined))) {
    // 線索池開著：揭露這個地區一則隱藏的線索（事件種類對得上的優先）
    const it = discoverLead(state, lead, name)
    text = `記下情報「${it.title}」：${it.text}（第 ${it.until} 天前有效，見冒險筆記）`
  } else {
    const places = spec.location ? placesAt(spec.location, spec.layer) : nearbyPlaces(state.location, openFor(state))
    if (!places.length) throw new Error('看不出這份情報說的是哪裡')
    const it = withRng(state, (rng) => {
      const p = rng.pick(places)
      const event = spec.event ?? rng.pick(['combat', 'combat', 'chest', 'chest', 'merchant'] as const)
      return addIntel(state, { ...makePoint(state, p, event, spec.days ?? shopRules.types.informant.info?.valid_days ?? 5), kind: 'point', source: name })
    })
    text = `記下情報「${it.title}」：${it.text}（第 ${it.until} 天前有效，見冒險筆記）`
  }
  report.changes.items_lost = [{ name, qty: 1 }]
  report.outcome.summary = `解讀了${name}，${text}。`
  return commitReport(state, report)
}

export function canUse(name: string): boolean {
  const use = itemDef(name)?.use
  return (!!use && !use.combat_only && (!!use.heal || !!use.slot || !!use.condition || !!use.perks?.length || !!use.abilities?.length || !!use.lactation || !!use.stop_lactation || hasLewdUse(use) || !!use.lure?.length)) || !!toolDef(itemDef(name)?.tool)?.condition
}

/** 冥想道具：有慾望指標的增減 */
function hasLewdUse(use: ItemUse): boolean {
  return Object.values(use.lewd ?? {}).some((v) => v)
}
function lewdUseText(lewd: Partial<Record<LewdKey, number>>): string {
  return Object.entries(lewd).filter(([, v]) => v).map(([k, v]) => `${k === 'exposure' ? '這一帶的' : ''}${lewdName(k as LewdKey)} ${v! > 0 ? '+' : '−'}${Math.abs(v!)}`).join('、')
}

/** 消耗品效果的一行說明 */
export function useSummary(use?: ItemUse): string {
  if (!use) return ''
  const parts: string[] = []
  if (use.condition) parts.push(`「${conditionName(use.condition)}」：${companionRules.conditions[use.condition]?.desc ?? ''}`)
  if (use.perks?.length) parts.push(`讀了有機會學會特質：${use.perks.map((id) => perkDef(id)?.name ?? id).join('、')}`)
  if (use.abilities?.length) parts.push(`每讀一次學會下一個能力：${use.abilities.map((id) => `${abilities[id]?.name ?? id}（${abilities[id]?.unlock ?? 1} 級）`).join('、')}`)
  if (use.revive) parts.push(`救起倒下的隊友（${Math.round(use.revive * 100)}% 生命）`)
  if (use.lactation) parts.push(`${use.lactation} 天內泌乳`)
  if (use.stop_lactation) parts.push('停止道具與事件造成的泌乳')
  if (hasLewdUse(use)) parts.push(`冥想一小時：${lewdUseText(use.lewd!)}`)
  if (use.lure?.length) parts.push(`在地下城裡使用：立刻遇到「${lureTitle(use.lure) ?? '（事件已經不在了）'}」`)
  if (use.heal) parts.push(`回復 ${use.heal} HP`)
  if (use.slot) parts.push(`回復 ${use.slot} 環以下的法術環`)
  if (use.cleanse) parts.push(`解除${use.cleanse.map((id) => statusDef(id).name).join('、')}`)
  if (use.status) parts.push(`${statusDef(use.status.id).name} ${use.status.turns} 回合`)
  if (use.temp_hp) parts.push(`暫時生命 ${use.temp_hp}`)
  if (use.ap) parts.push(`行動點 +${use.ap}`)
  const area = use.area === 'all' ? '所有敵人' : '一名敵人'
  if (use.damage) parts.push(`${area} ${use.damage.dice} ${damageTypeName(use.damage.type)}傷害`)
  if (use.apply) parts.push(`${use.damage ? '' : area}${statusDef(use.apply.status).name} ${use.apply.turns} 回合${use.apply.save ? `（${attrName(use.apply.save)}豁免 DC ${use.apply.dc}）` : ''}`)
  if (use.save) parts.push(`${attrName(use.save.attr)}豁免 DC ${use.save.dc}（成功減半）`)
  if (use.escape) parts.push('全隊脫離戰鬥')
  return parts.join('、') + (use.combat_only ? '・戰鬥中' : '')
}

export function canEquip(state: Pick<GameState, 'customItems'>, name: string): boolean {
  return !!gearSpecOf(state, name)
}

/** 使用消耗品（戰鬥以外）：回復生命值或法術環、吃喝；保養類的工具（磨刀石）用了不會消耗。其他效果只能在戰鬥中使用。 */
export function useItem(state: GameState, name: string, memberId: string): Report {
  take(state, name)
  const def = itemDef(name)
  const toolCondition = toolDef(def?.tool)?.condition
  if (!def?.use && !toolCondition) throw new Error('這個東西不能使用')
  if (!canUse(name)) throw new Error('這個東西只能在戰鬥中使用')
  const m = member(state, memberId)
  const report = itemReport(state, toolCondition ? 0.25 : 0.1)
  const snap = report.party.find((p) => p.id === m.id)!
  let text = ''
  // 工具：得到狀態，東西留著
  if (toolCondition) {
    if (!gainCondition(m, toolCondition, report)) throw new Error(`${m.name}已經是「${conditionName(toolCondition)}」了`)
    report.outcome.summary = `${m.name}用了${name}，得到「${conditionName(toolCondition)}」（${name}還留著）。`
    return commitReport(state, report)
  }
  if (!def?.use) throw new Error('這個東西不能使用')
  if (def.use.lure?.length) {
    // 寄生物的引子（docs/ADULT_EVENTS.md 第 6 節）：在地下城裡立刻遇到那件事，發生在主角身上；不在地下城、正忙著時不會用掉
    const t = checkLure(state, def.use.lure)
    report.changes.items_lost = [{ name, qty: 1 }]
    report.outcome.summary = `拿出了${name}——「${t.title}」。`
    const committed = commitReport(state, report)
    startLure(state, t)
    return committed
  }
  if (def.use.perks?.length) {
    // 書籍：讀完得到一次學特質的機會（從書裡的特質選一個，或寫說法交給 AI）
    // 只給現在學得了的：進階特質要先有入門、互斥的流派不能同修（秘法書，docs/LEWD_STATS.md 第 6.1 節）
    const learnable = new Set(learnablePerks(m).map((p) => p.id))
    const unread = def.use.perks.filter((id) => !hasPerk(m, id))
    if (!unread.length) throw new Error(`${m.name}已經學會書裡的特質了`)
    const options = unread.filter((id) => learnable.has(id))
    if (!options.length) throw new Error(`${m.name}現在還學不了書裡的特質（${unread.map((id) => perkDef(id)?.name ?? id).join('、')}：要先學會前面的特質，或和身上的特質互斥）`)
    offerPerks(m, `讀了「${name}」`, options)
    report.time.end = addHours(report.time.start, 4)
    text = `讀完之後，有機會學會：${options.map((id) => perkDef(id)?.name ?? id).join('、')}`
  } else if (def.use.abilities?.length) {
    // 技能書：學會下一個還沒學、等級也夠的能力
    const next = nextBookAbility(m, def.use.abilities)
    if (!next.ability) throw new Error(next.reason)
    const a = learnAbility(m, next.ability.id)
    const carried = carryLearned(m, a.id, gameRule(state, 'skillLoadout'))
    report.time.end = addHours(report.time.start, 4)
    report.changes.skills_gained = [{ actor: m.id, skill: a.name, quality: abilityQuality(a), source: 'study' }]
    text = `學會了【${a.name}】${carried ? '' : '（攜帶的技能已滿，先放進技能庫）'}`
  } else if (def.use.lactation || def.use.stop_lactation) {
    // 泌乳的道具（docs/FAMILY.md 第 10 節）：自由的夥伴要先答應，不肯的話道具不會用掉
    const r = useLactationItem(state, report, m, name, def.use)
    if (r.refused) {
      report.outcome.summary = `${r.text}。`
      return commitReport(state, report)
    }
    text = r.text
  } else if (hasLewdUse(def.use)) {
    // 冥想道具（docs/LEWD_STATS.md 第 4.1 節）：花一個小時，降一項慾望指標（曝露名聲是這一帶的）
    const changed = Object.entries(def.use.lewd!).filter(([, v]) => v).map(([k, v]) => [k as LewdKey, addLewd(state, m, k as LewdKey, v!, report)] as const).filter(([, d]) => d)
    if (!changed.length) throw new Error(`${m.name}的${Object.keys(def.use.lewd!).map((k) => lewdName(k as LewdKey)).join('、')}已經降不下去了`)
    report.time.end = addHours(report.time.start, 1)
    text = `靜下心來冥想了一個小時：${changed.map(([k, d]) => `${lewdName(k)} ${d > 0 ? '+' : ''}${d}`).join('、')}`
  } else if (def.use.condition) {
    const got = gainCondition(m, def.use.condition, report)
    if (!got) throw new Error(`${m.name}${companionRules.conditions[def.use.condition]?.group === 'meal' ? '已經吃得比這更好了' : '已經喝不下了'}`)
    text = `得到「${conditionName(got)}」`
  } else if (def.use.heal) {
    if (m.hp >= m.maxHp) throw new Error(`${m.name}沒有受傷`)
    const before = m.hp
    const healed = withRng(state, (rng) => roll(rng, def.use!.heal!).total)
    snap.hp = [before, Math.min(m.maxHp, before + healed), m.maxHp]
    text = `回復 ${snap.hp[1] - before} 點生命值`
  } else if (def.use.slot) {
    const circle = [...m.slotsUsed.keys()].filter((i) => i < def.use!.slot! && (m.slotsUsed[i] ?? 0) > 0).pop()
    if (circle === undefined) throw new Error(`${m.name}沒有可以回復的法術環`)
    m.slotsUsed[circle]! -= 1
    text = `回復一個 ${circle + 1} 環法術環`
  }
  report.changes.items_lost = [{ name, qty: 1 }]
  report.outcome.summary = `${m.name}使用了${name}，${text}。`
  return commitReport(state, report)
}

/**
 * 穿上裝備：放進指定的欄位（沒指定時挑第一個空的、可以放的欄位）。
 * 雙手武器會空出副手；換下來的裝備放回行囊。
 */
/**
 * 不能拿下的裝備：主人強制裝上的（契約還在時）、陷阱鎖住的、詛咒具（解咒之前）、寄生裝備（馴服或解咒之前），
 * 以及自己鎖上、鑰匙不在自己身上的拘束具（交給別人保管或丟掉了）
 */
export function lockedGear(m: Character, slot: GearSlot): EquippedGear | undefined {
  const g = m.gear?.[slot]
  if (g?.lock && !g.locked) return g.keyHolder === 'self' ? undefined : g
  if (!g?.locked) return undefined
  return g.locked.startsWith(PARASITE_LOCK) || lockedByThing(g.locked) || contractOf(m) ? g : undefined
}

/**
 * 限定穿著（任務點、地標場景的 wear）裡，因為欄位被鎖住（寄生裝備、主人強制戴上的）而穿不上的：回傳提醒的句子。
 * 已經穿著符合的就不算
 */
export function wearLocks(m: Character, wear: string[] | undefined): string[] {
  const out: string[] = []
  for (const w of missingWear(m, wear)) {
    const base = gearRules.bases[w] ? w : itemDef(w)?.gear?.base
    const slot = base ? gearRules.bases[base]?.slot : undefined
    if (!slot) continue
    const group = gearRules.slot_groups[slot] ?? [slot as GearSlot]
    const locks = group.map((x) => lockedGear(m, x))
    if (locks.length && locks.every(Boolean)) out.push(`${locks[0]!.name}脫不下來，穿不上【${wearName(w)}】`)
  }
  return [...new Set(out)]
}

function assertUnlocked(m: Character, slot: GearSlot) {
  const g = lockedGear(m, slot)
  if (g && !g.locked) throw new Error(`${g.name}上了鎖，${g.keyHolder === 'discarded' ? '鑰匙已經丟掉了' : '鑰匙不在自己身上'}（要拿回鑰匙、脫縛、用一次性的鑰匙或找鐵匠剪鎖）`)
  if (g?.locked?.startsWith(PARASITE_LOCK)) throw new Error(`${g.name}緊緊貼在身上，脫不下來（寄生裝備：馴服或解咒之後才能拿下）`)
  if (g?.locked?.startsWith(CURSE_LOCK)) throw new Error(`${g.name}被詛咒鎖在身上，掙不開也打不開（要到神殿解咒）`)
  if (g?.locked?.startsWith(TRAP_LOCK)) throw new Error(`${g.name}被鎖住了，自己打不開（要脫縛、用鑰匙或找鐵匠剪鎖）`)
  if (g) throw new Error(`${g.name}是主人強制戴上的，契約還在時不能拿下`)
}

/** 這件裝備能放的欄位（種族封住的、被主人鎖住的不算） */
export function freeSlotsFor(m: Character, spec: GearSpec): GearSlot[] {
  return slotsFor(spec, m.race).filter((x) => !lockedGear(m, x))
}

/**
 * 把裝備穿到角色身上（不經過行囊）：回傳穿上的欄位與換下來的裝備名稱（放回行囊由呼叫的地方處理）。
 * locked：主人強制裝上的（主人的 id）。換了裝備之後重算生命值上限（裝備可能有屬性加減）
 */
export function putOn(m: Character, name: string, spec: GearSpec, slot?: GearSlot, locked?: string): { target: GearSlot; back: string[] } {
  const all = slotsFor(spec, m.race)
  if (gearRules.bases[spec.base]?.pet && !hasSchool(m, 'beast')) throw new Error(`${name}只聽修了獸蟲派的人的話`)
  if (!all.length) throw new Error(gearRules.bases[spec.base]?.races?.length ? `只有${gearRules.bases[spec.base]!.races!.map(raceName).join('、')}能穿${name}` : raceUnfitReason(spec.base, m.race) ?? `${m.name}無法使用這個欄位`)
  if (slot && !all.includes(slot)) throw new Error(`${name}不能放在${slotNameFor(slot, m.race)}`)
  if (slot) assertUnlocked(m, slot)
  const options = freeSlotsFor(m, spec)
  if (!options.length) assertUnlocked(m, all[0]!)
  const gear = (m.gear ??= {})
  const target = slot ?? options.find((x) => !gear[x]) ?? options[0]!
  const stats = gearStats(spec)
  const main = gear.main_hand
  if (target === 'off_hand' && main && gearKnown(main.spec) && gearStats(main.spec).two_handed) throw new Error(`${main.name}要用雙手，副手空不出來`)
  if (target === 'main_hand' && stats.two_handed && gear.off_hand) assertUnlocked(m, 'off_hand')
  const back: string[] = []
  const removed = gear[target]
  if (removed) back.push(removed.name)
  // 換下自己鎖上的拘束具（鑰匙在自己身上）：打開鎖，鎖一起收進行囊
  const removedLock = removed?.lock && !removed.locked && removed.keyHolder === 'self' ? lockItemName(removed.lock) : undefined
  if (removedLock) back.push(removedLock)
  if (target === 'main_hand' && stats.two_handed && gear.off_hand) {
    back.push(gear.off_hand.name)
    delete gear.off_hand
  }
  // 詛咒具：一戴上就被詛咒鎖住（不管是自己戴的、陷阱還是別人替你戴的）
  const mark = spec.curse && gearRules.bases[spec.base]?.bind ? `${CURSE_LOCK}${name}` : locked
  gear[target] = { name, spec, ...(mark ? { locked: mark } : {}) }
  syncGear(m, classDef(m.class).weapon)
  recalc(m)
  return { target, back }
}

export function equipItem(state: GameState, name: string, memberId: string, slot?: GearSlot): Report {
  take(state, name)
  const spec = gearSpecOf(state, name)
  if (!spec) throw new Error('這個東西不能裝備')
  if (!gearKnown(spec)) throw new Error('這件裝備的底材或材料已經不存在，不能裝備')
  const m = member(state, memberId)
  // 存檔規則「職業武器限制」：主手只能拿職業能用的武器類型
  const block = state.options?.classWeapons ? classWeaponBlock(m.class, spec) : null
  if (block) throw new Error(`${block}，${m.name}不能裝備${name}`)
  const report = itemReport(state, 0.1)
  const { target, back } = putOn(m, name, spec, slot)
  report.changes.items_lost = [{ name, qty: 1 }]
  if (back.length) report.changes.items_gained = back.map((n) => ({ name: n, qty: 1, owner: 'pc' }))
  report.outcome.summary = `${m.name}在${slotNameFor(target, m.race)}裝上了${name}${back.length ? `，把${back.join('、')}收進行囊` : ''}。`
  if (m.gear?.[target]?.locked?.startsWith(CURSE_LOCK)) report.outcome.summary += `扣上的瞬間，${name}上的咒文亮了起來——被詛咒鎖住了，拿不下來（要到神殿解咒）。`
  return commitReport(state, report)
}

/** 卸下裝備，放回行囊 */
export function unequipItem(state: GameState, memberId: string, slot: GearSlot): Report {
  if (state.combat) throw new Error('戰鬥中不能這麼做')
  const m = member(state, memberId)
  const g = m.gear?.[slot]
  if (!g) throw new Error(`${slotNameFor(slot, m.race)}沒有裝備`)
  assertUnlocked(m, slot)
  delete m.gear![slot]
  syncGear(m, classDef(m.class).weapon)
  recalc(m)
  const report = itemReport(state, 0.1)
  // 自己裝的鎖（鑰匙在自己身上才走得到這裡）：打開，鎖放回行囊
  const lock = g.lock && !g.locked ? lockItemName(g.lock) : undefined
  report.changes.items_gained = [{ name: g.name, qty: 1, owner: 'pc' }, ...(lock ? [{ name: lock, qty: 1, owner: 'pc' }] : [])]
  report.outcome.summary = `${m.name}${lock ? `打開${lock}，` : ''}卸下了${g.name}。`
  return commitReport(state, report)
}

// ---- 鎖（雙面效應，docs/LEWD_STATS.md 第 7 節） ----

/** 這個等級的鎖是哪一件物品（打開時放回行囊） */
export function lockItemName(grade: LockGrade): string | undefined {
  return itemRules.items.find((i) => i.lock === grade)?.name
}

/** 行囊裡的鎖 */
export function lockItems(state: GameState): { name: string; grade: LockGrade }[] {
  return state.inventory.filter((i) => i.qty > 0 && itemDef(i.name)?.lock).map((i) => ({ name: i.name, grade: itemDef(i.name)!.lock! }))
}

/** 誰鎖上的（別人的鎖）：陷阱、詛咒或主人 */
export function lockerOf(g: EquippedGear): string {
  return g.locked?.startsWith(CURSE_LOCK) ? '詛咒' : g.locked?.startsWith(TRAP_LOCK) ? '陷阱' : '主人'
}

/** 這一格的裝備能不能上鎖：拘束具（底材有 bind）、還沒上鎖、沒有自帶的鎖、不是別人鎖上的 */
export function lockable(g: EquippedGear | undefined): boolean {
  return !!g && !!gearRules.bases[g.spec.base]?.bind && !g.lock && !g.spec.lock && !g.locked
}

/** 用行囊裡的鎖替身上的拘束具上鎖：鑰匙在自己身上（keyHolder self），之後可以交給別人保管或丟掉（docs/LEWD_STATS.md 第 7 節） */
export function lockGear(state: GameState, memberId: string, slot: GearSlot, lockName: string): Report {
  take(state, lockName)
  const grade = itemDef(lockName)?.lock
  if (!grade) throw new Error(`${lockName}不是鎖`)
  const m = member(state, memberId)
  const g = m.gear?.[slot]
  if (!g || !gearRules.bases[g.spec.base]?.bind) throw new Error('這一格沒有可以上鎖的拘束具')
  if (g.locked) throw new Error(`${g.name}是${lockerOf(g)}鎖上的`)
  if (g.lock || g.spec.lock) throw new Error(`${g.name}已經上鎖了`)
  g.lock = grade
  g.keyHolder = 'self'
  const report = itemReport(state, 0.1)
  report.changes.items_lost = [{ name: lockName, qty: 1 }]
  report.outcome.summary = `${m.name}用${lockName}鎖上了${g.name}，鑰匙收在身上。`
  return commitReport(state, report)
}

/** 用一次性的鑰匙打開自己打不開的拘束具（docs/LEWD_STATS.md 第 16 節）：鑰匙用掉，鎖也壞掉 */
export function useKey(state: GameState, memberId: string, slot: GearSlot, key: string): Report {
  take(state, key)
  const m = member(state, memberId)
  const { text } = openWithKey(m, slot, key)
  const report = itemReport(state, 0.1)
  report.changes.items_lost = [{ name: key, qty: 1 }]
  report.outcome.summary = text
  return commitReport(state, report)
}

/** 打開自己裝的鎖（鑰匙要在自己身上），鎖放回行囊 */
export function unlockGear(state: GameState, memberId: string, slot: GearSlot): Report {
  if (state.combat) throw new Error('戰鬥中不能這麼做')
  const m = member(state, memberId)
  const g = m.gear?.[slot]
  if (!g?.lock) throw new Error('這一格沒有上鎖')
  if (g.locked) throw new Error(`${g.name}是${lockerOf(g)}鎖上的，鑰匙不在你身上`)
  const why = keyAway(state, g)
  if (why) throw new Error(`${g.name}的${why}`)
  const name = lockItemName(g.lock)
  delete g.lock
  delete g.keyHolder
  const report = itemReport(state, 0.1)
  if (name) report.changes.items_gained = [{ name, qty: 1, owner: 'pc' }]
  report.outcome.summary = `${m.name}打開了${g.name}上的${name ?? '鎖'}。`
  return commitReport(state, report)
}

// ---- 自己鎖上的拘束具的鑰匙（docs/LEWD_STATS.md 第 7 節；lewd.json 的 locks.key_custody） ----

/** 鑰匙在誰那裡的名字（自己、隊員、主人；不在隊伍裡的人照人物紀錄） */
export function keyHolderName(state: GameState, id: string): string {
  return state.party.find((x) => x.id === id)?.name ?? npcRecord(state, id)?.name ?? '別人'
}

/** 打不開自己鎖上的鎖的原因：鑰匙交給別人保管或丟掉了（鑰匙在自己身上、或不是自己鎖的時 undefined） */
export function keyAway(state: GameState, g: EquippedGear): string | undefined {
  if (!g.lock || g.locked || g.keyHolder === 'self') return undefined
  if (!g.keyHolder) return '鎖沒有鑰匙'
  if (g.keyHolder === 'discarded') return '鑰匙已經丟掉了'
  return `鑰匙在${keyHolderName(state, g.keyHolder)}那裡`
}

/** 可以替這個人保管鑰匙的人：隊伍裡的其他人（暫時離隊的不算）；是這個人的主人時 master */
export function keyKeepers(state: GameState, m: Character): { id: string; name: string; master: boolean }[] {
  const master = contractOf(m)?.master
  return state.party
    .filter((x) => x.id !== m.id && !x.status.includes('away'))
    .map((x) => ({ id: x.id, name: x.name, master: x.id === master }))
}

function selfKeyed(state: GameState, memberId: string, slot: GearSlot): { m: Character; g: EquippedGear } {
  if (state.combat) throw new Error('戰鬥中不能這麼做')
  const m = member(state, memberId)
  const g = m.gear?.[slot]
  if (!g?.lock || g.locked || !g.keyHolder) throw new Error('這一格沒有自己鎖上的拘束具')
  return { m, g }
}

/** 把鑰匙交給同伴或主人保管：戰鬥中這個人的雙面效應上限提高，每天順從也會成長；要打開鎖得請那個人還回來 */
export function giveKey(state: GameState, memberId: string, slot: GearSlot, holderId: string): Report {
  const { m, g } = selfKeyed(state, memberId, slot)
  if (g.keyHolder !== 'self') throw new Error(`${g.name}的${keyAway(state, g)}`)
  const to = keyKeepers(state, m).find((x) => x.id === holderId)
  if (!to) throw new Error('這個人現在不能替你保管鑰匙')
  g.keyHolder = to.id
  const report = itemReport(state, 0.1)
  report.outcome.summary = `${m.name}把${g.name}的鑰匙交給${to.master ? '主人' : ''}${to.name}保管。`
  return commitReport(state, report)
}

/**
 * 請保管的人把鑰匙還回來：那個人要在隊伍裡（離隊的人把鑰匙一起帶走，回來之後才拿得回）。
 * 鑰匙在主人手上時，主人的親密度要到 key_custody.master_affinity 才肯還
 */
export function takeKeyBack(state: GameState, memberId: string, slot: GearSlot): Report {
  const { m, g } = selfKeyed(state, memberId, slot)
  const id = g.keyHolder!
  if (id === 'self') throw new Error('鑰匙就在自己身上')
  if (id === 'discarded') throw new Error('鑰匙已經丟掉了')
  const name = keyHolderName(state, id)
  const holder = state.party.find((x) => x.id === id)
  if (!holder || holder.status.includes('away')) throw new Error(`鑰匙在${name}那裡，${name}現在不在隊伍裡`)
  const need = lewdRules.locks.key_custody.master_affinity
  const aff = state.relationships?.[id]?.affinity ?? 0
  if (contractOf(m)?.master === id && aff < need) throw new Error(`${name}不肯把鑰匙還給你（主人的親密度要 ${need} 以上，現在 ${aff}）`)
  g.keyHolder = 'self'
  const report = itemReport(state, 0.1)
  report.outcome.summary = `${name}把${g.name}的鑰匙還給了${m.name}。`
  return commitReport(state, report)
}

/** 丟掉鑰匙：戰鬥中這個人的雙面效應上限提高更多；之後只剩脫縛、一次性的鑰匙與鐵匠剪鎖（鎖會壞掉） */
export function discardKey(state: GameState, memberId: string, slot: GearSlot): Report {
  const { m, g } = selfKeyed(state, memberId, slot)
  if (g.keyHolder !== 'self') throw new Error(`${g.name}的${keyAway(state, g)}`)
  g.keyHolder = 'discarded'
  const report = itemReport(state, 0.1)
  report.outcome.summary = `${m.name}把${g.name}的鑰匙丟掉了。`
  return commitReport(state, report)
}

/** 存檔規則「職業武器限制」打開時，這個人不能裝備這件東西的原因（行囊的「裝備」按鈕灰掉用）；可以裝備時是 null */
export function classWeaponBlockFor(state: GameState, name: string, memberId: string): string | null {
  if (!state.options?.classWeapons) return null
  const m = state.party.find((x) => x.id === memberId)
  const spec = gearSpecOf(state, name)
  return m && spec ? classWeaponBlock(m.class, spec) : null
}

/**
 * 切換這個存檔的職業武器限制。打開時有人卸下武器的話，寫一筆日誌說明誰的什麼收進了行囊（回傳那筆報告）
 */
export function setClassWeapons(state: GameState, on: boolean): Report | null {
  const { classWeapons: _, ...rest } = state.options ?? { defeatLoot: 'half' }
  state.options = { ...rest, ...(on ? { classWeapons: true } : {}) }
  const moved = enforceClassWeapons(state)
  if (!moved.length) return null
  const report = itemReport(state, 0)
  report.outcome.summary = `打開了存檔規則「職業武器限制」：${moved.join('；')}。`
  report.outcome.tags = ['職業武器限制']
  return commitReport(state, report)
}

/**
 * 存檔規則「額外飾品欄的格數」：設定目前開放的格數，超出的格子裡的裝備收進行囊（上了鎖或主人強迫的留在身上，直到解開）。
 * 讀檔、開新遊戲、改規則、夥伴入隊時呼叫；回傳日誌用的說明
 */
export function enforceExtraSlots(state: GameState, members: Character[] = state.party): string[] {
  setExtraSlotCount(gameRule(state, 'extraSlots'))
  const out: string[] = []
  for (const m of members) {
    for (const slot of EXTRA_SLOTS) {
      const g = m.gear?.[slot]
      if (!g || slotOpen(slot) || g.lock || g.locked) continue
      delete m.gear![slot]
      recalc(m)
      addItem(state.inventory, gearSpecOf(state, g.name) ? g.name : registerGear(state, g.spec, g.name), 1)
      out.push(`${m.name}的${g.name}收進了行囊（額外飾品欄只開 ${gameRule(state, 'extraSlots')} 格）`)
    }
  }
  return out
}

/**
 * 存檔規則「職業武器限制」（docs/ITEMS.md 第 2.2 節）：主手拿著職業不能用的武器時卸下、放回行囊。
 * 打開規則時、讀檔時、有人入隊時呼叫；規則關著或沒有人要卸時回傳空陣列。被鎖住的（主人強迫的）不動。
 */
/** 設定目前開放的額外飾品欄格數，回傳有沒有人的裝備在關掉的格子裡、要收起來（不動裝備） */
export function extraOverflow(state: GameState): boolean {
  setExtraSlotCount(gameRule(state, 'extraSlots'))
  return state.party.some((m) => EXTRA_SLOTS.some((slot) => { const g = m.gear?.[slot]; return !!g && !slotOpen(slot) && !g.lock && !g.locked }))
}

/** 改存檔規則「額外飾品欄的格數」後收進行囊的裝備：寫一筆日誌 */
export function stowedReport(state: GameState, stowed: string[]): Report {
  const report = itemReport(state, 0)
  report.outcome.summary = `改了存檔規則「額外飾品欄的格數」：${stowed.join('；')}。`
  report.outcome.tags = ['額外飾品欄']
  return commitReport(state, report)
}

export function enforceClassWeapons(state: GameState, members: Character[] = state.party): string[] {
  if (!state.options?.classWeapons) return []
  const out: string[] = []
  for (const m of members) {
    const g = m.gear?.main_hand
    if (!g || g.lock || g.locked || !gearKnown(g.spec)) continue
    const block = classWeaponBlock(m.class, g.spec)
    if (!block) continue
    delete m.gear!.main_hand
    syncGear(m, classDef(m.class).weapon)
    recalc(m)
    addItem(state.inventory, gearSpecOf(state, g.name) ? g.name : registerGear(state, g.spec, g.name), 1)
    out.push(`${m.name}的${g.name}收進了行囊（${block}）`)
  }
  return out
}
