import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { setContentFilters } from '@/engine/content'
import { companionRules } from '@/engine/data'
import { answerDungeonEvent, DEFAULT_LAYER_DC, dungeonCandidates, eventBaseDc, eventDc, dungeonTemplates, maybeDungeonEvent, pendingDungeonEvent, pruneDungeonEvent } from '@/engine/dungeonEvents'
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

/** 地下城事件 100% 發生、沒有冷卻 */
function always() {
  const mods = emptyMods()
  const r = builtinEventRules()
  mods.eventRules.rules = { ...r, dungeon: { ...r.dungeon, chance: { trap: 1, chest: 1, gather: 1, rest: 1 }, cooldown_hours: 0 } }
  applyContent(mods)
}

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
  it('are all adult, for feminine and androgynous heroes, with a way out and a scene', () => {
    const list = dungeonTemplates()
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
    expect(dungeonCandidates(inDungeon('masc'), area, 'trap')).toEqual([])
    setContentFilters({ pc_unwilling: false })
    const willing = dungeonCandidates(fem, area, 'rest')
    expect(willing.length).toBeGreaterThan(0)
    expect(willing.every((t) => !t.tags?.includes('pc_unwilling'))).toBe(true)
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
