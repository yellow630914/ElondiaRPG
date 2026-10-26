// 劇情計數器的自訂內容（內容頁籤「⭐ 特殊任務 → 🔢 劇情計數器」，說明見 docs/STORY_QUESTS.md 第 1.1 節）。
//
// - 內建的（data/rules/counters.json）可以修改名稱、說明、初始值與上下限，不能刪除；自建的沒有被使用時可以刪除。
// - 存檔裡的值存在 flags 的 count:<id>（storyFlags.ts 的 counterValue）。

import { npcs as namedNpcs, stories, storyCounters, type CounterDef, type StoryCond, type StoryOutcome } from './data'
import { travelEvents } from './road'

export interface CounterMod extends CounterDef {
  custom?: boolean
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const snapshot = clone(storyCounters)

export function builtinCounter(id: string): CounterDef | undefined {
  return snapshot[id] ? clone(snapshot[id]!) : undefined
}

export function restoreCounters() {
  for (const k of Object.keys(storyCounters)) delete storyCounters[k]
  Object.assign(storyCounters, clone(snapshot))
}

export function applyCounter(id: string, m: CounterMod) {
  const { custom: _custom, ...def } = clone(m)
  void _custom
  storyCounters[id] = def
}

const int = (v: unknown, lo: number, hi: number): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : undefined

export function sanitizeCounter(raw: Partial<CounterMod>, custom: boolean): CounterMod {
  const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, 20) : ''
  const desc = typeof raw.desc === 'string' ? raw.desc.trim().slice(0, 160) : ''
  let min = int(raw.min, -9999, 9999)
  let max = int(raw.max, -9999, 9999)
  if (min !== undefined && max !== undefined && min > max) [min, max] = [max, min]
  let initial = int(raw.initial, -9999, 9999) ?? 0
  if (min !== undefined) initial = Math.max(min, initial)
  if (max !== undefined) initial = Math.min(max, initial)
  return {
    name: name || '未命名的計數器',
    ...(desc ? { desc } : {}),
    ...(initial ? { initial } : {}),
    ...(min !== undefined ? { min } : {}),
    ...(max !== undefined ? { max } : {}),
    ...(custom ? { custom: true } : {}),
  }
}

export function newCounter(): CounterMod {
  return { name: '新的計數器', desc: '', custom: true }
}

const inCond = (c: StoryCond | undefined, id: string) => !!c?.counters && id in c.counters
const inOutcome = (o: StoryOutcome | undefined, id: string) => !!o?.counters && id in o.counters

/** 哪些地方用到這個計數器（刪除前檢查） */
export function counterUsage(id: string): string[] {
  const out: string[] = []
  for (const s of stories) {
    const used = inCond(s.start.requires, id) || s.nodes.some((n) => inCond(n.requires, id) || inOutcome(n.success, id) || inOutcome(n.fail, id)
      || (n.options ?? []).some((o) => inCond(o.requires, id) || inOutcome(o.success, id) || inOutcome(o.fail, id)))
    if (used) out.push(`特殊任務「${s.title}」`)
  }
  for (const t of travelEvents.templates) {
    const used = inCond(t.requires, id) || inOutcome(t.success, id) || inOutcome(t.fail, id)
      || (t.options ?? []).some((o) => inOutcome(o.success, id) || inOutcome(o.fail, id))
    if (used) out.push(`事件「${t.title}」`)
  }
  for (const n of namedNpcs) {
    if (inCond(n.requires, id) || (n.stages ?? []).some((st) => inCond(st.requires, id))) out.push(`固定 NPC「${n.name}」`)
  }
  return out
}
