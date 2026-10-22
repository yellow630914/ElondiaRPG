import { afterEach, describe, expect, it } from 'vitest'
import { prepareAction, resolveAction } from '@/engine/actions'
import { gainXp, gearAffinities } from '@/engine/character'
import { choosablePerks, perkDef, perkRules } from '@/engine/data'
import { applyEffects } from '@/engine/effects'
import { enterLocation, standOn } from '@/engine/grid'
import { npcIdentity } from '@/engine/npcs'
import { applyPitch } from '@/engine/perkActions'
import {
  checkModifiers, creationPerks, learnablePerks, offerPerks, overcomablePerks, perkPower, perksOf, pitchTarget, rollNpcPerks, sanitizePerk, trainablePerks,
} from '@/engine/perks'
import { pcOf } from '@/engine/party'
import { Rng } from '@/engine/rng'
import { newGame, withRng } from '@/engine/state'
import type { GameState, Report } from '@/engine/types'

function game(opts: Partial<Parameters<typeof newGame>[0]> = {}): GameState {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 4, birthplace: 'rhineburg', ...opts })
  enterLocation(state)
  return state
}

function blank(state: GameState): Report {
  return {
    schema_version: '0.1', report_id: `r-${state.nextReportNo++}`, kind: 'event',
    time: { start: { ...state.time }, end: { ...state.time } }, location: { at: state.location }, party: [], outcome: { result: 'neutral' }, changes: {},
  }
}

const flaws = () => choosablePerks().filter((p) => p.flaw)
const keepCreation = { ...perkRules.creation }
afterEach(() => Object.assign(perkRules.creation, keepCreation))

describe('flaw data', () => {
  it('has 10–12 flaws, each roughly offsetting one ordinary perk', () => {
    const list = flaws()
    expect(list.length).toBeGreaterThanOrEqual(10)
    expect(list.length).toBeLessThanOrEqual(12)
    const normal = choosablePerks().filter((p) => !p.flaw).map(perkPower).sort((a, b) => a - b)
    const median = normal[Math.floor(normal.length / 2)]!
    for (const p of list) {
      // 只有壞處
      for (const e of p.effects) {
        if ('check' in e) expect(e.bonus, p.id).toBeLessThan(0)
        if ('combat' in e) for (const v of Object.values(e.combat)) expect(v, p.id).toBeLessThan(0)
        if ('resist' in e) for (const v of Object.values(e.resist)) expect(v, p.id).toBeGreaterThan(0)
      }
      const power = -perkPower(p)
      expect(power, p.id).toBeGreaterThanOrEqual(normal[0]!)
      expect(power, p.id).toBeLessThanOrEqual(normal[normal.length - 1]!)
      expect(Math.abs(power - median), p.id).toBeLessThanOrEqual(2)
    }
  })
})

describe('flaws in play', () => {
  it('take away from the checks they cover', () => {
    const state = game({ perks: ['flaw_clumsy'] })
    const pc = pcOf(state)
    expect(checkModifiers(pc, { context: 'lock', attr: 'dex' })).toContainEqual({ label: '缺陷【笨手笨腳】', value: -3 })
    expect(checkModifiers(pc, { context: 'action', attr: 'cha' })).toEqual([])
    const shy = pcOf(game({ perks: ['flaw_shy'] }))
    expect(checkModifiers(shy, { context: 'action', kind: 'chat', attr: 'cha' })).toEqual([{ label: '缺陷【怕生】', value: -2 }])
    expect(checkModifiers(shy, { context: 'action', kind: 'bluff', attr: 'cha' })).toEqual([])
  })

  it('weaken the character in combat', () => {
    const plain = gearAffinities(pcOf(game()))
    const hurt = gearAffinities(pcOf(game({ perks: ['flaw_old_wound', 'flaw_hydrophobic'] })))
    expect(hurt.mods.evade ?? 0).toBe((plain.mods.evade ?? 0) - 1)
    expect(hurt.resist.cold ?? 0).toBe((plain.resist.cold ?? 0) + 0.25)
  })

  it('are listed as flaws in the identity text', () => {
    const text = npcIdentity({ id: 'x', kind: 'commoner', class: '', occupation: '漁夫', perks: ['flaw_drunkard'], race: 'human' })
    expect(text).toContain('缺陷【貪杯】')
  })
})

describe('character creation', () => {
  it('takes at most two flaws', () => {
    const state = game({ perks: ['flaw_shy', 'flaw_lost', 'flaw_coward', 'lucky'] })
    expect(pcOf(state).perks).toEqual(['flaw_shy', 'flaw_lost', 'lucky'])
    expect(creationPerks(['flaw_shy', 'flaw_lost', 'flaw_coward'].map((id) => perkDef(id)!)).error).toContain('最多選 2 個')
  })

  it('gives one more ordinary perk slot for each flaw', () => {
    perkRules.creation.slots = 2
    const ordinary = ['lucky', 'brawler', 'veteran', 'scholar']
    expect(pcOf(game({ perks: ordinary })).perks).toEqual(['lucky', 'brawler'])
    expect(pcOf(game({ perks: [...ordinary, 'flaw_shy'] })).perks).toEqual(['lucky', 'brawler', 'veteran', 'flaw_shy'])
    expect(pcOf(game({ perks: [...ordinary, 'flaw_shy', 'flaw_lost'] })).perks).toEqual([...ordinary, 'flaw_shy', 'flaw_lost'])
    expect(creationPerks(['lucky', 'brawler', 'veteran'].map((id) => perkDef(id)!))).toMatchObject({ normal: 3, slots: 2, error: expect.stringContaining('最多 2 個') })
    // 不限名額（預設）
    perkRules.creation.slots = 0
    expect(pcOf(game({ perks: ordinary })).perks).toEqual(ordinary)
  })

  it('can make a custom flaw, but only with drawbacks', () => {
    const state = game({ customPerks: [{ name: '暈船', flaw: true, effects: [{ check: { contexts: ['travel'] }, bonus: 2 }, { combat: { hit: -9 } }, { resist: { cold: 0.5 } }] }] })
    const p = pcOf(state).customPerks![0]!
    expect(p.flaw).toBe(true)
    // 正的加值不會翻成負的，直接拿掉；其他夾在範圍內
    expect(p.effects).toEqual([{ combat: { hit: -2 } }, { resist: { cold: 0.5 } }])
    expect(perkPower(p)).toBeLessThan(0)
  })
})

describe('getting and overcoming flaws', () => {
  it('never show up in offers to learn, level-ups or training', () => {
    const state = game()
    const pc = pcOf(state)
    expect(learnablePerks(pc).some((p) => p.flaw)).toBe(false)
    expect(offerPerks(pc, '測試', ['flaw_shy', 'lucky'])!.options).toEqual(['lucky'])
    withRng(state, (rng) => gainXp(pc, 100000, rng))
    for (const o of pc.perkOffers ?? []) for (const id of o.options) expect(perkDef(id)!.flaw, id).toBeFalsy()
    expect(trainablePerks(pc, 'guild').some((p) => p.flaw)).toBe(false)
  })

  it('come straight from an event effect, and lose_perk overcomes them', () => {
    const state = game()
    const pc = pcOf(state)
    const r = blank(state)
    const notes = applyEffects(state, r, [{ type: 'perk', perk: 'flaw_night_blind', options: ['lucky'] }])
    expect(pc.perks).toContain('flaw_night_blind')
    expect(pc.perkOffers ?? []).toEqual([])
    expect(notes.join('')).toContain('缺陷【夜盲】')
    expect(r.changes.perks).toEqual([{ actor: 'pc', perk: 'flaw_night_blind', name: '夜盲', added: true }])
    const notes2 = applyEffects(state, blank(state), [{ type: 'lose_perk', perk: 'flaw_night_blind' }])
    expect(pc.perks).not.toContain('flaw_night_blind')
    expect(notes2.join('')).toContain('克服了缺陷【夜盲】')
  })

  it('can be overcome by training where the flaw says', () => {
    const state = game({ perks: ['flaw_coward'] })
    const pc = pcOf(state)
    standOn(state, 'guild')
    state.money_cc = 1000
    expect(overcomablePerks(pc, 'guild').map((p) => p.id)).toEqual(['flaw_coward'])
    expect(overcomablePerks(pc, 'temple')).toEqual([])
    prepareAction(state, { kind: 'train', target: 'flaw_coward', text: '每天對著鏡子大吼' })
    state.pendingAction!.natural = 18
    const r = resolveAction(state, null)
    expect(pc.perks).not.toContain('flaw_coward')
    expect(r.changes.perks).toEqual([{ actor: 'pc', perk: 'flaw_coward', name: '膽小', added: false }])
    expect(state.money_cc).toBe(1000 - perkDef('flaw_coward')!.train!.price_cc)
    // 沒有這個缺陷就不能「克服」
    expect(() => prepareAction(state, { kind: 'train', target: 'flaw_coward', text: '' })).toThrow('克服')
  })

  it('cannot be designed by the AI in a pitch', () => {
    // 只有壞處的設計：效果全部拿掉，不成立
    expect(sanitizePerk({ name: '酒鬼', flaw: true, effects: [{ check: {}, bonus: -2 }] }, 'c-x')).toBeUndefined()
    const mixed = sanitizePerk({ name: '酒鬼', flaw: true, effects: [{ check: {}, bonus: -2 }, { check: { kinds: ['chat'] }, bonus: 2 }] }, 'c-x')!
    expect(mixed.flaw).toBeUndefined()
    expect(mixed.effects).toEqual([{ check: { kinds: ['chat'] }, bonus: 2 }])
    const state = game()
    const offer = offerPerks(pcOf(state), '測試', ['pathfinder'])!
    applyPitch(state, blank(state), pitchTarget('pc', offer.id), 'success', { name: '壞習慣', flaw: true, effects: [{ check: { contexts: ['travel'] }, bonus: -2 }] })
    for (const p of perksOf(pcOf(state))) expect(p.flaw, p.name).toBeFalsy()
  })
})

describe('NPC flaws', () => {
  it('roll by weight after the ordinary perks, without changing them', () => {
    let withFlaw = 0
    for (let i = 0; i < 400; i++) {
      const got = rollNpcPerks(new Rng(i), { tags: ['commoner'], class: '' })
      const fl = got.filter((id) => perkDef(id)!.flaw)
      expect(fl.length).toBeLessThanOrEqual(1)
      // 缺陷排在最後
      if (fl.length) expect(got[got.length - 1]).toBe(fl[0])
      if (fl.length) withFlaw++
    }
    expect(withFlaw / 400).toBeGreaterThan(perkRules.npc.flaw_chance * 0.6)
    expect(withFlaw / 400).toBeLessThan(perkRules.npc.flaw_chance * 1.4)
  })
})
