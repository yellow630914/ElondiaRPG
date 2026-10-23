// 城鎮的特色地標：遊戲中的功能（docs/LANDMARKS.md）。資料在 data/world/landmarks.json，內容編輯器見 landmarkMods.ts。
// 開放條件、參訪（付錢或花時間換效果）、探索（主動行動的檢定）；打工與受訓走 work.ts、perkActions.ts（格子的種類就是地標 id）。

import { landmarkDef, locationById, type Degree, type LandmarkDef } from './data'
import { applyEffects } from './effects'
import { currentArea, currentCell } from './grid'
import { isNight } from './light'
import { formatMoney } from './money'
import { isFugitive } from './party'
import { reputationOf } from './security'
import { condMet } from './storyFlags'
import { baseReport } from './town'
import { effectText } from './trade'
import { commitReport } from './state'
import type { GameState, Report } from './types'

/** 主角現在站的地標（聚落裡） */
export function landmarkHere(state: GameState): LandmarkDef | undefined {
  if (currentArea(state).kind !== 'settlement') return undefined
  return landmarkDef(currentCell(state).kind)
}

/** 站在地標上行動時，場景帶上地標與它的氛圍（交給 AI） */
export function withLandmark(state: GameState, scene: string): string {
  const l = landmarkHere(state)
  if (!l || scene.includes(l.name)) return scene
  const mood = (l.scene || l.desc).slice(0, 80)
  return `${scene}・${l.name}${mood ? `（${mood}）` : ''}`
}

// ---- 開放條件 ----

/** 地標現在不開放的原因（開放時是 undefined） */
export function landmarkClosed(state: GameState, l: LandmarkDef): string | undefined {
  const o = l.open
  if (!o) return undefined
  if (o.hours === 'day' && isNight(state.time)) return `${l.name}只在白天開放`
  if (o.hours === 'night' && !isNight(state.time)) return `${l.name}只在夜裡開放`
  if (!condMet(state, { ...(o.flags ? { flags: o.flags } : {}), ...(o.flags_none ? { flags_none: o.flags_none } : {}) })) return `${l.name}現在不開放`
  if (o.min_reputation && reputationOf(state, locationById(l.location).faction) < o.min_reputation) return `要在這裡的勢力有 ${o.min_reputation} 點聲望，${l.name}才讓你進去`
  if (o.official && isFugitive(state)) return `${l.name}的人認出了你身上的契約印記，不讓你進去`
  return undefined
}

/** 站在不開放的地標上：打工、受訓、參訪、探索都不行 */
export function closedHere(state: GameState): string | undefined {
  const l = landmarkHere(state)
  return l ? landmarkClosed(state, l) : undefined
}

function record(state: GameState, id: string) {
  return ((state.landmarks ??= {})[id] ??= {})
}

/** 還要等幾天才能再參訪／探索（0：現在可以） */
export function waitDays(state: GameState, l: LandmarkDef, what: 'visit' | 'explore'): number {
  const last = what === 'visit' ? state.landmarks?.[l.id]?.visited : state.landmarks?.[l.id]?.explored
  if (last === undefined) return 0
  const gap = what === 'visit' ? l.visit?.cooldown_days ?? 1 : l.explore?.cooldown_days ?? 7
  return Math.max(0, last + gap - state.time.day)
}

/** 為什麼現在不能參訪或探索（可以時是 undefined） */
export function blockedReason(state: GameState, what: 'visit' | 'explore'): string | undefined {
  const l = landmarkHere(state)
  if (!l || !l[what]) return what === 'visit' ? '這裡沒有可以參訪的地方' : '這裡沒有可以探索的地方'
  const closed = landmarkClosed(state, l)
  if (closed) return closed
  const wait = waitDays(state, l, what)
  if (wait) return `${wait} 天後才能再${what === 'visit' ? '來' : '探索'}`
  if (what === 'visit' && (l.visit!.money_cc ?? 0) > state.money_cc) return `錢不夠（要 ${formatMoney(l.visit!.money_cc!)}）`
  return undefined
}

// ---- 參訪 ----

/** 參訪地標：付錢、花時間，得到設定的效果 */
export function visitLandmark(state: GameState): Report {
  const why = blockedReason(state, 'visit')
  if (why) throw new Error(why)
  const l = landmarkHere(state)!
  const v = l.visit!
  const report = baseReport(state, 'event', v.hours ?? 0.5)
  report.location.scene = `${locationById(state.location).name}・${l.name}・${v.title}${l.scene ? `（${l.scene.slice(0, 80)}）` : ''}`
  report.lore_keys!.push(l.name)
  applyEffects(state, report, [...(v.money_cc ? [{ type: 'money' as const, amount: -v.money_cc }] : []), ...v.effects])
  record(state, l.id).visited = state.time.day
  report.outcome = { result: 'success', summary: `在${l.name}${v.title}。` }
  return commitReport(state, report)
}

// ---- 探索（主動行動 explore） ----

export function setupExplore(state: GameState) {
  const why = blockedReason(state, 'explore')
  if (why) throw new Error(why)
  const l = landmarkHere(state)!
  const e = l.explore!
  const gains = e.effects.map((x) => effectText(state, x)).join('、') || '有所收穫'
  const extra = (e.critical ?? []).map((x) => effectText(state, x)).join('、')
  return {
    attr: e.attr, dc: e.dc, hours: e.hours, situational: [],
    scene: `${locationById(state.location).name}・${l.name}・${e.title}`,
    outcomes: {
      critical: extra ? `${gains}，另外 ${extra}` : gains, success: gains, partial: '有些頭緒，但沒找到什麼', fail: '一無所獲', fumble: '一無所獲，還弄得狼狽不堪',
    } as Partial<Record<Degree, string>>,
  }
}

export function applyExplore(state: GameState, report: Report, degree: Degree): string {
  const l = landmarkHere(state)
  if (!l?.explore) return '這裡沒有可以探索的地方。'
  record(state, l.id).explored = state.time.day
  const e = l.explore
  if (degree !== 'critical' && degree !== 'success') return `在${l.name}${e.title}，${degree === 'partial' ? '有些頭緒，但沒找到什麼' : '一無所獲'}。`
  applyEffects(state, report, [...e.effects, ...(degree === 'critical' ? e.critical ?? [] : [])])
  return `在${l.name}${e.title}，有所收穫。`
}
