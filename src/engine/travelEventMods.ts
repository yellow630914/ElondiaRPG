// 旅途事件、城鎮事件與地下城事件的自訂內容（docs/TRAVEL_EVENTS.md、docs/CONTENT_EDITOR.md）。
// 內建的事件可以改、不能刪；自建的事件沒有被用到的地方，隨時可以刪（等待中的事件會作廢）。
// 另外一筆「事件設定」（key 是 rules）：旅途各種路段的機率、事件種類的權重，城鎮事件與地下城事件的機率與冷卻。

import { ATTR_IDS, geography, shopRules, type AttrId, type LocationType, type RouteMode, type StoryCheck, type StoryOutcome } from './data'
import { sanitizeCond } from './mods'
import { parasiteDef, parasiteRules } from './parasites'
import { travelEvents, type DungeonEventRules, type DungeonTrigger, type EventScope, type RoadOption, type RoadTemplate, type TownEventRules } from './road'
import { CONTENT_TAG_IDS } from './content'
import { BODIES } from './traits'
import { sanitizeOutcome } from './storyMods'
import { TOWN_EVENT_CELLS } from './townEvents'
import { MODE_NAME } from './travel'

export interface TravelEventMod extends RoadTemplate {
  custom?: boolean
}

/** 事件設定（只有一筆） */
export interface EventRulesMod {
  chance: Partial<Record<RouteMode, number>>
  weights: { auto: number; choice: number; combat: number; advanced: number }
  town: TownEventRules
  dungeon: DungeonEventRules
}

export const EVENT_LIMITS = { title_chars: 20, text_chars: 400, label_chars: 30, options: 5, cooldown_days: [0, 60], scene_chars: 200 } as const
export const DUNGEON_TRIGGERS: Record<DungeonTrigger, string> = { trap: '觸發陷阱', chest: '打開寶箱', gather: '採集', rest: '安全房長休' }
/** 寄生物發作的時機（parasiteEvents.ts） */
export const PARASITE_MOMENTS: Record<NonNullable<RoadTemplate['moments']>[number], string> = { step: '走動', travel: '旅途', rest: '長休之後' }
/** 地下城事件的層：0 近郊、1 淺層 … 4 底層 */
export const EVENT_LAYERS = ['近郊', '淺層', '中層', '深層', '底層'] as const
const DEFAULT_DUNGEON: DungeonEventRules = { chance: { trap: 0, chest: 0, gather: 0, rest: 0 }, cooldown_hours: 4, repeat_days: 3 }
export const ROUTE_MODES = Object.keys(MODE_NAME) as RouteMode[]
export const LOCATION_TYPE_NAME: Record<Exclude<LocationType, 'dungeon'>, string> = {
  capital: '主城', city: '城市', town: '城鎮', village: '村莊', port: '港口', outpost: '哨站', fortress: '要塞',
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const str = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '')
const num = (v: unknown, lo: number, hi: number, d: number, digits = 2) => {
  const n = Number(v)
  if (!Number.isFinite(n)) return d
  const f = 10 ** digits
  return Math.round(Math.max(lo, Math.min(hi, n)) * f) / f
}

/** 內建事件與設定的快照（模組載入時） */
const snapshot = { templates: clone(travelEvents.templates), rules: rulesOf() }

function rulesOf(): EventRulesMod {
  return clone({ chance: travelEvents.chance, weights: travelEvents.weights, town: travelEvents.town, dungeon: travelEvents.dungeon ?? DEFAULT_DUNGEON })
}

export function builtinTravelEvent(id: string): RoadTemplate | undefined {
  const t = snapshot.templates.find((x) => x.id === id)
  return t ? clone(t) : undefined
}

export function builtinEventRules(): EventRulesMod {
  return clone(snapshot.rules)
}

/** 城鎮事件可以指定的設施：內建的設施，加上自建的商店 */
export function townEventCells(): string[] {
  return [...TOWN_EVENT_CELLS, ...Object.entries(shopRules.types).filter(([, d]) => d.custom).map(([id]) => id)]
}

function check(v: unknown): StoryCheck | undefined {
  if (!v || typeof v !== 'object') return undefined
  const c = v as Partial<StoryCheck>
  return { attr: ATTR_IDS.includes(c.attr as AttrId) ? c.attr! : 'int', dc: Math.round(num(c.dc, 1, 40, 12)) }
}

/** 事件的結果：特殊任務的結果，拿掉只有任務用得到的（完成、失敗、再來一次、任務同行）。
 * 事件不能讓主角淪為奴隸（只留給特殊任務），也不能直接把隊伍送進地下城（不花時間就開始探索） */
function outcome(v: unknown): StoryOutcome | undefined {
  const o = sanitizeOutcome(v)
  if (!o) return undefined
  delete o.complete
  delete o.fail_quest
  delete o.retry
  delete o.join
  delete o.leave
  if (o.effects) {
    o.effects = o.effects.filter((e) => e.type !== 'enslave_player')
    if (!o.effects.length) delete o.effects
  }
  if (o.travel_to && geography.locations.find((l) => l.id === o.travel_to)?.type === 'dungeon') delete o.travel_to
  return Object.keys(o).length ? o : undefined
}

function pick<T extends string>(v: unknown, allowed: readonly T[]): T[] {
  return [...new Set((Array.isArray(v) ? v : []).filter((x): x is T => allowed.includes(x as T)))]
}

/** 整理一個事件。城鎮事件沒有高階（不會進臨時地圖的「發現」），選擇的事件至少要有一個選項 */
/** extraCells：還沒套用、但同一包裡有的自建商店（匯入時） */
export function sanitizeTravelEvent(id: string, raw: Partial<TravelEventMod>, custom: boolean, extraCells: string[] = []): TravelEventMod {
  const L = EVENT_LIMITS
  const scope: EventScope = raw.scope === 'town' || raw.scope === 'dungeon' || raw.scope === 'parasite' ? raw.scope : 'road'
  // 地下城事件與寄生物的發作只有選擇（事件發生在主角身上，主角自己決定怎麼應付）
  const kind = raw.kind === 'check' && scope !== 'dungeon' && scope !== 'parasite' ? 'check' : 'choice'
  const out: TravelEventMod = {
    id,
    ...(scope !== 'road' ? { scope } : {}),
    tier: scope === 'road' && raw.tier === 'advanced' ? 'advanced' : 'normal',
    kind,
    title: str(raw.title, L.title_chars) || '新的事件',
    text: str(raw.text, L.text_chars),
  }
  if (scope === 'road') {
    const modes = pick(raw.modes, ROUTE_MODES)
    if (modes.length) out.modes = modes
  } else if (scope === 'dungeon') {
    const triggers = pick(raw.triggers, Object.keys(DUNGEON_TRIGGERS) as DungeonTrigger[])
    if (triggers.length) out.triggers = triggers
    const dungeons = pick(raw.dungeons, geography.locations.map((l) => l.id))
    if (dungeons.length) out.dungeons = dungeons
    const regions = pick(raw.regions, geography.regions.map((r) => r.id))
    if (regions.length) out.regions = regions
    const layers = [...new Set((Array.isArray(raw.layers) ? raw.layers : []).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < EVENT_LAYERS.length))].sort()
    if (layers.length) out.layers = layers
    if (raw.cooldown_days !== undefined && raw.cooldown_days !== null && String(raw.cooldown_days) !== '') out.cooldown_days = Math.round(num(raw.cooldown_days, ...L.cooldown_days, 3))
  } else if (scope === 'parasite') {
    out.parasite = typeof raw.parasite === 'string' && parasiteDef(raw.parasite) ? raw.parasite : Object.keys(parasiteRules.parasites)[0]!
    const stages = [...new Set((Array.isArray(raw.stages) ? raw.stages : []).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < parasiteRules.stages.length))].sort()
    if (stages.length && stages.length < parasiteRules.stages.length) out.stages = stages
    const moments = pick(raw.moments, Object.keys(PARASITE_MOMENTS) as NonNullable<RoadTemplate['moments']>)
    if (moments.length && moments.length < Object.keys(PARASITE_MOMENTS).length) out.moments = moments
  } else {
    const cells = pick(raw.cells, [...townEventCells(), ...extraCells])
    if (cells.length) out.cells = cells
    const types = pick(raw.location_types, Object.keys(LOCATION_TYPE_NAME) as LocationType[])
    if (types.length) out.location_types = types
    const locs = pick(raw.locations, geography.locations.filter((l) => l.type !== 'dungeon').map((l) => l.id))
    if (locs.length) out.locations = locs
    if (raw.cooldown_days !== undefined && raw.cooldown_days !== null && String(raw.cooldown_days) !== '') out.cooldown_days = Math.round(num(raw.cooldown_days, ...L.cooldown_days, 7))
  }
  if (typeof raw.category === 'string' && travelEvents.town?.categories[raw.category]) out.category = raw.category
  const req = sanitizeCond(raw.requires)
  if (req) out.requires = req
  // 內容標籤、主角的體型、親密場景（成人向的事件）
  const tags = CONTENT_TAG_IDS.filter((t) => Array.isArray(raw.tags) && raw.tags.includes(t))
  if (tags.length) out.tags = tags
  const bodies = BODIES.filter((b) => Array.isArray(raw.pc_body) && raw.pc_body.includes(b))
  if (bodies.length && bodies.length < BODIES.length) out.pc_body = bodies
  const scene = str(raw.scene, L.scene_chars)
  if (scene) out.scene = scene
  if (kind === 'check') {
    out.check = check(raw.check) ?? { attr: 'int', dc: 12 }
    const s = outcome(raw.success)
    if (s) out.success = s
    const f = outcome(raw.fail)
    if (f) out.fail = f
  }
  // 選擇的事件；高階的檢定事件成功之後也接著選
  if (kind === 'choice' || out.tier === 'advanced') {
    const options = (Array.isArray(raw.options) ? raw.options : []).slice(0, L.options).map((o): RoadOption => {
      const opt: RoadOption = { label: str(o?.label, L.label_chars) || '選項' }
      const c = check(o?.check)
      if (c) opt.check = c
      const s = outcome(o?.success)
      if (s) opt.success = s
      const f = c ? outcome(o?.fail) : undefined
      if (f) opt.fail = f
      if (out.scene && (o?.adult_scene === 'always' || (c && (o?.adult_scene === 'success' || o?.adult_scene === 'fail')))) opt.adult_scene = o.adult_scene
      return opt
    })
    if (options.length) out.options = options
    else if (kind === 'choice') out.options = [{ label: '離開', success: { text: '你沒有多管。' } }]
  }
  if (custom) out.custom = true
  return out
}

export function newTravelEvent(id: string, scope: EventScope = 'road'): TravelEventMod {
  return sanitizeTravelEvent(id, {
    scope, kind: 'choice', title: scope === 'town' ? '新的城鎮事件' : scope === 'dungeon' ? '新的地下城事件' : scope === 'parasite' ? '新的發作' : '新的旅途事件', text: '',
    ...(scope === 'dungeon' ? { triggers: ['trap'] as DungeonTrigger[] } : {}),
    ...(scope === 'parasite' ? { tags: ['adult' as const] } : {}),
    options: [{ label: '答應', success: { text: '' } }, { label: '離開', success: { text: '你沒有多管。' } }],
  }, true)
}

export function sanitizeEventRules(raw: Partial<EventRulesMod>): EventRulesMod {
  const base = builtinEventRules()
  const chance = Object.fromEntries(ROUTE_MODES.map((m) => [m, num(raw.chance?.[m], 0, 1, base.chance[m] ?? 0.3)])) as EventRulesMod['chance']
  const w = raw.weights ?? base.weights
  const weights = {
    auto: num(w.auto, 0, 20, base.weights.auto, 1), choice: num(w.choice, 0, 20, base.weights.choice, 1),
    combat: num(w.combat, 0, 20, base.weights.combat, 1), advanced: num(w.advanced, 0, 20, base.weights.advanced, 1),
  }
  const t = raw.town ?? base.town
  const town: TownEventRules = {
    chance: num(t.chance, 0, 1, base.town.chance),
    cooldown_hours: num(t.cooldown_hours, 0, 168, base.town.cooldown_hours, 1),
    repeat_days: Math.round(num(t.repeat_days, 0, 60, base.town.repeat_days)),
    recent_penalty: num(t.recent_penalty, 0, 1, base.town.recent_penalty),
    recent_size: Math.round(num(t.recent_size, 0, 10, base.town.recent_size)),
    categories: base.town.categories,
  }
  const d = raw.dungeon ?? base.dungeon
  const dungeon: DungeonEventRules = {
    chance: Object.fromEntries((Object.keys(DUNGEON_TRIGGERS) as DungeonTrigger[]).map((k) => [k, num(d.chance?.[k], 0, 1, base.dungeon.chance[k])])) as DungeonEventRules['chance'],
    cooldown_hours: num(d.cooldown_hours, 0, 168, base.dungeon.cooldown_hours, 1),
    repeat_days: Math.round(num(d.repeat_days, 0, 60, base.dungeon.repeat_days)),
  }
  return { chance, weights, town, dungeon }
}

/** 把事件與設定還原成內建的樣子（自建的拿掉） */
export function restoreTravelEvents() {
  travelEvents.templates.splice(0, travelEvents.templates.length, ...clone(snapshot.templates))
  const r = builtinEventRules()
  travelEvents.chance = r.chance
  travelEvents.weights = r.weights
  travelEvents.town = r.town
  travelEvents.dungeon = r.dungeon
}

export function applyTravelEvent(id: string, m: TravelEventMod) {
  const { custom: _custom, ...def } = clone(m)
  const i = travelEvents.templates.findIndex((t) => t.id === id)
  if (i >= 0) travelEvents.templates[i] = { ...def, id }
  else travelEvents.templates.push({ ...def, id })
}

export function applyEventRules(r: EventRulesMod) {
  travelEvents.chance = clone(r.chance)
  travelEvents.weights = clone(r.weights)
  travelEvents.town = clone(r.town)
  travelEvents.dungeon = clone(r.dungeon)
}

export function currentEventRules(): EventRulesMod {
  return rulesOf()
}

/** 事件的檢查：可能沒問題、只提醒的地方 */
export function travelEventWarnings(t: RoadTemplate): string[] {
  const out: string[] = []
  if (!t.text) out.push('沒有描述')
  if (t.tier === 'advanced' && t.kind === 'check' && !t.options?.length) out.push('高階的檢定事件成功後沒有選項')
  return out
}
