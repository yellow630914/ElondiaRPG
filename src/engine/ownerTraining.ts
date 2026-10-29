// 調教（成人向；主角對自己的奴隸，docs/LEWD_STATS.md 第 9 節）：
// 選一個課程，從 slavery.json 的 owner_events 抽一件同課程的事件（主人事件格式），主角從回應裡選一個、自己擲檢定。
// DC 減去奴隸的順從、親密度很低時變難；成功時套用課程的指標與親密度，同一課程成功幾次保證學會這個課程的一個技能；
// 失敗而且親密度很低時反彈（親密度再降、記一段怨恨的記憶）。規則與數值在 data/rules/lewd.json 的 training。

import { abilities, lewdRules, masterEventPool, type LewdKey, type MasterEventDef } from './data'
import { addLewd } from './lewd'
import { addAffinity, pcOf } from './party'
import { addMemory } from './social'
import { teachAbility } from './effects'
import { withRng } from './state'
import { contractOf } from './tattoos'
import type { Character, GameState, PendingMasterEvent, Report } from './types'

const rules = () => lewdRules.training

export function courseIds(): string[] {
  return Object.keys(rules().courses)
}

export function courseName(id: string): string {
  return rules().courses[id]?.name ?? id
}

/** 可以調教的人：主角自己的奴隸（在隊伍裡、沒有暫時離隊） */
export function trainees(state: GameState): Character[] {
  return state.party.filter((m) => m.bond === 'slave' && contractOf(m)?.master === pcOf(state).id && !m.status.includes('away'))
}

/** 這個課程有事件可以抽（內容編輯器可能刪光了） */
export function courseEvents(course: string): MasterEventDef[] {
  return masterEventPool('owner').filter((e) => e.course === course && e.weight > 0)
}

/** 課程掛的技能（所有同課程的事件） */
export function courseTeaches(course: string): string[] {
  return [...new Set(masterEventPool('owner').filter((e) => e.course === course).flatMap((e) => e.teaches ?? []))].filter((id) => abilities[id]?.classes.includes('lewd'))
}

/** 不能調教的原因（可以時是 undefined） */
export function trainingBlocked(state: GameState, slave: Character | undefined, course: string): string | undefined {
  if (!slave || !trainees(state).includes(slave)) return '隊伍裡沒有這位奴隸'
  if (state.combat || state.pendingAction || state.pendingMasterEvent || state.pendingMark || state.standoff) return '現在不能這麼做'
  if (!rules().courses[course]) return '沒有這個課程'
  if (!courseEvents(course).length) return `「${courseName(course)}」沒有可以進行的調教事件`
  return undefined
}

/** 開始一次調教：抽一件這個課程的事件，等主角選做法 */
export function startTraining(state: GameState, slaveId: string, course: string): PendingMasterEvent {
  const slave = state.party.find((m) => m.id === slaveId)
  const why = trainingBlocked(state, slave, course)
  if (why) throw new Error(why)
  const list = courseEvents(course)
  const e = withRng(state, (rng) => {
    let r = rng.next() * list.reduce((s, x) => s + x.weight, 0)
    return list.find((x) => (r -= x.weight) < 0) ?? list[list.length - 1]!
  })
  state.pendingMasterEvent = { id: e.id, pool: 'owner', actor: slave!.id, text: e.text.split('{actor}').join(slave!.name).split('{master}').join(slave!.name) }
  return state.pendingMasterEvent
}

/** 調教檢定的修正：奴隸越順從越容易，親密度很低時變難 */
export function trainingDcMods(state: GameState, slave: Character): { label: string; value: number }[] {
  const r = rules()
  const sub = Math.floor((slave.lewd?.submission ?? lewdRules.defaults.submission) / r.sub_div)
  const aff = state.relationships?.[slave.id]?.affinity ?? 0
  return [
    ...(sub ? [{ label: `${slave.name}的順從`, value: sub }] : []),
    ...(aff < r.low_affinity ? [{ label: '親密度很低', value: -r.low_dc }] : []),
  ]
}

/** 調教的結果：課程的指標與親密度、進度與保證學會的技能、反彈 */
export function afterTraining(state: GameState, report: Report, slave: Character, e: MasterEventDef, ok: boolean): string[] {
  const r = rules()
  const course = e.course ? r.courses[e.course] : undefined
  const notes: string[] = []
  if (!course || !e.course) return notes
  if (ok) {
    for (const [k, v] of Object.entries(course.stats)) if (v) addLewd(state, slave, k as LewdKey, v, report)
    if (course.affinity) addAffinity(state, report, slave.id, course.affinity, `${course.name}的調教`)
    const progress = (slave.trainProgress ??= {})
    progress[e.course] = (progress[e.course] ?? 0) + 1
    const need = e.progress ?? r.progress
    if (progress[e.course]! >= need) {
      const open = courseTeaches(e.course).filter((id) => !slave.abilities.includes(id))
      if (open.length) {
        notes.push(teachAbility(state, report, slave, withRng(state, (rng) => rng.pick(open))))
        progress[e.course] = 0
      }
    }
    return notes
  }
  // 反彈：親密度很低時，失敗的調教留下怨恨
  const aff = state.relationships?.[slave.id]?.affinity ?? 0
  if (aff < r.backlash_affinity) {
    addAffinity(state, report, slave.id, r.backlash_delta, '調教失敗，心生怨恨')
    addMemory(state, {
      time: { ...report.time.start }, location: report.location.at, participants: ['pc', slave.id], report: report.report_id,
      summary: `${pcOf(state).name}的「${course.name}」調教讓${slave.name}心生怨恨`, importance: 2,
    })
    notes.push(`${slave.name}看你的眼神多了一分怨恨`)
  }
  return notes
}

/** 角色詳情的說明：每個課程的進度與還沒學的技能 */
export function courseStatus(slave: Character): { id: string; name: string; desc: string; progress: number; need: number; open: string[] }[] {
  return courseIds().map((id) => ({
    id, name: courseName(id), desc: rules().courses[id]!.desc,
    progress: slave.trainProgress?.[id] ?? 0, need: rules().progress,
    open: courseTeaches(id).filter((x) => !slave.abilities.includes(x)).map((x) => abilities[x]!.name),
  }))
}
