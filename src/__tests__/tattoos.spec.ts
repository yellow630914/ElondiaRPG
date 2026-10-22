import { afterEach, describe, expect, it } from 'vitest'
import { attrsOf, attrSources } from '@/engine/character'
import { marketStock } from '@/engine/companions'
import { slaveryRules } from '@/engine/data'
import { applyEffects } from '@/engine/effects'
import { enterLocation } from '@/engine/grid'
import { pcOf } from '@/engine/party'
import { contractKind, contractTerms, deriveFunctions, startAsSlave, termsFromTemplate } from '@/engine/slavery'
import { migrate, newGame } from '@/engine/state'
import { sanitizeEffects } from '@/engine/storyMods'
import {
  addTattoo, contractOf, freePlaces, isTattooPlace, oathError, removeTattoo, slaveMarkOf, TATTOO_PLACES, tattooAt, tattooFromTemplate,
  tattooRules, tattoosOf, tattooSummary,
} from '@/engine/tattoos'
import type { Character, GameState, Report } from '@/engine/types'

function game(seed = 3): GameState {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed, birthplace: 'rhineburg' })
  enterLocation(state)
  return state
}

function blank(state: GameState): Report {
  return {
    schema_version: '0.1', report_id: `r-${state.nextReportNo++}`, kind: 'event',
    time: { start: { ...state.time }, end: { ...state.time } }, location: { at: state.location }, party: [], outcome: { result: 'neutral' }, changes: {},
  }
}

const keepLabor = JSON.parse(JSON.stringify(slaveryRules.contracts.labor))
afterEach(() => Object.assign(slaveryRules.contracts.labor!, JSON.parse(JSON.stringify(keepLabor))))

describe('tattoo data', () => {
  it('has eleven places, and every template fits the rules', () => {
    expect(TATTOO_PLACES).toHaveLength(11)
    for (const [id, t] of Object.entries(tattooRules.templates)) {
      for (const p of t.places ?? []) expect(isTattooPlace(p), `${id} ${p}`).toBe(true)
      if (t.kind === 'oath') expect(oathError(t.attrs), id).toBeUndefined()
      else expect(t.attrs, id).toBeUndefined()
    }
    for (const [id, c] of Object.entries(slaveryRules.contracts)) expect(isTattooPlace(c.place), id).toBe(true)
  })

  it('derives the same mark functions the templates used to list', () => {
    expect(termsFromTemplate('labor').functions).toEqual(['identity', 'obedience', 'income', 'tracking'])
    expect(termsFromTemplate('combat').functions).toEqual(['identity', 'obedience', 'income', 'tracking', 'tether'])
    expect(termsFromTemplate('arcane').functions).toContain('spell_seal')
    expect(deriveFunctions({ ...termsFromTemplate('labor'), income_share: 0, recapture_chance: 0 })).toEqual(['identity', 'obedience'])
  })

  it('reads the template roles and market weights from data', () => {
    expect(contractKind('no_such_mark')).toBe(slaveryRules.roles.default)
    const state = game()
    for (const l of marketStock(state, 'public')) expect(Object.keys(slaveryRules.market_contracts.public)).toContain(l.contract)
  })
})

describe('oath rules', () => {
  it('need gains and losses that add up to zero', () => {
    expect(oathError({ str: 3, int: -2, cha: -1 })).toBeUndefined()
    expect(oathError({ str: 3, int: -2 })).toContain('總和')
    expect(oathError({ str: 2, dex: -2 })).toBeUndefined()
    expect(oathError({ str: 4, int: -4 })).toContain('±3')
    expect(oathError({ str: 1, dex: 1, int: 1, fai: -3 })).toContain('3 項')
    expect(oathError({ str: 2 })).toContain('有加也有減')
    expect(oathError({ luck: 1, str: -1 })).toContain('五種屬性')
  })

  it('change the effective attributes until they are removed', () => {
    const state = game()
    const pc = pcOf(state)
    const base = { ...pc.attrs }
    addTattoo(pc, tattooFromTemplate('oath_berserker', pc), state.time)
    expect(attrsOf(pc)).toMatchObject({ str: base.str + 3, int: base.int - 2, cha: base.cha - 1 })
    expect(attrSources(pc)[0]!.label).toBe('誓約印記【狂戰之誓】')
    expect(pc.attrs).toEqual(base)
    removeTattoo(pc, tattoosOf(pc)[0]!.place)
    expect(attrsOf(pc)).toEqual(base)
  })

  it('are limited per character', () => {
    const state = game()
    const pc = pcOf(state)
    addTattoo(pc, tattooFromTemplate('oath_sage', pc), state.time)
    addTattoo(pc, tattooFromTemplate('oath_shadow', pc), state.time)
    expect(() => addTattoo(pc, tattooFromTemplate('oath_wild', pc), state.time)).toThrow('最多 2 個')
  })
})

describe('tattoos on the body', () => {
  it('take one place each, preferring the template places', () => {
    const state = game()
    const pc = pcOf(state)
    const t = addTattoo(pc, tattooFromTemplate('spread_hawk', pc), state.time)
    expect(t.place).toBe('back')
    expect(addTattoo(pc, tattooFromTemplate('spread_hawk', pc), state.time).place).toBe('chest')
    expect(() => addTattoo(pc, { ...tattooFromTemplate('lotus', pc), place: 'back' }, state.time)).toThrow('背部已經有普通刺青【展翅之鷹】')
    expect(freePlaces(pc)).toHaveLength(9)
    expect(tattooSummary(pc)).toContain('背部：普通刺青【展翅之鷹】')
  })

  it('carve the slave mark where its terms say, covering what was there', () => {
    const state = game()
    const pc = pcOf(state)
    addTattoo(pc, { kind: 'plain', place: 'belly', name: '雙魚', desc: '' }, state.time)
    startAsSlave(state, { master: { type: 'none' }, mark: 'brothel' })
    expect(slaveMarkOf(pc)!.place).toBe('belly')
    expect(tattoosOf(pc)).toHaveLength(1)
    expect(contractOf(pc)!.kind).toBe('brothel')
  })

  it('keep the mark terms from the moment of marking', () => {
    const state = game()
    startAsSlave(state, { master: { type: 'none' }, mark: 'labor' })
    const before = contractTerms(contractOf(pcOf(state))!).income_share
    slaveryRules.contracts.labor!.income_share = 0.05
    expect(contractTerms(contractOf(pcOf(state))!).income_share).toBe(before)
    expect(termsFromTemplate('labor').income_share).toBe(0.05)
  })

  it('cannot wash away a slave mark', () => {
    const state = game()
    const pc = pcOf(state)
    startAsSlave(state, { master: { type: 'none' }, mark: 'labor' })
    expect(removeTattoo(pc, 'neck')).toBeUndefined()
    expect(tattooAt(pc, 'neck')!.kind).toBe('slave')
  })
})

describe('tattoo effects', () => {
  it('ink and wash the player from events', () => {
    const state = game()
    const pc = pcOf(state)
    const r = blank(state)
    const notes = applyEffects(state, r, [
      { type: 'tattoo', template: 'wolf_head', by: '老水手' },
      { type: 'tattoo', kind: 'oath', name: '海誓', text: '海浪紋', attrs: { str: 1, cha: -1 }, place: 'left_calf' },
    ])
    expect(tattooAt(pc, 'chest')).toMatchObject({ kind: 'plain', name: '狼首', by: '老水手' })
    expect(tattooAt(pc, 'left_calf')).toMatchObject({ kind: 'oath', attrs: { str: 1, cha: -1 } })
    expect(notes.join('')).toContain('胸口多了普通刺青【狼首】')
    expect(r.changes.tattoos).toHaveLength(2)
    // 部位已經有刺青：不刺
    expect(applyEffects(state, blank(state), [{ type: 'tattoo', template: 'lotus', place: 'chest' }]).join('')).toContain('沒有刺上')
    applyEffects(state, blank(state), [{ type: 'remove_tattoo', kind: 'oath' }])
    expect(tattooAt(pc, 'left_calf')).toBeUndefined()
    applyEffects(state, blank(state), [{ type: 'remove_tattoo', place: 'chest' }])
    expect(tattoosOf(pc)).toEqual([])
  })

  it('are cleaned up when written in a story', () => {
    expect(sanitizeEffects([
      { type: 'tattoo', template: 'lotus', place: 'hips' },
      { type: 'tattoo', template: 'nope' },
      { type: 'tattoo', kind: 'oath', name: '壞誓', attrs: { str: 3 } },
      { type: 'tattoo', kind: 'oath', name: '好誓', attrs: { str: 2, int: -2 }, place: 'moon' },
      { type: 'remove_tattoo', place: 'neck' },
      { type: 'remove_tattoo', kind: 'slave' },
    ])).toEqual([
      { type: 'tattoo', template: 'lotus', place: 'hips' },
      { type: 'tattoo', kind: 'oath', name: '好誓', text: '', attrs: { str: 2, int: -2 } },
      { type: 'remove_tattoo', place: 'neck' },
    ])
  })
})

describe('old saves', () => {
  it('move the contract onto a slave mark tattoo', () => {
    const state = game()
    const pc = pcOf(state) as Character & { contract?: unknown }
    pc.contract = { kind: 'combat', master: '', masterName: '', obedience: 4, since: { ...state.time } }
    state.schema = 5
    migrate(state)
    expect(pc.contract).toBeUndefined()
    expect(slaveMarkOf(pc)).toMatchObject({ kind: 'slave', place: 'neck' })
    expect(contractOf(pc)).toMatchObject({ kind: 'combat', obedience: 4, terms: termsFromTemplate('combat') })
  })
})
