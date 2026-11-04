import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { setContentFilters } from '@/engine/content'
import { companionRules } from '@/engine/data'
import { acceptTrapLure, answerDungeonEvent, declineTrapLure, DEFAULT_LAYER_DC, dungeonCandidates, dungeonEventWeight, eventBaseDc, FRESH_DAYS, FULL_POOL, eventDc, dungeonTemplates, maybeDungeonEvent, pendingDungeonEvent, pruneDungeonEvent } from '@/engine/dungeonEvents'
import { cellAt, currentArea, DUNGEON_LAYERS, enterLocation, move } from '@/engine/grid'
import { applyContent, emptyMods } from '@/engine/mods'
import { longRestBlocked } from '@/engine/rest'
import { travelEvents } from '@/engine/road'
import { newGame } from '@/engine/state'
import { arriveAt } from './helpers/travel'
import { builtinEventRules, sanitizeTravelEvent } from '@/engine/travelEventMods'
import type { GameState } from '@/engine/types'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})
afterEach(() => {
  applyContent(emptyMods())
  setContentFilters({ pc_unwilling: true })
})

function inDungeon(body: 'fem' | 'andro' | 'masc' = 'fem', seed = 3): GameState {
  const state = newGame({ name: '艾琳', race: 'human', classId: 'rogue', seed, gender: body === 'masc' ? '男' : '女', body })
  enterLocation(state)
  arriveAt(state, 'snake_creek')
  return state
}

/** 地下城事件 100% 發生、沒有冷卻；normal 沒開時只留成人向的事件（普通的事件加上不會成立的條件） */
function always(normal = false) {
  const mods = emptyMods()
  const r = builtinEventRules()
  mods.eventRules.rules = { ...r, dungeon: { ...r.dungeon, chance: { trap: 1, chest: 1, gather: 1, rest: 1 }, cooldown_hours: 0 } }
  if (!normal) mods.travelEvents = Object.fromEntries(dungeonTemplates().filter((t) => !t.tags?.includes('adult')).map((t) => [t.id, { ...t, requires: { flags: ['test_never'] } }])) as never
  applyContent(mods)
}

const isAdult = (t: { tags?: string[] }) => !!t.tags?.includes('adult')

/** 站到一格空地上，旁邊一格空地換成 cell，回傳方向 */
function besides(state: GameState, cell: object): [number, number] {
  const area = currentArea(state)
  for (let i = 0; i < area.cells.length; i++) {
    if (area.cells[i]!.kind !== 'floor') continue
    const x = i % area.width
    const y = Math.floor(i / area.width)
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      if (cellAt(area, x + dx, y + dy)?.kind !== 'floor') continue
      state.position = { area: area.key, x, y }
      area.cells[(y + dy) * area.width + x + dx] = cell as never
      return [dx, dy]
    }
  }
  throw new Error('no free floor')
}

describe('dungeon adult events', () => {
  it('the adult ones are for feminine and androgynous heroes, with a way out and a scene', () => {
    const list = dungeonTemplates().filter(isAdult)
    expect(list.length).toBeGreaterThanOrEqual(25)
    for (const t of list) {
      expect(t.tags, t.id).toContain('adult')
      expect(t.pc_body, t.id).toEqual(['fem', 'andro'])
      expect(t.triggers?.length, t.id).toBeGreaterThan(0)
      expect(t.scene, t.id).toBeTruthy()
      expect(t.options?.length, t.id).toBe(3)
      // 一定有一個檢定可以躲開，也一定有一個會進入親密場景
      expect(t.options!.some((o) => o.check && o.fail), t.id).toBe(true)
      expect(t.options!.some((o) => o.adult_scene), t.id).toBe(true)
      for (const o of t.options!) {
        for (const e of [...(o.success?.effects ?? []), ...(o.fail?.effects ?? [])]) {
          if (e.type === 'condition') expect(companionRules.conditions[e.condition], `${t.id} ${e.condition}`).toBeTruthy()
        }
      }
      // 內容編輯器整理後不會掉欄位
      const clean = sanitizeTravelEvent(t.id, t, false)
      expect(clean.triggers).toEqual(t.triggers)
      expect(clean.tags).toEqual(t.tags)
      expect(clean.pc_body).toEqual(t.pc_body)
      expect(clean.options!.map((o) => o.adult_scene)).toEqual(t.options!.map((o) => o.adult_scene))
    }
  })

  it('only happen to feminine or androgynous heroes and respect the unwilling filter', () => {
    const fem = inDungeon('fem')
    const area = currentArea(fem)
    expect(dungeonCandidates(fem, area, 'trap').length).toBeGreaterThan(0)
    expect(dungeonCandidates(inDungeon('andro'), area, 'trap').length).toBeGreaterThan(0)
    // 陽剛體型只遇到普通的事件
    const masc = dungeonCandidates(inDungeon('masc'), area, 'trap')
    expect(masc.length).toBeGreaterThan(0)
    expect(masc.some(isAdult)).toBe(false)
    setContentFilters({ pc_unwilling: false })
    const willing = dungeonCandidates(fem, area, 'rest')
    expect(willing.length).toBeGreaterThan(0)
    expect(willing.every((t) => !t.tags?.includes('pc_unwilling'))).toBe(true)
  })

  it('has as many normal events as adult ones, for every hero, most of them for gathering', () => {
    const all = dungeonTemplates()
    const normal = all.filter((t) => !isAdult(t))
    expect(normal.length).toBe(all.filter(isAdult).length)
    expect(normal.filter((t) => t.triggers?.includes('gather')).length).toBeGreaterThanOrEqual(18)
    for (const t of normal) {
      expect(t.tags ?? [], t.id).toEqual([])
      expect(t.pc_body, t.id).toBeUndefined()
      expect(t.scene, t.id).toBeUndefined()
      expect(t.options!.every((o) => !o.adult_scene), t.id).toBe(true)
      for (const o of t.options!) {
        for (const e of [...(o.success?.effects ?? []), ...(o.fail?.effects ?? [])]) {
          if (e.type === 'condition') expect(companionRules.conditions[e.condition], `${t.id} ${e.condition}`).toBeTruthy()
        }
      }
    }
    // 一般地下城的周邊採集時，普通的事件也抽得到（不再只有淫泉和春宮書）
    const state = inDungeon('masc')
    expect(dungeonCandidates(state, currentArea(state), 'gather').length).toBeGreaterThanOrEqual(FULL_POOL)
  })

  it('weighs adult events up with the save rule', () => {
    const adultShare = (mult: number) => {
      const mods = emptyMods()
      const r = builtinEventRules()
      mods.eventRules.rules = { ...r, dungeon: { ...r.dungeon, chance: { trap: 0.1, chest: 0.1, gather: 0.1, rest: 0.1 }, cooldown_hours: 0 } }
      applyContent(mods)
      const state = inDungeon('fem', 11)
      state.options = { ...state.options!, adultDungeonMult: mult }
      let adult = 0
      let total = 0
      for (let i = 0; i < 400; i++) {
        if (maybeDungeonEvent(state, 'trap')) {
          total++
          if (isAdult(pendingDungeonEvent(state)!)) adult++
        }
        delete state.dungeonEvent
        state.dungeonEvents = { seen: {} }
      }
      return { adult, total }
    }
    const one = adultShare(1)
    const eight = adultShare(8)
    expect(eight.adult).toBeGreaterThan(one.adult * 2)
    expect(eight.total).toBeGreaterThan(one.total)
  })

  it('lets the hero set off a spotted trap on purpose when the save rule allows it', () => {
    always(true)
    const state = inDungeon('fem')
    const layer = DUNGEON_LAYERS[currentArea(state).layer ?? 0]!
    const dc = layer.trap_dc
    layer.trap_dc = -99
    try {
      // 規則沒開：察覺了就繞過去
      let [dx, dy] = besides(state, { kind: 'trap' })
      move(state, dx, dy)
      expect(state.trapLure).toBeUndefined()
      // 規則開著：問要不要觸發，先回答才能走
      state.options = { ...state.options!, trapLure: true }
      ;[dx, dy] = besides(state, { kind: 'trap' })
      const step = move(state, dx, dy)
      expect(step.report?.outcome.summary).toContain('要不要主動觸發')
      expect(state.trapLure).toBeTruthy()
      expect(() => move(state, -dx, -dy)).toThrow('察覺到的陷阱')
      expect(longRestBlocked(state, 'safe')).toContain('察覺到的陷阱')
      declineTrapLure(state)
      expect(state.trapLure).toBeUndefined()
      expect(state.dungeonEvent).toBeUndefined()
      // 主動觸發：遇到一件陷阱的事件
      ;[dx, dy] = besides(state, { kind: 'trap' })
      move(state, dx, dy)
      expect(acceptTrapLure(state)).toBe(true)
      expect(state.trapLure).toBeUndefined()
      expect(pendingDungeonEvent(state)?.triggers).toContain('trap')
    } finally {
      layer.trap_dc = dc
    }
  })

  it('springs from an undetected trap instead of trap damage, blocks moving and resting until answered', () => {
    always()
    const state = inDungeon('fem')
    const layer = DUNGEON_LAYERS[currentArea(state).layer ?? 0]!
    const dc = layer.trap_dc
    layer.trap_dc = 99
    try {
      const [dx, dy] = besides(state, { kind: 'trap' })
      const hp = state.party[0]!.hp
      const step = move(state, dx, dy)
      expect(step.report?.outcome.summary).toContain('機關對準的是你')
      expect(state.party[0]!.hp).toBe(hp)
      const t = pendingDungeonEvent(state)!
      expect(t.triggers).toContain('trap')
      expect(() => move(state, -dx, -dy)).toThrow('先應付眼前的處境')
      expect(longRestBlocked(state, 'safe')).toBe('先應付眼前的處境')
      // 屈服的回應：一定進入親密場景
      const i = t.options!.findIndex((o) => o.adult_scene === 'always')
      const report = answerDungeonEvent(state, i)
      expect(report.outcome.tags).toContain('地下城事件')
      expect(report.narration!.adult_scene).toBe(t.scene)
      expect(state.dungeonEvent).toBeUndefined()
      expect(() => move(state, -dx, -dy)).not.toThrow()
    } finally {
      layer.trap_dc = dc
    }
  })

  it('turns a chest into a mimic: the chest does not open, the answer decides the loot', () => {
    always()
    const state = inDungeon('fem')
    // 擬態寶箱在淺層以下（周邊沒有）
    currentArea(state).layer = 1
    const [dx, dy] = besides(state, { kind: 'chest', level: 1 })
    const step = move(state, dx, dy)
    expect(step.report?.outcome.summary ?? '').toBe('')
    const t = pendingDungeonEvent(state)!
    expect(t.triggers).toContain('chest')
    const money = state.money_cc
    // 屈服的回應：寶箱裡的東西看事件（擬態寶箱吐出錢，受詛咒的內衣沒有）
    const i = t.options!.findIndex((o) => o.adult_scene === 'always')
    const gain = (t.options![i]!.success?.effects ?? []).some((e) => e.type === 'money')
    answerDungeonEvent(state, i)
    if (gain) expect(state.money_cc).toBeGreaterThan(money)
    else expect(state.money_cc).toBe(money)
  })

  it('waits out the cooldown and does not repeat the same event within a few days', () => {
    const state = inDungeon('fem')
    const mods = emptyMods()
    const r = builtinEventRules()
    mods.eventRules.rules = { ...r, dungeon: { ...r.dungeon, chance: { trap: 1, chest: 1, gather: 1, rest: 1 }, cooldown_hours: 6 } }
    applyContent(mods)
    expect(maybeDungeonEvent(state, 'rest')).toBe(true)
    const first = state.dungeonEvent!.template
    answerDungeonEvent(state, 0)
    expect(maybeDungeonEvent(state, 'rest')).toBe(false)
    state.time = { ...state.time, hour: state.time.hour + 7 }
    const area = currentArea(state)
    expect(dungeonCandidates(state, area, 'rest').some((t) => t.id === first)).toBe(false)
  })

  it('keeps the spring and the book from showing up every time you gather', () => {
    const spring = travelEvents.templates.find((t) => t.id === 'dg_lewd_spring')!
    const book = travelEvents.templates.find((t) => t.id === 'dg_erotic_book')!
    expect(spring.cooldown_days).toBe(10)
    expect(book.cooldown_days).toBe(10)
    // 剛出現過的權重低，隔得越久越高
    const state = inDungeon('fem')
    expect(dungeonEventWeight(state, 'dg_lewd_spring')).toBe(1)
    state.dungeonEvents = { seen: { dg_lewd_spring: state.time.day } }
    expect(dungeonEventWeight(state, 'dg_lewd_spring')).toBeCloseTo(0.2)
    state.time = { ...state.time, day: state.time.day + FRESH_DAYS }
    expect(dungeonEventWeight(state, 'dg_lewd_spring')).toBe(1)
    // 採集可抽的事件少時機率照比例調低：只有一件可抽時，機率 1 也大約只有 1/FULL_POOL 會發生
    const mods = emptyMods()
    const r = builtinEventRules()
    mods.eventRules.rules = { ...r, dungeon: { ...r.dungeon, chance: { trap: 1, chest: 1, gather: 1, rest: 1 }, cooldown_hours: 0, repeat_days: 0 } }
    // 只留淫泉可以在採集時抽（這裡是周邊：拿掉層數的限制）
    mods.travelEvents = Object.fromEntries(dungeonTemplates().map((t) => [t.id, t.id === 'dg_lewd_spring' ? { ...t, layers: undefined } : { ...t, triggers: ['trap'] }])) as never
    applyContent(mods)
    const area = currentArea(state)
    const only = dungeonCandidates(state, area, 'gather')
    expect(only.map((t) => t.id)).toEqual(['dg_lewd_spring'])
    let hits = 0
    for (let i = 0; i < 200; i++) {
      if (maybeDungeonEvent(state, 'gather')) hits++
      delete state.dungeonEvent
      state.dungeonEvents = { seen: {} }
    }
    expect(hits).toBeGreaterThan(200 / FULL_POOL / 2)
    expect(hits).toBeLessThan(200 / FULL_POOL * 1.6)
  })

  it('drops a pending event whose template the content no longer has', () => {
    const state = inDungeon('fem')
    state.dungeonEvent = { template: 'dg_gone', trigger: 'trap' }
    pruneDungeonEvent(state)
    expect(state.dungeonEvent).toBeUndefined()
    expect(travelEvents.dungeon?.chance.trap).toBeGreaterThan(0)
  })

  it('scale check DCs by layer: the written DC is an offset from 14, plus the save rule', () => {
    const state = inDungeon()
    const area = currentArea(state)
    const layer = area.kind === 'dungeon' ? area.layer ?? 0 : 0
    const base = (travelEvents.dungeon?.dc ?? DEFAULT_LAYER_DC)[layer]!
    const t = { scope: 'dungeon' as const }
    expect(eventBaseDc(state, t)).toBe(base)
    expect(eventDc(state, t, 14)).toBe(base)
    expect(eventDc(state, t, 12)).toBe(base - 2)
    state.options = { ...state.options!, eventDc: 3 }
    expect(eventDc(state, t, 16)).toBe(base + 5)
    // 旅途與城鎮事件不受影響
    expect(eventDc(state, { scope: 'town' }, 13)).toBe(13)
    expect(travelEvents.dungeon?.dc).toEqual([11, 13, 14, 16, 18])
  })
})
