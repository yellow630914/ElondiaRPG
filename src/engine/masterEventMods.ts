// 主人事件格式的自訂內容（內容編輯器「⛓️ 主奴與娼館」；docs/CONTENT_EDITOR.md、docs/COMPANIONS.md 2.4 節）：
// 主人的突發事件、調教事件、娼館的打工與受訓事件共用一個格式（slavery.json；MasterEventDef）。
// 內建的事件可以改、不能刪；自建的事件隨時可以刪（等待回應中的事件作廢）。id 在所有事件庫裡不能重複。

import {
  abilities, ATTR_IDS, MASTER_EVENT_POOLS, masterEventPool, slaveryRules, type AttrId, type MasterEventDef, type MasterEventOption, type MasterEventPool,
} from './data'
import { sanitizeEffects } from './storyMods'

export interface MasterEventMod extends MasterEventDef {
  /** 放在哪一個事件庫 */
  pool: MasterEventPool
  custom?: boolean
}

export const MASTER_EVENT_LIMITS = { text_chars: 400, label_chars: 30, result_chars: 300, scene_chars: 300, options: 4, teaches: 6 } as const
export const POOL_IDS = Object.keys(MASTER_EVENT_POOLS) as MasterEventPool[]
/** 只有主人的突發事件用得到的欄位（在主人的家、離家逾期、刺青、強制裝備、經過娼館） */
export const MASTER_ONLY_POOL: MasterEventPool = 'master'

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const str = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '')
const num = (v: unknown, lo: number, hi: number, d: number, digits = 2) => {
  const n = Number(v)
  if (!Number.isFinite(n)) return d
  const f = 10 ** digits
  return Math.round(Math.max(lo, Math.min(hi, n)) * f) / f
}
const has = (v: unknown) => v !== undefined && v !== null && String(v) !== ''

/** 內建事件的快照（模組載入時） */
const snapshot: Record<MasterEventPool, MasterEventDef[]> = Object.fromEntries(POOL_IDS.map((p) => [p, clone(masterEventPool(p))])) as Record<MasterEventPool, MasterEventDef[]>

/** 內建的事件（和它在哪一個事件庫） */
export function builtinMasterEvent(id: string): MasterEventMod | undefined {
  for (const pool of POOL_IDS) {
    const e = snapshot[pool].find((x) => x.id === id)
    if (e) return { ...clone(e), pool }
  }
  return undefined
}

/** 目前所有的事件（套用自訂內容之後） */
export function allMasterEvents(): { pool: MasterEventPool; def: MasterEventDef }[] {
  return POOL_IDS.flatMap((pool) => masterEventPool(pool).map((def) => ({ pool, def })))
}

export function masterEventById(id: string): { pool: MasterEventPool; def: MasterEventDef } | undefined {
  return allMasterEvents().find((x) => x.def.id === id)
}

const masterTags = () => Object.keys(slaveryRules.master_tags.tags)
const lewdAbility = (id: unknown) => typeof id === 'string' && !!abilities[id]?.classes.includes('lewd')

function option(raw: Partial<MasterEventOption> | undefined, scene: boolean): MasterEventOption {
  const L = MASTER_EVENT_LIMITS
  const o: MasterEventOption = { label: str(raw?.label, L.label_chars) || '回應' }
  const c = raw?.check
  if (c && typeof c === 'object') {
    o.check = { attr: ATTR_IDS.includes(c.attr as AttrId) ? c.attr : 'cha', dc: Math.round(num(c.dc, 1, 40, 12)) }
    const success = str(raw?.success, L.result_chars)
    if (success) o.success = success
    const fail = str(raw?.fail, L.result_chars)
    if (fail) o.fail = fail
    const s = sanitizeEffects(raw?.effects_success)
    if (s.length) o.effects_success = s
    const f = sanitizeEffects(raw?.fail_effects)
    if (f.length) o.fail_effects = f
    if (raw?.stance === 'submit' || raw?.stance === 'resist') o.stance = raw.stance
  } else {
    const result = str(raw?.result, L.result_chars)
    if (result) o.result = result
  }
  const e = sanitizeEffects(raw?.effects)
  if (e.length) o.effects = e
  if (has(raw?.hours)) o.hours = num(raw?.hours, 0.25, 24, 1)
  if (raw?.learn) o.learn = true
  const a = raw?.adult_scene
  if (scene && (a === 'always' || (o.check && (a === 'success' || a === 'fail')))) o.adult_scene = a
  return o
}

/** 整理一個事件；pool 不對時放進主人的突發事件 */
export function sanitizeMasterEvent(id: string, raw: Partial<MasterEventMod>, custom: boolean): MasterEventMod {
  const L = MASTER_EVENT_LIMITS
  const pool: MasterEventPool = POOL_IDS.includes(raw.pool as MasterEventPool) ? raw.pool! : 'master'
  const out: MasterEventMod = {
    id, pool,
    weight: num(raw.weight, 0, 20, 1, 1),
    text: str(raw.text, L.text_chars),
    hours: num(raw.hours, 0.25, 24, 1),
    options: [],
  }
  const scene = str(raw.scene, L.scene_chars)
  if (scene) out.scene = scene
  out.options = (Array.isArray(raw.options) ? raw.options : []).slice(0, L.options).map((o) => option(o, !!scene))
  if (!out.options.length) out.options = [{ label: '照辦', result: '' }]
  if (has(raw.free_dc)) out.free_dc = Math.round(num(raw.free_dc, 5, 30, 13))
  if (raw.adult) out.adult = true
  if (has(raw.affinity_min)) out.affinity_min = Math.round(num(raw.affinity_min, -100, 100, 0))
  if (has(raw.affinity_max)) out.affinity_max = Math.round(num(raw.affinity_max, -100, 100, 0))
  const tags = [...new Set((raw.tags ?? []).filter((t) => masterTags().includes(t)))]
  if (tags.length) out.tags = tags
  const none = [...new Set((raw.tags_none ?? []).filter((t) => masterTags().includes(t)))]
  if (none.length) out.tags_none = none
  if (pool === MASTER_ONLY_POOL) {
    if (raw.cell === 'brothel') {
      out.cell = 'brothel'
      out.chance = num(raw.chance, 0, 1, 0.3)
    }
    if (raw.at_home === true || raw.at_home === false) out.at_home = raw.at_home
    if (raw.overdue) out.overdue = true
    if (raw.free_place) out.free_place = true
    if (raw.forced_gear) out.forced_gear = true
  }
  const teaches = [...new Set((raw.teaches ?? []).filter(lewdAbility))].slice(0, L.teaches)
  if (teaches.length) out.teaches = teaches
  const course = str(raw.course, 12)
  if (course && pool === 'owner') out.course = course
  if (has(raw.rank_min) && (pool === 'brothel_work' || pool === 'brothel_train')) out.rank_min = Math.round(num(raw.rank_min, 0, 10, 0))
  if (has(raw.progress) && pool === 'owner') out.progress = Math.round(num(raw.progress, 1, 10, 3))
  if (custom) out.custom = true
  return out
}

export function newMasterEvent(id: string, pool: MasterEventPool = 'master'): MasterEventMod {
  return sanitizeMasterEvent(id, {
    pool, weight: 2, hours: 1, text: pool === 'master' ? '{master}…' : '',
    options: [{ label: '照辦', result: '' }, { label: '討價還價', check: { attr: 'cha', dc: 13 }, stance: 'resist' }, { label: '拒絕', check: { attr: 'fai', dc: 15 }, stance: 'resist' }],
  }, true)
}

/** 把事件還原成內建的樣子（自建的拿掉） */
export function restoreMasterEvents() {
  for (const pool of POOL_IDS) masterEventPool(pool).splice(0, Infinity, ...clone(snapshot[pool]))
}

/** 套用一個事件：換掉同 id 的（可能換了事件庫），沒有就加在那個事件庫的最後 */
export function applyMasterEvent(id: string, m: MasterEventMod) {
  const { custom: _custom, pool, ...def } = clone(m)
  for (const p of POOL_IDS) {
    if (p === pool) continue
    const list = masterEventPool(p)
    const i = list.findIndex((x) => x.id === id)
    if (i >= 0) list.splice(i, 1)
  }
  const list = masterEventPool(pool)
  const i = list.findIndex((x) => x.id === id)
  if (i >= 0) list[i] = { ...def, id }
  else list.push({ ...def, id })
}

/** 只提醒、不擋的地方 */
export function masterEventWarnings(m: MasterEventMod): string[] {
  const out: string[] = []
  if (!m.text) out.push('沒有描述')
  if (!m.weight && !m.cell && !m.overdue) out.push('權重是 0：不會被抽到')
  if (m.options.some((o) => o.adult_scene) && !m.adult) out.push('有親密場景的回應，事件最好勾「成人向」（主角非自願關掉時不發生）')
  if ((m.pool === 'brothel_work' || m.pool === 'brothel_train') && !m.teaches?.length) out.push('娼館的事件沒有掛技能')
  if (m.pool !== 'master') out.push(`${MASTER_EVENT_POOLS[m.pool]}要到之後的版本（S5）才會發生`)
  return out
}
