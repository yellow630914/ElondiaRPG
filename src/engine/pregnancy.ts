// 懷孕（成人向，docs/FAMILY.md）。
// - 受孕只在性經歷的 AI 記錄時判定（sexRecord.ts 的 applySexUpdates 呼叫 maybeConceive）：範圍是那份日誌的人
//   （主角、隊伍、人際關係裡的人），NPC 私生活（npcLife.ts）不會受孕，娼館接客不會受孕。內容篩選「懷孕」關掉時不擲。
// - 記錄存在 state.pregnancies（角色 id，主角是 pc）；階段照「已經懷了幾天 ÷ 孕期」算，不另外存。
//   角色身上的標記（pregMark）在每次結算時同步，檢定減值看標記（pregMarks.ts）。
// - 中期自動察覺（隊伍、留守與寄放的人；不在隊上的人要主角在同一座城）。察覺、自動生下的嬰兒寫成通知（state.familyNotices）。
// - 預產日到了：主角、隊上的人在聚落裡時跳生產事件（state.pendingBirth）；在野外先陣痛，labor_hours 之後在原地生（DC 高）。
//   不在隊上的人在他的城裡自動生下，嬰兒照 children.ts 的 autoPlace 自動安排。
// - 不做流產：生產失敗只會讓產後虛弱變長。

import familyJson from '@data/rules/family.json'
import { attrParts, rollBreakdown, sumParts } from './rollParts'
import { addChild, autoPlace, birthPlaceOptions, childrenNote, hasTemple, nurseryRefusal, placeText } from './children'
import { tagsAllowed } from './content'
import { genderDef, GENDER_IDS, isSettlement, locationById, locationName, npcPool, type AttrId } from './data'
import { gameRule } from './gameRules'
import { characterBody } from './look'
import { formatMoney } from './money'
import { hashString, npcRecord } from './npcs'
import { addNpcNews } from './npcLife'
import { gainCondition, isFugitive } from './party'
import { checkModifiers } from './perks'
import { familyRules, pregnancyStageName } from './pregMarks'
import { Rng, roll as diceRoll, withBonus } from './rng'
import { commitReport, withRng } from './state'
import { babyName } from './traits'
import { baseReport } from './town'
import type { Character, ChildPlace, GameState, PregnancyStage, PregnancyState, Report } from './types'

interface Rules {
  conception: { base: number; times: Record<string, number>; race: { same: number; mixed: number; low_fertility: Record<string, number> }; max: number; brothel: number; tattoos?: Record<string, number>; parasites?: Record<string, { min: number; mult: number }> }
  genders: { carry: string[]; sire: string[]; body_carry: string[]; body_sire: string[] }
  morning_sickness: { stage: PregnancyStage; chance: number; condition: string }
  discover: { auto_stage: PregnancyStage }
  birth: { temple_cc: number; attr: AttrId; dc: number; wild_dc: number; healer_bonus: number; healer_classes: string[]; labor_hours: number }
}
const rules = familyJson as unknown as Rules

const TAG = '懷孕'
const hoursNow = (state: GameState) => state.time.day * 24 + (state.time.hour ?? 0) + (state.time.minute ?? 0) / 60

// ---- 誰 ----

interface Person { id: string; name: string; race: string; gender?: string; body?: Character['body']; character?: Character; inParty: boolean; location?: string; staying?: string }

/** 找一個人（主角是 pc）：隊伍、NPC 登錄（留守、寄放、人際關係裡的人） */
export function personOf(state: GameState, id: string): Person | undefined {
  const pc = state.party.find((m) => m.isPlayer)
  if (id === 'pc' || (pc && id === pc.id)) return pc ? { id: 'pc', name: pc.name, race: pc.race, gender: pc.gender, body: pc.body, character: pc, inParty: true, location: state.location } : undefined
  const m = state.party.find((x) => x.id === id)
  if (m) return { id, name: m.name, race: m.race, gender: m.gender, body: m.body, character: m, inParty: true, location: state.location }
  const rec = state.npcs?.[id] ?? npcRecord(state, id)
  if (!rec) return undefined
  const c = rec.character
  return { id, name: c?.name ?? rec.name, race: c?.race ?? rec.race, gender: c?.gender ?? rec.gender, body: c?.body, ...(c ? { character: c } : {}), inParty: false, location: rec.staying?.startsWith('tavern:') ? rec.staying.slice(7) : rec.location, ...(rec.staying ? { staying: rec.staying } : {}) }
}

/** 性別對得到 carry／sire 嗎；對應不到的性別（主角自由輸入、未知）看體型 */
function genderCan(p: Pick<Person, 'gender' | 'race' | 'body'>, side: 'carry' | 'sire'): boolean {
  const g = genderDef(p.gender)?.id
  if (g && g !== 'unknown') return rules.genders[side].includes(g)
  const body = characterBody({ race: p.race, gender: p.gender, body: p.body })
  return rules.genders[side === 'carry' ? 'body_carry' : 'body_sire'].includes(body)
}

export function canCarry(p: Pick<Person, 'gender' | 'race' | 'body'>): boolean {
  return genderCan(p, 'carry')
}

export function canSire(p: Pick<Person, 'gender' | 'race' | 'body'>): boolean {
  return genderCan(p, 'sire')
}

// ---- 記錄與階段 ----

export function pregnancyOf(state: GameState, id: string): PregnancyState | undefined {
  return state.pregnancies?.[pcKey(state, id)]
}

/** 主角的角色 id 換成 pc */
function pcKey(state: GameState, id: string): string {
  return state.party.find((m) => m.isPlayer)?.id === id ? 'pc' : id
}

export function isPostpartum(state: GameState, id: string): boolean {
  const until = state.postpartum?.[pcKey(state, id)]
  return until !== undefined && state.time.day <= until
}

/** 懷了幾天佔孕期的比例對應的階段 */
export function stageOf(p: PregnancyState, day: number): PregnancyStage {
  const f = (day - p.conceived) / Math.max(1, p.due - p.conceived)
  let stage: PregnancyStage = 'hidden'
  for (const s of familyRules.stages) if (f >= s.at) stage = s.id
  return stage
}

const STAGE_ORDER: PregnancyStage[] = ['hidden', 'early', 'mid', 'late']
const atLeast = (a: PregnancyStage, b: PregnancyStage) => STAGE_ORDER.indexOf(a) >= STAGE_ORDER.indexOf(b)

/** 角色詳情的一行（察覺之後才有） */
export function pregnancyLine(state: GameState, id: string): string {
  const p = pregnancyOf(state, id)
  if (p?.known) {
    const days = state.time.day - p.conceived
    return `懷孕・${pregnancyStageName(stageOf(p, state.time.day))}（第 ${days} 天，預產第 ${p.due} 天）・父親：${p.father?.name ?? '父親不明'}`
  }
  if (isPostpartum(state, id)) return `產後虛弱（到第 ${state.postpartum![pcKey(state, id)]} 天）`
  return ''
}

// ---- 受孕 ----

export interface ConceiveInput {
  report: Report
  /** 這份記錄的人（pc 或角色 id） */
  mother: string
  /** 和誰性交（sex 是 false 的不算）；沒有對象時是空的 */
  partners: { id?: string; name: string; sex?: boolean }[]
  /** 這次性交幾次 */
  times: number
}

/** 這次的受孕機率與父親（不會受孕時 undefined；給測試與說明用） */
export function conceptionChance(state: GameState, input: ConceiveInput): { chance: number; father?: { id?: string; name: string } } | undefined {
  if (!tagsAllowed(['pregnancy']) || input.times <= 0) return undefined
  const mult = gameRule(state, 'conceptionMult')
  if (mult <= 0) return undefined
  const key = pcKey(state, input.mother)
  const mother = personOf(state, key)
  if (!mother || !canCarry(mother)) return undefined
  if (state.pregnancies?.[key] || isPostpartum(state, key)) return undefined
  if (mother.character?.status.includes('contraceptive')) return undefined
  // 娼館接客：老鴇讓接客的人喝避子湯
  const worker = input.report.narration?.brothel_work
  if (worker && pcKey(state, worker) === key && rules.conception.brothel <= 0) return undefined
  // 能讓人懷孕的對象：有 id 的看性別；只有名字的當成可以（報告裡有怪物時不算，交給寄生物；關了男性對象時也不算）
  const monsters = !!input.report.others?.some((o) => o.monster)
  const named = input.partners.filter((p) => p.sex !== false && pcKey(state, p.id ?? '') !== key)
  const eligible = named.filter((p) => {
    if (p.id) {
      const who = personOf(state, p.id)
      return who ? canSire(who) : !monsters && tagsAllowed(['male_partner'])
    }
    return !monsters && tagsAllowed(['male_partner'])
  })
  if (named.length && !eligible.length) return undefined
  if (!named.length && monsters) return undefined
  const fatherRef = eligible.length === 1 ? eligible[0]! : undefined
  const father = fatherRef ? { ...(fatherRef.id ? { id: pcKey(state, fatherRef.id) } : {}), name: fatherRef.name } : undefined
  const c = rules.conception
  const times = c.times[String(Math.min(3, input.times))] ?? 1
  const fatherRace = father?.id ? personOf(state, father.id)?.race ?? mother.race : mother.race
  let race = fatherRace === mother.race ? c.race.same : c.race.mixed
  race *= c.race.low_fertility[mother.race] ?? 1
  if (fatherRace !== mother.race) race *= c.race.low_fertility[fatherRace] ?? 1
  let extra = 1
  for (const t of mother.character?.tattoos ?? []) extra *= c.tattoos?.[t.template ?? ''] ?? 1
  for (const p of mother.character?.parasites ?? []) {
    const rule = c.parasites?.[p.id]
    if (rule && p.corruption >= rule.min && !p.dormant) extra *= rule.mult
  }
  return { chance: Math.min(c.max, c.base * times * race * extra * mult), ...(father ? { father } : {}) }
}

/** 擲受孕（固定種子：日誌 id ＋ 這個人，重讀同一個檔結果一樣）；受孕了回傳 true */
export function maybeConceive(state: GameState, input: ConceiveInput): boolean {
  const odds = conceptionChance(state, input)
  if (!odds) return false
  const key = pcKey(state, input.mother)
  const rng = new Rng(hashString(`${state.seed}:${input.report.report_id}:${key}:conceive`))
  if (!rng.chance(odds.chance)) return false
  const day = input.report.time.end.day
  ;(state.pregnancies ??= {})[key] = {
    conceived: day,
    due: day + Math.round(gameRule(state, 'pregnancyDays')),
    ...(odds.father ? { father: odds.father } : {}),
    report: input.report.report_id,
  }
  syncPregnancyMarks(state)
  return true
}

// ---- 每次結算 ----

/** 角色身上的標記照 state.pregnancies 與產後虛弱同步（隊伍、留守與寄放的人、存檔裡有角色的 NPC） */
export function syncPregnancyMarks(state: GameState) {
  const mark = (c: Character, key: string) => {
    const p = state.pregnancies?.[key]
    const pp = isPostpartum(state, key)
    if (!p && !pp) {
      delete c.pregMark
      return
    }
    c.pregMark = { ...(p ? { stage: p.known ? stageOf(p, state.time.day) : 'hidden', known: !!p.known } : {}), ...(pp ? { postpartum: true } : {}) }
  }
  for (const m of state.party) mark(m, m.isPlayer ? 'pc' : m.id)
  for (const rec of Object.values(state.npcs ?? {})) if (rec.character) mark(rec.character, rec.id)
}

function notify(state: GameState, text: string) {
  ;(state.familyNotices ??= []).push(text)
}

/** 這個人在不在聚落裡（主角、隊伍看主角的位置） */
function inSettlement(state: GameState): boolean {
  if (state.road || state.expedition) return false
  const loc = locationById(state.location)
  return isSettlement(loc)
}

/**
 * 每次結算（commitReport、advanceTime）：產後虛弱到期、察覺、陣痛與生產。
 * 不在隊上的人到了預產日在他的城裡自動生下；隊上的人跳生產事件（一次一位）
 */
export function familyTick(state: GameState) {
  const day = state.time.day
  for (const [id, until] of Object.entries(state.postpartum ?? {})) if (day > until) delete state.postpartum![id]
  for (const [id, p] of Object.entries(state.pregnancies ?? {})) {
    const who = personOf(state, id)
    if (!who) {
      // 這個人不在了（自訂內容拿掉的 NPC）：記錄跟著拿掉
      delete state.pregnancies![id]
      continue
    }
    const stage = stageOf(p, day)
    if (!p.known && atLeast(stage, rules.discover.auto_stage)) {
      const near = who.inParty || (who.staying && !who.staying.startsWith('tavern:')) || who.location === state.location
      if (near) {
        p.known = true
        p.knownDay = day
        if (!who.inParty) addNpcNews(state, id, `看起來懷孕了（預產第 ${p.due} 天）。`)
        notify(state, who.id === 'pc' ? `你的肚子已經藏不住了：你懷孕了（${pregnancyStageName(stage)}，預產第 ${p.due} 天）。` : `${who.name}的肚子看得出來了：懷孕了（${pregnancyStageName(stage)}，預產第 ${p.due} 天）。`)
      }
    }
    if (day < p.due) continue
    if (!who.inParty) {
      autoBirth(state, id, p, who)
      continue
    }
    if (state.pendingBirth) continue
    if (inSettlement(state)) {
      state.pendingBirth = { mother: id }
    } else if (p.labor === undefined) {
      p.labor = hoursNow(state)
      notify(state, `${who.id === 'pc' ? '你' : who.name}開始陣痛了：${rules.birth.labor_hours} 小時內趕到聚落，不然就得在原地生。`)
    } else if (hoursNow(state) - p.labor >= rules.birth.labor_hours) {
      state.pendingBirth = { mother: id, wild: true }
    }
  }
  if (state.pendingBirth && !state.pregnancies?.[state.pendingBirth.mother]) delete state.pendingBirth
  syncPregnancyMarks(state)
}

/** 長休之後：初期的人有機會孕吐（rest.ts 呼叫） */
export function morningSickness(state: GameState, report?: Report) {
  const ms = rules.morning_sickness
  for (const m of state.party) {
    const p = state.pregnancies?.[m.isPlayer ? 'pc' : m.id]
    if (!p || stageOf(p, state.time.day) !== ms.stage) continue
    if (withRng(state, (rng) => rng.chance(ms.chance))) gainCondition(m, ms.condition, report)
  }
}

// ---- 生產 ----

function newbornGender(rng: Rng): string {
  const ids = GENDER_IDS.filter((g) => g !== 'unknown')
  const total = ids.reduce((n, g) => n + (npcPool.genders[g]?.weight ?? 0), 0)
  let r = rng.next() * total
  for (const g of ids) {
    r -= npcPool.genders[g]?.weight ?? 0
    if (r < 0) return g
  }
  return ids[0] ?? 'female'
}

function newborn(state: GameState, motherId: string, p: PregnancyState, name: string | undefined, rng: Rng) {
  const mother = personOf(state, motherId)!
  const fatherRace = p.father?.id ? personOf(state, p.father.id)?.race : undefined
  const race = fatherRace && rng.chance(0.5) ? fatherRace : mother.race
  const gender = newbornGender(rng)
  const used = new Set((state.children ?? []).map((c) => c.name))
  return { name: name?.trim().slice(0, 16) || babyName(rng, race, gender, used), gender, race, mother: { id: motherId, name: mother.name } }
}

function finishPregnancy(state: GameState, id: string, postDays: number) {
  delete state.pregnancies![id]
  ;(state.postpartum ??= {})[id] = state.time.day + postDays - 1
}

/** 不在隊上的人自動生下：嬰兒照 autoPlace 安排（留守在房子的人，嬰兒留在那棟房子） */
function autoBirth(state: GameState, id: string, p: PregnancyState, who: Person) {
  const rng = new Rng(hashString(`${state.seed}:${id}:${p.conceived}:birth`))
  const where: ChildPlace = who.staying && state.homes?.[who.staying] && !state.homes[who.staying]!.master
    ? { kind: 'home', home: who.staying }
    : autoPlace(state, who.location ?? state.location)
  const baby = newborn(state, id, p, undefined, rng)
  addChild(state, { ...baby, born: state.time.day, ...(p.father ? { father: p.father } : {}), where })
  finishPregnancy(state, id, familyRules.postpartum.days)
  notify(state, `${who.name}在${locationName(who.location ?? state.location)}生下了孩子${baby.name}，送到了${placeText(state, where)}。`)
  addNpcNews(state, id, `生下了孩子${baby.name}。`)
}

/** 生產事件的選項：在神殿生（這座城有神殿、錢夠）或自己生（擲信仰） */
export interface BirthOption { id: 'temple' | 'self'; label: string; disabled?: string }

export function birthOptions(state: GameState): BirthOption[] {
  const pb = state.pendingBirth
  if (!pb) return []
  const out: BirthOption[] = []
  if (!pb.wild && inSettlement(state) && hasTemple(state.location)) {
    const cost = rules.birth.temple_cc
    out.push({ id: 'temple', label: `去神殿生（${formatMoney(cost)}，一定順利）`, ...(state.money_cc < cost ? { disabled: '金錢不足' } : {}) })
  }
  out.push({ id: 'self', label: `自己生（信仰檢定 DC ${birthDc(state)}）` })
  return out
}

/** 自己生的 DC：野外比較難；隊伍裡（母親以外）有治療職業的人比較容易 */
export function birthDc(state: GameState): number {
  const pb = state.pendingBirth
  const b = rules.birth
  const motherChar = pb ? personOf(state, pb.mother)?.character : undefined
  const healer = state.party.some((m) => m !== motherChar && b.healer_classes.includes(m.class))
  return (pb?.wild ? b.wild_dc : b.dc) - (healer ? b.healer_bonus : 0)
}

/** 生下來的嬰兒可以放哪裡（這座城的房子、神殿；都沒有時照自動安排） */
export function birthPlaces(state: GameState): { id: string; label: string }[] {
  const opts = birthPlaceOptions(state).map((o) => ({ id: o.id, label: o.label }))
  if (opts.length) return opts
  const auto = autoPlace(state, state.location)
  return [{ id: 'auto', label: `${placeText(state, auto)}（這座城沒有神殿、也沒有你的房子）` }]
}

/**
 * 回應生產：選怎麼生（神殿或自己）、嬰兒的名字（空著照名字庫抽）、放在哪裡（birthPlaces 的 id）。
 * 不會死、嬰兒也不會有事：失敗只讓產後虛弱變長
 */
export function answerBirth(state: GameState, how: 'temple' | 'self', name?: string, placeId?: string): Report {
  const pb = state.pendingBirth
  if (!pb) throw new Error('現在沒有要生產')
  const p = state.pregnancies?.[pb.mother]
  const mother = personOf(state, pb.mother)
  if (!p || !mother?.character) {
    delete state.pendingBirth
    throw new Error('生產的人不在隊伍裡')
  }
  const opt = birthOptions(state).find((o) => o.id === how)
  if (!opt || opt.disabled) throw new Error(opt?.disabled ?? '不能這樣生')
  const places = birthPlaceOptions(state)
  const place: ChildPlace = places.find((o) => o.id === placeId)?.place ?? places[0]?.place ?? autoPlace(state, state.location)
  const report = baseReport(state, 'social', how === 'temple' ? 6 : 8)
  const self = mother.id === 'pc'
  const who = self ? '你' : mother.name
  report.location.scene = how === 'temple' ? `${locationName(state.location)}的神殿` : pb.wild ? `${report.location.scene}・野外` : report.location.scene
  let ok = true
  if (how === 'temple') {
    report.changes.money_cc = -rules.birth.temple_cc
  } else {
    const b = rules.birth
    const c = mother.character
    const parts = [...attrParts(c, b.attr), ...checkModifiers(c, { context: 'action', attr: b.attr })]
    const dc = birthDc(state)
    const dice = withBonus('1d20', sumParts(parts))
    const r = withRng(state, (rng) => diceRoll(rng, dice))
    const natural = r.rolls[0] ?? r.total
    ok = natural === 20 || (natural !== 1 && r.total >= dc)
    report.timeline = [{ seq: 1, time: { ...state.time }, actor: c.id, action: `${who}生產`, roll: { dice, value: r.total, dc, ...rollBreakdown(natural, parts) }, result: ok ? 'success' : 'fail' }]
  }
  const rng = new Rng(hashString(`${state.seed}:${pb.mother}:${p.conceived}:birth`))
  const baby = newborn(state, pb.mother, p, name, rng)
  addChild(state, { ...baby, born: state.time.day, ...(p.father ? { father: p.father } : {}), where: place })
  const post = ok ? familyRules.postpartum.days : familyRules.postpartum.fail_days
  delete state.pendingBirth
  finishPregnancy(state, pb.mother, post)
  const lines = [
    how === 'temple' ? `${who}在神殿的產房裡生下了孩子${baby.name}（奉獻 ${formatMoney(rules.birth.temple_cc)}）。` : ok ? `${who}順利生下了孩子${baby.name}。` : `${who}生得很辛苦，好在母子平安，生下了孩子${baby.name}。`,
    `${baby.name}送到了${placeText(state, place)}。`,
    `${who}產後虛弱 ${post} 天（所有檢定 -${familyRules.postpartum.check}）。`,
  ]
  report.outcome = { result: ok ? 'success' : 'failure', summary: lines.join(''), tags: ['生產'] }
  report.narration = { pov: 'second_person', length: 'medium', focus: ['生產的過程與嬰兒的第一聲哭聲（一般的描寫，不是親密場景）'] }
  const committed = commitReport(state, report)
  syncPregnancyMarks(state)
  return committed
}

/** 神殿的診察：看出隊伍裡誰懷孕了（包括還沒察覺的） */
export const CHECKUP_CC = 20

export function templeCheckup(state: GameState): Report {
  if (!hasTemple(state.location)) throw new Error('這裡沒有神殿')
  if (isFugitive(state)) throw new Error('神殿的人認出了你身上的契約印記，拒絕接待')
  const owed = nurseryRefusal(state)
  if (owed) throw new Error(owed)
  if (state.money_cc < CHECKUP_CC) throw new Error('金錢不足')
  const report = baseReport(state, 'action', 0.5)
  report.location.scene = `${locationName(state.location)}的神殿`
  report.changes.money_cc = -CHECKUP_CC
  const found: string[] = []
  for (const m of state.party) {
    const key = m.isPlayer ? 'pc' : m.id
    const p = state.pregnancies?.[key]
    if (!p) continue
    if (!p.known) {
      p.known = true
      p.knownDay = state.time.day
    }
    found.push(`${m.isPlayer ? '你' : m.name}懷孕了（第 ${state.time.day - p.conceived} 天，預產第 ${p.due} 天${p.father ? `，父親是${p.father.name}` : ''}）`)
  }
  report.outcome = { result: 'neutral', summary: `請神殿的修女診察，奉獻 ${formatMoney(CHECKUP_CC)}。${found.length ? `${found.join('；')}。` : '沒有人懷孕。'}`, tags: [TAG] }
  const committed = commitReport(state, report)
  syncPregnancyMarks(state)
  return committed
}

/** 通知（察覺、自動生下）：玩家按「知道了」寫成一筆日誌 */
export function acknowledgeFamilyNotices(state: GameState): Report {
  const list = state.familyNotices ?? []
  if (!list.length) throw new Error('沒有新的消息')
  const report = baseReport(state, 'social', 0)
  report.outcome = { result: 'neutral', summary: list.join(''), tags: [TAG] }
  report.narration = { pov: 'second_person', length: 'short' }
  delete state.familyNotices
  return commitReport(state, report)
}

/** 交給 AI 的角色資料：懷孕（察覺了的寫階段與父親，沒察覺的只寫症狀）、產後虛弱 */
export function pregnancyPrompt(state: GameState, id: string): string {
  const key = pcKey(state, id)
  const p = state.pregnancies?.[key]
  if (p) {
    const stage = stageOf(p, state.time.day)
    if (!p.known) return stage === 'hidden' ? '' : '最近容易累、聞到油味就想吐（自己還沒察覺是懷孕）'
    return `懷孕・${pregnancyStageName(stage)}（第 ${state.time.day - p.conceived} 天，預產第 ${p.due} 天${p.father ? `，父親是${p.father.name}` : '，父親不明'}）`
  }
  return isPostpartum(state, key) ? '剛生完孩子，產後虛弱' : ''
}

/**
 * 交給 AI 的家人資料（敘事與判定）：隊伍裡懷孕、產後虛弱的人各一行；孩子只在一般的敘事與判定寫一行，
 * 成人場景（adult）一律不送孩子
 */
export function familyPrompt(state: GameState, adult: boolean): string {
  const lines: string[] = []
  for (const m of state.party) {
    const t = pregnancyPrompt(state, m.isPlayer ? 'pc' : m.id)
    if (t) lines.push(`${m.isPlayer ? '主角' : m.name}：${t}`)
  }
  if (!adult) {
    const kids = childrenNote(state)
    if (kids) lines.push(kids)
  }
  return lines.length ? `\n${lines.join('\n')}` : ''
}
