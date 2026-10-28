import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { enterLocation, move, standOn } from '@/engine/grid'
import { applyContent, emptyMods, normalizeMods } from '@/engine/mods'
import { pruneRoadEvent, travelEvents } from '@/engine/road'
import { newGame } from '@/engine/state'
import { setFlag } from '@/engine/storyFlags'
import { answerTownEvent, maybeTownEvent, pendingTownEvent, pruneTownEvent, townCandidates, townWeight } from '@/engine/townEvents'
import { builtinEventRules, newTravelEvent, sanitizeTravelEvent } from '@/engine/travelEventMods'
import type { GameState } from '@/engine/types'
import { currentArea } from '@/engine/grid'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})
afterEach(() => {
  applyContent(emptyMods())
})

function inTown(location = 'soriel', seed = 4): GameState {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed, birthplace: location })
  enterLocation(state)
  return state
}

/** 只留一個城鎮事件，機率 100%、沒有冷卻 */
function only(id: string) {
  const mods = emptyMods()
  for (const t of travelEvents.templates) if (t.scope === 'town' && t.id !== id) mods.travelEvents[t.id] = { ...t, requires: { flags: ['never'] } }
  mods.eventRules.rules = { ...builtinEventRules(), town: { ...builtinEventRules().town, chance: 1, cooldown_hours: 0 } }
  applyContent(mods)
}

describe('town events', () => {
  it('fires a choice event on a matching facility and waits for an answer', () => {
    only('tavern_free_round')
    const state = inTown()
    expect(standOn(state, 'tavern')).toBe(true)
    expect(maybeTownEvent(state)).toEqual({})
    expect(pendingTownEvent(state)?.id).toBe('tavern_free_round')
    // 回應之前不能走
    expect(() => move(state, 1, 0)).toThrow('先決定')
    const money = state.money_cc
    const report = answerTownEvent(state, 0)
    expect(report.outcome.tags).toContain('城鎮事件')
    expect(state.money_cc).toBe(money - 40)
    expect(state.townEvent).toBeUndefined()
  })

  it('reveals a check event right away', () => {
    only('bard_rumor')
    const state = inTown()
    standOn(state, 'tavern')
    const r = maybeTownEvent(state)
    expect(r.report?.outcome.summary).toContain('吟遊詩人')
    expect(state.townEvent).toBeUndefined()
  })

  it('takes only what the hero has when an event asks for more money than that', () => {
    only('town_frisk')
    const state = inTown('soriel')
    state.townEvent = { template: 'town_frisk' }
    state.money_cc = 10
    const r = answerTownEvent(state, 1)
    expect(r.changes.money_cc).toBe(-10)
    expect(state.money_cc).toBe(0)
  })

  it('only offers events that fit the facility, settlement type and flags', () => {
    const state = inTown('soriel')
    const area = currentArea(state)
    const ids = (cell: string) => townCandidates(state, area, cell).map((t) => t.id)
    expect(ids('temple')).toContain('temple_alms')
    expect(ids('temple')).not.toContain('tavern_arm_wrestle')
    // 村莊限定
    expect(ids('inn')).not.toContain('village_harvest')
    const t = travelEvents.templates.find((x) => x.id === 'guild_novice')!
    t.requires = { flags: ['met_novice'] }
    expect(ids('guild')).not.toContain('guild_novice')
    setFlag(state, 'met_novice')
    expect(ids('guild')).toContain('guild_novice')
  })

  it('keeps a cooldown between events and does not repeat the same one soon', () => {
    only('tavern_free_round')
    const state = inTown()
    standOn(state, 'tavern')
    maybeTownEvent(state)
    answerTownEvent(state, 1)
    // 同一個事件 repeat_days 天內不再出現
    expect(townCandidates(state, currentArea(state), 'tavern').map((t) => t.id)).not.toContain('tavern_free_round')
    state.time.day += travelEvents.town.repeat_days
    expect(townCandidates(state, currentArea(state), 'tavern').map((t) => t.id)).toContain('tavern_free_round')
    // 兩次事件之間的冷卻
    travelEvents.town.cooldown_hours = 12
    state.townEvents!.last = state.time.day * 24 + (state.time.hour ?? 0)
    expect(maybeTownEvent(state)).toEqual({})
    expect(state.townEvent).toBeUndefined()
  })

  it('lowers the weight of categories seen recently', () => {
    const state = inTown()
    const social = travelEvents.templates.find((t) => t.id === 'temple_alms')!
    const omen = travelEvents.templates.find((t) => t.id === 'temple_omen')!
    state.townEvents = { seen: {}, recent: ['social', 'social'] }
    expect(townWeight(state, social)).toBeCloseTo(travelEvents.town.recent_penalty ** 2)
    expect(townWeight(state, omen)).toBe(1)
  })

  it('drops a pending event whose template was deleted', () => {
    const state = inTown()
    state.townEvent = { template: 'mod_event_gone' }
    pruneTownEvent(state)
    expect(state.townEvent).toBeUndefined()
    state.roadEvent = { x: 0, template: 'mod_event_gone' }
    pruneRoadEvent(state)
    expect(state.roadEvent).toBeUndefined()
  })
})

describe('travel event mods', () => {
  it('sanitizes events: town events are never advanced, quest-only outcome fields go away', () => {
    const t = sanitizeTravelEvent('mod_event_x', {
      scope: 'town', tier: 'advanced', kind: 'choice', title: '測試', text: '一件事', cells: ['tavern', 'nope'], location_types: ['village', 'dungeon' as never],
      options: [{ label: '好', success: { text: '好', complete: true, join: 'lina', effects: [{ type: 'money', amount: 10 }] } }],
    }, true)
    expect(t.tier).toBe('normal')
    expect(t.cells).toEqual(['tavern'])
    expect(t.location_types).toEqual(['village'])
    expect(t.options![0]!.success).toEqual({ text: '好', effects: [{ type: 'money', amount: 10 }] })
    expect(t.custom).toBe(true)
    // 選擇的事件至少一個選項
    expect(sanitizeTravelEvent('mod_event_y', { kind: 'choice', options: [] }, true).options).toHaveLength(1)
  })

  it('applies custom events and rules, and restores the built-in ones', () => {
    const before = travelEvents.templates.length
    const mods = emptyMods()
    mods.travelEvents.mod_event_new = newTravelEvent('mod_event_new', 'town')
    mods.travelEvents.stuck_wagon = { ...travelEvents.templates.find((t) => t.id === 'stuck_wagon')!, title: '改過的馬車' }
    mods.eventRules.rules = { ...builtinEventRules(), chance: { ...builtinEventRules().chance, road: 0.9 } }
    applyContent(normalizeMods(mods))
    expect(travelEvents.templates).toHaveLength(before + 1)
    expect(travelEvents.templates.find((t) => t.id === 'stuck_wagon')!.title).toBe('改過的馬車')
    expect(travelEvents.chance.road).toBe(0.9)
    applyContent(emptyMods())
    expect(travelEvents.templates).toHaveLength(before)
    expect(travelEvents.templates.find((t) => t.id === 'stuck_wagon')!.title).toBe('陷在泥裡的馬車')
    expect(travelEvents.chance.road).toBe(0.3)
  })

  it('every built-in event survives its own sanitizer unchanged', () => {
    for (const t of travelEvents.templates) {
      expect(sanitizeTravelEvent(t.id, t, false), t.id).toEqual(t)
    }
  })
})

describe('adult town events', () => {
  const ADULT = ['town_frisk', 'town_drugged_drink', 'town_gamble_price', 'town_pickup', 'town_grope']
  const female = (location = 'albena') => {
    const state = newGame({ name: '艾琳', race: 'human', classId: 'rogue', seed: 4, birthplace: location, gender: '女', body: 'fem' })
    enterLocation(state)
    return state
  }

  it('are adult, male-partner events for feminine and androgynous heroes with a scene on every yielding option', () => {
    for (const id of ADULT) {
      const t = travelEvents.templates.find((x) => x.id === id)!
      expect(t.scope).toBe('town')
      expect(t.tags, id).toContain('adult')
      expect(t.tags, id).toContain('male_partner')
      expect(t.pc_body, id).toEqual(['fem', 'andro'])
      expect(t.scene, id).toBeTruthy()
      expect(t.options!.at(-1)!.adult_scene, id).toBe('always')
    }
  })

  it('only show up for the right body', () => {
    const state = female()
    const ids = () => townCandidates(state, currentArea(state), 'tavern').map((t) => t.id)
    expect(ids()).toContain('town_drugged_drink')
    expect(ids()).toContain('town_gamble_price')
    const man = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 4, birthplace: 'albena', gender: '男', body: 'masc' })
    enterLocation(man)
    expect(townCandidates(man, currentArea(man), 'tavern').map((t) => t.id)).not.toContain('town_drugged_drink')
  })

  it('hand the scene to the narration when the hero gives in', () => {
    only('town_drugged_drink')
    const state = female()
    expect(standOn(state, 'tavern')).toBe(true)
    maybeTownEvent(state)
    expect(pendingTownEvent(state)?.id).toBe('town_drugged_drink')
    const report = answerTownEvent(state, 2)
    expect(report.narration?.adult_scene).toBe(travelEvents.templates.find((x) => x.id === 'town_drugged_drink')!.scene)
    expect(report.changes.conditions?.map((c) => c.condition)).toContain('aroused')
  })
})
