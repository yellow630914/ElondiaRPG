import { afterEach, describe, expect, it } from 'vitest'
import { prepareAction, resolveAction } from '@/engine/actions'
import { attrsOf, attrSources } from '@/engine/character'
import { marketStock } from '@/engine/companions'
import { geography, isSettlement, locationById, slaveryRules } from '@/engine/data'
import { applyEffects } from '@/engine/effects'
import { blockKeys, enterLocation, getArea, standOn } from '@/engine/grid'
import { pcOf } from '@/engine/party'
import {
  answerMasterEvent, contractKind, contractTerms, deriveFunctions, eventFits, masterCandidates, oathStrength, startAsSlave, startMasterEvent, termsFromTemplate, unmarkOffers,
} from '@/engine/slavery'
import { applyContent, emptyMods, normalizeMods } from '@/engine/mods'
import { markUsage, tattooUsage } from '@/engine/tattooMods'
import { characterFor, registerNpc } from '@/engine/npcs'
import { inkPrice, inkTattoo, tattooShop, washTattoo } from '@/engine/tattooShop'
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

describe('tattoo shops', () => {
  it('stand in the cities, and mark carvers in the capitals and black-market towns', () => {
    for (const loc of geography.locations) {
      const kinds = new Set(blockKeys(loc.id).flatMap((k) => (isSettlement(loc) ? getArea(game(), k).cells.map((c) => c.kind) : [])))
      if (['capital', 'city', 'port'].includes(loc.type)) expect(kinds.has('tattoo'), loc.id).toBe(true)
      if (loc.type === 'capital' || slaveryRules.markets[loc.id]?.black) expect(kinds.has('carver'), loc.id).toBe(true)
    }
  })

  it('ink plain tattoos at the parlor and oath marks at the carver, for a price', () => {
    const state = game()
    const pc = pcOf(state)
    state.money_cc = 100000
    standOn(state, 'tattoo')
    inkTattoo(state, { template: 'lotus', place: 'hips' })
    expect(tattooAt(pc, 'hips')).toMatchObject({ kind: 'plain', name: '蓮花', by: '刺青店' })
    expect(state.money_cc).toBe(100000 - tattooShop('parlor').ink!)
    expect(() => inkTattoo(state, { template: 'oath_sage', place: 'chest' })).toThrow('只刺普通刺青')
    expect(inkPrice('parlor', { kind: 'plain' })).toBe(tattooShop('parlor').ink! + tattooShop('parlor').custom_extra!)

    standOn(state, 'carver')
    const before = state.money_cc
    inkTattoo(state, { template: 'oath_berserker', place: 'back' })
    expect(state.money_cc).toBe(before - 3 * tattooShop('carver').oath_per_point!)
    expect(() => inkTattoo(state, { kind: 'oath', name: '亂誓', desc: '', place: 'chest', attrs: { str: 3, int: -1 } })).toThrow('總和')
    inkTattoo(state, { kind: 'oath', name: '海誓', desc: '浪紋', place: 'chest', attrs: { cha: 2, str: -2 } })
    expect(tattooAt(pc, 'chest')!.attrs).toEqual({ str: -2, cha: 2 })
  })

  it('wash tattoos by what each shop takes; the temple wants reputation', () => {
    const state = game()
    const pc = pcOf(state)
    state.money_cc = 100000
    addTattoo(pc, tattooFromTemplate('lotus', pc, 'hips'), state.time)
    addTattoo(pc, tattooFromTemplate('oath_sage', pc, 'chest'), state.time)
    standOn(state, 'tattoo')
    expect(() => washTattoo(state, 'chest')).toThrow('不洗誓約印記')
    washTattoo(state, 'hips')
    expect(tattooAt(pc, 'hips')).toBeUndefined()
    standOn(state, 'temple')
    expect(() => washTattoo(state, 'chest')).toThrow('聲望')
    state.reputation[locationById(state.location).faction!] = tattooShop('temple').min_reputation!
    const before = state.money_cc
    washTattoo(state, 'chest')
    expect(state.money_cc).toBe(before - tattooShop('temple').remove.oath!)
    expect(attrsOf(pc)).toEqual(pc.attrs)
  })

  it('let a wizard unpick an oath, leaving the ink as a plain tattoo', () => {
    const state = game()
    const pc = pcOf(state)
    addTattoo(pc, tattooFromTemplate('oath_shadow', pc, 'back'), state.time)
    const wiz = { ...masterCandidates('rhineburg', 11)[0]!, class: 'wizard' }
    registerNpc(state, wiz)
    state.party.push({ ...characterFor(state, wiz), bond: 'voluntary' })
    const offer = unmarkOffers(state).find((o) => o.place === 'back')!
    expect(offer).toMatchObject({ fee_cc: 0, target: `mage:${wiz.id}@back`, dc: oathStrength(tattooAt(pc, 'back')!) - 3 })
    prepareAction(state, { kind: 'unmark', target: offer.target, text: '' })
    state.pendingAction!.natural = 20
    resolveAction(state, null)
    expect(tattooAt(pc, 'back')).toMatchObject({ kind: 'plain', name: '影行之誓' })
    expect(tattooAt(pc, 'back')!.attrs).toBeUndefined()
    expect(attrsOf(pc)).toEqual(pc.attrs)
  })
})

describe('masters ink their slaves', () => {
  function enslaved(): GameState {
    const state = game()
    const [rec] = masterCandidates('rhineburg', 3)
    startAsSlave(state, { master: { type: 'candidate', rec: rec! }, mark: 'labor' })
    return state
  }
  const crest = () => slaveryRules.master_events.events.find((e) => e.id === 'ink_crest')!

  it('only on a bare place, with the master named', () => {
    const state = enslaved()
    const pc = pcOf(state)
    const master = contractOf(pc)!
    expect(eventFits(state, { id: master.master, tags: [] }, crest())).toBe(true)
    startMasterEvent(state, crest())
    answerMasterEvent(state, 0)
    const t = tattoosOf(pc).find((x) => x.kind === 'plain')!
    expect(t).toMatchObject({ name: `${master.masterName}的記號`, by: master.masterName })
    expect(t.place).not.toBe('neck')
    // 身上都刺滿了：不會再有主人刺青的事件
    for (const p of freePlaces(pc)) addTattoo(pc, { kind: 'plain', place: p, name: '填', desc: '' }, state.time)
    expect(eventFits(state, { id: master.master, tags: [] }, crest())).toBe(false)
  })

  it('never ink over an existing tattoo', () => {
    const state = enslaved()
    const pc = pcOf(state)
    addTattoo(pc, { kind: 'plain', place: 'left_thigh', name: '舊刺青', desc: '' }, state.time)
    const notes = applyEffects(state, blank(state), [{ type: 'tattoo', kind: 'plain', name: '徽記', text: '', place: 'left_thigh' }])
    expect(notes.join('')).toContain('沒有刺上')
    expect(tattooAt(pc, 'left_thigh')!.name).toBe('舊刺青')
  })
})

describe('tattoo content', () => {
  afterEach(() => applyContent(emptyMods()))

  it('adds custom templates and marks, and drops unbalanced oaths', () => {
    const m = normalizeMods({
      tattoos: {
        mod_tattoo_a: { kind: 'oath', name: '星誓', desc: '星紋', attrs: { int: 2, str: -2 }, custom: true },
        mod_tattoo_b: { kind: 'oath', name: '壞誓', desc: '', attrs: { int: 3 }, custom: true },
      },
      marks: { mod_mark_a: { name: '鐵環印', mark: '腳踝上的鐵環紋', place: 'left_calf', income_share: 2, negotiate_dc: 34, escape_dc: 40, exit_dc: 3, recapture_chance: 0.9, escape_effects: { hp_ratio: 0.5 }, obedience_penalty: 12, side_effects: ['走路時叮噹作響'], custom: true } },
      markRules: { rules: { roles: { default: 'mod_mark_a', madam: 'nope' }, market_contracts: { public: { mod_mark_a: 5, ghost: 9 }, black: {} }, severity: ['mod_mark_a', 'labor', 'ghost'], self_sale: { labor: 1 } } },
    })
    expect(Object.keys(m.tattoos)).toEqual(['mod_tattoo_a'])
    expect(m.marks.mod_mark_a).toMatchObject({ income_share: 1, negotiate_dc: 34, escape_dc: 35, exit_dc: 5, recapture_chance: 0.8, obedience_penalty: 10, place: 'left_calf' })
    expect(m.markRules.rules).toMatchObject({ roles: { default: 'mod_mark_a', madam: 'brothel' }, severity: ['mod_mark_a', 'labor'], market_contracts: { public: { mod_mark_a: 5 } } })
    applyContent(m)
    expect(tattooRules.templates.mod_tattoo_a!.name).toBe('星誓')
    expect(slaveryRules.roles.default).toBe('mod_mark_a')
    expect(termsFromTemplate('mod_mark_a')).toMatchObject({ place: 'left_calf', functions: expect.arrayContaining(['tether', 'tracking', 'income']) })
    // 新刻的印記照新模板，刻在它的部位
    const state = game()
    startAsSlave(state, { master: { type: 'none' }, mark: slaveryRules.roles.default })
    expect(slaveMarkOf(pcOf(state))!.place).toBe('left_calf')
    expect(markUsage('mod_mark_a')).toEqual(expect.arrayContaining(['印記設定：預設的印記', '印記設定：刻印檢定的輕重順序', '印記設定：奴隸市場的權重']))
    // 恢復內建
    applyContent(emptyMods())
    expect(slaveryRules.roles.default).toBe('labor')
    expect(slaveryRules.contracts.mod_mark_a).toBeUndefined()
    expect(tattooRules.templates.mod_tattoo_a).toBeUndefined()
  })

  it('knows where built-in templates are used', () => {
    expect(tattooUsage('butterfly')).toContain('主人的事件「ink_crest」')
    expect(markUsage('brothel')).toContain('印記設定：老鴇刻的印記')
  })
})
