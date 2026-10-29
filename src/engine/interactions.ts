// 和這裡的人互動：聊天、送禮、獻媚、誘惑、偷竊、偷襲（見 docs/NPC_SYSTEM.md 第 8 節；誘惑見 docs/LEWD_STATS.md 第 15 節）。
// 都是主動行動：先擲骰，再由 AI 或規則判定；親密度、偷到的東西、警戒與聲望由程式依成功程度決定，
// AI 只能補充關係文字與旗標。

import { gearAffinities, lifeTier, mod } from './character'
import { startCombat } from './combat'
import { actionRules, economy, itemDef, itemRules, lewdRules, locationById, mulResist, npcTags, tagDcMod, tagDef, type ActionKind, type Degree } from './data'
import { adultScene, type AdultScene } from './content'
import { currentArea } from './grid'
import { formatMoney } from './money'
import { addLewdStat, lewdOf } from './lewd'
import { characterFor, npcKind, npcRecord, npcTitle, registerNpc } from './npcs'
import { addAffinity, pcOf } from './party'
import { isGuarded, nearbyPeople, presentHere } from './population'
import { consequences, securityRules } from './security'
import { ensureRelationship } from './social'
import { withRng } from './state'
import type { Character, GameState, NpcRecord, Report } from './types'

export type InteractionKind = 'chat' | 'gift' | 'flatter' | 'seduce' | 'steal' | 'attack'
export const INTERACTIONS: InteractionKind[] = ['chat', 'gift', 'flatter', 'seduce', 'steal', 'attack']

export function isInteraction(kind: ActionKind): kind is InteractionKind {
  return (INTERACTIONS as string[]).includes(kind)
}

/** 財富等級：標籤中最高的（沒有標籤為 1） */
export function wealthOf(rec: Pick<NpcRecord, 'tags'>): number {
  return Math.max(1, ...(rec.tags ?? []).map((t) => tagDef(t)?.wealth ?? 1))
}

/** 物品的價值（目錄價格或自創物品的價格） */
export function itemValue(state: GameState, name: string): number {
  return itemDef(name)?.price_cc ?? state.customItems?.[name]?.price_cc ?? 0
}

/** 禮物的價值加成：價格每達到一級門檻 +1 */
export function giftBonus(state: GameState, rec: Pick<NpcRecord, 'tags'>, item: string): number {
  const k = actionRules.kinds.gift
  const living = economy.commoner_living_cc_per_day
  const scale = k.wealth_scale ?? [1]
  const threshold = living * (scale[Math.min(wealthOf(rec), scale.length - 1)] ?? 1)
  const price = itemValue(state, item)
  return (k.value_steps ?? []).filter((step) => price >= threshold * step).length
}

/** 這次互動各成功程度的親密度變化（聊天、送禮、獻媚、誘惑） */
export function affinityTable(state: GameState, kind: 'chat' | 'gift' | 'flatter' | 'seduce', rec: NpcRecord, item?: string): Record<Degree, number> {
  const base = { ...actionRules.kinds[kind].affinity! }
  if (kind === 'gift' && item) {
    const bonus = giftBonus(state, rec, item)
    for (const d of ['critical', 'success', 'partial'] as Degree[]) base[d] += bonus
  }
  return base
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n)
}

export interface InteractionSetup {
  dc: number
  targetName: string
  situational: { label: string; value: number }[]
  outcomes: Partial<Record<Degree, string>>
  scene: string
  adultScene?: AdultScene
}

/** 參考 DC 與各成功程度的結果；也檢查對象在不在、禮物有沒有 */
export function setupInteraction(state: GameState, kind: InteractionKind, target?: string, item?: string): InteractionSetup {
  const rec = target ? npcRecord(state, target) : undefined
  if (!rec) throw new Error('要選一個對象')
  if (state.party.some((m) => m.id === rec.id)) throw new Error('隊友不需要這樣互動，可以用自由行動')
  if (!presentHere(state, rec.id)) throw new Error('對方不在這裡')
  if (state.captives?.npcs.includes(rec.id)) throw new Error(`${rec.name}被你制伏在地上，先決定怎麼處置`)
  // 一國之主這類人身邊戒備森嚴：不能偷襲、偷竊（只能透過特殊任務交手）
  if (kind === 'attack' && isGuarded(rec.id, 'attack')) throw new Error(`${rec.name}身邊戒備森嚴，找不到下手的機會`)
  if (kind === 'steal' && isGuarded(rec.id, 'steal')) throw new Error(`${rec.name}身邊戒備森嚴，沒辦法下手偷東西`)
  if (kind === 'attack') return setupAttack(state, rec)
  if (kind === 'steal') return setupSteal(state, rec)
  if (rec.hostile) throw new Error(`${rec.name}對你充滿敵意，不想理你`)
  if (kind === 'gift') {
    if (!item) throw new Error('要選一件禮物')
    if (!state.inventory.some((i) => i.name === item && i.qty > 0)) throw new Error(`沒有${item}`)
  }
  // 互動過就算認識了
  ensureRelationship(state, rec)
  const pc = pcOf(state)
  const def = actionRules.kinds[kind]
  const rel = state.relationships?.[rec.id]
  let dc = (def.base ?? 12) + 2 * Math.max(0, lifeTier(rec.level) - lifeTier(pc.level))
  if (rel) dc -= Math.floor(rel.affinity / 25)
  // 標籤的修正（例如好人比較好相處）
  dc += tagDcMod(rec, kind)
  if (kind === 'seduce') dc += seduceDcMod(npcCharacter(state, rec))
  const situational: { label: string; value: number }[] = []
  if (kind === 'flatter' && def.status_dc) {
    const gap = wealthOf(rec) - 2
    if (gap > 0) situational.push({ label: '對方身分高貴', value: -def.status_dc * gap })
  }
  const table = affinityTable(state, kind, rec, item)
  const lewdGain = kind === 'seduce' ? def.lewd_gain ?? {} : {}
  const outcomes = Object.fromEntries(
    (Object.keys(table) as Degree[]).map((d) => [d, `${rec.name}的親密度 ${signed(table[d])}${kind === 'gift' && d === 'fumble' ? '，禮物被退回' : ''}${lewdGain[d] ? `，淫亂 +${lewdGain[d]}` : ''}`]),
  ) as Record<Degree, string>
  const where = locationById(state.location).name
  // 誘惑：有沒有進入親密場景由 AI 依經過判定
  const intimate = kind === 'seduce' ? adultScene(`誘惑${rec.name}`, []) : {}
  return { dc, targetName: rec.name, situational, outcomes, scene: `${where}・${npcTitle(rec)}${rec.name}`, ...intimate }
}

/** 套用機制結果：親密度、送出的禮物、偷到的東西、開戰 */
export function applyInteraction(state: GameState, report: Report, kind: InteractionKind, target: string, degree: Degree, item?: string): string {
  const rec = npcRecord(state, target)!
  if (kind === 'steal') return applySteal(state, report, rec, degree)
  if (kind === 'attack') return applyAttack(state, report, rec, degree)
  const delta = affinityTable(state, kind, rec, item)[degree]
  const reason = { chat: '聊天', gift: item ? `收到${item}` : '收到禮物', flatter: '被奉承', seduce: '被誘惑' }[kind]
  if (delta) addAffinity(state, report, target, delta, reason)
  if (kind === 'seduce') {
    const gain = actionRules.kinds.seduce.lewd_gain?.[degree] ?? 0
    if (gain && npcLewdGain(state, rec, gain, report)) return `${rec.name}被撩得心神不寧。`
  }
  if (kind === 'gift' && item) {
    if (degree === 'fumble') return `${rec.name}把${item}退了回來。`
    report.changes.items_lost = [...(report.changes.items_lost ?? []), { name: item, qty: 1 }]
    const value = itemValue(state, item)
    return `把${item}${value ? `（價值 ${formatMoney(value)}）` : ''}送給了${rec.name}。`
  }
  return ''
}

// ---- 誘惑 ----

/** 不在隊上的人的角色資料：隊友用隊伍裡的，其他照 NPC 資料生成（慾望指標用存檔裡記下的） */
function npcCharacter(state: GameState, rec: NpcRecord): Character {
  return state.party.find((m) => m.id === rec.id) ?? characterFor(state, rec)
}

/**
 * 誘惑的 DC 修正：對方的慾望抗性換算（信仰與裝備；受到的慾望每少 resist_per 一級 +1，容易受影響的反過來 −1）
 * − 對方淫亂 / lewd_per
 */
export function seduceDcMod(c: Character): number {
  const k = actionRules.kinds.seduce
  const resist = { ...gearAffinities(c).resist }
  const faith = mod(c.attrs.fai) * lewdRules.combat.faith_resist
  if (faith) mulResist(resist, { lust: faith })
  const r = -(resist.lust ?? 0)
  const fromResist = r > 0 ? Math.floor(r / (k.resist_per ?? 0.1) + 1e-9) : Math.ceil(r / (k.resist_per ?? 0.1) - 1e-9)
  return fromResist - Math.floor(lewdOf(c).lewdness / (k.lewd_per ?? 10))
}

/**
 * 誘惑成功：對方的淫亂增加。隊友、留守的夥伴改角色資料；其他人記在存檔的 NPC 資料上（固定 NPC 第一次被改時複製進存檔），
 * 之後生成角色、入隊都照這個值。回傳實際增加的量。
 */
export function npcLewdGain(state: GameState, rec: NpcRecord, delta: number, report?: Report): number {
  const member = state.party.find((m) => m.id === rec.id) ?? rec.character
  if (member) return addLewdStat(member, 'lewdness', delta, report)
  const stored = state.npcs?.[rec.id] ?? registerNpc(state, JSON.parse(JSON.stringify(rec)) as NpcRecord)
  const c = characterFor(state, stored)
  const d = addLewdStat(c, 'lewdness', delta, report)
  if (d) stored.lewd = { ...stored.lewd, lewdness: lewdOf(c).lewdness }
  return d
}

// ---- 偷竊 ----

function lootRange(rec: NpcRecord): [number, number] {
  const days = securityRules.steal.loot_days
  const base = economy.commoner_living_cc_per_day * (days[Math.min(wealthOf(rec), days.length - 1)] ?? 1)
  return [Math.max(1, Math.round(base * 0.5)), Math.max(1, Math.round(base * 1.5))]
}

function setupSteal(state: GameState, rec: NpcRecord): InteractionSetup {
  const r = securityRules.steal
  const pc = pcOf(state)
  const rel = state.relationships?.[rec.id]
  let dc = r.base + 2 * Math.max(0, lifeTier(rec.level) - lifeTier(pc.level)) + (wealthOf(rec) >= 2 ? r.wary : 0)
  if (rel) dc -= Math.floor(rel.affinity / 25)
  const [lo, hi] = lootRange(rec)
  const witnesses = currentArea(state).kind === 'settlement' ? '，衛兵警戒' : ''
  return {
    dc, targetName: rec.name, situational: [], scene: `${currentArea(state).name}・${npcTitle(rec)}${rec.name}`,
    outcomes: {
      critical: `神不知鬼不覺，偷到 ${formatMoney(lo * 2)}～${formatMoney(hi * 2)}（商人身上可能是一件商品）`,
      success: `偷到 ${formatMoney(lo)}～${formatMoney(hi)}`,
      partial: `只摸到一點零錢（${formatMoney(Math.round(lo / 2))}～${formatMoney(Math.round(hi / 2))}），差點被發現`,
      fail: `被發覺：親密度 ${r.fail.affinity}${witnesses} +${r.fail.alert}、聲望 ${r.fail.reputation}`,
      fumble: `當場被抓：親密度 ${r.fumble.affinity}${witnesses} +${r.fumble.alert}、聲望 ${r.fumble.reputation}`,
    },
  }
}

function applySteal(state: GameState, report: Report, rec: NpcRecord, degree: Degree): string {
  const r = securityRules.steal
  const [lo, hi] = lootRange(rec)
  if (degree === 'fail' || degree === 'fumble') {
    const c = r[degree]
    ensureRelationship(state, rec)
    addAffinity(state, report, rec.id, c.affinity, '偷竊被發現')
    // 冒險者被抓到偷東西會翻臉
    if (degree === 'fumble' && npcKind(rec) === 'adventurer') (state.npcs?.[rec.id] ?? registerNpc(state, { ...rec })).hostile = true
    const notes = consequences(state, report, [{ location: state.location, alert: currentArea(state).kind === 'settlement' ? c.alert : 0, reputation: c.reputation + crimeReputation(rec) }])
    return [`${rec.name}${degree === 'fumble' ? '當場抓住了你的手' : '察覺你想偷東西'}。`, ...notes].join('')
  }
  return withRng(state, (rng) => {
    const scale = degree === 'critical' ? 2 : degree === 'partial' ? 0.5 : 1
    const money = Math.max(1, Math.round(rng.int(lo, hi) * scale))
    // 大成功：商人身上可能偷到一件商品（價值不超過偷到的錢的兩倍）
    if (degree === 'critical' && rec.tags?.includes('merchant') && rng.chance(0.5)) {
      const goods = itemRules.items.filter((i) => i.price_cc <= money * 2 && i.category !== 'equipment' && i.category !== 'info')
      if (goods.length) {
        const g = rng.pick(goods)
        report.changes.items_gained = [...(report.changes.items_gained ?? []), { name: g.name, qty: 1, owner: 'pc' }]
        return `從${rec.name}身上偷到了${g.name}。`
      }
    }
    report.changes.money_cc = (report.changes.money_cc ?? 0) + money
    return `從${rec.name}身上偷到 ${formatMoney(money)}。`
  })
}

/** 對好人等犯罪被發現時，額外的聲望變化（標籤的 crime_reputation） */
function crimeReputation(rec: NpcRecord): number {
  return (rec.tags ?? []).reduce((sum, t) => sum + (npcTags.tags[t]?.crime_reputation ?? 0), 0)
}

// ---- 偷襲 ----

function setupAttack(state: GameState, rec: NpcRecord): InteractionSetup {
  if (npcKind(rec) !== 'adventurer') throw new Error('不能攻擊普通人')
  if (nearbyPeople(state).find((p) => p.rec.id === rec.id)?.staff) throw new Error('不能攻擊店主與職員')
  if (state.party.filter((m) => m.hp > 0).length === 0) throw new Error('隊伍沒有能戰鬥的成員')
  const a = securityRules.attack
  const guarded = currentArea(state).kind === 'settlement'
  const witnessed = `被目擊：${rec.name}敵對${guarded ? `，這裡的警戒 +${a.alert_here}` : ''}、聲望 ${a.reputation_here}；${rec.name}常去的地方警戒 +${a.alert_haunts}、聲望 ${a.reputation_haunts}`
  return {
    dc: a.base + Math.floor(rec.level / 2), targetName: rec.name, situational: [], scene: `${currentArea(state).name}・${rec.name}`,
    outcomes: {
      critical: '偷襲得手，先手開戰，沒有人看到',
      success: '先手開戰，沒有人看到',
      partial: '對方察覺，沒有先手，但沒有人看到',
      fail: `開戰；${witnessed}`,
      fumble: `對方先手；${witnessed}`,
    },
  }
}

function applyAttack(state: GameState, report: Report, rec: NpcRecord, degree: Degree): string {
  const a = securityRules.attack
  const notes: string[] = []
  const witnessed = degree === 'fail' || degree === 'fumble'
  if (witnessed) {
    ;(state.npcs?.[rec.id] ?? registerNpc(state, { ...rec })).hostile = true
    const guarded = currentArea(state).kind === 'settlement'
    const haunts = [...new Set((rec.haunts ?? []).map((h) => h.location))]
      .filter((id) => id !== state.location && locationById(id).type !== 'dungeon')
    notes.push(...consequences(state, report, [
      { location: state.location, alert: guarded ? a.alert_here : 0, reputation: a.reputation_here + crimeReputation(rec) },
      ...haunts.map((id) => ({ location: id, alert: a.alert_haunts, reputation: a.reputation_haunts })),
    ]))
  }
  const surprise = degree === 'critical' || degree === 'success' ? 'party' : degree === 'fumble' ? 'enemy' : undefined
  startCombat(state, undefined, { npcs: [rec.id], scene: currentArea(state).name, aggressor: 'party', ...(witnessed ? {} : { unseen: true }), ...(surprise ? { surprise } : {}) })
  const lead = surprise === 'party' ? `你搶先對${rec.name}出手。` : surprise === 'enemy' ? `${rec.name}察覺了你的殺意，搶先動手。` : `你和${rec.name}打了起來。`
  return [lead, ...notes].join('')
}
