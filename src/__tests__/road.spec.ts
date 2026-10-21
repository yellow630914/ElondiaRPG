import { describe, expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020'
import schema from '../../schemas/report.schema.json'
import { prepareAction, resolveAction } from '@/engine/actions'
import { finishCombat } from '@/engine/combat'
import { afterCombat, currentArea, currentCell, enterLocation, move, standOn } from '@/engine/grid'
import { answerRoadEvent, leaveSide, ROAD_KEY, startJourney } from '@/engine/road'
import { migrate, newGame } from '@/engine/state'
import { nodesHere, playNode } from '@/engine/story'
import { hasFlag } from '@/engine/storyFlags'
import type { GameState, Report } from '@/engine/types'

const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema)
const valid = (r: Report) => expect(validate(r), JSON.stringify(validate.errors)).toBe(true)

function game(seed = 3): GameState {
  const state = newGame({ name: '測試者', race: 'human', classId: 'fighter', seed, birthplace: 'soriel' })
  enterLocation(state)
  standOn(state, 'gate')
  state.money_cc = 2000
  state.inventory.push({ name: '乾糧', qty: 20 })
  return state
}

/** 一路往前走：戰鬥直接獲勝，事件選最後一個選項（通常是不理會） */
function walk(state: GameState): Report {
  for (let i = 0; i < 200; i++) {
    if (state.roadEvent) {
      valid(answerRoadEvent(state, 0))
      if (state.side) leaveSide(state)
      continue
    }
    if (state.pendingMasterEvent) delete state.pendingMasterEvent
    const r = move(state, 1, 0)
    if (r.combat) {
      for (const c of state.combat!.combatants) if (c.side === 'enemy') c.hp = 0
      state.combat!.status = 'victory'
      const rep = finishCombat(state)
      afterCombat(state, rep)
      continue
    }
    if (r.report) valid(r.report)
    if (r.report?.kind === 'travel') return r.report
  }
  throw new Error('never arrived')
}

describe('the road', () => {
  it('draws the journey as a one-way road, one cell per day, and arrives at the end', () => {
    const state = game()
    expect(startJourney(state, 'rivervale')).toBeUndefined()
    const road = currentArea(state)
    expect(road.kind).toBe('road')
    expect(road.cells.at(-1)).toMatchObject({ kind: 'arrive', town: 'rivervale' })
    expect(state.location).toBe('soriel')
    expect(() => move(state, -1, 0)).toThrow('單行道')
    const day = state.time.day
    const report = walk(state)
    expect(report.location.to).toBe('rivervale')
    expect(state.location).toBe('rivervale')
    expect(state.road).toBeUndefined()
    expect(state.time.day).toBeGreaterThan(day)
    expect(currentArea(state).kind).toBe('settlement')
    expect(report.timeline?.[0]?.action).toContain('出發')
  })

  it('pre-rolls events on the road, including fights and choices', () => {
    const kinds = new Set<string>()
    for (let seed = 1; seed < 30; seed++) {
      const state = game(seed)
      startJourney(state, 'snowridge')
      for (const c of state.areas![ROAD_KEY]!.cells) kinds.add(c.kind === 'event' ? `event:${c.event!.tier}` : c.kind)
    }
    for (const k of ['encounter', 'event:auto', 'event:normal', 'event:advanced', 'waypoint', 'arrive']) expect(kinds, k).toContain(k)
  })

  it('takes a detour into a temporary map and comes back to the same spot', () => {
    const state = game()
    startJourney(state, 'rivervale')
    move(state, 1, 0)
    const x = state.position!.x
    state.roadEvent = { x, template: 'waystation' }
    answerRoadEvent(state, 0)
    expect(currentArea(state).kind).toBe('side')
    expect(currentArea(state).cells.some((c) => c.kind === 'safe')).toBe(true)
    expect(currentCell(state).kind).toBe('exit')
    leaveSide(state)
    expect(state.position).toMatchObject({ area: ROAD_KEY, x })
  })

  it('starts a special quest on the road that can send you elsewhere', () => {
    const state = game()
    startJourney(state, 'albena')
    const road = state.areas![ROAD_KEY]!
    const i = road.cells.findIndex((c, idx) => idx > 0 && c.kind === 'road' && c.road)
    road.cells[i] = { ...road.cells[i]!, kind: 'event', event: { tier: 'special', story: 'overturned_wagon' } }
    // 前面的格子清空，直接走到特殊事件
    for (let k = 1; k < i; k++) {
      const c = road.cells[k]!
      delete c.event
      if (c.kind !== 'waypoint') c.kind = 'road'
    }
    let r = move(state, 1, 0)
    while (state.position!.x < i) r = move(state, 1, 0)
    expect(r.report?.story?.status).toBe('started')
    expect(nodesHere(state).map((n) => n.node.id)).toEqual(['decide'])
    // 送小女孩回河谷鎮：改道
    playNode(state, 'overturned_wagon:decide', 1)
    expect(state.location).toBe('rivervale')
    expect(state.road).toBeUndefined()
    standOn(state, 'inn')
    const done = playNode(state, 'overturned_wagon:home') as Report
    valid(done)
    expect(state.stories!.overturned_wagon!.status).toBe('completed')
    // 接下任務、每一步與完成都記進冒險記憶
    const memories = state.memories!.filter((m) => m.report && state.reports.find((x) => x.report_id === m.report)?.story?.id === 'overturned_wagon')
    expect(memories.map((m) => m.importance)).toEqual([2, 1, 3])
    expect(memories[0]!.summary).toContain('翻覆的篷車')
  })

  it('fills in event memories that older saves never recorded', () => {
    const state = game()
    startJourney(state, 'albena')
    const road = state.areas![ROAD_KEY]!
    road.cells[1] = { ...road.cells[1]!, kind: 'event', event: { tier: 'special', story: 'overturned_wagon' } }
    move(state, 1, 0)
    const started = state.reports.at(-1)!
    // 舊版存檔：事件沒有記憶，也沒有記憶規則的版本
    const old = JSON.parse(JSON.stringify(state)) as GameState
    old.memories = old.memories!.filter((m) => m.report !== started.report_id)
    delete old.memoryRules
    const loaded = migrate(old)
    expect(loaded.memories!.some((m) => m.report === started.report_id)).toBe(true)
    expect(loaded.memoryRules).toBe(2)
    // 再讀一次不會重複
    const again = migrate(JSON.parse(JSON.stringify(loaded)))
    expect(again.memories!.filter((m) => m.report === started.report_id)).toHaveLength(1)
  })

  it('can follow the trail into a cave with the rescue as a quest point', () => {
    const state = game()
    startJourney(state, 'albena')
    const road = state.areas![ROAD_KEY]!
    road.cells[1] = { ...road.cells[1]!, kind: 'event', event: { tier: 'special', story: 'overturned_wagon' } }
    move(state, 1, 0)
    prepareAction(state, { kind: 'story', target: 'overturned_wagon:decide:0', text: '' })
    state.pendingAction!.natural = 20
    resolveAction(state, null)
    expect(hasFlag(state, 'wagon_trail')).toBe(true)
    const cave = currentArea(state)
    expect(cave.kind).toBe('side')
    expect(cave.cells.some((c) => c.storyNode === 'overturned_wagon:hideout')).toBe(true)
  })
})
