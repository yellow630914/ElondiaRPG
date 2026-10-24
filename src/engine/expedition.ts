// 地下城探索（見 docs/DUNGEON_DESIGN.md 第 6 節）：進入地下城開始一趟探索，記下這趟撿到、還沒帶出去的東西；
// 戰敗時依這個存檔的規則（options.defeatLoot）失去一部分。離開地下城（啟程旅行）就算帶出去了。
// 不在安全房也可以緊急撤退：檢定成功直接回到入口，失敗被追上打一場，打贏才撤得出去。

import { checkBonus } from './perks'
import mapsJson from '@data/world/maps.json'
import { attrOf, mod, proficiency, snapshot } from './character'
import { computeDegree } from './checks'
import { DUNGEON_LAYER_IDS, dungeonEncounters, locationById, regionById, type DungeonLayerId } from './data'
import { inDarkness } from './light'
import { addHours, commitReport, newReportId, player, withRng } from './state'
import type { Area } from './grid'
import { withBonus, type Rng } from './rng'
import type { DefeatLoot, GameState, ItemDelta, Report } from './types'
import { gameRule } from './gameRules'

interface RetreatRules {
  attr: 'dex'
  dc_base: number
  dc_per_layer: number
  /** 每深一層多花的時間 */
  hours_per_layer: number
}

export const expeditionRules = (mapsJson as unknown as { expedition: { retreat: RetreatRules } }).expedition

export const DEFEAT_LOOT_NAME: Record<DefeatLoot, string> = { keep: '保留', half: '失去一半', all: '全部失去' }

/** 這個存檔的戰敗規則 */
export function defeatLootRule(state: GameState): DefeatLoot {
  return state.options?.defeatLoot ?? 'half'
}

export function startExpedition(state: GameState, location: string) {
  state.expedition = { location, started: { ...state.time }, deepest: 0, loot: [], money_cc: 0 }
}

/** 到了更深的一層 */
export function reachLayer(state: GameState, layer: number) {
  if (state.expedition && layer > state.expedition.deepest) state.expedition.deepest = layer
}

/** 正在這趟探索的地下城裡 */
function exploring(state: GameState): boolean {
  const e = state.expedition
  return !!e && e.location === state.location && !state.road
}

/** 報告提交時：這趟探索撿到的東西與錢記下來 */
export function noteLoot(state: GameState, report: Report) {
  if (!exploring(state)) return
  const e = state.expedition!
  for (const it of report.changes.items_gained ?? []) {
    const x = e.loot.find((l) => l.name === it.name)
    if (x) x.qty += it.qty
    else e.loot.push({ name: it.name, qty: it.qty })
  }
  if ((report.changes.money_cc ?? 0) > 0) e.money_cc += report.changes.money_cc!
}

/**
 * 在地下城戰敗：這趟撿到、還在身上的東西依規則失去（一半是每一份各擲一次）。
 * 回傳要寫進戰報的失去物品與金錢（金錢是負數）；之後這趟探索的紀錄清空
 */
export function defeatLoss(state: GameState, rng: Rng, location: string): { items: ItemDelta[]; money: number } {
  const e = state.expedition
  const rule = defeatLootRule(state)
  if (!e || e.location !== location || rule === 'keep') return { items: [], money: 0 }
  const lose = (n: number) => (rule === 'all' ? n : Array.from({ length: n }, () => rng.chance(0.5)).filter(Boolean).length)
  const items: ItemDelta[] = []
  for (const l of e.loot) {
    const held = Math.min(l.qty, state.inventory.find((i) => i.name === l.name)?.qty ?? 0)
    const n = lose(held)
    if (n > 0) items.push({ name: l.name, qty: n })
  }
  const heldMoney = Math.min(e.money_cc, state.money_cc)
  const money = rule === 'all' ? heldMoney : Math.floor(heldMoney / 2)
  e.loot = []
  e.money_cc = 0
  return { items, money: -money }
}

// ---- 緊急撤退 ----

const LAYER_IDS: DungeonLayerId[] = DUNGEON_LAYER_IDS

/** 撤退檢定的 DC（站在安全房不用檢定） */
export function retreatDc(state: GameState, area: Area): number {
  const r = expeditionRules.retreat
  return r.dc_base + r.dc_per_layer * (area.layer ?? 0) + (inDarkness(state, area) ? 2 : 0) + gameRule(state, 'escapeDc')
}

export interface RetreatResult {
  report: Report
  /** 被追上：要打一場（由呼叫的地方開始戰鬥） */
  pursuit?: { group: [string, number][]; scene: string }
  /** 撤出成功：回到入口 */
  escaped: boolean
}

/** 從地下城深處撤回入口：隊伍中靈巧最高的人帶路檢定 */
export function attemptRetreat(state: GameState, area: Area, safe: boolean): RetreatResult {
  const r = expeditionRules.retreat
  const layer = area.layer ?? 0
  const loc = locationById(area.location)
  const guide = [...state.party].filter((m) => m.hp > 0).sort((a, b) => attrOf(b, r.attr) - attrOf(a, r.attr))[0] ?? player(state)
  const dc = retreatDc(state, area)
  const start = { ...state.time }
  const hours = r.hours_per_layer * (layer + 1)
  const report: Report = {
    schema_version: '0.1',
    report_id: newReportId(state),
    kind: 'event',
    time: { start, end: addHours(start, hours) },
    location: { at: loc.id, region: loc.region, scene: area.name },
    party: state.party.map((m) => snapshot(m, undefined, player(state))),
    outcome: { result: 'success', tags: ['撤退'] },
    changes: {},
    narration: { pov: 'second_person', length: 'short' },
    lore_keys: [loc.name, regionById(loc.region).name],
  }
  if (safe) {
    report.outcome.summary = `從${area.name}的安全房循原路撤出${loc.name}，花了大約 ${hours} 小時。`
    return { report: commitReport(state, report), escaped: true }
  }
  const { natural, rolled } = withRng(state, (rng) => {
    const natural = rng.int(1, 20)
    const table = dungeonEncounters[loc.id]?.[LAYER_IDS[layer] ?? 'shallow'] ?? []
    return { natural, rolled: table.length ? rng.pick(table) : undefined }
  })
  const modifier = mod(attrOf(guide, r.attr)) + proficiency(guide.level) + checkBonus(guide, { context: 'retreat', attr: r.attr })
  const total = natural + modifier
  const degree = computeDegree(natural, total, dc)
  const ok = degree === 'success' || degree === 'critical'
  report.check = { action: '撤出地下城', attr: r.attr, base_dc: dc, dc, natural, modifier, total, degree, source: 'rules' }
  report.timeline = [{
    seq: 1, time: start, actor: guide.id, action: `${guide.name}帶路撤退（靈巧檢定）`,
    roll: { dice: withBonus('1d20', modifier), value: total, dc }, result: ok ? 'success' : 'fail',
  }]
  if (ok) {
    report.outcome.summary = `${guide.name}帶著大家避開魔物，從${area.name}撤出${loc.name}，花了大約 ${hours} 小時。`
    return { report: commitReport(state, report), escaped: true }
  }
  report.outcome = { result: 'failure', summary: `撤退途中被${area.name}的魔物追上了。`, tags: ['撤退', '被追上'] }
  report.time.end = addHours(start, 0.5)
  const committed = commitReport(state, report)
  return { report: committed, escaped: false, ...(rolled?.length ? { pursuit: { group: rolled, scene: `${area.name}（撤退途中）` } } : {}) }
}
