// 特殊任務：人工編寫的任務鏈（data/rules/stories.json，內容頁籤可以編輯；說明見 docs/STORY_QUESTS.md）。
//
// - 任務從公會、固定 NPC、旅途或情報商開始；開始時設定開頭的劇情旗標。
// - 任務點依劇情旗標解鎖、依序出現：在聚落裡、站在某種設施上、某位固定 NPC 在身邊，或是近郊、地下城某一層的任務點（⭐）。
// - 任務點是劇情（直接發生）、判定（擲骰，可以描述做法交給 AI 判定）、戰鬥或選擇；結果設定或清除旗標、給效果、
//   讓固定 NPC 以「任務同行」加入或離開，也可以完成或失敗整個任務。
// - 每次推進都產生一份報告（report.story），也記在任務的經過（冒險筆記）。

import { snapshot } from './character'
import { endpointsIn } from './specialMaps'
import { storySpotProblem } from './specialMapMods'
import { startCombat, type CombatState } from './combat'
import { playerRank, storyMerit } from './guild'
import { RANK_ORDER } from './materialQuests'
import {
  locationById, npcs as namedNpcs, regionById, specialMaps, stories, type Degree, type DungeonLayerId, type StoryCheck, type StoryDef, type StoryNode, type StoryOutcome, DUNGEON_LAYER_NAME,
} from './data'
import { applyEffects, type RewardEffect } from './effects'
import { blockKeys, cellName, currentArea, currentCell, DUNGEON_LAYERS, getArea, type Area, type CellKind } from './grid'
import { formatMoney } from './money'
import { npcRecord } from './npcs'
import { joinParty, leaveParty, pcOf } from './party'
import { presentHere } from './population'
import type { Rng } from './rng'
import { addHours, commitReport, newReportId, withRng } from './state'
import { condMet, flagKey } from './storyFlags'
import { applyPendingMove, queueMove } from './road'
import type { GameState, Report, StoryProgress } from './types'

export function storyDef(id: string): StoryDef | undefined {
  return stories.find((s) => s.id === id)
}

export function storyProgress(state: GameState, id: string): StoryProgress | undefined {
  return state.stories?.[id]
}

/** 任務點的參照：任務 id:任務點 id */
export function nodeRef(story: string, node: string): string {
  return `${story}:${node}`
}

function parseRef(ref: string): { def: StoryDef; node: StoryNode } {
  const i = ref.lastIndexOf(':')
  const def = storyDef(ref.slice(0, i))
  const node = def?.nodes.find((n) => n.id === ref.slice(i + 1))
  if (!def || !node) throw new Error('找不到這個任務點')
  return { def, node }
}

// ---- 開始 ----

/** 建議的公會階級：和公會委託一樣，同級或更低，組隊（2 人以上）時可以高一級；沒寫時不限 */
export function storyRankOk(state: GameState, def: Pick<StoryDef, 'rank'>): boolean {
  if (!def.rank) return true
  const mine = RANK_ORDER.indexOf(playerRank(state))
  const target = RANK_ORDER.indexOf(def.rank)
  return target <= mine || (state.party.length > 1 && target === mine + 1)
}

/** 還沒開始、條件也符合（建議階級、等級、劇情旗標）。公會、固定 NPC、情報商、旅途的開頭都用這個檢查 */
export function canStart(state: GameState, def: StoryDef): boolean {
  if (state.stories?.[def.id]) return false
  if (!storyRankOk(state, def)) return false
  if (def.start.min_level && pcOf(state).level < def.start.min_level) return false
  if (def.start.kind === 'npc' && def.start.npc && def.start.min_affinity !== undefined
    && (state.relationships?.[def.start.npc]?.affinity ?? 0) < def.start.min_affinity) return false
  return condMet(state, def.start.requires)
}

/** 這裡可以接的特殊任務：公會（站在這座城的公會）、固定 NPC（在身邊） */
export function storyOffersHere(state: GameState): StoryDef[] {
  const area = currentArea(state)
  const cell = currentCell(state)
  return stories.filter((def) => {
    if (!canStart(state, def)) return false
    const s = def.start
    if (s.kind === 'guild') return area.kind === 'settlement' && cell.kind === 'guild' && (!s.location || s.location === area.location)
    if (s.kind === 'npc') return !!s.npc && !!npcRecord(state, s.npc) && presentHere(state, s.npc)
    return false
  })
}

function storyReport(state: GameState, def: StoryDef, status: NonNullable<Report['story']>['status'], hours: number, node?: StoryNode): Report {
  const start = { ...state.time }
  const area = currentArea(state)
  const loc = locationById(area.location)
  const pc = pcOf(state)
  const npcNames = [def.start.npc, node?.at.npc, ...(node?.foes ?? []), ...(node?.allies ?? [])].map((id) => (id ? npcRecord(state, id)?.name : undefined)).filter((n): n is string => !!n)
  const others = node ? presentOthers(state, node) : []
  return {
    schema_version: '0.1',
    report_id: newReportId(state),
    kind: 'event',
    time: { start, end: addHours(start, hours) },
    location: { at: area.location, region: loc.region, scene: area.name },
    party: state.party.map((m) => snapshot(m, undefined, pc)),
    ...(others.length ? { others } : {}),
    story: { id: def.id, title: def.title, ...(node ? { node: node.id } : {}), status },
    outcome: { result: 'neutral', tags: ['特殊任務'] },
    changes: {},
    narration: { pov: 'second_person', length: 'medium', focus: [`特殊任務「${def.title}」`] },
    lore_keys: [...new Set([loc.name, regionById(loc.region).name, ...npcNames])],
  }
}

/** 任務點在場的人（友方與身邊的固定 NPC）：記在報告的 others，AI 寫經過時會帶上他們的關係與記憶 */
function presentOthers(state: GameState, node: StoryNode): { id: string; name: string }[] {
  const ids = [...new Set([...(node.allies ?? []), ...(node.at.npc ? [node.at.npc] : [])])]
  return ids
    .filter((id) => !state.party.some((m) => m.id === id))
    .map((id) => npcRecord(state, id))
    .filter((r): r is NonNullable<typeof r> => !!r && !r.dead)
    .map((r) => ({ id: r.id, name: r.name }))
}

/** 在場的友方的名字（判定的場景說明用） */
function allyNames(state: GameState, node: StoryNode): string {
  return (node.allies ?? []).map((id) => npcRecord(state, id)?.name).filter(Boolean).join('、')
}

function log(p: StoryProgress, state: GameState, text: string, node?: string) {
  p.log.push({ time: { ...state.time }, text, ...(node ? { node } : {}) })
}

function setFlags(report: Report, names: string[] | undefined, value: boolean) {
  for (const f of names ?? []) (report.changes.flags ??= {})[flagKey(f)] = value
}

/** 開始任務：設定開頭的旗標，記下任務的經過。text 是開頭的事件描述（旅途、情報商）。 */
export function startStory(state: GameState, id: string, opts: { text?: string; report?: Report } = {}): Report {
  const def = storyDef(id)
  if (!def) throw new Error('找不到這個特殊任務')
  if (state.stories?.[id]) throw new Error('這個任務已經開始過了')
  const progress: StoryProgress = { id, status: 'active', started: { ...state.time }, done: [], log: [] }
  ;(state.stories ??= {})[id] = progress
  const report = opts.report ?? storyReport(state, def, 'started', 0.5)
  report.story = { id, title: def.title, status: 'started' }
  setFlags(report, def.start_flags, true)
  const text = opts.text ?? def.start.text ?? def.summary
  log(progress, state, text)
  report.outcome = { result: 'success', summary: `接下特殊任務「${def.title}」：${def.summary}`, tags: [...new Set([...(report.outcome.tags ?? []), '特殊任務'])] }
  report.narration = { ...report.narration, focus: [...(report.narration?.focus ?? []), text] }
  if (opts.report) return report
  const committed = commitReport(state, report)
  refreshStoryMarkers(state)
  return committed
}

// ---- 任務點 ----

export interface ActiveNode { def: StoryDef; node: StoryNode; ref: string }

/** 進行中的任務裡已經解鎖、還沒結束的任務點 */
export function activeNodes(state: GameState): ActiveNode[] {
  const out: ActiveNode[] = []
  for (const p of Object.values(state.stories ?? {})) {
    if (p.status !== 'active') continue
    const def = storyDef(p.id)
    if (!def) continue
    for (const node of def.nodes) {
      if (p.done.includes(node.id) || !condMet(state, node.requires)) continue
      out.push({ def, node, ref: nodeRef(def.id, node.id) })
    }
  }
  return out
}

/** 主角現在所在的地方有沒有這個任務點 */
export function nodeIsHere(state: GameState, n: ActiveNode): boolean {
  const at = n.node.at
  const area = currentArea(state)
  if (at.location && at.where !== 'npc' && at.where !== 'road' && at.where !== 'side' && at.where !== 'special' && area.location !== at.location) return false
  switch (at.where) {
    case 'road': return area.kind === 'road'
    case 'side':
    case 'special': return currentCell(state).kind === 'quest' && currentCell(state).storyNode === n.ref
    case 'settlement': return area.kind === 'settlement'
    case 'cell': return area.kind === 'settlement' && currentCell(state).kind === at.cell
    case 'npc': return !!at.npc && presentHere(state, at.npc) && (!at.location || area.location === at.location)
    case 'outskirts':
    case 'dungeon': return currentCell(state).kind === 'quest' && currentCell(state).storyNode === n.ref
  }
  return false
}

export function nodesHere(state: GameState): ActiveNode[] {
  return activeNodes(state).filter((n) => nodeIsHere(state, n))
}

function active(state: GameState, ref: string): ActiveNode & { progress: StoryProgress } {
  const { def, node } = parseRef(ref)
  const progress = state.stories?.[def.id]
  if (!progress || progress.status !== 'active' || progress.done.includes(node.id) || !condMet(state, node.requires)) throw new Error('這個任務點現在沒辦法進行')
  return { def, node, ref, progress }
}

/** 地點的說明（冒險筆記用） */
export function placeText(n: StoryNode, state?: GameState): string {
  const at = n.at
  const loc = at.location ? locationById(at.location).name : ''
  const LAYER = DUNGEON_LAYER_NAME
  switch (at.where) {
    case 'settlement': return loc
    case 'cell': return `${loc}的${at.cell ? cellName(at.cell as CellKind) : '某處'}`
    case 'npc': return `找${(at.npc && (state ? npcRecord(state, at.npc) : namedNpcs.find((x) => x.id === at.npc))?.name) || '某人'}${loc ? `（${loc}）` : ''}`
    case 'outskirts': return `${loc}近郊（⭐）`
    case 'dungeon': return `${loc}・${LAYER[at.layer ?? 'outskirts']}（⭐）`
    case 'road': return '旅途上'
    case 'side': return '臨時地圖裡（⭐）'
    case 'special': return `${specialMaps[at.special_map ?? '']?.name ?? '特殊地圖'}（⭐）`
  }
  return loc
}

/**
 * 進行沒有檢定的任務點：劇情直接發生，選擇的選項沒有檢定時也直接套用；戰鬥任務點開始戰鬥。
 * 有檢定的判定與選項要走主動行動 story（可以描述做法，交給 AI 判定）。
 */
export function playNode(state: GameState, ref: string, option?: number, intent?: string): Report | CombatState {
  const n = active(state, ref)
  if (!nodeIsHere(state, n)) throw new Error('要在任務點才能進行')
  const { def, node } = n
  if (node.kind === 'combat') {
    return startCombat(state, node.enemies ?? [], {
      story: { id: def.id, node: node.id }, scene: `${currentArea(state).name}・${node.title}`,
      ...(node.foes?.length ? { npcs: node.foes.filter((id) => !!npcRecord(state, id)) } : {}),
      ...(node.allies?.length ? { allies: node.allies.filter((id) => !!npcRecord(state, id)) } : {}),
      ...(intent ? { intent } : {}),
    })
  }
  let outcome: StoryOutcome | undefined
  let label = ''
  if (node.kind === 'choice') {
    const o = node.options?.[option ?? -1]
    if (!o) throw new Error('沒有這個選項')
    if (o.check) throw new Error('這個選項要檢定')
    outcome = o.success
    label = o.label
  } else if (node.kind === 'story') {
    outcome = node.success
  } else {
    throw new Error('判定的任務點要擲骰')
  }
  const report = storyReport(state, def, 'progress', 1, node)
  if (intent) report.narration = { ...report.narration, player_intent: intent }
  const lines = resolveOutcome(state, report, n.progress, def, node, outcome, true, label)
  report.outcome = { ...report.outcome, result: 'success', summary: lines.join('') }
  const committed = commitReport(state, report)
  refreshStoryMarkers(state)
  applyPendingMove(state)
  return committed
}

// ---- 判定（主動行動 story） ----

/** target：任務 id:任務點 id，選擇的選項再加 :選項序號 */
function parseTarget(target: string | undefined): { ref: string; option?: number } {
  const parts = (target ?? '').split(':')
  if (parts.length >= 3 && /^\d+$/.test(parts[parts.length - 1]!)) return { ref: parts.slice(0, -1).join(':'), option: Number(parts[parts.length - 1]) }
  return { ref: target ?? '' }
}

function checkOf(node: StoryNode, option?: number): { check: StoryCheck; success?: StoryOutcome; fail?: StoryOutcome; label: string } {
  if (node.kind === 'choice') {
    const o = node.options?.[option ?? -1]
    if (!o?.check) throw new Error('這個選項不用檢定')
    return { check: o.check, success: o.success, fail: o.fail, label: o.label }
  }
  if (node.kind !== 'check' || !node.check) throw new Error('這個任務點不用檢定')
  return { check: node.check, success: node.success, fail: node.fail, label: node.title }
}

export function setupStoryCheck(state: GameState, target?: string) {
  const { ref, option } = parseTarget(target)
  const n = active(state, ref)
  if (!nodeIsHere(state, n)) throw new Error('要在任務點才能進行')
  const c = checkOf(n.node, option)
  const ok = c.success?.text ?? '成功'
  const bad = c.fail?.text ?? '沒有成功（之後可以再試一次）'
  return {
    attr: c.check.attr, dc: c.check.dc, hours: 1, situational: [],
    ...(n.node.at.npc && npcRecord(state, n.node.at.npc) ? { targetName: npcRecord(state, n.node.at.npc)!.name } : {}),
    scene: `${currentArea(state).name}・特殊任務「${n.def.title}」：${n.node.title}（${c.label}）。${n.node.text}${allyNames(state, n.node) ? `在場的友方：${allyNames(state, n.node)}。` : ''}`,
    outcomes: { critical: ok, success: ok, partial: `勉強過關：${ok}`, fail: bad, fumble: bad } as Partial<Record<Degree, string>>,
  }
}

/** 結算判定：大成功、成功、部分成功算成功 */
export function applyStoryCheck(state: GameState, report: Report, target: string, degree: Degree): string {
  const { ref, option } = parseTarget(target)
  const n = active(state, ref)
  const c = checkOf(n.node, option)
  const success = degree === 'critical' || degree === 'success' || degree === 'partial'
  report.story = { id: n.def.id, title: n.def.title, node: n.node.id, status: 'progress' }
  report.outcome.tags = [...new Set([...(report.outcome.tags ?? []), '特殊任務'])]
  report.lore_keys = [...new Set([...(report.lore_keys ?? []), n.def.title])]
  const present = presentOthers(state, n.node).filter((o) => !report.others?.some((x) => x.id === o.id))
  if (present.length) report.others = [...(report.others ?? []), ...present]
  const lines = resolveOutcome(state, report, n.progress, n.def, n.node, success ? c.success : c.fail, success, n.node.kind === 'choice' ? c.label : '')
  return lines.join('')
}

/** 戰鬥任務點結束：勝利套用成功的結果，落敗或撤退套用失敗的結果（沒有失敗的結果時可以再挑戰） */
export function applyStoryCombat(state: GameState, report: Report, ref: { id: string; node: string }, status: CombatState['status']) {
  const progress = state.stories?.[ref.id]
  const def = storyDef(ref.id)
  const node = def?.nodes.find((x) => x.id === ref.node)
  if (!progress || progress.status !== 'active' || !def || !node || progress.done.includes(node.id)) return
  const won = status === 'victory'
  report.story = { id: def.id, title: def.title, node: node.id, status: 'progress' }
  report.outcome.tags = [...new Set([...(report.outcome.tags ?? []), '特殊任務'])]
  const lines = resolveOutcome(state, report, progress, def, node, won ? node.success : node.fail, won, '')
  report.outcome.summary = `${report.outcome.summary ?? ''}${lines.join('')}`
}

/**
 * 套用任務點的結果。失敗而且沒有寫失敗的結果時，任務點保持開放（可以再試）。
 * 回傳摘要的文字。
 */
function resolveOutcome(
  state: GameState, report: Report, progress: StoryProgress, def: StoryDef, node: StoryNode, outcome: StoryOutcome | undefined, success: boolean, label: string,
): string[] {
  const lines = [`「${def.title}」${node.title}${label ? `：${label}` : ''}。`]
  report.narration = { ...report.narration, focus: [...(report.narration?.focus ?? []), node.text, ...(outcome?.text ? [outcome.text] : [])] }
  if (!outcome) {
    if (!success) {
      lines.push('這次沒有進展，之後可以再試一次。')
      log(progress, state, `${node.title}：沒有成功`, node.id)
      return lines
    }
    outcome = {}
  }
  if (outcome.text) lines.push(outcome.text)
  setFlags(report, outcome.set_flags, true)
  setFlags(report, outcome.clear_flags, false)
  // 特質的機會：來源寫成這個特殊任務
  const sourced = (list: RewardEffect[]) => list.map((e) => (e.type === 'perk' && !e.source ? { ...e, source: `特殊任務「${def.title}」` } : e))
  const notes = outcome.effects?.length ? applyEffects(state, report, sourced(outcome.effects)) : []
  if (notes.length) lines.push(notes.join('，') + '。')
  if (outcome.join) {
    const rec = npcRecord(state, outcome.join)
    if (rec && !state.party.some((m) => m.id === rec.id)) {
      try {
        joinParty(state, rec, 'guest', report, { reason: `特殊任務「${def.title}」` })
        progress.guests = [...new Set([...(progress.guests ?? []), rec.id])]
        lines.push(`${rec.name}暫時和你們同行。`)
      } catch (e) {
        lines.push(`（${rec.name}沒辦法同行：${e instanceof Error ? e.message : String(e)}）`)
      }
    }
  }
  if (outcome.leave) leaveGuest(state, report, progress, outcome.leave, lines)
  // 進入臨時地圖、改去別的地點：報告提交之後執行
  queueMove(state, outcome)
  if (!outcome.retry) progress.done = [...new Set([...progress.done, node.id])]
  log(progress, state, `${node.title}${label ? `（${label}）` : ''}：${outcome.text ?? (success ? '完成' : '失敗')}`, node.id)
  if (outcome.complete) finishStory(state, report, progress, def, 'completed', lines)
  else if (outcome.fail_quest) finishStory(state, report, progress, def, 'failed', lines)
  return lines
}

function leaveGuest(state: GameState, report: Report, progress: StoryProgress, id: string, lines: string[]) {
  const m = state.party.find((x) => x.id === id && x.bond === 'guest')
  if (!m) return
  leaveParty(state, id, report, '任務同行結束')
  progress.guests = (progress.guests ?? []).filter((g) => g !== id)
  lines.push(`${m.name}和你們分開了。`)
}

function finishStory(state: GameState, report: Report, progress: StoryProgress, def: StoryDef, status: 'completed' | 'failed', lines: string[]) {
  progress.status = status
  progress.ended = { ...state.time }
  report.story = { id: def.id, title: def.title, ...(report.story?.node ? { node: report.story.node } : {}), status }
  if (status === 'completed') report.changes.merit = (report.changes.merit ?? 0) + (def.merit ?? storyMerit())
  if (status === 'completed' && def.rewards?.length) {
    const notes = applyEffects(state, report, def.rewards.map((e) => (e.type === 'perk' && !e.source ? { ...e, source: `完成特殊任務「${def.title}」` } : e)))
    const money = def.rewards.filter((r) => r.type === 'money').reduce((s, r) => s + (r as { amount: number }).amount, 0)
    lines.push(`完成特殊任務「${def.title}」${money ? `，得到 ${formatMoney(money)}` : ''}${notes.length ? `：${notes.join('，')}` : ''}。`)
  } else {
    lines.push(status === 'completed' ? `完成特殊任務「${def.title}」。` : `特殊任務「${def.title}」失敗了。`)
  }
  for (const g of [...(progress.guests ?? [])]) leaveGuest(state, report, progress, g, lines)
  log(progress, state, status === 'completed' ? '任務完成' : '任務失敗')
  report.outcome.tags = [...new Set([...(report.outcome.tags ?? []), status === 'completed' ? '任務完成' : '任務失敗'])]
}

/**
 * 自訂內容刪掉的特殊任務：存檔裡進行中的算中斷，任務同行的夥伴離隊（不然會一直佔著同行的名額）。
 * 讀檔時與自訂內容改變之後呼叫。
 */
export function pruneStories(state: GameState) {
  for (const p of Object.values(state.stories ?? {})) {
    if (p.status !== 'active' || storyDef(p.id)) continue
    p.status = 'failed'
    p.ended = { ...state.time }
    for (const g of p.guests ?? []) if (state.party.some((m) => m.id === g && m.bond === 'guest')) leaveParty(state, g, undefined, '任務同行結束')
    p.guests = []
    p.log.push({ time: { ...state.time }, text: '這個特殊任務已經不存在，任務中斷' })
  }
}

/** 放棄進行中的任務 */
export function abandonStory(state: GameState, id: string): Report {
  const progress = state.stories?.[id]
  const def = storyDef(id)
  if (!progress || progress.status !== 'active' || !def) throw new Error('沒有進行中的這個任務')
  const report = storyReport(state, def, 'failed', 0)
  const lines: string[] = []
  finishStory(state, report, progress, def, 'failed', lines)
  report.outcome = { ...report.outcome, result: 'neutral', summary: `放棄了特殊任務「${def.title}」。${lines.slice(1).join('')}` }
  report.narration = { length: 'short' }
  const committed = commitReport(state, report)
  refreshStoryMarkers(state)
  return committed
}

// ---- 近郊與地下城的任務點（⭐） ----

function layerId(area: Area): DungeonLayerId | undefined {
  return area.kind === 'dungeon' ? DUNGEON_LAYERS[area.layer ?? 0]?.id as DungeonLayerId : undefined
}

/** 這一區該有哪些任務點 */
function markersFor(state: GameState, area: Area): string[] {
  return activeNodes(state)
    .filter(({ node }) => (node.at.where === 'side' && area.kind === 'side' && (!node.at.side_map || node.at.side_map === area.template))
      || (node.at.where === 'special' && area.kind === 'special' && node.at.special_map === area.special) || (node.at.location === area.location && (
      (node.at.where === 'outskirts' && area.kind === 'wild') ||
      (node.at.where === 'dungeon' && area.kind === 'dungeon' && (node.at.layer ?? 'outskirts') === layerId(area)))))
    .map((n) => n.ref)
}

/** 在近郊或地下城的一層放上任務點（已經有的保留） */
export function ensureStoryMarkers(state: GameState, area: Area, rng: Rng) {
  if (area.kind === 'settlement' || area.kind === 'home' || area.kind === 'road') return
  const have = new Set(area.cells.map((c) => c.storyNode).filter(Boolean))
  const entry = area.cells.findIndex((c) => c.kind === 'exit' || c.kind === 'stairs_up')
  // 特殊地圖：通道的端點（關著時是空地）不放任務點
  const avoid = new Set(area.kind === 'special' ? endpointsIn(area.key).map((e) => e.y * area.width + e.x) : [])
  for (const ref of markersFor(state, area)) {
    if (have.has(ref)) continue
    // 固定地圖上指定了格子：放在那一格（不行的格子改成隨機）
    const at = activeNodes(state).find((n) => n.ref === ref)?.node.at
    if (area.kind === 'special' && at?.x !== undefined && at.y !== undefined && !storySpotProblem(area.special ?? '', at.x, at.y)) {
      const i = at.y * area.width + at.x
      if (!area.cells[i]?.storyNode) {
        area.cells[i] = { kind: 'quest' as CellKind, storyNode: ref }
        continue
      }
    }
    const free = area.cells.map((c, i) => (c.kind === 'floor' && i !== entry && i !== entry - area.width && !avoid.has(i) ? i : -1)).filter((i) => i >= 0)
    if (!free.length) return
    const i = free[rng.int(0, free.length - 1)]!
    area.cells[i] = { kind: 'quest' as CellKind, storyNode: ref }
  }
}

/** 重新整理已經生成的區域：補上新解鎖的任務點、拿掉結束的 */
export function refreshStoryMarkers(state: GameState) {
  for (const area of Object.values(state.areas ?? {})) {
    const want = new Set(markersFor(state, area))
    area.cells.forEach((c, i) => {
      if (c.storyNode && !want.has(c.storyNode)) area.cells[i] = { kind: 'floor' }
    })
    withRng(state, (rng) => ensureStoryMarkers(state, area, rng))
  }
}

// ---- 在場的友方站在哪裡 ----

/**
 * 任務點在場的友方固定 NPC 現在站在哪一格：近郊、地下城、臨時地圖的 ⭐ 旁邊，聚落裡任務點的設施上（任何區塊）。
 * 任務點還沒解鎖、已經結束，或那一區還沒生成時為 undefined（照平常的出沒）。
 */
export function allyPlacement(state: GameState, npcId: string): { area: string; x: number; y: number } | undefined {
  // 先便宜地看有沒有進行中的任務把這個人列為友方（每畫一次人群都會叫）
  if (!Object.values(state.stories ?? {}).some((p) => p.status === 'active' && storyDef(p.id)?.nodes.some((n) => n.allies?.includes(npcId)))) return undefined
  for (const n of activeNodes(state)) {
    if (!n.node.allies?.includes(npcId)) continue
    const at = n.node.at
    if (at.where === 'outskirts' || at.where === 'dungeon' || at.where === 'side' || at.where === 'special') {
      for (const area of Object.values(state.areas ?? {})) {
        const i = area.cells.findIndex((c) => c.storyNode === n.ref)
        if (i < 0) continue
        return { area: area.key, ...besideCell(area, i) }
      }
      continue
    }
    if ((at.where === 'cell' || at.where === 'settlement') && at.location) {
      const kind = (at.where === 'cell' ? at.cell : 'gate') as CellKind
      for (const key of blockKeys(at.location)) {
        const area = getArea(state, key)
        const i = area.cells.findIndex((c) => c.kind === kind)
        if (i >= 0) return { area: key, x: i % area.width, y: Math.floor(i / area.width) }
      }
    }
  }
  return undefined
}

/** ⭐ 旁邊一格可以站的地方（沒有時就是 ⭐ 本身） */
function besideCell(area: Area, i: number): { x: number; y: number } {
  const x = i % area.width
  const y = Math.floor(i / area.width)
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, -1], [0, 1]] as const) {
    const nx = x + dx
    const ny = y + dy
    const c = nx >= 0 && ny >= 0 && nx < area.width && ny < area.height ? area.cells[ny * area.width + nx] : undefined
    if (c && c.kind !== 'wall' && c.kind !== 'water') return { x: nx, y: ny }
  }
  return { x, y }
}
