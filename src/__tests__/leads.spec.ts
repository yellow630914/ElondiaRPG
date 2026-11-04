// 地區的線索池（engine/leads.ts）：走進地區才擲、分給情報商與隱藏、不知道也會遇到、情報物品揭露、到期換一批
import { afterEach, describe, expect, it } from 'vitest'
import { currentArea, enterLocation, goOutskirts, moveTo, standOn } from '@/engine/grid'
import { reachableFloors } from '@/engine/intel'
import { readIntelItem } from '@/engine/inventory'
import { activeLeads, ensureLeadPool, LEAD_SLOTS, leadById, setLeadPool } from '@/engine/leads'
import { addItem, newGame } from '@/engine/state'
import { buyDeal, shopState } from '@/engine/trade'
import { ASK_COST, askAround, askAroundBlock } from '@/engine/askAround'
import { applyEffects } from '@/engine/effects'
import { rumorFrom } from '@/engine/intel'
import { worldFacts } from '@/narrator/worldFacts'
import type { GameState } from '@/engine/types'

afterEach(() => setLeadPool({ days: 7 }))

function game(seed = 6): GameState {
  const state = newGame({ name: '測試者', race: 'human', classId: 'fighter', seed, birthplace: 'soriel' })
  enterLocation(state)
  state.money_cc = 20000
  return state
}

function stepOnto(state: GameState, i: number) {
  const area = currentArea(state)
  const x = i % area.width
  const y = Math.floor(i / area.width)
  const from = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].find(([fx, fy]) => {
    const c = area.cells[fy! * area.width + fx!]
    return fx! >= 0 && fy! >= 0 && fx! < area.width && fy! < area.height && c && c.kind !== 'wall' && c.kind !== 'water'
  })!
  state.position = { area: area.key, x: from[0]!, y: from[1]! }
  return moveTo(state, x, y)
}

/** 擲到近郊有線索的池子（不同種子試幾次） */
function withWildLead(): GameState {
  for (let seed = 1; seed < 60; seed++) {
    const state = game(seed)
    ensureLeadPool(state, 'central')
    if (activeLeads(state, 'central').some((l) => l.location === 'soriel' && !l.layer && l.event !== 'merchant')) return state
  }
  throw new Error('no wild lead')
}

describe('regional lead pool', () => {
  it('rolls a pool only for the region you walk into, with informant and hidden leads', () => {
    const state = game()
    expect(state.leadPools).toBeUndefined()
    standOn(state, 'gate')
    goOutskirts(state)
    const region = 'central'
    const pool = state.leadPools?.[region]
    expect(pool).toBeTruthy()
    expect(Object.keys(state.leadPools!)).toEqual([region])
    expect(pool!.leads.length).toBeLessThanOrEqual(LEAD_SLOTS)
    for (const l of pool!.leads) {
      expect(l.region).toBe(region)
      expect(['combat', 'chest', 'merchant', 'relic']).toContain(l.event)
      expect(['informant', 'hidden']).toContain(l.visibility)
    }
    expect(new Set(pool!.leads.map((l) => l.id)).size).toBe(pool!.leads.length)
  })

  it('puts unknown leads on the map where you can walk to them, and notes them when you step on one', () => {
    const state = withWildLead()
    const lead = activeLeads(state, 'central').find((l) => l.location === 'soriel' && !l.layer && l.event !== 'merchant')!
    expect(lead.known).toBeFalsy()
    standOn(state, 'gate')
    goOutskirts(state)
    const area = currentArea(state)
    const i = area.cells.findIndex((c) => c.intel === lead.id)
    expect(i).toBeGreaterThanOrEqual(0)
    expect(reachableFloors(area).length).toBeGreaterThan(0)
    expect(state.intel?.some((x) => x.id === lead.id)).toBeFalsy()
    stepOnto(state, i)
    const noted = state.intel!.find((x) => x.id === lead.id)!
    expect(noted.source).toBe('自己遇到')
    expect(lead.known).toBe(true)
  })

  it('lets the informant sell the leads given to them, under the same id', () => {
    for (let seed = 1; seed < 60; seed++) {
      const state = game(seed)
      standOn(state, 'informant')
      const deal = shopState(state, 'informant').deals.find((d) => d.id.startsWith('info:lead:'))
      if (!deal) continue
      const id = deal.id.slice('info:lead:'.length)
      expect(leadById(state, id)?.visibility).toBe('informant')
      buyDeal(state, 'informant', deal.id)
      expect(state.intel!.find((x) => x.id === id)).toMatchObject({ kind: 'point', status: 'active' })
      expect(leadById(state, id)?.known).toBe(true)
      // 買過的不再賣（今天的清單照舊，隔天起不再列出）
      state.time.day += 1
      expect(shopState(state, 'informant').deals.some((d) => d.id === deal.id)).toBe(false)
      return
    }
    throw new Error('no informant lead')
  })

  it('reveals a hidden lead when you read an intel item', () => {
    for (let seed = 1; seed < 60; seed++) {
      const state = game(seed)
      ensureLeadPool(state, 'central')
      const hidden = activeLeads(state, 'central').filter((l) => l.visibility === 'hidden' && l.event === 'combat')
      if (!hidden.length) continue
      addItem(state.inventory, '懸賞告示', 1)
      readIntelItem(state, '懸賞告示')
      const it = state.intel!.at(-1)!
      expect(hidden.map((l) => l.id)).toContain(it.id)
      expect(it.source).toBe('懸賞告示')
      return
    }
    throw new Error('no hidden combat lead')
  })

  it('swaps unknown leads for a new batch when the pool is due, and keeps the known ones', () => {
    const state = game()
    ensureLeadPool(state, 'central')
    const first = state.leadPools!.central!.leads
    // 流浪商人只有 5 天：挑別的
    const known = first.find((l) => l.event !== 'merchant')
    if (known) known.known = true
    state.time = { ...state.time, day: state.time.day + 7 }
    ensureLeadPool(state, 'central')
    const next = state.leadPools!.central!
    expect(next.day).toBe(state.time.day)
    for (const l of first.filter((x) => x !== known)) expect(l.status).toBe('expired')
    if (known) expect(next.leads).toContain(known)
  })

  it('does nothing when the pool is turned off', () => {
    setLeadPool({ days: 0 })
    const state = game()
    standOn(state, 'gate')
    goOutskirts(state)
    expect(state.leadPools).toBeUndefined()
  })

  it('asks around at the tavern: costs a round, reveals hidden leads on a good roll, once a day', () => {
    for (let seed = 1; seed < 80; seed++) {
      const state = game(seed)
      standOn(state, 'tavern')
      if (askAroundBlock(state)) continue
      state.party[0]!.attrs.cha = 30
      const money = state.money_cc
      const r = askAround(state)
      expect(state.money_cc).toBe(money - ASK_COST)
      expect(r.timeline?.[0]?.roll?.dc).toBe(13)
      if (r.outcome.result === 'success') expect(state.intel?.some((it) => it.source?.includes('酒館'))).toBe(true)
      expect(askAroundBlock(state)).toBe('今天已經在這裡打聽過了')
      return
    }
    throw new Error('no tavern to ask in')
  })

  it('lets the AI reveal a hidden lead it was shown in the world facts', () => {
    for (let seed = 1; seed < 60; seed++) {
      const state = game(seed)
      ensureLeadPool(state, 'central')
      const hidden = activeLeads(state, 'central').find((l) => l.visibility === 'hidden')
      if (!hidden) continue
      expect(worldFacts(state)).toContain(`[${hidden.id}]`)
      // 失敗時不算
      expect(rumorFrom(state, { title: 'x', text: 'y', lead: hidden.id }, 'fail')).not.toHaveProperty('lead')
      const rumor = rumorFrom(state, { title: '', text: '', lead: hidden.id }, 'success', '酒保')!
      const report = { changes: {} } as never
      applyEffects(state, report, [rumor])
      expect(state.intel!.find((it) => it.id === hidden.id)).toMatchObject({ npc: '酒保', status: 'active' })
      expect(hidden.known).toBe(true)
      return
    }
    throw new Error('no hidden lead')
  })
})
