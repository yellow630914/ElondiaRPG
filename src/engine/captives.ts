// 打贏冒險者之後被制伏的人：等主角處置（見 docs/NPC_SYSTEM.md 第 8.2 節）。
//
// 戰鬥結束時（combat.ts 的 settleNpcFoes）倒下的人不再直接死亡，而是記在 state.captives，擋住移動與休息，直到每個人都處置完：
// - 處決：死亡（從名單移除）
// - 放過：留在原地、敵對，今天不會再打起來；對方先動手時，對方欠你一份情（親密度上升）
// - 收為奴隸：以奴隸身分加入隊伍（要有空位），打上預設的契約
// - 也可以先用主動行動對他做任何事（審問、搜身、勸降……），交給 AI 判定，之後再處置
// 處決與收為奴隸有後果：依誰先動手（security.json 的 captives），有衛兵的聚落加警戒、所屬勢力扣聲望。

import { snapshot } from './character'
import { locationById, npcTags, regionById } from './data'
import { currentArea, getArea } from './grid'
import { npcRecord, registerNpc } from './npcs'
import { addAffinity, joinParty, partyRoom, pcOf } from './party'
import { consequences, securityRules } from './security'
import { ensureRelationship } from './social'
import { addHours, commitReport, newReportId } from './state'
import type { Captives, GameState, NpcRecord, Report } from './types'

export type CaptiveChoice = 'execute' | 'release' | 'enslave'

interface CaptiveRules {
  enslave: Record<Captives['aggressor'], { alert: number; reputation: number }>
  execute: Record<Captives['aggressor'], { alert: number; reputation: number }>
  release_affinity: number
}
const rules = (securityRules as unknown as { captives: CaptiveRules }).captives

/** 還在等處置的人（已經不在了的略過） */
export function captiveRecords(state: GameState): NpcRecord[] {
  return (state.captives?.npcs ?? []).map((id) => npcRecord(state, id)).filter((r): r is NpcRecord => !!r && !r.dead)
}

/** 處置會有什麼後果（給畫面顯示）：警戒只在有衛兵的聚落裡加 */
export function captiveConsequence(state: GameState, choice: Exclude<CaptiveChoice, 'release'>): { alert: number; reputation: number } {
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

/** 處置一位被制伏的人 */
export function resolveCaptive(state: GameState, id: string, choice: CaptiveChoice): Report {
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
  c.npcs = c.npcs.filter((x) => x !== id)
  if (!captiveRecords(state).length) delete state.captives
  return commitReport(state, r)
}
