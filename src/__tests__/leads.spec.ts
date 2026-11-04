// 地區的線索池（engine/leads.ts）：走進地區才擲、分給情報商與隱藏、不知道也會遇到、情報物品揭露、到期換一批
import { afterEach, describe, expect, it } from 'vitest'
import { currentArea, enterLocation, goOutskirts, move, moveTo, standOn } from '@/engine/grid'
import { reachableFloors } from '@/engine/intel'
import { readIntelItem } from '@/engine/inventory'
import { activeLeads, ensureLeadPool, LEAD_SLOTS, leadById, setLeadPool } from '@/engine/leads'
import { addItem, newGame } from '@/engine/state'
import { buyDeal, shopState } from '@/engine/trade'
import { ASK_COST, askAround, askAroundBlock } from '@/engine/askAround'
import { applyEffects } from '@/engine/effects'
import { rumorFrom } from '@/engine/intel'
import { worldFacts } from '@/narrator/worldFacts'
import { answerLeadEvent, pendingLeadEvent, pickCast, castTemplate, leadTemplate } from '@/engine/leadEvents'
import { sanitizeTravelEvent, travelEventWarnings } from '@/engine/travelEventMods'
import { npcRecord } from '@/engine/npcs'
import { Rng } from '@/engine/rng'
import { restEventBlock } from '@/engine/rest'

import type { GameState, Lead } from '@/engine/types'

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
      expect(['combat', 'chest', 'merchant', 'relic', 'event']).toContain(l.event)
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

/** 在索里耳近郊放一件線索事件（登場角色是新生成的冒險者） */
function plantLead(state: GameState, template: string, cast: string[]): Lead {
  ensureLeadPool(state, 'central')
  const t = leadTemplate(template)!
  const lead: Lead = {
    id: 'lead-test', region: 'central', tier: 0, location: 'soriel', event: 'event', template, cast,
    title: t.title, text: t.text, level: 1, until: state.time.day + 7, visibility: 'hidden', status: 'active',
  }
  state.leadPools!.central!.leads.push(lead)
  return lead
}

function walkToLead(state: GameState, id: string) {
  standOn(state, 'gate')
  goOutskirts(state)
  const area = currentArea(state)
  const i = area.cells.findIndex((c) => c.intel === id)
  expect(area.cells[i]?.kind).toBe('event')
  stepOnto(state, i)
}

describe('lead events', () => {
  it('rolls lead events with a template and cast into the pool', () => {
    for (let seed = 1; seed < 80; seed++) {
      const state = game(seed)
      ensureLeadPool(state, 'central')
      const ev = activeLeads(state, 'central').find((l) => l.event === 'event' && l.cast?.length)
      if (!ev) continue
      const t = leadTemplate(ev.template)!
      expect(t.scope).toBe('lead')
      expect(ev.cast!.length).toBe(t.cast)
      const name = npcRecord(state, ev.cast![0]!)!.name
      expect(ev.title + ev.text).toContain(name)
      expect(ev.text).not.toContain('{a}')
      return
    }
    throw new Error('no lead event')
  })

  it('starts the event on its cell, blocks moving, and the answer touches the cast and closes the lead', () => {
    const state = game()
    const [a] = pickCast(state, new Rng(3), 1, 'central')
    const lead = plantLead(state, 'ld_campfire_peer', [a!])
    walkToLead(state, lead.id)
    expect(state.leadEvent?.lead).toBe(lead.id)
    const t = pendingLeadEvent(state)!
    const name = npcRecord(state, a!)!.name
    expect(t.text).toContain(name)
    expect(restEventBlock(state)).toBeTruthy()
    expect(() => move(state, 1, 0)).toThrow()
    answerLeadEvent(state, 0)
    expect(state.leadEvent).toBeUndefined()
    expect(state.relationships?.[a!]?.affinity).toBeGreaterThan(0)
    expect(lead.status).toBe('done')
    const area = currentArea(state)
    expect(area.cells.find((c) => c.intel === lead.id)?.done).toBe(true)
    expect(state.reports.at(-1)!.narration?.focus?.join('')).toContain(name)
  })

  it('takes the party into a side map from a lead event', () => {
    const state = game()
    const lead = plantLead(state, 'ld_hidden_cave', [])
    walkToLead(state, lead.id)
    answerLeadEvent(state, 0)
    expect(state.side?.area).toBe('side/cave')
    expect(currentArea(state).kind).not.toBe('settlement')
  })

  it('picks known adventurers of the region as cast', () => {
    const state = game()
    const [a] = pickCast(state, new Rng(5), 1, 'central')
    applyEffects(state, { changes: {} } as never, [{ type: 'affinity', npc: a!, delta: 5 }])
    const always = { chance: () => true, int: (lo: number) => lo, pick: <T>(xs: T[]) => xs[0]!, next: () => 0 } as unknown as Rng
    expect(pickCast(state, always, 1, 'central', new Set())).toEqual([a])
    // 已經在別的線索裡的人不會再登場
    expect(pickCast(state, always, 1, 'central', new Set([a!]))).not.toEqual([a])
  })

  it('writes news for known cast when a lead expires, and drops cast nobody met', () => {
    const state = game()
    const [a, b] = pickCast(state, new Rng(7), 2, 'central')
    applyEffects(state, { changes: {} } as never, [{ type: 'affinity', npc: a!, delta: 5 }])
    plantLead(state, 'ld_duel_witness', [a!, b!])
    state.time = { ...state.time, day: state.time.day + 9 }
    activeLeads(state, 'central')
    expect(state.npcLife?.news[a!]?.at(-1)?.text).toContain(npcRecord(state, a!)!.name)
    expect(state.npcs?.[b!]).toBeUndefined()
  })

  it('fills $a and $b in effects and keeps lead fields through the editor', () => {
    const state = game()
    const [a, b] = pickCast(state, new Rng(9), 2, 'central')
    const t = castTemplate(state, leadTemplate('ld_split_loot')!, [a!, b!])
    expect(JSON.stringify(t)).not.toMatch(/\$a|\$b|\{[ab]他?\}/)
    expect(JSON.stringify(t.options)).toContain(`"npc":"${a}"`)
    // 代名詞照性別
    npcRecord(state, a!)!.gender = 'female'
    expect(castTemplate(state, leadTemplate('ld_wounded_rival')!, [a!]).text).toContain('她握緊了武器')
    npcRecord(state, a!)!.gender = 'male'
    expect(castTemplate(state, leadTemplate('ld_wounded_rival')!, [a!]).text).toContain('他握緊了武器')
    const m = sanitizeTravelEvent('x', { ...leadTemplate('ld_split_loot')!, layers: [0, 9] }, true)
    expect(m).toMatchObject({ scope: 'lead', cast: 2, kind: 'choice', layers: [0] })
    expect(m.offscreen).toBeTruthy()
    expect(travelEventWarnings({ ...m, cast: 1 }).join('')).toContain('乙')
  })
})
