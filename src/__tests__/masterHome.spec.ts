import { describe, expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020'
import schema from '../../schemas/report.schema.json'
import { prepareAction, resolveAction } from '@/engine/actions'
import { negotiateDc } from '@/engine/companions'
import { geography, npcTags, slaveryRules, tagDcMod } from '@/engine/data'
import { applyEffects } from '@/engine/effects'
import { currentArea, enterLocation, getArea, move, position, standOn } from '@/engine/grid'
import { buyHome, homeOnLot, lotsOf, manorOf } from '@/engine/homes'
import {
  allowedDays, applyLeave, atMasterHome, currentMasterHome, homeDeadline, householdOf, leaveDc, mayLeaveHouse, overdueChance, sendToMasterHome, strictPoints, syncMasterHome,
} from '@/engine/masterHome'
import { peopleHere } from '@/engine/population'
import { generateNpc, registerNpc } from '@/engine/npcs'
import { isBound, isEnslaved, joinParty, leaderOf, pcOf, playerEscapes, recapturePlayer } from '@/engine/party'
import { isHostile, pickTags } from '@/engine/population'
import { changeMaster } from '@/engine/party'
import { Rng } from '@/engine/rng'
import { answerMasterEvent, eventFits, masterCandidates, permitDc, startAsSlave, startMasterEvent } from '@/engine/slavery'
import { addHours, migrate, newGame, withRng } from '@/engine/state'
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
  it("is the fixed manor of the master's city, and leaves the lots for sale", () => {
    const { state, master } = slave()
    const lotsBefore = lotsOf('rhineburg').length
    const home = currentMasterHome(state)!
    expect(home).toMatchObject({ master: master.id, location: 'rhineburg' })
    expect(home.name).toBe(`${master.name}的家`)
    // 貴族主人：豪宅
    expect(home.district).toBe('manor')
    // 不佔空地、不存進 homes，只記主人、城市與家裡的人
    expect(lotsOf('rhineburg').every((l) => !homeOnLot(state, l.id))).toBe(true)
    expect(lotsOf('rhineburg')).toHaveLength(lotsBefore)
    expect(state.homes ?? {}).toEqual({})
    expect(state.masterHome).toMatchObject({ master: master.id, location: 'rhineburg' })
    const manor = manorOf('rhineburg')!
    expect(home.lot).toMatchObject({ area: manor.area, x: manor.x, y: manor.y })
    const area = getArea(state, home.lot.area)
    expect(area.cells[home.lot.y * area.width + home.lot.x]).toMatchObject({ kind: 'link', home: home.id })
    // 同樣規格的主人的家都長一樣、而且存檔沒有地圖：讀檔之後一樣進得去
    const loaded = migrate(JSON.parse(JSON.stringify(state)))
    expect(Object.keys(currentMasterHome(loaded)!.areas)).toEqual(Object.keys(home.areas))
  })

  it('is a closed house nobody can enter when the protagonist has no master here', () => {
    const state = game()
    const manor = manorOf('rhineburg')!
    const area = getArea(state, manor.area)
    expect(area.cells[manor.y * area.width + manor.x]!.kind).toBe('manor')
    // 每座聚落都有一棟
    for (const l of geography.locations.filter((x) => x.type !== 'dungeon')) expect(manorOf(l.id), l.id).toBeTruthy()
  })

  it('moves an old save\'s master home off its lot and keeps the household', () => {
    const { state, master } = slave()
    const home = currentMasterHome(state)!
    const people = [...state.masterHome!.household]
    // 做一個舊格式（存檔格式 3）的存檔：主人的家疊在空地上、存在 homes
    const old = JSON.parse(JSON.stringify(state)) as GameState
    const lot = lotsOf('rhineburg')[0]!
    old.homes = { [`m-${master.id}`]: { ...JSON.parse(JSON.stringify(home)), lot: { area: lot.area, x: lot.x, y: lot.y, street: lot.street } } }
    delete old.masterHome
    old.schema = 3
    const loaded = migrate(old)
    expect(loaded.homes).toEqual({})
    expect(loaded.masterHome).toEqual({ master: master.id, location: 'rhineburg', household: people, district: home.district })
    expect(householdOf(loaded).map((r) => r.id)).toEqual(people)
    expect(lotsOf('rhineburg').some((l) => l.id === lot.id && !homeOnLot(loaded, l.id))).toBe(true)
  })

  it("keeps an old save's house layout, so whoever stood inside is still inside (schema 3 → 4)", () => {
    // 舊版：主人沒有身分標籤時，規格看空地的地段（首都、城市的第一塊空地常在貴族區 → 三層的豪宅）
    const { state, master } = slave()
    const home = currentMasterHome(state)!
    expect(home.district).toBe('manor')
    const top = home.floors.map((k) => home.areas[k]!).find((a) => a.homeFloor === 'upper' && a.key.endsWith('/F3'))!
    expect(top).toBeTruthy()
    const old = JSON.parse(JSON.stringify(state)) as GameState
    delete old.npcs![master.id]!.tags
    old.homes = { [`m-${master.id}`]: JSON.parse(JSON.stringify(home)) }
    delete old.masterHome
    old.schema = 3
    // 站在三樓
    old.position = { area: top.key, x: 2, y: 2 }
    const loaded = migrate(JSON.parse(JSON.stringify(old)))
    expect(loaded.masterHome!.district).toBe('manor')
    syncMasterHome(loaded)
    expect(loaded.position).toEqual({ area: top.key, x: 2, y: 2 })
    expect(() => getArea(loaded, top.key)).not.toThrow()
    // 一樓的出口（豪宅比較寬）
    const ground = home.areas[home.floors.find((k) => home.areas[k]!.homeFloor === 'ground')!]!
    const exit = ground.cells.findIndex((c) => c.dir === 'out')
    old.position = { area: ground.key, x: exit % ground.width, y: Math.floor(exit / ground.width) }
    const loaded2 = migrate(JSON.parse(JSON.stringify(old)))
    syncMasterHome(loaded2)
    expect(loaded2.position).toEqual(old.position)
    expect(currentArea(loaded2).cells[exit]!.dir).toBe('out')
  })

  it('moves you and the household back inside when a stored spot is outside the house', () => {
    const { state } = slave()
    const home = currentMasterHome(state)!
    const ground = home.areas[home.floors.find((k) => home.areas[k]!.homeFloor === 'ground')!]!
    // 格局對不上（例如規格不同）：座標在這一層外面
    state.position = { area: ground.key, x: ground.width + 3, y: ground.height + 3 }
    const person = householdOf(state)[0]!
    person.at = { area: ground.key, x: ground.width + 5, y: 1, until: 1e9 }
    syncMasterHome(state)
    const p = state.position!
    expect(p.area).toBe(ground.key)
    expect(p.x < ground.width && p.y < ground.height).toBe(true)
    expect(ground.cells[p.y * ground.width + p.x]!.dir).toBe('out')
    expect(person.at!.x < ground.width || person.at!.area !== ground.key).toBe(true)
  })

  it('gives bought houses ids that never collide', () => {
    const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 1, birthplace: 'rhineburg' })
    enterLocation(state)
    state.money_cc = 1e7
    const lots = lotsOf('rhineburg')
    buyHome(state, lots[0]!.id)
    buyHome(state, lots[1]!.id)
    const [a, b] = Object.keys(state.homes!)
    delete state.homes![a!]
    buyHome(state, lots[2]!.id)
    expect(Object.keys(state.homes!)).toEqual([b, 'h3-rhineburg'])
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

describe("the people in the master's house", () => {
  /** 主人自訂、在指定的城市；回傳家與家裡的人 */
  function household(seed: number, location: string) {
    const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed, birthplace: location })
    enterLocation(state)
    startAsSlave(state, { master: { type: 'custom', spec: { name: '維克多', level: 5 } }, mark: 'labor' })
    const home = currentMasterHome(state)!
    return { state, home, people: householdOf(state, home) }
  }
  const kindOf = (r: NpcRecord) => (r.occupation?.match(/的(妻子|丈夫|伴侶)$/) ? 'spouse' : r.occupation?.match(/的(兒子|女兒|孩子)$/) ? 'child' : r.tags?.includes('slave') ? 'slave' : 'servant')

  it('a small house has only a partner, only children or only slaves', () => {
    const seen = new Set<string>()
    for (let seed = 1; seed <= 30; seed++) {
      const { home, people } = household(seed, 'sunscorch')
      expect(home.district).toBe('cottage')
      const kinds = new Set(people.map(kindOf))
      expect(kinds.size).toBe(1)
      seen.add([...kinds][0]!)
    }
    expect([...seen].sort()).toEqual(['child', 'slave', 'spouse'])
  })

  it('lives in its own city even when every lot there is sold', () => {
    const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 1, birthplace: 'mosswhisper' })
    enterLocation(state)
    // 村裡唯一的空地已經被主角買下：主人的家是民宅，不受影響
    state.money_cc = 100000
    for (const lot of lotsOf('mosswhisper')) buyHome(state, lot.id)
    startAsSlave(state, { master: { type: 'custom', spec: { name: '維克多', level: 5 } }, mark: 'labor' })
    const home = currentMasterHome(state)!
    expect(home.location).toBe('mosswhisper')
  })

  it('a bigger house has servants and slaves, and children take a race from the adults', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const { state, home, people } = household(seed, 'rhineburg')
      expect(home.district).toBe('house')
      const kinds = people.map(kindOf)
      expect(kinds.filter((k) => k === 'servant').length).toBeGreaterThanOrEqual(1)
      expect(kinds.filter((k) => k === 'slave').length).toBeGreaterThanOrEqual(1)
      const master = state.npcs![pcOf(state).contract!.master]!
      const adults = new Set([master.race, ...people.filter((r) => kindOf(r) !== 'child').map((r) => r.race)])
      for (const c of people.filter((r) => kindOf(r) === 'child')) expect(adults.has(c.race)).toBe(true)
      // 每個人都站在房子裡，走進去就看得到
      for (const r of people) expect(r.at!.area.startsWith(`home/${home.id}/`)).toBe(true)
    }
  })

  it('stays the same people for the same master, and the house looks the same for every master', () => {
    const a = household(5, 'rhineburg')
    const b = household(5, 'rhineburg')
    expect(b.people.map((r) => r.name)).toEqual(a.people.map((r) => r.name))
    const other = household(6, 'rhineburg')
    const floor = (h: typeof a.home) => h.floors.map((k) => h.areas[k]!.cells.map((c) => c.kind).join(''))
    expect(floor(other.home)).toEqual(floor(a.home))
    // 走進去：家裡的人在「這裡的人」裡
    sendToMasterHome(a.state, blank(a.state))
    const f = a.people.find((r) => r.at!.area === position(a.state).area)
    if (f) expect(peopleHere(a.state).some((p) => p.rec.id === f.id)).toBe(true)
  })

  it('a new master brings a new household', () => {
    const { state, people } = household(5, 'rhineburg')
    const rec = withRng(state, (rng) => generateNpc(state, rng, { level: 6, kind: 'adventurer', location: state.location }))
    registerNpc(state, rec)
    changeMaster(state, rec, blank(state))
    for (const r of people) expect(state.npcs?.[r.id]).toBeUndefined()
    const now = householdOf(state)
    expect(now.length).toBeGreaterThan(0)
    expect(now.every((r) => r.id.startsWith(`hh_${rec.id}_`))).toBe(true)
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
