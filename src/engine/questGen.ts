// 特殊任務生成器的整理（docs/plan/roadmap/WORLD_EDITOR_PLAN.md E4b）：AI 回覆的 JSON → 可以加進世界的內容。
// AI 只寫劇情與結構，下面這些由程式決定：
// - id：新東西用代號（$npc1、$item1……），換成正式的 id（物品是名稱），所有引用跟著改；文字裡的代號換成名字
// - 旗標：不是現有任務設定的旗標一律加上這個任務的前綴（g<短碼>_），不會和其他任務撞名
// - 完成報酬（金錢、經驗）、建議階級、物品價格、NPC 的雇用價依建議等級算
// - 新怪物、技能、狀態的數值夾在內建同等級的範圍（超出的拉回邊緣，記一筆「已調整」）
// - 地標的格子：在那個聚落找一格空地；特殊地圖只做隨機地圖（遭遇表用指定的怪物）
// 不允許的種類（特質、刺青、印記、事件……）與沒有勾選允許的新東西整項拿掉，記一筆說明。
// 最後的整理與檢查（normalizeMods、storyCheck、可達性）在沙盒裡做：見 stores/content.ts 的 checkGenerated。

import {
  abilities, enemies, geography, itemDef, landmarkTypes, npcs as namedNpcs, PARK_STAMP_PREFIX, statuses, stories,
  type AbilityDef, type EnemyDef, type StatusDef, type StoryDef,
} from './data'
import { guildRankFor } from './character'
import { blockKeys, settlementArea } from './grid'
import { landmarkSpotProblem } from './landmarkMods'
import { builtinEnemy, builtinNpc, builtinStatus, builtinAbility, type ContentMods } from './mods'
import { builtinStory } from './storyMods'
import { cleanFlag } from './storyFlags'
import { copyItemName } from './contentImport'

/** 可以新增的種類（AI 回覆的 new 底下） */
export const GEN_KINDS = {
  npcs: '固定 NPC', items: '物品', landmarks: '地標', specialMaps: '特殊地圖', enemies: '怪物', abilities: '技能', statuses: '狀態',
} as const
export type GenKind = keyof typeof GEN_KINDS

/** 玩家在輸入畫面填的 */
export interface GenInput {
  /** 描述 */
  prompt: string
  /** 開頭方式與地點（選填） */
  startKind?: StoryDef['start']['kind']
  location?: string
  /** 指定要用的現有 NPC */
  npcs?: string[]
  /** 建議等級（沒填時看 AI 寫的 min_level，再沒有時 5） */
  level?: number
  /** 任務點數量上限 */
  maxNodes: number
  /** 可以用的內容標籤（成人向只有在設定開放時才能勾） */
  tags: string[]
  /** 允許新增哪些東西 */
  allow: Record<GenKind, boolean>
  /** 允許「主角淪為奴隸」 */
  enslave?: boolean
}

export function defaultGenInput(): GenInput {
  return { prompt: '', maxNodes: 6, tags: [], allow: { npcs: true, items: true, landmarks: true, specialMaps: true, enemies: true, abilities: true, statuses: true } }
}

export interface GenResult {
  storyId: string
  /** 要加進世界的內容（還沒經過 normalizeMods） */
  mods: Partial<ContentMods>
  /** AI 寫的設計說明 */
  notes: string
  /** 程式改了什麼（報酬、數值、格子……） */
  adjusted: string[]
  /** 拿掉了什麼（不允許的種類、沒勾選的、寫錯的） */
  dropped: string[]
}

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v)
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const str = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '')
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b)
  return s.length ? s[Math.floor(s.length / 2)]! : 0
}

// ---- 平衡：內建內容依等級的範圍 ----

const builtinEnemies = () => Object.values(enemies).filter((e) => !!builtinEnemy(e.id))

/** 骰子的平均（2d6+3 → 10）；不是骰子時 0 */
export function diceAvg(d: unknown): number {
  const m = /^(\d{0,2})d(\d{1,3})([+-]\d{1,3})?$/.exec(String(d ?? '').replace(/\s+/g, ''))
  if (!m) return 0
  const count = Number(m[1] || 1)
  return (count * (Number(m[2]) + 1)) / 2 + Number(m[3] ?? 0)
}

/** 同等級（±1）內建怪物的數值範圍 */
export function enemyBand(level: number) {
  let pool = builtinEnemies().filter((e) => Math.abs(e.level - level) <= 1)
  if (pool.length < 3) pool = builtinEnemies().filter((e) => Math.abs(e.level - level) <= 3)
  const range = (f: (e: EnemyDef) => number): [number, number] => {
    const v = pool.map(f)
    return v.length ? [Math.min(...v), Math.max(...v)] : [0, 0]
  }
  return {
    hp: range((e) => e.hp), ap: range((e) => e.ap), evade: range((e) => e.evade), dr: range((e) => e.dr), xp: range((e) => e.xp),
    weapon: range((e) => diceAvg(e.weapon.dice)), offense: range((e) => e.offense?.all ?? 1),
  }
}

/** 一項技能每次的平均傷害（每一段的骰子加總 × 次數） */
function abilityPower(a: Pick<AbilityDef, 'damage' | 'hits'>): number {
  return (a.damage ?? []).reduce((s, p) => s + diceAvg(p.dice), 0) * (a.hits ?? 1)
}

/** 等級 level 以下（+2）的內建怪物用的技能裡，最強的平均傷害 */
function abilityCap(level: number): number {
  const used = new Set(builtinEnemies().filter((e) => e.level <= level + 2).flatMap((e) => e.abilities ?? []))
  const v = [...used].map((id) => builtinAbility(id)).filter((a): a is AbilityDef => !!a).map(abilityPower)
  return Math.max(4, ...v)
}

/** 內建狀態的持續傷害（dot）最大的平均 */
function dotCap(): number {
  return Math.max(3, ...Object.keys(statuses).map((id) => builtinStatus(id)).filter((s): s is StatusDef => !!s).map((s) => Math.max(diceAvg(s.dot?.dice), diceAvg(s.pulse?.dice))))
}

/** 內建特殊任務依階級的完成報酬（金錢、經驗的中位數） */
export function rewardFor(level: number): { rank: ReturnType<typeof guildRankFor>; money: number; xp: number } {
  const rank = guildRankFor(level)
  const same = stories.filter((s) => s.rank === rank && builtinStory(s.id))
  const sum = (s: StoryDef, t: 'money' | 'xp') => (s.rewards ?? []).reduce((n, e) => n + (e.type === t ? e.amount : 0), 0)
  const money = median(same.map((s) => sum(s, 'money')).filter((n) => n > 0))
  const xp = median(same.map((s) => sum(s, 'xp')).filter((n) => n > 0))
  return { rank, money: money || 100 * level, xp: xp || 100 * level }
}

/** 同等級冒險者的雇用價（內建的中位數） */
function hireFor(level: number): number {
  for (let d = 0; d <= 5; d++) {
    const v = namedNpcs.filter((n) => builtinNpc(n.id) && n.kind !== 'commoner' && n.hire_cc > 0 && Math.abs(n.level - level) <= d).map((n) => n.hire_cc)
    if (v.length) return median(v)
  }
  return 100 * level
}

// ---- 旗標 ----

/** 現有任務設定的旗標（開頭與結果）：AI 刻意引用時保留原名 */
export function knownFlags(): Set<string> {
  const out = new Set<string>()
  for (const s of stories) {
    for (const f of s.start_flags ?? []) out.add(f)
    for (const n of s.nodes) {
      for (const o of [n.success, n.fail, ...(n.options ?? []).flatMap((x) => [x.success, x.fail])]) for (const f of o?.set_flags ?? []) out.add(f)
    }
  }
  return out
}

/** 生成的任務自己的旗標前綴（任務 id 去掉 mod_story_） */
export const genFlagPrefix = (storyId: string) => `${storyId.replace(/^mod_story_/, '')}_`

const FLAG_KEYS = new Set(['flags', 'flags_none', 'flags_any', 'set_flags', 'clear_flags', 'start_flags'])

/** 把物件裡所有旗標欄位的旗標改名（就地） */
function renameFlags(v: unknown, rename: (f: string) => string) {
  if (Array.isArray(v)) {
    for (const x of v) renameFlags(x, rename)
  } else if (isObj(v)) {
    for (const [k, x] of Object.entries(v)) {
      if (FLAG_KEYS.has(k) && Array.isArray(x)) v[k] = x.map((f) => (typeof f === 'string' ? rename(f) : f))
      else renameFlags(x, rename)
    }
  }
}

// ---- 代號 ----

const REF = /\$[A-Za-z][A-Za-z0-9_]*/g

/** 換掉代號：整個字串是代號的換成 id，物件的 key 也換；文字裡夾著的換成名字（就地，回傳新值） */
function replaceRefs(v: unknown, ids: Map<string, string>, names: Map<string, string>): unknown {
  if (typeof v === 'string') {
    if (ids.has(v)) return ids.get(v)
    return v.includes('$') ? v.replace(REF, (m) => names.get(m) ?? m) : v
  }
  if (Array.isArray(v)) return v.map((x) => replaceRefs(x, ids, names))
  if (isObj(v)) {
    const out: Obj = {}
    for (const [k, x] of Object.entries(v)) out[ids.get(k) ?? k] = replaceRefs(x, ids, names)
    return out
  }
  return v
}

/** 還留著的代號（沒有定義的） */
function leftoverRefs(v: unknown, out = new Set<string>()): Set<string> {
  if (typeof v === 'string') {
    if (/^\$[A-Za-z][A-Za-z0-9_]*$/.test(v)) out.add(v)
  } else if (Array.isArray(v)) {
    for (const x of v) leftoverRefs(x, out)
  } else if (isObj(v)) {
    for (const [k, x] of Object.entries(v)) {
      if (k.startsWith('$')) out.add(k)
      leftoverRefs(x, out)
    }
  }
  return out
}

// ---- 地標的格子 ----

/** 在聚落裡找一格可以擺地標的空地（離區塊中心近的優先；taken 是這次已經用掉的格子） */
export function landmarkSpot(location: string, taken: Set<string>): { area: string; x: number; y: number } | undefined {
  for (const key of blockKeys(location)) {
    const area = settlementArea(key)
    if (!area) continue
    const cx = area.width / 2
    const cy = area.height / 2
    const spots = area.cells
      .map((c, i) => ({ c, x: i % area.width, y: Math.floor(i / area.width) }))
      .filter(({ c }) => c.kind === 'floor')
      .sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy))
    for (const s of spots) {
      const k = `${key}:${s.x},${s.y}`
      if (taken.has(k) || landmarkSpotProblem('lm_new', { area: key, x: s.x, y: s.y })) continue
      taken.add(k)
      return { area: key, x: s.x, y: s.y }
    }
  }
  return undefined
}

// ---- 主程式 ----

const isSettlement = (id: unknown) => typeof id === 'string' && geography.locations.some((l) => l.id === id && l.type !== 'dungeon')
const isLocation = (id: unknown) => typeof id === 'string' && geography.locations.some((l) => l.id === id)

/** 不能新增的種類（AI 寫了就拿掉） */
const NOT_ALLOWED: Record<string, string> = {
  perks: '特質', tattoos: '刺青', marks: '奴隸印記', counters: '劇情計數器', travelEvents: '事件', masterEvents: '事件', conditions: '非戰鬥狀態', bases: '裝備底材', materials: '材料', shops: '商店',
}
/** 新技能可以改的欄位（其餘照樣板） */
const ABILITY_FIELDS = ['name', 'desc', 'target', 'resolve', 'save', 'on_save', 'damage', 'hits', 'apply', 'heal', 'uses', 'ap', 'attr', 'count', 'lifesteal', 'crit', 'adv']
/** 新狀態可以改的欄位 */
const STATUS_FIELDS = ['name', 'kind', 'mods', 'dot', 'hot', 'pulse', 'control', 'advantage', 'disadvantage', 'resist', 'offense', 'attacked_advantage', 'attacked_disadvantage', 'charges']
/** 新 NPC 不收的欄位（由程式決定或第一版不開放） */
const NPC_DROP = ['id', 'ref', 'hire_cc', 'stages', 'squad', 'relations', 'icon', 'portrait', 'abilities', 'gear', 'perks']

/**
 * 整理 AI 的回覆（已經解析成物件）。code 是旗標與 id 的短碼（測試時固定）。
 * 丟出錯誤：回覆的格式不對（沒有 story）。
 */
export function buildGenerated(reply: unknown, input: GenInput, code = Math.random().toString(36).slice(2, 6)): GenResult {
  if (!isObj(reply) || !isObj(reply.story)) throw new Error('AI 的回覆沒有 story')
  const adjusted: string[] = []
  const dropped: string[] = []
  const story = clone(reply.story)
  const fresh = isObj(reply.new) ? clone(reply.new) : {}
  const storyId = `mod_story_g${code}`
  const mods: Partial<ContentMods> = { stories: {} }

  // 1. 不能新增的種類、沒有勾選允許的
  for (const k of Object.keys(fresh)) {
    if (k in GEN_KINDS && input.allow[k as GenKind]) continue
    const list = Array.isArray(fresh[k]) ? fresh[k] as unknown[] : []
    if (list.length) dropped.push(k in GEN_KINDS ? `沒有允許新增${GEN_KINDS[k as GenKind]}，拿掉了 ${list.length} 項` : `不能新增${NOT_ALLOWED[k] ?? k}，拿掉了 ${list.length} 項`)
    delete fresh[k]
  }
  const listOf = (k: GenKind) => (Array.isArray(fresh[k]) ? (fresh[k] as unknown[]).filter(isObj) : [])

  // 2. 代號 → id（物品是名稱）
  const ids = new Map<string, string>()
  const names = new Map<string, string>()
  const takenItems = new Set<string>()
  const counter: Record<string, number> = {}
  const nextId = (kind: GenKind) => {
    const n = (counter[kind] = (counter[kind] ?? 0) + 1)
    const prefix = { npcs: 'mod_npc_g', enemies: 'mod_enemy_g', abilities: 'mod_ability_g', statuses: 'mod_status_g', landmarks: 'lm_g', specialMaps: 'sm_g', items: '' }[kind]
    return `${prefix}${code}_${n}`
  }
  const entries: Record<GenKind, { ref: string; id: string; raw: Obj }[]> = { npcs: [], items: [], landmarks: [], specialMaps: [], enemies: [], abilities: [], statuses: [] }
  for (const kind of Object.keys(GEN_KINDS) as GenKind[]) {
    for (const raw of listOf(kind)) {
      const ref = str(raw.ref, 40)
      let id: string
      if (kind === 'items') {
        const name = str(raw.name, 20)
        if (!name) {
          dropped.push(`有一項新物品沒有名稱，拿掉了`)
          continue
        }
        id = itemDef(name) || takenItems.has(name) ? copyItemName(name, new Set([...takenItems, ...(itemDef(name) ? [name] : [])])) : name
        if (id !== name) adjusted.push(`新物品「${name}」和現有的物品同名，改成「${id}」`)
        takenItems.add(id)
      } else {
        id = nextId(kind)
      }
      if (ref.startsWith('$')) {
        ids.set(ref, id)
        names.set(ref, kind === 'items' ? id : str(raw.name, 30) || id)
      }
      entries[kind].push({ ref, id, raw })
    }
  }
  const resolve = <T>(v: T): T => replaceRefs(v, ids, names) as T
  const storyR = resolve(story)
  for (const kind of Object.keys(entries) as GenKind[]) for (const e of entries[kind]) e.raw = resolve(e.raw)
  const left = leftoverRefs([storyR, ...Object.values(entries).flat().map((e) => e.raw)])
  if (left.size) dropped.push(`AI 用了沒有定義的代號：${[...left].join('、')}（引用它的地方檢查時會報錯）`)

  // 3. 旗標：現有任務設定的照留，其他的加上前綴
  const known = knownFlags()
  const prefix = genFlagPrefix(storyId)
  const rename = (f: string) => {
    const c = cleanFlag(f)
    if (!c || c.startsWith('ai:') || c.startsWith(PARK_STAMP_PREFIX) || c.startsWith(prefix) || known.has(c)) return c
    return cleanFlag(`${prefix}${c.replace(/[^a-zA-Z0-9_]/g, '_')}`)
  }
  renameFlags(storyR, rename)
  for (const kind of ['npcs', 'landmarks'] as const) for (const e of entries[kind]) renameFlags(e.raw, rename)

  // 4. 等級、階級、報酬
  const start = isObj(storyR.start) ? storyR.start : (storyR.start = { kind: 'guild' })
  if (input.startKind) start.kind = input.startKind
  if (input.location && (start.kind === 'guild' || start.kind === 'informant')) start.location = input.location
  if (start.kind === 'npc' && !start.npc && input.npcs?.[0]) start.npc = input.npcs[0]
  const level = clamp(Math.round(input.level ?? (Number(start.min_level) || 5)), 1, 20)
  start.min_level = level
  const reward = rewardFor(level)
  storyR.rank = reward.rank
  const rewards = (Array.isArray(storyR.rewards) ? storyR.rewards : []).filter(isObj)
  const aiMoney = rewards.filter((e) => e.type === 'money').reduce((s, e) => s + (Number(e.amount) || 0), 0)
  const aiXp = rewards.filter((e) => e.type === 'xp').reduce((s, e) => s + (Number(e.amount) || 0), 0)
  storyR.rewards = [{ type: 'money', amount: reward.money }, { type: 'xp', amount: reward.xp }, ...rewards.filter((e) => e.type !== 'money' && e.type !== 'xp')]
  if (aiMoney !== reward.money || aiXp !== reward.xp) adjusted.push(`完成報酬依建議等級 ${level}（${reward.rank} 級）算：${reward.money} 白鸛幣、${reward.xp} 經驗`)
  delete storyR.merit
  // 中途給的錢加總不超過完成報酬
  const nodes = (Array.isArray(storyR.nodes) ? storyR.nodes : []).filter(isObj)
  storyR.nodes = nodes
  const outcomes = (n: Obj) => [n.success, n.fail, ...(Array.isArray(n.options) ? n.options.filter(isObj).flatMap((o) => [o.success, o.fail]) : [])].filter(isObj)
  let midMoney = 0
  for (const n of nodes) for (const o of outcomes(n)) for (const e of (Array.isArray(o.effects) ? o.effects : []).filter(isObj)) if (e.type === 'money' && Number(e.amount) > 0) midMoney += Number(e.amount)
  if (midMoney > reward.money) {
    const ratio = reward.money / midMoney
    for (const n of nodes) for (const o of outcomes(n)) for (const e of (Array.isArray(o.effects) ? o.effects : []).filter(isObj)) if (e.type === 'money' && Number(e.amount) > 0) e.amount = Math.max(1, Math.floor(Number(e.amount) * ratio))
    adjusted.push(`中途給的金錢加總超過完成報酬，按比例減少`)
  }
  if (nodes.length > input.maxNodes) adjusted.push(`任務點有 ${nodes.length} 個，超過上限 ${input.maxNodes} 個（照留，可以在編輯器刪減）`)

  // 5. 內容標籤、成人場景、主角淪為奴隸
  const allowTags = new Set(input.tags)
  const tagsOf = (v: unknown) => (Array.isArray(v) ? v.filter((t): t is string => typeof t === 'string') : [])
  const removedTags = new Set<string>()
  const keepTags = (o: Obj) => {
    const t = tagsOf(o.tags)
    for (const x of t) if (!allowTags.has(x)) removedTags.add(x)
    if (t.length) o.tags = t.filter((x) => allowTags.has(x))
  }
  // 帶了不允許標籤的選項整個拿掉（例如 NTR 分支），其他的只拿掉標籤
  for (const n of nodes) {
    if (!Array.isArray(n.options)) continue
    for (const o of n.options) if (isObj(o)) for (const t of tagsOf(o.tags)) if (!allowTags.has(t)) removedTags.add(t)
    n.options = n.options.filter((o) => !isObj(o) || tagsOf(o.tags).every((t) => allowTags.has(t)))
  }
  keepTags(storyR)
  for (const n of nodes) for (const o of (Array.isArray(n.options) ? n.options : []).filter(isObj)) keepTags(o)
  if (removedTags.size) dropped.push(`拿掉沒有允許的內容標籤：${[...removedTags].join('、')}`)
  const adult = tagsOf(storyR.tags).includes('adult')
  let scenes = 0
  let enslave = 0
  for (const n of nodes) {
    for (const o of outcomes(n)) {
      if (o.scene && !adult) {
        delete o.scene
        scenes++
      }
      if (Array.isArray(o.effects) && !input.enslave) {
        const kept = o.effects.filter((e) => !(isObj(e) && e.type === 'enslave_player'))
        enslave += o.effects.length - kept.length
        o.effects = kept
      }
    }
  }
  if (scenes) dropped.push(`任務不是成人向，拿掉 ${scenes} 段親密場景`)
  if (enslave) dropped.push(`沒有允許「主角淪為奴隸」，拿掉 ${enslave} 個效果`)
  storyR.custom = true
  mods.stories![storyId] = storyR as never

  // 6. 新狀態、技能（樣板＋可以改的欄位，數值夾在內建的範圍）
  if (entries.statuses.length) mods.statuses = {}
  const dcap = dotCap()
  for (const e of entries.statuses) {
    const base = typeof e.raw.template === 'string' && statuses[e.raw.template] ? clone(statuses[e.raw.template]!) : { name: '', kind: 'debuff' as const }
    const out = { ...base } as Obj
    for (const k of STATUS_FIELDS) if (e.raw[k] !== undefined) out[k] = e.raw[k]
    for (const k of ['dot', 'pulse'] as const) {
      const d = out[k] as { dice?: string } | undefined
      if (d?.dice && diceAvg(d.dice) > dcap) {
        d.dice = shrinkDice(d.dice, dcap)
        adjusted.push(`新狀態「${str(out.name, 20)}」的${k === 'dot' ? '持續傷害' : '脈衝'}超過內建最強的，改成 ${d.dice}`)
      }
    }
    out.custom = true
    mods.statuses![e.id] = out as never
  }
  if (entries.abilities.length) mods.abilities = {}
  const acap = abilityCap(level)
  for (const e of entries.abilities) {
    const tpl = typeof e.raw.template === 'string' ? abilities[e.raw.template] : undefined
    const base: Obj = tpl ? clone(tpl) as unknown as Obj : { target: 'enemy', resolve: 'attack', damage: [{ dice: '1d6', type: 'slashing' }] }
    const out: Obj = { ...base }
    for (const k of ABILITY_FIELDS) if (e.raw[k] !== undefined) out[k] = e.raw[k]
    // 只給怪物與這次的 NPC 用：不是職業的能力
    out.id = e.id
    out.type = base.type === 'cantrip' ? 'cantrip' : 'skill'
    out.classes = ['monster']
    delete out.unlock
    delete out.circle
    const power = abilityPower(out as never)
    if (power > acap && Array.isArray(out.damage)) {
      const ratio = acap / power
      out.damage = (out.damage as Obj[]).map((p) => (typeof p.dice === 'string' ? { ...p, dice: shrinkDice(p.dice, diceAvg(p.dice) * ratio) } : p))
      adjusted.push(`新技能「${str(out.name, 20)}」的傷害超過同等級怪物的技能（平均 ${Math.round(power)}，上限 ${Math.round(acap)}），已調低`)
    }
    out.desc = str(out.desc, 200) || str(out.name, 20)
    out.custom = true
    mods.abilities![e.id] = out as never
  }

  // 7. 新怪物（樣板複製或直接寫），數值對照同等級
  if (entries.enemies.length) mods.enemies = {}
  for (const e of entries.enemies) {
    const tpl = typeof e.raw.template === 'string' ? enemies[e.raw.template] : undefined
    const out: Obj = tpl ? { ...clone(tpl), name: e.raw.name ?? tpl.name, desc: e.raw.desc ?? tpl.desc } : { ...e.raw }
    if (tpl) for (const k of ['abilities', 'loot', 'kind'] as const) if (e.raw[k] !== undefined) out[k] = e.raw[k]
    for (const k of ['id', 'ref', 'template', 'spawns', 'habitats', 'exclude', 'icon']) delete out[k]
    out.custom = true
    const lv = clamp(Math.round(Number(out.level) || level), 1, 20)
    out.level = lv
    if (!tpl) clampEnemy(out, lv, adjusted)
    // 技能：只能用現有的或這次新增的（不能是法術）
    const fresh = new Set(entries.abilities.map((a) => a.id))
    const ab = (Array.isArray(out.abilities) ? out.abilities : []).filter((a): a is string => typeof a === 'string')
    const okAb = ab.filter((a) => fresh.has(a) || (abilities[a] && abilities[a]!.type !== 'spell'))
    if (okAb.length < ab.length) dropped.push(`新怪物「${str(out.name, 20)}」的技能 ${ab.filter((a) => !okAb.includes(a)).join('、')} 不存在或是法術，拿掉了`)
    out.abilities = okAb
    mods.enemies![e.id] = out as never
  }

  // 8. 新物品：價格依等級
  if (entries.items.length) mods.items = {}
  for (const e of entries.items) {
    const price = Math.max(1, Math.round(reward.money / 10))
    const out: Obj = { ...e.raw, name: e.id, price_cc: price, custom: true }
    if (!['food', 'consumable', 'material', 'scroll', 'info'].includes(String(out.category))) out.category = 'material'
    out.tags = Array.isArray(out.tags) ? out.tags : []
    for (const k of ['ref', 'gear', 'recipe', 'furniture', 'seed', 'forge', 'master_force', 'icon']) delete out[k]
    mods.items![e.id] = out as never
  }

  // 9. 新 NPC：雇用價、出沒地點由程式定
  if (entries.npcs.length) mods.npcs = {}
  for (const e of entries.npcs) {
    const out: Obj = { ...e.raw }
    for (const k of NPC_DROP) delete out[k]
    if (!isSettlement(out.location)) {
      const fallback = isSettlement(input.location) ? input.location! : isSettlement(start.location) ? String(start.location) : 'soriel'
      if (out.location) adjusted.push(`新角色「${str(out.name, 20)}」的所屬地點 ${String(out.location)} 不是聚落，改成 ${fallback}`)
      out.location = fallback
    }
    const lv = clamp(Math.round(Number(out.level) || level), 1, 20)
    out.level = lv
    out.kind = out.kind === 'commoner' ? 'commoner' : 'adventurer'
    out.hire_cc = out.kind === 'commoner' ? 0 : hireFor(lv)
    out.haunts = [{ location: out.location, zone: 'town', weight: 1 }]
    out.personality = str(out.personality, 200) || '話不多。'
    out.custom = true
    mods.npcs![e.id] = out as never
  }

  // 10. 新地標：程式找格子；找不到時任務點改成「在聚落裡」
  const taken = new Set<string>()
  if (entries.landmarks.length) mods.landmarks = {}
  for (const e of entries.landmarks) {
    const location = isSettlement(e.raw.location) ? String(e.raw.location) : isSettlement(input.location) ? input.location! : undefined
    const at = location ? landmarkSpot(location, taken) : undefined
    const name = str(e.raw.name, 12) || '新的地標'
    if (!location || !at) {
      dropped.push(`新地標「${name}」${location ? '在那個聚落找不到空地' : '沒有指定聚落'}，拿掉了（用到它的任務點改成「在聚落裡」）`)
      for (const n of nodes) {
        const p = isObj(n.at) ? n.at : undefined
        if (p?.cell === e.id) {
          p.where = 'settlement'
          delete p.cell
          if (location) p.location = location
        }
      }
      continue
    }
    const types = (Array.isArray(e.raw.types) ? e.raw.types : []).filter((t): t is string => typeof t === 'string' && !!landmarkTypes[t])
    const out: Obj = { ...e.raw, id: e.id, name, location, at, types, emoji: str(e.raw.emoji, 8) || '📍', custom: true }
    for (const k of ['ref', 'area', 'interior', 'auction']) delete out[k]
    adjusted.push(`新地標「${name}」擺在 ${at.area} 的 (${at.x}, ${at.y})（可以在地標編輯器移動）`)
    mods.landmarks![e.id] = out as never
  }

  // 11. 新特殊地圖：隨機地圖，遭遇表用指定的怪物
  if (entries.specialMaps.length) mods.specialMaps = {}
  const knownEnemy = (id: string) => !!enemies[id] || entries.enemies.some((x) => x.id === id)
  for (const e of entries.specialMaps) {
    const location = isLocation(e.raw.location) ? String(e.raw.location) : isLocation(input.location) ? input.location! : 'soriel'
    const size = Array.isArray(e.raw.size) ? e.raw.size.map((n) => clamp(Math.round(Number(n) || 10), 6, 16)) : [10, 8]
    const foes = (Array.isArray(e.raw.enemies) ? e.raw.enemies : []).filter((x): x is string => typeof x === 'string')
    const ok = foes.filter(knownEnemy).slice(0, 4)
    if (ok.length < foes.length) dropped.push(`新特殊地圖「${str(e.raw.name, 16)}」的怪物 ${foes.filter((x) => !ok.includes(x)).join('、')} 不存在，拿掉了`)
    const out: Obj = {
      id: e.id, name: str(e.raw.name, 16) || '新的特殊地圖', location, desc: str(e.raw.desc, 300),
      lighting: ['lit', 'daylight', 'dark'].includes(String(e.raw.lighting)) ? e.raw.lighting : 'dark',
      layer: ['outskirts', 'shallow', 'middle', 'deep'].includes(String(e.raw.layer)) ? e.raw.layer : 'shallow',
      size: [size[0] ?? 10, size[1] ?? 8], custom: true,
      ...(ok.length ? { table: ok.map((id) => [[id, 1]]), encounters: [2, 4] } : { peaceful: true }),
      chests: [1, 2], resources: [1, 3],
    }
    mods.specialMaps![e.id] = out as never
  }
  return { storyId, mods, notes: str(reply.notes, 2000), adjusted, dropped }
}

/** 把骰子縮到平均不超過 cap（減少骰子數，再不夠時換小一號的骰子） */
export function shrinkDice(d: string, cap: number): string {
  const m = /^(\d{0,2})d(\d{1,3})([+-]\d{1,3})?$/.exec(d.replace(/\s+/g, ''))
  if (!m) return d
  let count = Number(m[1] || 1)
  let sides = Number(m[2])
  const bonus = Math.min(Number(m[3] ?? 0), Math.floor(cap / 2))
  const avg = () => (count * (sides + 1)) / 2 + bonus
  while (count > 1 && avg() > cap) count--
  const SIDES = [4, 6, 8, 10, 12]
  while (avg() > cap && SIDES.indexOf(sides) > 0) sides = SIDES[SIDES.indexOf(sides) - 1]!
  return `${count}d${sides}${bonus > 0 ? `+${bonus}` : bonus < 0 ? bonus : ''}`
}

/** 新怪物（不是照樣板）的數值夾在同等級內建怪物的範圍 */
function clampEnemy(out: Obj, level: number, adjusted: string[]) {
  const band = enemyBand(level)
  const name = str(out.name, 20) || '新怪物'
  const fixed: string[] = []
  const fit = (k: 'hp' | 'ap' | 'evade' | 'dr' | 'xp', label: string, d: number) => {
    const [lo, hi] = band[k]
    const v = Number(out[k])
    const n = Number.isFinite(v) ? clamp(Math.round(v), lo, hi) : d
    if (Number.isFinite(v) && n !== Math.round(v)) fixed.push(`${label} ${v}→${n}`)
    out[k] = n
  }
  fit('hp', '生命', Math.round((band.hp[0] + band.hp[1]) / 2))
  fit('ap', '行動點', band.ap[0])
  fit('evade', '迴避', band.evade[0])
  fit('dr', '減傷', band.dr[0])
  fit('xp', '經驗', Math.round((band.xp[0] + band.xp[1]) / 2))
  const w = isObj(out.weapon) ? out.weapon : (out.weapon = { dice: '1d6', type: 'slashing', attr: 'str' })
  if (diceAvg(w.dice) > band.weapon[1]) {
    const d = shrinkDice(String(w.dice), band.weapon[1])
    fixed.push(`攻擊骰 ${String(w.dice)}→${d}`)
    w.dice = d
  }
  const off = isObj(out.offense) ? out.offense : undefined
  if (off && typeof off.all === 'number' && off.all > band.offense[1]) {
    fixed.push(`傷害倍率 ×${off.all}→×${band.offense[1]}`)
    off.all = band.offense[1]
  }
  if (fixed.length) adjusted.push(`新怪物「${name}」超出 ${level} 級怪物的範圍，已調整：${fixed.join('、')}`)
}
