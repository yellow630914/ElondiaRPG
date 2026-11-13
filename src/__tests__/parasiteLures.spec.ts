// 寄生物的取得（docs/ADULT_EVENTS.md 第 6 節）：存檔規則「寄生事件的比重」、黑市的引子、陽剛體型的版本
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { buyCurio, curioStock } from '@/engine/companions'
import { setContentFilters } from '@/engine/content'
import { itemDef } from '@/engine/data'
import { answerDungeonEvent, dungeonCandidates, dungeonTemplates, maybeDungeonEvent, parasiteBoost, parasitesFrom, pendingDungeonEvent } from '@/engine/dungeonEvents'
import { gameRule, parasiteLuresOn, sanitizeRules } from '@/engine/gameRules'
import { currentArea, enterLocation, standOn, type CellKind } from '@/engine/grid'
import { canUse, useItem } from '@/engine/inventory'
import { applyContent, emptyMods, sanitizeItem } from '@/engine/mods'
import { pcOf } from '@/engine/party'
import { attachParasite, parasiteOf } from '@/engine/parasites'
import { builtinEventRules } from '@/engine/travelEventMods'
import { addItem, newGame } from '@/engine/state'
import type { GameState } from '@/engine/types'
import { arriveAt } from './helpers/travel'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})
afterEach(() => {
  applyContent(emptyMods())
  setContentFilters({ pc_unwilling: true })
})

const LIN = 'hungry_lingerie'
const MARK = 'succubus_mark'
const SEED = 'parasite_seed'
const LURES: [string, string, string][] = [
  ['受詛咒的黑色內衣', 'dg_cursed_lingerie', LIN],
  ['魅魔的封印箱', 'dg_succubus_box', MARK],
  ['寄生植物的花苞', 'dg_seed_plant', SEED],
]

function hero(body: 'fem' | 'andro' | 'masc' = 'fem'): GameState {
  return newGame({ name: '艾琳', race: 'human', classId: 'rogue', seed: 3, gender: body === 'masc' ? '男' : '女', body })
}

/** 站在地下城的第 layer 層 */
function inDungeon(body: 'fem' | 'andro' | 'masc' = 'fem', layer = 1): GameState {
  const state = hero(body)
  enterLocation(state)
  arriveAt(state, 'snake_creek')
  currentArea(state).layer = layer
  return state
}

function atBlackMarket(): GameState {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'rogue', seed: 9, birthplace: 'soriel' })
  enterLocation(state)
  state.flags['black_market:soriel'] = true
  standOn(state, 'lm_uw_black_soriel' as CellKind)
  state.money_cc = 1e6
  return state
}

const template = (id: string) => dungeonTemplates().find((t) => t.id === id)!
/** 會帶來寄生物的那個選項（屈服的回應） */
const yieldIndex = (id: string) => template(id).options!.findIndex((o) => JSON.stringify(o.success ?? {}).includes('"parasite"'))

describe('parasite event boost (save rule)', () => {
  it('finds the parasite events from their options, not from a list of ids', () => {
    const tagged = dungeonTemplates().filter((t) => parasitesFrom(t).length).map((t) => t.id).sort()
    expect(tagged).toEqual(['dg_cursed_lingerie', 'dg_cursed_lingerie_m', 'dg_incubus_visit', 'dg_incubus_visit_m', 'dg_seed_plant', 'dg_seed_plant_m', 'dg_succubus_box', 'dg_succubus_box_m'])
    expect(parasitesFrom(template('dg_succubus_box'))).toEqual([MARK])
  })

  it('weights the event by the rule only while the hero lacks that parasite', () => {
    const state = inDungeon()
    const lin = template('dg_cursed_lingerie')
    expect(gameRule(state, 'parasiteEventBoost')).toBe(3)
    expect(parasiteBoost(state, lin)).toBe(3)
    expect(parasiteBoost(state, template('dg_lewd_dream'))).toBe(1)
    attachParasite(pcOf(state), LIN, state.time)
    expect(parasiteBoost(state, lin)).toBe(1)
    // 另一種寄生物不受影響
    expect(parasiteBoost(state, template('dg_succubus_box'))).toBe(3)
    // 規則設 1 就是關掉
    state.options = { defeatLoot: 'half', parasiteEventBoost: 1 }
    expect(parasiteBoost(state, template('dg_succubus_box'))).toBe(1)
    expect(sanitizeRules({ parasiteEventBoost: 3 })).toEqual({})
    expect(sanitizeRules({ parasiteEventBoost: 99 })).toEqual({ parasiteEventBoost: 10 })
  })

  it('makes the parasite events come up more often, and raises the overall chance', () => {
    // 寶箱的事件只留成人向的，機率 10%、沒有冷卻
    const mods = emptyMods()
    const r = builtinEventRules()
    mods.eventRules.rules = { ...r, dungeon: { ...r.dungeon, chance: { trap: 0, chest: 0.1, gather: 0, rest: 0 }, cooldown_hours: 0 } }
    mods.travelEvents = Object.fromEntries(dungeonTemplates().filter((t) => !t.tags?.includes('adult')).map((t) => [t.id, { ...t, requires: { flags: ['test_never'] } }])) as never
    applyContent(mods)
    const count = (boost: number) => {
      const state = inDungeon('fem', 1)
      state.options = { defeatLoot: 'half', parasiteEventBoost: boost }
      expect(dungeonCandidates(state, currentArea(state), 'chest').some((t) => t.id === 'dg_cursed_lingerie')).toBe(true)
      let any = 0
      let lin = 0
      for (let i = 0; i < 2000; i++) {
        state.dungeonEvents = { seen: {} }
        if (!maybeDungeonEvent(state, 'chest')) continue
        any++
        if (state.dungeonEvent!.template === 'dg_cursed_lingerie') lin++
        delete state.dungeonEvent
      }
      return { any, lin }
    }
    const off = count(1)
    const on = count(10)
    expect(on.lin).toBeGreaterThan(off.lin * 3)
    expect(on.any).toBeGreaterThan(off.any)
  })
})

describe('parasite lures (black market)', () => {
  it('are adult consumables that only the black market sells', () => {
    for (const [name, id] of LURES) {
      const def = itemDef(name)!
      expect(def.adult, name).toBe(true)
      expect(def.black_market, name).toBe(true)
      expect(def.use?.lure?.[0], name).toBe(id)
      expect(canUse(name), name).toBe(true)
      expect(def.price_cc, name).toBeGreaterThanOrEqual(300)
      expect(def.price_cc, name).toBeLessThanOrEqual(1500)
      // 內容標籤和它引來的事件一樣
      expect(def.content_tags ?? [], name).toEqual((template(id).tags ?? []).filter((t) => t !== 'adult'))
      // 內容編輯器整理後不會掉欄位
      const clean = sanitizeItem(name, def, false)
      expect(clean.use?.lure, name).toEqual(def.use!.lure)
      expect(clean.black_market, name).toBe(true)
    }
  })

  it('are stocked each day while the rule is on, and not when it is off', () => {
    const state = atBlackMarket()
    expect(parasiteLuresOn(state)).toBe(true)
    const names = () => curioStock(state).map((c) => c.item)
    for (const [name] of LURES) expect(names()).toContain(name)
    const lure = curioStock(state).find((c) => c.item === '魅魔的封印箱')!
    expect(lure.price_cc).toBe(itemDef('魅魔的封印箱')!.price_cc)
    // 關掉：當天就不賣，也買不到
    state.options = { defeatLoot: 'half', parasiteLures: false }
    for (const [name] of LURES) expect(names()).not.toContain(name)
    expect(() => buyCurio(state, '魅魔的封印箱')).toThrow('黑市今天沒有')
    state.time.day += 1
    for (const [name] of LURES) expect(names()).not.toContain(name)
    // 內容篩選關掉「主角非自願」：非自願的兩種不賣
    state.options = { defeatLoot: 'half' }
    setContentFilters({ pc_unwilling: false })
    expect(names()).toContain('魅魔的封印箱')
    expect(names()).not.toContain('受詛咒的黑色內衣')
    expect(names()).not.toContain('寄生植物的花苞')
  })

  it('are bought once a day', () => {
    const state = atBlackMarket()
    const money = state.money_cc
    buyCurio(state, '寄生植物的花苞')
    expect(state.money_cc).toBe(money - itemDef('寄生植物的花苞')!.price_cc)
    expect(state.inventory.some((i) => i.name === '寄生植物的花苞')).toBe(true)
    expect(curioStock(state).some((c) => c.item === '寄生植物的花苞')).toBe(false)
    state.time.day += 1
    expect(curioStock(state).some((c) => c.item === '寄生植物的花苞')).toBe(true)
  })

  it('start their event right away in a dungeon, ignoring chance, cooldown and the layer', () => {
    for (const [name, id] of LURES) {
      const state = inDungeon('fem', 1)
      // 剛遇過別的事件（冷卻中）、魅魔之箱只在深層以下：引子照樣引來
      state.dungeonEvents = { last: state.time.day * 24 + (state.time.hour ?? 0), seen: { [id]: state.time.day } }
      addItem(state.inventory, name, 1)
      useItem(state, name, pcOf(state).id)
      expect(pendingDungeonEvent(state)?.id, name).toBe(id)
      expect(state.inventory.some((i) => i.name === name), name).toBe(false)
    }
  })

  it('refuse outside a dungeon or while something else is pending, and are not used up', () => {
    const town = hero()
    enterLocation(town)
    addItem(town.inventory, '魅魔的封印箱', 1)
    expect(() => useItem(town, '魅魔的封印箱', pcOf(town).id)).toThrow('地下城裡')
    expect(town.inventory.some((i) => i.name === '魅魔的封印箱')).toBe(true)

    const state = inDungeon()
    addItem(state.inventory, '魅魔的封印箱', 1)
    state.dungeonEvent = { template: 'dg_lewd_dream', trigger: 'rest' }
    expect(() => useItem(state, '魅魔的封印箱', pcOf(state).id)).toThrow('先應付眼前的處境')
    expect(state.dungeonEvent.template).toBe('dg_lewd_dream')
    expect(state.inventory.some((i) => i.name === '魅魔的封印箱')).toBe(true)
  })

  it('refuse when the content filter blocks their event', () => {
    const state = inDungeon()
    addItem(state.inventory, '寄生植物的花苞', 1)
    setContentFilters({ pc_unwilling: false })
    expect(() => useItem(state, '寄生植物的花苞', pcOf(state).id)).toThrow('不會發生')
  })
})

describe('parasites for masculine heroes', () => {
  it('have a masculine version of each parasite event, mirroring the original', () => {
    for (const id of ['dg_cursed_lingerie', 'dg_succubus_box', 'dg_seed_plant', 'dg_incubus_visit']) {
      const f = template(id)
      const m = template(`${id}_m`)
      expect(m.pc_body, id).toEqual(['masc'])
      expect(m.tags, id).toEqual(f.tags)
      expect(m.triggers, id).toEqual(f.triggers)
      expect(m.layers, id).toEqual(f.layers)
      expect(m.dungeons, id).toEqual(f.dungeons)
      expect(m.options!.map((o) => [o.check, o.adult_scene, o.success?.effects, o.fail?.effects, o.success?.set_flags, o.fail?.set_flags]), id)
        .toEqual(f.options!.map((o) => [o.check, o.adult_scene, o.success?.effects, o.fail?.effects, o.success?.set_flags, o.fail?.set_flags]))
      expect(parasitesFrom(m), id).toEqual(parasitesFrom(f))
    }
  })

  it('a masculine hero gets each of the three parasites (lures pick the masculine version)', () => {
    for (const [name, id, parasite] of LURES) {
      const state = inDungeon('masc', 3)
      expect(dungeonCandidates(state, currentArea(state), template(id).triggers![0]!).some((t) => t.id === id), name).toBe(false)
      addItem(state.inventory, name, 1)
      useItem(state, name, pcOf(state).id)
      expect(pendingDungeonEvent(state)?.id, name).toBe(`${id}_m`)
      answerDungeonEvent(state, yieldIndex(`${id}_m`))
      expect(parasiteOf(pcOf(state), parasite), name).toBeTruthy()
    }
    // 夢魔的夜訪：安全房長休的版本也帶來契紋
    const state = inDungeon('masc', 2)
    expect(dungeonCandidates(state, currentArea(state), 'rest').some((t) => t.id === 'dg_incubus_visit_m')).toBe(true)
    state.dungeonEvent = { template: 'dg_incubus_visit_m', trigger: 'rest' }
    answerDungeonEvent(state, yieldIndex('dg_incubus_visit_m'))
    expect(parasiteOf(pcOf(state), MARK)).toBeTruthy()
  })

  it('feminine heroes still get the original events', () => {
    const state = inDungeon('andro')
    addItem(state.inventory, '受詛咒的黑色內衣', 1)
    useItem(state, '受詛咒的黑色內衣', pcOf(state).id)
    expect(pendingDungeonEvent(state)?.id).toBe('dg_cursed_lingerie')
    expect(dungeonCandidates(state, currentArea(state), 'chest').some((t) => t.id === 'dg_cursed_lingerie_m')).toBe(false)
  })
})
