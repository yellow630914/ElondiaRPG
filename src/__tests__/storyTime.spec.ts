import { afterEach, describe, expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020'
import schema from '../../schemas/report.schema.json'
import { enterLocation, standOn } from '@/engine/grid'
import { applyContent, emptyMods, normalizeMods } from '@/engine/mods'
import { applyRoadOutcome } from '@/engine/road'
import { newGame } from '@/engine/state'
import { blockingNode, nodesHere, nodesWaitingForTime, placeText, playNode, startStory, waitForNode } from '@/engine/story'
import { sanitizeOutcome, sanitizeStory, type StoryMod } from '@/engine/storyMods'
import { hoursUntil, jumpFrom } from '@/engine/timeOfDay'
import { baseReport } from '@/engine/town'
import type { GameState, Report } from '@/engine/types'

const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema)
const valid = (r: Report) => expect(validate(r), JSON.stringify(validate.errors)).toBe(true)

afterEach(() => applyContent(emptyMods()))

function game(hour = 10): GameState {
  const state = newGame({ name: '測試者', race: 'human', classId: 'fighter', seed: 7, birthplace: 'soriel' })
  enterLocation(state)
  state.time = { day: 1, hour, minute: 0 }
  return state
}

/** 酒館裡的夜會：只在夜裡進行，結束後到隔天早上；接著是公會的報告（推到夜裡） */
const tryst: StoryMod = {
  id: 'tryst', title: '月下之約', summary: '', start: { kind: 'guild', location: 'soriel' }, start_flags: ['t_started'], custom: true,
  nodes: [
    { id: 'meet', title: '月下碰面', text: '', at: { where: 'cell', location: 'soriel', cell: 'tavern' }, kind: 'story', hours: 'night', requires: { flags: ['t_started'] }, success: { set_flags: ['t_met'], time: { until: 'morning' } } },
    { id: 'report', title: '回公會', text: '', at: { where: 'cell', location: 'soriel', cell: 'guild' }, kind: 'story', requires: { flags: ['t_met'] }, success: { complete: true, time: { hours: 2, until: 'night' } } },
  ],
}

function withTryst() {
  applyContent(normalizeMods({ ...emptyMods(), stories: { tryst } }))
}

describe('time of day helpers', () => {
  it('counts the hours to the next night or morning, never backwards', () => {
    expect(hoursUntil({ day: 1, hour: 10, minute: 0 }, 'night')).toBe(10)
    expect(hoursUntil({ day: 1, hour: 22, minute: 0 }, 'night')).toBe(0)
    expect(hoursUntil({ day: 1, hour: 3, minute: 0 }, 'night')).toBe(0)
    expect(hoursUntil({ day: 1, hour: 22, minute: 30 }, 'morning')).toBe(9.5)
    expect(hoursUntil({ day: 1, hour: 3, minute: 0 }, 'morning')).toBe(5)
    expect(hoursUntil({ day: 1, hour: 9, minute: 0 }, 'morning')).toBe(23)
    expect(jumpFrom({ day: 1, hour: 10, minute: 0 }, { hours: 30, until: 'night' })).toEqual({ day: 2, hour: 20, minute: 0 })
    expect(jumpFrom({ day: 1, hour: 10, minute: 0 }, { hours: 9999 })).toEqual({ day: 11, hour: 10, minute: 0 })
  })

  it('keeps the new fields when saving and drops bad values', () => {
    expect(sanitizeOutcome({ time: { hours: 3.4, until: 'morning' } })?.time).toEqual({ hours: 3, until: 'morning' })
    expect(sanitizeOutcome({ time: { hours: -2, until: 'noon' } })?.time).toBeUndefined()
    const s = sanitizeStory('tryst', tryst, true)
    expect(s.nodes[0]!.hours).toBe('night')
    expect(s.nodes[0]!.success?.time).toEqual({ until: 'morning' })
    expect(sanitizeStory('x', { ...tryst, nodes: [{ ...tryst.nodes[0]!, hours: 'noon' as never }] }, true).nodes[0]!.hours).toBeUndefined()
  })
})

describe('story nodes only at night or by day', () => {
  it('does not pop up or block by day, offers to wait, then plays at night', () => {
    withTryst()
    const state = game(10)
    startStory(state, 'tryst')
    standOn(state, 'tavern')
    expect(nodesHere(state)).toEqual([])
    expect(blockingNode(state)).toBeUndefined()
    expect(nodesWaitingForTime(state).map((n) => n.ref)).toEqual(['tryst:meet'])
    expect(() => playNode(state, 'tryst:meet')).toThrow('要在任務點')
    expect(placeText(tryst.nodes[0]!)).toContain('只在夜裡')

    const waited = waitForNode(state, 'tryst:meet')
    valid(waited)
    expect(state.time).toMatchObject({ day: 1, hour: 20, minute: 0 })
    expect(nodesHere(state).map((n) => n.ref)).toEqual(['tryst:meet'])
    expect(nodesWaitingForTime(state)).toEqual([])
    expect(() => waitForNode(state, 'tryst:meet')).toThrow('現在就可以')
  })

  it('moves the clock forward when the outcome says so', () => {
    withTryst()
    const state = game(22)
    startStory(state, 'tryst')
    standOn(state, 'tavern')
    const r1 = playNode(state, 'tryst:meet') as Report
    valid(r1)
    // 任務點本身 1 小時（23 點），再推到隔天早上 8 點
    expect(state.time).toMatchObject({ day: 2, hour: 8, minute: 0 })
    expect(r1.outcome.summary).toContain('第 2 天 08:00')
    expect(r1.narration?.focus?.join()).toContain('時間的流逝')

    standOn(state, 'guild')
    playNode(state, 'tryst:report')
    // 9 點 + 2 小時 = 11 點，再推到夜裡 20 點
    expect(state.time).toMatchObject({ day: 2, hour: 20, minute: 0 })
    expect(state.stories?.tryst?.status).toBe('completed')
  })
})

describe('event outcomes', () => {
  it('moves the clock in town, but not on the road', () => {
    const state = game(9)
    const report = baseReport(state, 'event', 1)
    const lines = applyRoadOutcome(state, report, { text: '酒過三巡', time: { until: 'night' } })
    expect(report.time.end).toMatchObject({ day: 1, hour: 20 })
    expect(lines.join()).toContain('夜裡')

    const onRoad = game(9)
    onRoad.road = { from: 'soriel', to: 'rhineburg' } as GameState['road']
    const r2 = baseReport(onRoad, 'event', 1)
    applyRoadOutcome(onRoad, r2, { time: { until: 'night' } })
    expect(r2.time.end).toMatchObject({ day: 1, hour: 10 })
  })
})
