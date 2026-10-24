// 打贏冒險者之後被制伏的人：等主角處置（見 docs/NPC_SYSTEM.md 第 8.2 節）。
//
// 戰鬥結束時（combat.ts 的 settleNpcFoes）倒下的人不再直接死亡，而是記在 state.captives，擋住移動與休息，直到每個人都處置完：
// - 處決：死亡（從名單移除）
// - 放過：留在原地、敵對，今天不會再打起來；對方先動手時，對方欠你一份情（親密度上升）
// - 收為奴隸：以奴隸身分加入隊伍（要有空位），打上預設的契約
// - 也可以先用主動行動對他做任何事（審問、搜身、勸降……），交給 AI 判定，之後再處置
// 處置時也可以寫下怎麼做（例如怎麼處決、放過時說了什麼），記在報告的 player_intent 交給 AI 寫經過；結果不變
// 處決與收為奴隸有後果：依誰先動手（security.json 的 captives），有衛兵的聚落加警戒、所屬勢力扣聲望。

import { snapshot } from './character'
import { adultContent } from './content'
import { formatMoney } from './money'
import { locationById, npcTags, regionById } from './data'
import { currentArea, getArea } from './grid'
import { npcRecord, registerNpc } from './npcs'
import { addAffinity, joinParty, partyRoom, pcOf } from './party'
import { consequences, securityRules } from './security'
import { ensureRelationship } from './social'
import { addHours, commitReport, newReportId, withRng } from './state'
import type { Captives, GameState, NpcRecord, Report } from './types'

export type CaptiveChoice = 'execute' | 'release' | 'enslave'
/** 處置之前可以做的事（做完人還在你手上）：劫財、劫色（只在開啟成人向時） */
export type CaptiveDeed = 'rob' | 'violate'

type Cost = Record<Captives['aggressor'], { alert: number; reputation: number }>
interface CaptiveRules {
  enslave: Cost
  execute: Cost
  rob: Cost
  violate: Cost
  rob_money_per_level: number
  affinity: Record<CaptiveDeed, number>
  release_affinity: number
}
const rules = (securityRules as unknown as { captives: CaptiveRules }).captives

/** 還在等處置的人（已經不在了的略過） */
export function captiveRecords(state: GameState): NpcRecord[] {
  return (state.captives?.npcs ?? []).map((id) => npcRecord(state, id)).filter((r): r is NpcRecord => !!r && !r.dead)
}

/** 處置會有什麼後果（給畫面顯示）：警戒只在有衛兵的聚落裡加 */
export function captiveConsequence(state: GameState, choice: Exclude<CaptiveChoice, 'release'> | CaptiveDeed): { alert: number; reputation: number } {
  const c = state.captives
  if (!c) return { alert: 0, reputation: 0 }
  const r = rules[choice][c.aggressor]
  return { alert: guarded(state) ? r.alert : 0, reputation: r.reputation }
}

function guarded(state: GameState): boolean {
  const c = state.captives
  if (!c) return false
  try {
    return getArea(state, c.area).kind === 'settlement'
  } catch {
    return false
  }
}

function report(state: GameState, summary: string, rec: NpcRecord, tags: string[]): Report {
  const area = currentArea(state)
  const loc = locationById(area.location)
  const pc = pcOf(state)
  const start = { ...state.time }
  return {
    schema_version: '0.1',
    report_id: newReportId(state),
    kind: 'event',
    time: { start, end: addHours(start, 10 / 60) },
    location: { at: area.location, region: loc.region, scene: area.name },
    party: state.party.map((m) => snapshot(m, undefined, pc)),
    others: [{ id: rec.id, name: rec.name, level: rec.level }],
    outcome: { result: 'neutral', summary, tags: ['戰後處置', ...tags] },
    changes: {},
    narration: { pov: 'second_person', length: 'short' },
    lore_keys: [loc.name, regionById(loc.region).name, rec.name],
  }
}

/** 對好人等的額外聲望（標籤的 crime_reputation）：只在主角先動手時算 */
function crimeReputation(state: GameState, rec: NpcRecord): number {
  if (state.captives?.aggressor !== 'party') return 0
  return (rec.tags ?? []).reduce((sum, t) => sum + (npcTags.tags[t]?.crime_reputation ?? 0), 0)
}

/** 這個人已經劫過財、劫過色了嗎 */
export function deedDone(state: GameState, id: string, deed: CaptiveDeed): boolean {
  return !!state.captives?.[deed === 'rob' ? 'robbed' : 'violated']?.includes(id)
}

/**
 * 處置之前對被制伏的人劫財或劫色（每個人各一次，做完還是要處置）。text 是玩家描述的做法，交給 AI 寫經過。
 * 劫色只在開啟成人向時可以，報告帶成人場景（敘事附上成人場景規則）。
 */
export function captiveDeed(state: GameState, id: string, deed: CaptiveDeed, text = ''): Report {
  const c = state.captives
  if (!c?.npcs.includes(id)) throw new Error('這個人不在你手上')
  if (state.combat) throw new Error('戰鬥中')
  if (state.pendingAction) throw new Error('還有一個行動等待判定')
  if (deed === 'violate' && !adultContent()) throw new Error('沒有開啟成人向內容')
  if (deedDone(state, id, deed)) throw new Error(deed === 'rob' ? '已經搜刮過了' : '已經這麼做過了')
  const rec = npcRecord(state, id)
  if (!rec) throw new Error('找不到這個人')
  const pc = pcOf(state)
  const how = text.trim().slice(0, 400)
  let r: Report
  if (deed === 'rob') {
    const money = withRng(state, (rng) => Math.round(rules.rob_money_per_level * rec.level * (0.5 + rng.next())))
    r = report(state, `搜刮了被制伏的${rec.name}，拿走 ${formatMoney(money)}。`, rec, ['劫財'])
    r.changes.money_cc = money
    ;(c.robbed ??= []).push(id)
  } else {
    r = report(state, `${pc.name}趁${rec.name}被制伏時強行佔有了對方。`, rec, ['劫色'])
    r.narration = { ...r.narration, length: 'medium', adult_scene: `${pc.name}在戰鬥中制伏了${rec.name}，趁對方無力反抗時強行與對方發生關係` }
    ;(c.violated ??= []).push(id)
  }
  ensureRelationship(state, rec)
  addAffinity(state, r, rec.id, rules.affinity[deed], deed === 'rob' ? '被制伏後遭到搜刮' : '被制伏後遭到侵犯')
  const k = captiveConsequence(state, deed)
  const notes = consequences(state, r, [{ location: c.location, alert: k.alert, reputation: k.reputation + crimeReputation(state, rec) }])
  if (notes.length) r.outcome.summary += notes.join('')
  if (how) r.narration = { ...r.narration, player_intent: how }
  return commitReport(state, r)
}

/** 處置一位被制伏的人；text 是玩家描述的做法（怎麼處決、放過時說了什麼……），交給 AI 寫經過 */
export function resolveCaptive(state: GameState, id: string, choice: CaptiveChoice, text = ''): Report {
  const c = state.captives
  if (!c?.npcs.includes(id)) throw new Error('這個人不在你手上')
  if (state.combat) throw new Error('戰鬥中')
  if (state.pendingAction) throw new Error('還有一個行動等待判定')
  const rec = npcRecord(state, id)
  if (!rec) throw new Error('找不到這個人')
  if (choice === 'enslave' && partyRoom(state) < 1) throw new Error('隊伍已滿，帶不走更多人')
  const stored = state.npcs?.[rec.id] ?? registerNpc(state, { ...rec })
  const firstHand = c.aggressor === 'npc' ? '對方先動的手' : '你先動的手'
  let r: Report
  if (choice === 'release') {
    stored.hostile = true
    ;(state.avoided ??= {})[rec.id] = state.time.day
    r = report(state, `放過了${rec.name}。`, rec, ['放過'])
    if (c.aggressor === 'npc') {
      ensureRelationship(state, rec)
      addAffinity(state, r, rec.id, rules.release_affinity, '戰敗後被放過一馬')
    }
  } else if (choice === 'execute') {
    stored.dead = true
    delete stored.at
    for (const roster of Object.values(state.rosters ?? {})) roster.members = roster.members.filter((x) => x !== rec.id)
    r = report(state, `處決了被制伏的${rec.name}（${firstHand}）。`, rec, ['處決'])
    const k = captiveConsequence(state, 'execute')
    const notes = consequences(state, r, [{ location: c.location, alert: k.alert, reputation: k.reputation + crimeReputation(state, rec) }])
    if (notes.length) r.outcome.summary += notes.join('')
  } else {
    delete stored.hostile
    r = report(state, `把被制伏的${rec.name}收為奴隸（${firstHand}）。`, rec, ['奴隸'])
    joinParty(state, rec, 'slave', r, { reason: '戰後收為奴隸' })
    const k = captiveConsequence(state, 'enslave')
    const notes = consequences(state, r, [{ location: c.location, alert: k.alert, reputation: k.reputation + crimeReputation(state, rec) }])
    if (notes.length) r.outcome.summary += notes.join('')
  }
  const how = text.trim().slice(0, 400)
  if (how) {
    r.narration = { ...r.narration, player_intent: how }
    r.outcome.summary += `（${how.length > 40 ? `${how.slice(0, 40)}…` : how}）`
  }
  c.npcs = c.npcs.filter((x) => x !== id)
  if (!captiveRecords(state).length) delete state.captives
  return commitReport(state, r)
}
