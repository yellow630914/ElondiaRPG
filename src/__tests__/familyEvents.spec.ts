import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abilities, enemies } from '@/engine/data'
import { DEFAULT_FILTERS, setContentFilters } from '@/engine/content'
import { startCombat } from '@/engine/combat'
import { giveBrood } from '@/engine/brood'
import { addLactation, lactationAbilities, milk, milkBlock } from '@/engine/lactation'
import { generateNpc, registerNpc } from '@/engine/npcs'
import { pcOf } from '@/engine/party'
import { parasiteOf, parasiteSummary } from '@/engine/parasites'
import { syncPregnancyMarks } from '@/engine/pregnancy'
import {
  answerPregnancyEvent, broodCandidates, broodFocus, broodTemplates, lactationCandidates, lactationTemplates, maybePregnancyEvent, pendingPregnancyEvent, prunePregnancyEvent,
} from '@/engine/pregnancyEvents'
import { newGame, withRng } from '@/engine/state'
import { baseReport } from '@/engine/town'
import { sanitizeTravelEvent, travelEventWarnings } from '@/engine/travelEventMods'
import type { Character, GameState } from '@/engine/types'

function game(): GameState {
  return newGame({ name: '莉雅', race: 'human', classId: 'bard', gender: '女', seed: 7 })
}
const report = (state: GameState) => baseReport(state, 'event', 0)

function mate(state: GameState): Character {
  const rec = registerNpc(state, withRng(state, (rng) => generateNpc(state, rng, { level: 1, location: state.location, gender: 'female' })))
  const c = { ...pcOf(state), id: rec.id, name: rec.name, isPlayer: false, gender: 'female', status: [], bond: 'slave' } as Character
  state.party.push(c)
  return c
}

function lactate(state: GameState, key: string) {
  addLactation(state, key, { kind: 'event', until: state.time.day + 10 })
  syncPregnancyMarks(state)
}

/** 擲到有事件為止（每次重設冷卻） */
function roll(state: GameState, moment: 'rest' | 'travel' | 'step'): boolean {
  for (let i = 0; i < 300; i++) {
    delete state.pregnancyEvents
    if (maybePregnancyEvent(state, moment)) return true
  }
  return false
}

beforeEach(() => setContentFilters({ ...DEFAULT_FILTERS, pregnancy: true, lactation: true, monster_brood: true }))
afterEach(() => setContentFilters({ ...DEFAULT_FILTERS }))

describe('資料', () => {
  it('泌乳：主角 6 件、夥伴 4 件；苗床：卵生 3、胎生 4、寄生 3；都是成人向，整理之後不變、沒有警告', () => {
    const lact = lactationTemplates()
    expect(lact.filter((t) => t.subject === 'pc')).toHaveLength(6)
    expect(lact.filter((t) => t.subject === 'companion')).toHaveLength(4)
    const brood = broodTemplates()
    for (const [k, n] of [['egg', 3], ['live', 4], ['parasite', 3]] as const) expect(brood.filter((t) => t.brood_kinds?.includes(k)), k).toHaveLength(n)
    for (const t of [...lact, ...brood]) {
      expect(t.tags, t.id).toContain('adult')
      expect(t.tags, t.id).toContain(t.scope === 'lactation' ? 'lactation' : 'monster_brood')
      if (t.subject === 'companion') expect(t.text, t.id).toContain('{a}')
      if (t.options?.some((o) => o.adult_scene)) expect(t.scene, t.id).toBeTruthy()
      expect(travelEventWarnings(t), t.id).toEqual([])
      expect(sanitizeTravelEvent(t.id, t, false), t.id).toEqual(t)
    }
  })
})

describe('泌乳的事件', () => {
  it('泌乳中的主角才有；篩選關掉時沒有；夥伴的事件代進名字', () => {
    const state = game()
    expect(lactationCandidates(state, 'pc', 'rest')).toEqual([])
    lactate(state, 'pc')
    expect(lactationCandidates(state, 'pc', 'rest').length).toBeGreaterThan(0)
    expect(lactationCandidates(state, 'pc', 'rest').every((t) => t.subject === 'pc')).toBe(true)
    setContentFilters({ lactation: false })
    expect(roll(state, 'rest')).toBe(false)
    setContentFilters({ lactation: true })
    const m = mate(state)
    lactate(state, m.id)
    expect(lactationCandidates(state, m.id, 'rest').every((t) => t.subject === 'companion')).toBe(true)
    // 只有夥伴泌乳時：擲到夥伴的事件，名字代進去，回應之後清掉
    const solo = game()
    const n = mate(solo)
    lactate(solo, n.id)
    expect(roll(solo, 'rest')).toBe(true)
    expect(solo.pregnancyEvent?.mother).toBe(n.id)
    const ev = pendingPregnancyEvent(solo)!
    expect(ev.scope).toBe('lactation')
    expect(ev.title).not.toContain('{a}')
    answerPregnancyEvent(solo, 1)
    expect(solo.pregnancyEvent).toBeUndefined()
  })
})

describe('苗床的事件', () => {
  it('照種類與階段挑；{m} 是留下苗床的怪物，交給 AI 時附上牠的樣子', () => {
    const state = game()
    giveBrood(state, report(state), 'brood_tentacle', false, 'lp_deep_tentacle')
    const p = parasiteOf(pcOf(state), 'brood_tentacle')!
    expect(p.monster).toBe('lp_deep_tentacle')
    expect(parasiteSummary(pcOf(state))).toContain(`${enemies.lp_deep_tentacle!.name}留下的`)
    const early = broodCandidates(state, 'brood_tentacle', 'rest')
    expect(early.every((t) => t.brood_kinds?.includes('live') !== false)).toBe(true)
    expect(early.some((t) => t.brood_kinds?.includes('egg'))).toBe(false)
    expect(early.some((t) => t.id === 'br_live_dream')).toBe(false)
    p.corruption = 40
    expect(broodCandidates(state, 'brood_tentacle', 'rest', { day: state.time.day, hour: 23 }).some((t) => t.id === 'br_live_dream')).toBe(true)
    expect(broodFocus(state, 'brood_tentacle')).toContain(enemies.lp_deep_tentacle!.desc!)
    state.pregnancyEvent = { template: 'br_live_dream', mother: 'pc', parasite: 'brood_tentacle' }
    expect(pendingPregnancyEvent(state)!.title).toBe(`${enemies.lp_deep_tentacle!.name}的夢`)
    const r = answerPregnancyEvent(state, 0)
    expect(r.narration?.focus?.join()).toContain(enemies.lp_deep_tentacle!.name)
    expect(r.narration?.adult_scene).toContain(enemies.lp_deep_tentacle!.name)
    // 苗床不在了：等待中的事件作廢；沒記下怪物時寫「不知名的魔物」
    state.pregnancyEvent = { template: 'br_live_kick', mother: 'pc', parasite: 'brood_slug' }
    prunePregnancyEvent(state)
    expect(state.pregnancyEvent).toBeUndefined()
    giveBrood(state, report(state), 'brood_slug')
    state.pregnancyEvent = { template: 'br_par_crawl', mother: 'pc', parasite: 'brood_slug' }
    expect(pendingPregnancyEvent(state)!.text).toContain('不知名的魔物')
  })

  it('篩選「怪物的苗床」關掉時不擲', () => {
    const state = game()
    giveBrood(state, report(state), 'brood_wasp_egg')
    expect(roll(state, 'travel')).toBe(true)
    expect(state.pregnancyEvent?.parasite).toBe('brood_wasp_egg')
    delete state.pregnancyEvent
    setContentFilters({ monster_brood: false })
    expect(roll(state, 'travel')).toBe(false)
  })
})

describe('擠奶', () => {
  it('泌乳時戰鬥中多一個「擠奶」技能', () => {
    const state = game()
    expect(abilities.lact_milking).toBeTruthy()
    expect(lactationAbilities(pcOf(state))).toEqual([])
    lactate(state, 'pc')
    expect(lactationAbilities(pcOf(state))).toEqual(['lact_milking'])
    const combat = startCombat(state, [['goblin', 1]])
    expect(combat.combatants.find((c) => c.id === pcOf(state).id)!.abilities).toContain('lact_milking')
  })

  it('角色詳情的擠奶：一天一次，得到母乳；沒泌乳時不行', () => {
    const state = game()
    const pc = pcOf(state)
    expect(milkBlock(state, pc)).toContain('沒有在泌乳')
    lactate(state, 'pc')
    expect(milkBlock(state, pc)).toBeUndefined()
    const r = milk(state, pc.id)
    expect(state.inventory.find((i) => i.name === '母乳')?.qty).toBeGreaterThanOrEqual(1)
    expect(r.narration?.adult_scene).toBeTruthy()
    expect(milkBlock(state, pc)).toBe('今天已經擠過了')
  })
})
