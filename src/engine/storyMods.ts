// 特殊任務的編輯：整理（儲存、匯入時）、套用到任務清單、檢查任務鏈的問題（內容頁籤「⭐ 特殊任務」）。

import {
  abilities, ATTR_IDS, enemies, geography, npcs as namedNpcs, stories, type AttrId, type EncounterGroup, type StoryCheck, type StoryCond,
  type StoryDef, type StoryNode, type StoryOption, type StoryOutcome, type StoryPlace, type StoryStart, type StoryStartKind, type StoryWhere,
} from './data'
import type { RewardEffect } from './effects'
import { CELL_NAME, type CellKind } from './grid'
import { RANK_ORDER } from './materialQuests'
import { sanitizeCond, sanitizeGearSpecLoose } from './mods'
import { cleanFlag } from './storyFlags'

export interface StoryMod extends StoryDef {
  custom?: boolean
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const snapshot = clone(stories)

export function builtinStory(id: string): StoryDef | undefined {
  const s = snapshot.find((x) => x.id === id)
  return s ? clone(s) : undefined
}

export function restoreStories() {
  stories.splice(0, stories.length, ...clone(snapshot))
}

export function applyStoryMod(id: string, m: StoryMod) {
  const { custom: _custom, ...def } = clone(m)
  void _custom
  const i = stories.findIndex((s) => s.id === id)
  if (i >= 0) stories[i] = { ...def, id }
  else stories.push({ ...def, id })
}

// ---- 整理 ----

const num = (v: unknown, lo: number, hi: number, d: number) => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d
}
const int = (v: unknown, lo: number, hi: number, d: number) => Math.round(num(v, lo, hi, d))
const str = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '')
const flags = (v: unknown) => [...new Set((Array.isArray(v) ? v : []).map(cleanFlag).filter(Boolean))]
/** id：英數與底線 */
export const cleanId = (v: unknown, d: string) => (typeof v === 'string' ? v.trim().replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 40) : '') || d

export const START_KINDS: Record<StoryStartKind, string> = {
  guild: '冒險者公會', npc: '固定 NPC', travel: '旅途中的事件', informant: '情報商', manual: '只由其他事件開啟',
}
export const WHERE_NAME: Record<StoryWhere, string> = {
  settlement: '在聚落裡（任何地方）', cell: '站在聚落的某種設施上', npc: '某位固定 NPC 在身邊', outskirts: '近郊的任務點（⭐）', dungeon: '地下城某一層的任務點（⭐）',
}
export const NODE_KINDS: Record<StoryNode['kind'], string> = { story: '劇情', check: '判定', combat: '戰鬥', choice: '選擇' }
/** 任務點可以指定的設施 */
export const STORY_CELLS: CellKind[] = ['inn', 'guild', 'tavern', 'shop', 'temple', 'gate', 'brothel', 'smithy', 'tailor', 'jeweler', 'magic', 'informant']
export const STORY_LAYERS = ['outskirts', 'shallow', 'middle', 'deep'] as const
export const LAYER_NAME: Record<(typeof STORY_LAYERS)[number], string> = { outskirts: '周邊', shallow: '淺層', middle: '中層', deep: '深層' }
/** 任務的效果可以用的種類 */
export const STORY_EFFECTS: Partial<Record<RewardEffect['type'], string>> = {
  money: '金錢', item: '物品', gear: '裝備', xp: '經驗值', reputation: '聲望', affinity: '親密度', memory: '記憶', ability: '學會能力', companion: '正式入隊', hp: '生命值',
}

const isLoc = (id: unknown) => typeof id === 'string' && geography.locations.some((l) => l.id === id)

function check(v: unknown): StoryCheck | undefined {
  if (!v || typeof v !== 'object') return undefined
  const c = v as Partial<StoryCheck>
  return { attr: ATTR_IDS.includes(c.attr as AttrId) ? c.attr! : 'int', dc: int(c.dc, 1, 40, 12) }
}

export function sanitizeEffects(v: unknown): RewardEffect[] {
  const out: RewardEffect[] = []
  for (const e of Array.isArray(v) ? v : []) {
    if (!e || typeof e !== 'object') continue
    const x = e as Record<string, unknown>
    switch (x.type) {
      case 'money': {
        const amount = int(x.amount, -1e8, 1e8, 0)
        if (amount) out.push({ type: 'money', amount })
        break
      }
      case 'item': {
        const name = str(x.name, 30)
        const qty = int(x.qty, -99, 99, 1)
        if (name && qty) out.push({ type: 'item', name, qty })
        break
      }
      case 'gear': {
        const spec = sanitizeGearSpecLoose(x.spec as never)
        if (spec) out.push({ type: 'gear', spec, ...(str(x.name, 20) ? { name: str(x.name, 20) } : {}), ...(str(x.desc, 80) ? { desc: str(x.desc, 80) } : {}) })
        break
      }
      case 'xp': {
        const amount = int(x.amount, 0, 1e6, 0)
        if (amount) out.push({ type: 'xp', amount })
        break
      }
      case 'reputation': {
        const delta = int(x.delta, -20, 20, 0)
        if (delta && str(x.faction, 30)) out.push({ type: 'reputation', faction: str(x.faction, 30), delta })
        break
      }
      case 'affinity': {
        const delta = int(x.delta, -50, 50, 0)
        if (delta && str(x.npc, 60)) out.push({ type: 'affinity', npc: str(x.npc, 60), delta, ...(str(x.reason, 40) ? { reason: str(x.reason, 40) } : {}) })
        break
      }
      case 'memory': {
        const summary = str(x.summary, 200)
        if (summary) out.push({ type: 'memory', summary, importance: int(x.importance, 1, 3, 2) as 1 | 2 | 3 })
        break
      }
      case 'ability': {
        const ability = typeof x.ability === 'string' && abilities[x.ability] ? x.ability : undefined
        out.push({ type: 'ability', target: 'pc', ...(ability ? { ability } : { choices: int(x.choices, 1, 5, 3) }) })
        break
      }
      case 'companion': {
        if (str(x.npc, 60)) out.push({ type: 'companion', npc: str(x.npc, 60), mode: x.mode === 'hired' ? 'hired' : 'voluntary' })
        break
      }
      case 'hp': {
        const ratio = Math.round(num(x.ratio, -0.9, 1, 0) * 100) / 100
        if (ratio) out.push({ type: 'hp', target: 'pc', ratio })
        break
      }
    }
  }
  return out
}

function outcome(v: unknown): StoryOutcome | undefined {
  if (!v || typeof v !== 'object') return undefined
  const o = v as Partial<StoryOutcome>
  const out: StoryOutcome = {}
  if (str(o.text, 400)) out.text = str(o.text, 400)
  const set = flags(o.set_flags)
  if (set.length) out.set_flags = set
  const clear = flags(o.clear_flags)
  if (clear.length) out.clear_flags = clear
  const effects = sanitizeEffects(o.effects)
  if (effects.length) out.effects = effects
  if (str(o.join, 60)) out.join = str(o.join, 60)
  if (str(o.leave, 60)) out.leave = str(o.leave, 60)
  if (o.complete) out.complete = true
  else if (o.fail_quest) out.fail_quest = true
  if (o.retry) out.retry = true
  return out
}

function place(v: unknown): StoryPlace {
  const p = (v && typeof v === 'object' ? v : {}) as Partial<StoryPlace>
  const where: StoryWhere = (Object.keys(WHERE_NAME) as StoryWhere[]).includes(p.where as StoryWhere) ? p.where! : 'settlement'
  const out: StoryPlace = { where }
  if (isLoc(p.location)) out.location = p.location
  if (where === 'cell') out.cell = STORY_CELLS.includes(p.cell as CellKind) ? p.cell : 'tavern'
  if (where === 'dungeon') out.layer = STORY_LAYERS.includes(p.layer as never) ? p.layer : 'outskirts'
  if (where === 'npc' && str(p.npc, 60)) out.npc = str(p.npc, 60)
  return out
}

function group(v: unknown): EncounterGroup | undefined {
  const g = (Array.isArray(v) ? v : [])
    .filter((x) => Array.isArray(x) && typeof x[0] === 'string')
    .map(([id, n]) => [String(id), int(n, 1, 6, 1)] as [string, number])
  return g.length ? g : undefined
}

function node(v: unknown, i: number, used: Set<string>): StoryNode {
  const n = (v && typeof v === 'object' ? v : {}) as Partial<StoryNode>
  let id = cleanId(n.id, `n${i + 1}`)
  while (used.has(id)) id = `${id}_`
  used.add(id)
  const kind = (Object.keys(NODE_KINDS) as StoryNode['kind'][]).includes(n.kind as never) ? n.kind! : 'story'
  const out: StoryNode = { id, title: str(n.title, 40) || '新的任務點', text: str(n.text, 600), at: place(n.at), kind }
  const req = sanitizeCond(n.requires) as StoryCond | undefined
  if (req) out.requires = req
  if (kind === 'check') out.check = check(n.check) ?? { attr: 'int', dc: 12 }
  if (kind === 'combat') {
    const g = group(n.enemies)
    if (g) out.enemies = g
    const foes = (n.foes ?? []).map((f) => str(f, 60)).filter(Boolean)
    if (foes.length) out.foes = [...new Set(foes)]
  }
  if (kind === 'choice') {
    out.options = (n.options ?? []).slice(0, 6).map((o): StoryOption => {
      const c = check(o?.check)
      const s = outcome(o?.success)
      const f = outcome(o?.fail)
      return { label: str(o?.label, 30) || '選項', ...(c ? { check: c } : {}), ...(s ? { success: s } : {}), ...(c && f ? { fail: f } : {}) }
    })
  } else {
    const s = outcome(n.success)
    if (s) out.success = s
    const f = kind === 'check' || kind === 'combat' ? outcome(n.fail) : undefined
    if (f) out.fail = f
  }
  return out
}

function start(v: unknown): StoryStart {
  const s = (v && typeof v === 'object' ? v : {}) as Partial<StoryStart>
  const kind: StoryStartKind = (Object.keys(START_KINDS) as StoryStartKind[]).includes(s.kind as StoryStartKind) ? s.kind! : 'guild'
  const out: StoryStart = { kind }
  if (isLoc(s.location) && (kind === 'guild' || kind === 'informant')) out.location = s.location
  if (kind === 'npc' && str(s.npc, 60)) out.npc = str(s.npc, 60)
  if (kind === 'travel') {
    out.chance = Math.round(num(s.chance, 0.01, 1, 0.2) * 100) / 100
    const regions = (s.regions ?? []).filter((r) => geography.regions.some((g) => g.id === r))
    if (regions.length) out.regions = regions
  }
  if (kind === 'informant') out.price = int(s.price, 0, 1e7, 100)
  if (s.min_level) out.min_level = int(s.min_level, 1, 20, 1)
  const req = sanitizeCond(s.requires) as StoryCond | undefined
  if (req) out.requires = req
  if (str(s.text, 400)) out.text = str(s.text, 400)
  return out
}

export function sanitizeStory(id: string, raw: Partial<StoryMod>, custom: boolean): StoryMod {
  const used = new Set<string>()
  const out: StoryMod = {
    id,
    title: str(raw.title, 30) || '新的特殊任務',
    summary: str(raw.summary, 300),
    start: start(raw.start),
    nodes: (raw.nodes ?? []).slice(0, 60).map((n, i) => node(n, i, used)),
  }
  if (raw.rank && RANK_ORDER.includes(raw.rank)) out.rank = raw.rank
  const sf = flags(raw.start_flags)
  if (sf.length) out.start_flags = sf
  const rewards = sanitizeEffects(raw.rewards)
  if (rewards.length) out.rewards = rewards
  if (custom) out.custom = true
  return out
}

export function newStory(id: string): StoryMod {
  return {
    id, title: '新的特殊任務', summary: '', start: { kind: 'guild', location: 'soriel' }, start_flags: [`${id}_started`],
    nodes: [{ id: 'n1', title: '第一個任務點', text: '', at: { where: 'cell', location: 'soriel', cell: 'tavern' }, kind: 'story', requires: { flags: [`${id}_started`] }, success: { complete: true } }],
    custom: true,
  }
}

export function newNode(def: StoryDef): StoryNode {
  let i = def.nodes.length + 1
  while (def.nodes.some((n) => n.id === `n${i}`)) i++
  return { id: `n${i}`, title: '新的任務點', text: '', at: { where: 'settlement', ...(def.start.location ? { location: def.start.location } : {}) }, kind: 'story' }
}

// ---- 檢查任務鏈 ----

export interface FlagUse { flag: string; setBy: string[]; clearedBy: string[]; requiredBy: string[]; blockedBy: string[] }

function outcomesOf(n: StoryNode): { label: string; o: StoryOutcome }[] {
  const out: { label: string; o: StoryOutcome }[] = []
  if (n.success) out.push({ label: n.kind === 'combat' ? '勝利' : '成功', o: n.success })
  if (n.fail) out.push({ label: n.kind === 'combat' ? '落敗' : '失敗', o: n.fail })
  for (const opt of n.options ?? []) {
    if (opt.success) out.push({ label: `「${opt.label}」${opt.check ? '成功' : ''}`, o: opt.success })
    if (opt.fail) out.push({ label: `「${opt.label}」失敗`, o: opt.fail })
  }
  return out
}

/** 每個旗標：誰設定、誰清除、誰需要、誰需要它不成立 */
export function flagUsage(def: StoryDef): FlagUse[] {
  const map = new Map<string, FlagUse>()
  const get = (f: string) => {
    let u = map.get(f)
    if (!u) map.set(f, (u = { flag: f, setBy: [], clearedBy: [], requiredBy: [], blockedBy: [] }))
    return u
  }
  for (const f of def.start_flags ?? []) get(f).setBy.push('任務開始')
  for (const f of def.start.requires?.flags ?? []) get(f).requiredBy.push('接取條件')
  for (const f of def.start.requires?.flags_none ?? []) get(f).blockedBy.push('接取條件')
  for (const n of def.nodes) {
    for (const f of n.requires?.flags ?? []) get(f).requiredBy.push(n.title)
    for (const f of n.requires?.flags_none ?? []) get(f).blockedBy.push(n.title)
    for (const { label, o } of outcomesOf(n)) {
      for (const f of o.set_flags ?? []) get(f).setBy.push(`${n.title}・${label}`)
      for (const f of o.clear_flags ?? []) get(f).clearedBy.push(`${n.title}・${label}`)
    }
  }
  return [...map.values()].sort((a, b) => a.flag.localeCompare(b.flag))
}

/** 任務鏈可能的問題（不擋儲存，只是提醒） */
export function storyIssues(def: StoryDef, others: StoryDef[] = stories): string[] {
  const out: string[] = []
  const npcIds = new Set(namedNpcs.map((n) => n.id))
  const externalSets = new Set(others.filter((s) => s.id !== def.id).flatMap((s) => [...(s.start_flags ?? []), ...s.nodes.flatMap((n) => outcomesOf(n).flatMap(({ o }) => o.set_flags ?? []))]))
  const usage = flagUsage(def)
  for (const u of usage) {
    if (u.requiredBy.length && !u.setBy.length && !u.flag.startsWith('ai:') && !externalSets.has(u.flag)) {
      out.push(`旗標 🚩${u.flag} 沒有任何地方會設定，需要它的「${u.requiredBy.join('」「')}」永遠不會出現`)
    }
  }
  if (!def.nodes.some((n) => outcomesOf(n).some(({ o }) => o.complete))) out.push('沒有任何結果會完成任務（勾選「完成任務」）')
  if (def.start.kind === 'npc' && (!def.start.npc || !npcIds.has(def.start.npc))) out.push('開頭的固定 NPC 不存在')
  if ((def.start.kind === 'guild') && !def.start.location) out.push('沒有指定哪座城鎮的公會')
  for (const n of def.nodes) {
    const t = `任務點「${n.title}」`
    if (n.at.where !== 'npc' && !n.at.location) out.push(`${t}沒有指定地點`)
    if (n.at.where === 'npc' && (!n.at.npc || !npcIds.has(n.at.npc))) out.push(`${t}的固定 NPC 不存在`)
    if (n.at.where === 'outskirts' && n.at.location && geography.locations.find((l) => l.id === n.at.location)?.type === 'dungeon') out.push(`${t}：地下城沒有近郊，請改成「地下城某一層」`)
    if (n.at.where === 'dungeon' && n.at.location && geography.locations.find((l) => l.id === n.at.location)?.type !== 'dungeon') out.push(`${t}：選的地點不是地下城`)
    if ((n.at.where === 'settlement' || n.at.where === 'cell') && n.at.location && geography.locations.find((l) => l.id === n.at.location)?.type === 'dungeon') out.push(`${t}：選的地點不是聚落`)
    if (n.kind === 'combat' && !n.enemies?.length && !n.foes?.length) out.push(`${t}是戰鬥，但沒有敵人`)
    for (const [id] of n.enemies ?? []) if (!enemies[id]) out.push(`${t}的怪物 ${id} 不存在`)
    for (const id of n.foes ?? []) if (!npcIds.has(id)) out.push(`${t}的敵對角色 ${id} 不存在`)
    if (n.kind === 'choice' && !n.options?.length) out.push(`${t}是選擇，但沒有選項`)
    for (const { o } of outcomesOf(n)) {
      if (o.join && !npcIds.has(o.join)) out.push(`${t}要同行的角色 ${o.join} 不存在`)
    }
    if (n.at.where === 'cell' && n.at.cell && !(n.at.cell in CELL_NAME)) out.push(`${t}的設施不存在`)
  }
  return out
}
