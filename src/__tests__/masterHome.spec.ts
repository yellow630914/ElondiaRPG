import { describe, expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020'
import schema from '../../schemas/report.schema.json'
import { prepareAction, resolveAction } from '@/engine/actions'
import { negotiateDc } from '@/engine/companions'
import { npcTags, slaveryRules, tagDcMod } from '@/engine/data'
import { applyEffects } from '@/engine/effects'
import { currentArea, enterLocation, getArea, move, position, standOn } from '@/engine/grid'
import { homeOnLot, lotsOf } from '@/engine/homes'
import {
  allowedDays, applyLeave, atMasterHome, currentMasterHome, homeDeadline, leaveDc, mayLeaveHouse, overdueChance, sendToMasterHome, strictPoints,
} from '@/engine/masterHome'
import { generateNpc, registerNpc } from '@/engine/npcs'
import { isBound, isEnslaved, joinParty, leaderOf, pcOf, playerEscapes, recapturePlayer } from '@/engine/party'
import { isHostile, pickTags } from '@/engine/population'
import { Rng } from '@/engine/rng'
import { answerMasterEvent, eventFits, masterCandidates, permitDc, startAsSlave, startMasterEvent } from '@/engine/slavery'
import { addHours, newGame, withRng } from '@/engine/state'
import { sanitizeEffects } from '@/engine/storyMods'
import type { GameState, NpcRecord, Report } from '@/engine/types'
import { workers, workTarget } from '@/engine/work'

const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema)

function game(seed = 3, location = 'rhineburg'): GameState {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed, birthplace: location })
  enterLocation(state)
  return state
}

function blank(state: GameState): Report {
  return {
    schema_version: '0.1', report_id: `r-${state.nextReportNo++}`, kind: 'event',
    time: { start: { ...state.time }, end: { ...state.time } }, location: { at: state.location }, party: [], outcome: { result: 'neutral' }, changes: {},
  }
}

/** 以奴隸身分開始，主人是第 i 位候選人（0 貴族、1 旅人、2 神官、3 惡人、4 好人） */
function slave(i = 0, mark = 'labor'): { state: GameState; master: NpcRecord } {
  const state = game()
  const rec = masterCandidates('rhineburg', 3)[i]!
  startAsSlave(state, { master: { type: 'candidate', rec }, mark })
  return { state, master: rec }
}

function act(state: GameState, input: Parameters<typeof prepareAction>[1], natural: number) {
  prepareAction(state, input)
  state.pendingAction!.natural = natural
  const r = resolveAction(state, null)
  expect(validate(r), JSON.stringify(validate.errors)).toBe(true)
  return r
}

describe('special quests can enslave the protagonist', () => {
  it('keeps a fixed or random master in the story data', () => {
    expect(sanitizeEffects([{ type: 'enslave_player', master: 'npc_selene', contract: 'combat' }])).toEqual([{ type: 'enslave_player', master: 'npc_selene', contract: 'combat' }])
    expect(sanitizeEffects([{ type: 'enslave_player', random: { tag: 'noble' }, contract: 'nope' }])).toEqual([{ type: 'enslave_player', random: { tag: 'noble' }, contract: 'labor' }])
    expect(sanitizeEffects([{ type: 'enslave_player', random: { tag: 'dragon' } }])).toEqual([{ type: 'enslave_player', random: {}, contract: 'labor' }])
  })

  it('makes a random master of the chosen kind, then asks for the marking', () => {
    const state = game()
    const report = blank(state)
    applyEffects(state, report, [{ type: 'enslave_player', random: { tag: 'merchant' }, contract: 'labor' }])
    const master = leaderOf(state)!
    expect(isBound(state)).toBe(true)
    expect(state.npcs![master.id]!.tags).toContain('merchant')
    expect(master.level).toBeGreaterThan(pcOf(state).level)
    expect(state.pendingMark).toEqual({ intended: 'labor' })
    // 已經是奴隸：換主人，印記沿用
    const before = pcOf(state).contract!.kind
    applyEffects(state, blank(state), [{ type: 'enslave_player', master: 'npc_selene', contract: 'arcane' }])
    expect(pcOf(state).contract).toMatchObject({ master: 'npc_selene', kind: before })
  })
})

describe('sending your own slaves to work', () => {
  it('lets the slave make the check and hands you the pay', () => {
    const state = game()
    const rec = withRng(state, (rng) => generateNpc(state, rng, { level: 2, kind: 'commoner', location: state.location }))
    registerNpc(state, rec)
    joinParty(state, rec, 'slave', undefined, { contract: 'labor' })
    expect(workers(state).map((m) => m.id)).toEqual([rec.id])
    standOn(state, 'tavern')
    const money = state.money_cc
    const r = act(state, { kind: 'work', target: workTarget(4, rec.id), text: '' }, 15)
    expect(r.outcome.summary).toContain(`派${rec.name}去做了 4 小時`)
    expect(state.money_cc).toBeGreaterThan(money)
    expect(() => prepareAction(state, { kind: 'work', target: workTarget(4, 'nobody'), text: '' })).toThrow('奴隸')
  })
})

describe("the master's house", () => {
  it("is built on a lot in the master's city, which is no longer for sale", () => {
    const { state, master } = slave()
    const home = currentMasterHome(state)!
    expect(home).toMatchObject({ master: master.id, location: 'rhineburg' })
    expect(home.name).toBe(`${master.name}的家`)
    // 貴族主人：豪宅
    expect(home.district).toBe('manor')
    const lot = lotsOf('rhineburg').find((l) => homeOnLot(state, l.id)?.id === home.id)
    expect(lot).toBeTruthy()
    const area = getArea(state, home.lot.area)
    expect(area.cells[home.lot.y * area.width + home.lot.x]).toMatchObject({ kind: 'link', home: home.id })
  })

  it('allows days away by mark, affinity and tags', () => {
    const { state, master } = slave(1)
    // 勞役：(18 − 12) × 0.5 = 3 天；旅人 +2
    expect(allowedDays(state)).toBe(5)
    state.relationships![master.id]!.affinity = 60
    expect(allowedDays(state)).toBe(8)
    const good = slave(4)
    good.state.relationships![good.master.id]!.affinity = 80
    // (3 + 4 + 3) × 2 = 20 天
    expect(allowedDays(good.state)).toBe(20)
    const bad = slave(3, 'arcane')
    bad.state.relationships![bad.master.id]!.affinity = -40
    expect(allowedDays(bad.state)).toBe(slaveryRules.master_home.days.min)
  })

  it('needs the master to say yes before leaving the house', () => {
    const { state } = slave()
    const report = blank(state)
    sendToMasterHome(state, report)
    expect(atMasterHome(state)).toBe(true)
    const p = position(state)
    const inside = [[0, -1], [1, 0], [-1, 0], [0, 1]].find(([dx, dy]) => {
      const c = currentArea(state).cells[(p.y + dy!) * currentArea(state).width + p.x + dx!]
      return c && c.kind !== 'wall' && c.kind !== 'link'
    })!
    move(state, inside[0]!, inside[1]!)
    expect(() => move(state, -inside[0]!, -inside[1]!)).toThrow('出門')
    expect(mayLeaveHouse(state)).toBe(false)
    applyLeave(state, blank(state), 'success')
    move(state, -inside[0]!, -inside[1]!)
    expect(currentArea(state).kind).toBe('settlement')
    // 走出大門：離家期限從現在算
    expect(homeDeadline(state)!.hoursLeft).toBeCloseTo(allowedDays(state) * 24)
  })

  it('brings you home when you stay away too long', () => {
    const { state } = slave()
    const d = homeDeadline(state)!
    state.time = addHours(d.due, 48)
    expect(overdueChance(state)).toBeGreaterThan(0)
    startMasterEvent(state, slaveryRules.master_events.events.find((e) => e.id === 'call_home')!)
    const r = answerMasterEvent(state, 0)
    expect(validate(r), JSON.stringify(validate.errors)).toBe(true)
    expect(atMasterHome(state)).toBe(true)
    expect(overdueChance(state)).toBe(0)
  })

  it('takes a fugitive straight back home and watches them closer', () => {
    const { state } = slave()
    const before = permitDc(state)
    const leave = leaveDc(state)
    playerEscapes(state)
    expect(isBound(state)).toBe(false)
    const report = blank(state)
    const line = recapturePlayer(state, report, slaveryRules.master_home.strict.found)
    expect(line).toContain('被帶回')
    expect(isBound(state)).toBe(true)
    expect(atMasterHome(state)).toBe(true)
    expect(strictPoints(state)).toBe(2)
    expect(permitDc(state)).toBe(before + 2)
    expect(leaveDc(state)).toBe(leave + 2)
    // 每 3 天減 1 點
    state.time = addHours(state.time, 24 * 3)
    expect(strictPoints(state)).toBe(1)
  })

  it('is gone once the protagonist is free', () => {
    const { state } = slave()
    applyEffects(state, blank(state), [{ type: 'free', npc: 'pc' }])
    expect(isEnslaved(state)).toBe(false)
    expect(Object.values(state.homes ?? {}).some((h) => h.master)).toBe(false)
  })
})

describe('master events by affinity and tags', () => {
  const def = (id: string) => slaveryRules.master_events.events.find((e) => e.id === id)!

  it('picks events that fit the master', () => {
    const { state, master } = slave(4)
    const rec = state.npcs![master.id]!
    expect(eventFits(state, rec, def('good_heal'))).toBe(true)
    expect(eventFits(state, rec, def('villain_debt'))).toBe(false)
    expect(eventFits(state, rec, def('confide'))).toBe(false)
    state.relationships![master.id]!.affinity = 70
    expect(eventFits(state, rec, def('confide'))).toBe(true)
    expect(eventFits(state, rec, def('cold_shoulder'))).toBe(false)
    // 在家裡才有的事件
    expect(eventFits(state, rec, def('home_chores'))).toBe(false)
    sendToMasterHome(state, blank(state))
    expect(eventFits(state, rec, def('home_chores'))).toBe(true)
  })

  it('every event option resolves into a valid report', () => {
    for (const e of slaveryRules.master_events.events) {
      for (let i = 0; i < e.options.length; i++) {
        const { state } = slave(4)
        state.money_cc = 500
        startMasterEvent(state, e)
        const r = answerMasterEvent(state, i)
        expect(validate(r), `${e.id}#${i} ${JSON.stringify(validate.errors)}`).toBe(true)
      }
    }
  })
})

describe('the good-person tag', () => {
  it('never comes with the villain tag', () => {
    const loc = { id: 'rhineburg', type: 'city' } as never
    const rng = new Rng(7)
    for (let i = 0; i < 400; i++) {
      const tags = pickTags(rng, 'adventurer', loc)
      expect(tags.includes('good') && tags.includes('villain')).toBe(false)
    }
  })

  it('is easier to get along with and does not turn on you in the wild', () => {
    const state = game()
    const rec = withRng(state, (rng) => generateNpc(state, rng, { level: 2, kind: 'adventurer', tags: ['good'], location: state.location }))
    expect(tagDcMod(rec, 'chat')).toBe(npcTags.tags.good!.dc_mods!.chat)
    expect(tagDcMod(rec, 'hire')).toBeLessThan(0)
    registerNpc(state, rec)
    state.relationships = { ...state.relationships, [rec.id]: { ...(state.relationships?.[rec.id] ?? {}), affinity: -80 } as never }
    expect(isHostile(state, rec, 'wild')).toBe(false)
    expect(isHostile(state, { ...rec, tags: [] }, 'wild')).toBe(true)
  })

  it('makes a master more willing to set you free', () => {
    const good = slave(4)
    const noble = slave(0)
    expect(negotiateDc(good.state)).toBe(negotiateDc(noble.state) - 3)
  })
})
