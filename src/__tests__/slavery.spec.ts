import { describe, expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020'
import schema from '../../schemas/report.schema.json'
import { prepareAction, resolveAction, sanitizeJudgment } from '@/engine/actions'
import { buySlave, marketStock, offerSelf, pickBuyer, rejoinAway } from '@/engine/companions'
import { finishCombat, startCombat } from '@/engine/combat'
import { slaveryRules } from '@/engine/data'
import { applyEffects } from '@/engine/effects'
import { enterLocation, goOutskirts, move, standOn } from '@/engine/grid'
import { isBound, isEnslaved, isFugitive, isNoncombatant, leaderOf } from '@/engine/party'
import { characterFor, generateNpc, registerNpc } from '@/engine/npcs'
import { Rng } from '@/engine/rng'
import {
  answerMasterEvent, chooseMark, contractTerms, markSummary, masterCandidates, maybeMasterEvent, permitDc, sanitizeTerms, startAsSlave,
  markStrength, masterNearby, masterTagDc, masterWhereabouts, seekMasterDc, startMasterEvent, unmarkOffers,
} from '@/engine/slavery'
import { commitReport, newGame } from '@/engine/state'
import type { GameState, Report } from '@/engine/types'

const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema)

function game(seed = 3, location = 'rhineburg'): GameState {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed, birthplace: location })
  enterLocation(state)
  return state
}

function act(state: GameState, input: Parameters<typeof prepareAction>[1], natural: number) {
  prepareAction(state, input)
  state.pendingAction!.natural = natural
  const r = resolveAction(state, null)
  expect(validate(r), JSON.stringify(validate.errors)).toBe(true)
  return r
}

function blank(state: GameState): Report {
  return {
    schema_version: '0.1', report_id: `r-${state.nextReportNo++}`, kind: 'event',
    time: { start: { ...state.time }, end: { ...state.time } }, location: { at: state.location }, party: [], outcome: { result: 'neutral' }, changes: {},
  }
}

describe('mark terms', () => {
  it('clamps custom marks and derives their functions', () => {
    const t = sanitizeTerms({ name: '月下的鎖鏈紋樣很長很長很長很長', mark: '鎖骨上一圈銀色的月紋', income_share: 3, negotiate_dc: 99, escape_dc: 2, exit_dc: 14, recapture_chance: 0, escape_hp_ratio: 0.5, side_effects: ['月圓時發燙'] })
    expect(t.name.length).toBeLessThanOrEqual(slaveryRules.custom_mark.name_chars)
    expect(t).toMatchObject({ income_share: 1, negotiate_dc: 30, escape_dc: 8, exit_dc: 14, recapture_chance: 0 })
    expect(t.functions).toContain('tether')
    expect(t.functions).not.toContain('tracking')
  })
})

describe('starting as a slave', () => {
  it('serves a chosen master with a chosen mark', () => {
    const state = game()
    const [rec] = masterCandidates('rhineburg', 3)
    expect(rec!.kind).toBe('adventurer')
    const r = startAsSlave(state, { master: { type: 'candidate', rec: rec! }, mark: 'combat' })
    expect(validate(r)).toBe(true)
    expect(leaderOf(state)?.id).toBe(rec!.id)
    expect(isBound(state)).toBe(true)
    expect(state.party[0]!.contract).toMatchObject({ kind: 'combat', master: rec!.id })
    expect(markSummary(state.party[0]!.contract!)).toContain('出城 DC 14')
  })

  it('can design the master and the mark', () => {
    const state = game()
    startAsSlave(state, {
      master: { type: 'custom', spec: { name: '維克多', race: 'demon', class: 'wizard', level: 6, personality: '冷酷而講究規矩' } },
      mark: { name: '黑薔薇印', mark: '左胸上一朵黑色的薔薇', income_share: 0.3, negotiate_dc: 15, escape_dc: 16, exit_dc: 10, recapture_chance: 0.15, escape_hp_ratio: 0.2 },
    })
    const master = leaderOf(state)!
    expect(master).toMatchObject({ name: '維克多', race: 'demon', class: 'wizard', level: 6 })
    expect(contractTerms(state.party[0]!.contract!)).toMatchObject({ name: '黑薔薇印', exit_dc: 10, income_share: 0.3 })
  })

  it('may have no master: the mark stays but nobody holds the leash', () => {
    const state = game()
    startAsSlave(state, { master: { type: 'none' }, mark: 'labor' })
    expect(isEnslaved(state)).toBe(true)
    expect(isBound(state)).toBe(false)
    expect(leaderOf(state)).toBeUndefined()
    const money = state.money_cc
    const r = blank(state)
    applyEffects(state, r, [{ type: 'money', amount: 100 }])
    commitReport(state, r)
    expect(state.money_cc).toBe(money + 100)
    standOn(state, 'gate')
    goOutskirts(state)
  })
})

describe('the master holds the leash', () => {
  function bound(mark = 'labor') {
    const state = game()
    const [rec] = masterCandidates('rhineburg', 3)
    startAsSlave(state, { master: { type: 'candidate', rec: rec! }, mark })
    standOn(state, 'gate')
    return state
  }

  it('needs the master’s permission to leave town, harder with heavier marks', () => {
    const labor = bound('labor')
    const arcane = bound('arcane')
    expect(permitDc(arcane) - permitDc(labor)).toBe(16 - 12 + (5 - 2))
    expect(() => goOutskirts(labor)).toThrow('請求')
    act(labor, { kind: 'master_permit', text: '說要去近郊替主人採藥' }, 20)
    goOutskirts(labor)

    act(arcane, { kind: 'master_permit', text: '' }, 1)
    expect(() => goOutskirts(arcane)).toThrow('不准')
    expect(() => prepareAction(arcane, { kind: 'master_permit', text: '' })).toThrow('拒絕')
  })

  it('springs master events while moving, with a cooldown, and waits for an answer', () => {
    const state = bound()
    const ev = maybeMasterEvent(state, 1)!
    expect(state.pendingMasterEvent).toEqual(ev)
    expect(() => move(state, 0, 1)).toThrow('回應主人')
    expect(() => prepareAction(state, { kind: 'free', text: '看看四周' })).toThrow('回應主人')
    const r = answerMasterEvent(state, 0)
    expect(validate(r)).toBe(true)
    expect(r.outcome.tags).toContain('主人')
    expect(r.outcome.summary).toContain(slaveryRules.master_events.events.find((e) => e.id === ev.id)!.options[0]!.label)
    expect(state.pendingMasterEvent).toBeUndefined()
    expect(maybeMasterEvent(state, 1)).toBeUndefined()
    state.time.day += 1
    expect(maybeMasterEvent(state, 1)).toBeTruthy()
  })

  it('offers three answers per event, each one valid', () => {
    for (const def of slaveryRules.master_events.events) {
      expect(def.options).toHaveLength(3)
      def.options.forEach((_, i) => {
        const state = bound()
        state.money_cc = 5
        startMasterEvent(state, def)
        const r = answerMasterEvent(state, i)
        expect(validate(r), `${def.id}/${i} ${JSON.stringify(validate.errors)}`).toBe(true)
        expect(state.money_cc).toBeGreaterThanOrEqual(0)
      })
    }
  })

  it('keeps adult events behind the adult setting', () => {
    const adult = slaveryRules.master_events.events.filter((e) => e.adult).map((e) => e.id)
    expect(adult).toContain('proposition')
    const seen = (opts: { adult?: boolean }) => {
      const ids = new Set<string>()
      for (let seed = 1; seed < 80; seed++) {
        const state = bound()
        state.rngState = seed
        ids.add(maybeMasterEvent(state, 1, opts)!.id)
      }
      return ids
    }
    expect([...seen({})].some((id) => adult.includes(id))).toBe(false)
    expect(seen({ adult: true })).toContain('proposition')
  })

  it('lets the player answer in their own words', () => {
    const state = bound()
    startMasterEvent(state, slaveryRules.master_events.events.find((e) => e.id === 'bad_mood')!)
    const master = leaderOf(state)!.id
    const before = state.relationships![master]!.affinity
    const r = act(state, { kind: 'master_event', text: '端上一杯熱茶，問主人今天遇到了什麼事' }, 20)
    expect(r.outcome.summary).toBeTruthy()
    expect(state.pendingMasterEvent).toBeUndefined()
    expect(state.relationships![master]!.affinity).toBe(before + 3)
  })
})

describe('marking when enslaved', () => {
  function sold(): GameState {
    for (let seed = 1; seed < 60; seed++) {
      const state = game(seed)
      state.party[0]!.attrs.cha = 16
      offerSelf(state, 'public')
      if (state.pendingMark) return state
    }
    throw new Error('nobody bought')
  }

  it('holds everything until the mark is chosen; a great showing lets you design it', () => {
    const state = sold()
    expect(() => move(state, 0, -1)).toThrow('刻印')
    act(state, { kind: 'marking', text: '低頭順從，懇求用最輕的印記' }, 20)
    expect(state.pendingMark?.custom).toBe(true)
    chooseMark(state, { name: '細鏈', mark: '手腕上一圈細細的銀鏈紋', exit_dc: 8 })
    expect(state.pendingMark).toBeUndefined()
    expect(contractTerms(state.party[0]!.contract!)).toMatchObject({ name: '細鏈', exit_dc: 8 })
  })

  it('a fumble brings the heaviest mark; the AI may describe it from your behaviour', () => {
    const state = sold()
    const p = prepareAction(state, { kind: 'marking', text: '咬了刻印師一口' })
    state.pendingAction!.natural = 1
    const j = sanitizeJudgment(state, p, { degree: 'fumble', effects: [{ type: 'mark', name: '咬痕之印', text: '頸側一道帶著齒痕形狀的紫色法陣' }] })
    resolveAction(state, j)
    expect(state.pendingMark?.allowed).toEqual(['arcane'])
    expect(() => chooseMark(state, 'labor')).toThrow('不能選')
    chooseMark(state, 'arcane')
    const c = state.party[0]!.contract!
    expect(contractTerms(c)).toMatchObject({ name: '咬痕之印', mark: '頸側一道帶著齒痕形狀的紫色法陣', exit_dc: 16 })
    expect(c.obedience).toBe(slaveryRules.contracts.arcane!.obedience_penalty + 1)
  })
})

describe('slave companions', () => {
  it('buys a slave with a chosen mark, and rolls with advantage against your own slave', () => {
    const state = game(4)
    state.money_cc = 100000
    const l = marketStock(state, 'public')[0]!
    buySlave(state, 'public', l.npc, { name: '家紋', mark: '肩上一枚主角家的紋章', income_share: 0, exit_dc: 5 })
    const slave = state.party.find((m) => m.id === l.npc)!
    expect(contractTerms(slave.contract!)).toMatchObject({ name: '家紋', income_share: 0 })
    const p = prepareAction(state, { kind: 'free', target: slave.id, text: '要他老實交代來歷' })
    expect(p.rolls).toHaveLength(2)
    expect(p.natural).toBe(Math.max(...p.rolls!))
    resolveAction(state, null)
  })
})

describe('after escaping: the old master, a new master, removing the mark', () => {
  /** 把 NPC 放到主角的格子上 */
  function bringHere(state: GameState, id: string) {
    const p = state.position!
    state.npcs![id] = { ...state.npcs![id]!, at: { area: p.area, x: p.x, y: p.y, until: state.time.day } }
  }

  function fugitive(mark = 'labor', seed = 3, location = 'rhineburg') {
    const state = game(seed, location)
    const [rec] = masterCandidates(location, seed)
    startAsSlave(state, { master: { type: 'candidate', rec: rec! }, mark })
    act(state, { kind: 'escape', text: '' }, 20)
    expect(isFugitive(state)).toBe(true)
    return { state, master: rec!.id }
  }

  it('can go back to the master once found', () => {
    const { state, master } = fugitive()
    expect(masterWhereabouts(state)).toContain('今天')
    expect(() => prepareAction(state, { kind: 'master_return', text: '' })).toThrow('不在你身邊')
    bringHere(state, master)
    expect(masterNearby(state)).toBe(true)
    const hp = state.party[0]!.hp
    act(state, { kind: 'master_return', text: '跪下認錯' }, 20)
    expect(isBound(state)).toBe(true)
    expect(leaderOf(state)?.id).toBe(master)
    expect(state.party[0]!.hp).toBe(hp)
  })

  it('can negotiate face to face, harder than when bound, and a fumble drags you back', () => {
    const { state, master } = fugitive()
    bringHere(state, master)
    const p = prepareAction(state, { kind: 'negotiate', text: '我可以付贖金' })
    expect(p.base_dc).toBe(slaveryRules.contracts.labor!.negotiate_dc + slaveryRules.fugitive_master.negotiate_dc_bonus - Math.floor((state.relationships![master]!.affinity) / 20))
    state.pendingAction!.natural = 1
    resolveAction(state, null)
    expect(isBound(state)).toBe(true)

    const other = fugitive()
    bringHere(other.state, other.master)
    act(other.state, { kind: 'negotiate', text: '' }, 20)
    expect(isEnslaved(other.state)).toBe(false)
  })

  it('can seek a new master nearby; the mark stays', () => {
    const state = game()
    startAsSlave(state, { master: { type: 'none' }, mark: 'combat' })
    const [rec] = masterCandidates('rhineburg', 9)
    registerNpc(state, rec!)
    bringHere(state, rec!.id)
    const r = act(state, { kind: 'seek_master', target: rec!.id, text: '我會替你扛行李、守夜' }, 20)
    expect(r.changes.companions?.some((c) => c.change === 'transferred')).toBe(true)
    expect(isBound(state)).toBe(true)
    expect(leaderOf(state)?.id).toBe(rec!.id)
    expect(state.party[0]!.contract).toMatchObject({ kind: 'combat', master: rec!.id })
  })

  it('removes the mark at the temple for a fee; fugitives are eyed coldly', () => {
    const state = game()
    startAsSlave(state, { master: { type: 'none' }, mark: 'labor' })
    standOn(state, 'temple')
    state.money_cc = 100000
    const offer = unmarkOffers(state).find((o) => o.service === 'temple')!
    const strength = markStrength(state.party[0]!.contract!)
    expect(offer).toMatchObject({ dc: strength - 4, fee_cc: strength * 150 })
    act(state, { kind: 'unmark', target: 'temple', text: '' }, 15)
    expect(isEnslaved(state)).toBe(false)
    expect(state.money_cc).toBe(100000 - offer.fee_cc)

    const f = fugitive()
    standOn(f.state, 'temple')
    expect(unmarkOffers(f.state).find((o) => o.service === 'temple')!.dc).toBe(markStrength(f.state.party[0]!.contract!) - 4 + 2)
  })

  it('a black-market marker may sell you out to your master', () => {
    const { state, master } = fugitive('labor', 3, 'soriel')
    standOn(state, 'tavern')
    state.flags['black_market:soriel'] = true
    state.money_cc = 100000
    expect(unmarkOffers(state).map((o) => o.service)).toContain('black')
    act(state, { kind: 'unmark', target: 'black', text: '' }, 1)
    expect(isBound(state)).toBe(true)
    expect(leaderOf(state)?.id).toBe(master)
  })

  it('a wizard in the party unpicks the mark for free, easier on arcane marks', () => {
    const state = game()
    startAsSlave(state, { master: { type: 'none' }, mark: 'arcane' })
    const [w] = masterCandidates('rhineburg', 11).filter((r) => r.class === 'wizard')
    const wiz = w ?? { ...masterCandidates('rhineburg', 11)[0]!, class: 'wizard' }
    registerNpc(state, wiz)
    state.party.push({ ...characterFor(state, wiz), bond: 'voluntary' })
    const offer = unmarkOffers(state).find((o) => o.service === 'mage')!
    expect(offer).toMatchObject({ fee_cc: 0, target: `mage:${wiz.id}`, dc: markStrength(state.party[0]!.contract!) - 3 - 3 })
    act(state, { kind: 'unmark', target: offer.target, text: '' }, 20)
    expect(isEnslaved(state)).toBe(false)
  })

  it('lets the AI free the player or hand them to a new master, within limits', () => {
    const state = game()
    startAsSlave(state, { master: { type: 'none' }, mark: 'labor' })
    const [rec] = masterCandidates('rhineburg', 9)
    registerNpc(state, rec!)
    bringHere(state, rec!.id)
    const p = prepareAction(state, { kind: 'free', target: rec!.id, text: '求他收下我' })
    expect(sanitizeJudgment(state, p, { degree: 'partial', effects: [{ type: 'change_master', npc: rec!.id }, { type: 'free', npc: 'pc' }] }).effects).toEqual([])
    expect(sanitizeJudgment(state, p, { degree: 'success', effects: [{ type: 'free', npc: 'pc' }] }).effects).toEqual([])
    const j = sanitizeJudgment(state, p, { degree: 'success', effects: [{ type: 'change_master', npc: rec!.id }] })
    expect(j.effects).toEqual([{ type: 'change_master', master: rec!.id }])
    resolveAction(state, j)
    expect(leaderOf(state)?.id).toBe(rec!.id)

    const r = blank(state)
    applyEffects(state, r, [{ type: 'change_master', master: null, reason: '主人把你放逐了' }])
    expect(validate(commitReport(state, r))).toBe(true)
    expect(isEnslaved(state) && !isBound(state)).toBe(true)
    expect(state.party.some((m) => m.id === rec!.id)).toBe(false)
  })
})

describe('who becomes the new master depends on who they are', () => {
  it('weights buyers by market and shifts the DC by tag', () => {
    const seen = { public: new Set<string>(), black: new Set<string>() }
    for (let i = 0; i < 400; i++) {
      const rng = new Rng(i)
      seen.public.add(pickBuyer(rng, 'public').tag)
      seen.black.add(pickBuyer(rng, 'black').tag)
    }
    expect(seen.public.has('villain')).toBe(false)
    expect(seen.black.has('priest')).toBe(false)
    expect(seen.black.has('villain')).toBe(true)
    expect(masterTagDc({ kind: 'adventurer', class: 'fighter', tags: ['noble'] })).toBe(-3)
    expect(masterTagDc({ kind: 'commoner', class: '', tags: ['commoner'] })).toBe(2 + 3)
    expect(masterTagDc({ kind: 'commoner', class: '', tags: ['priest', 'noble'] })).toBe(2 - 3)
  })

  function commonerMaster(seed = 3) {
    const state = game(seed)
    startAsSlave(state, { master: { type: 'none' }, mark: 'labor' })
    const merchant = generateNpc(state, new Rng(5), { kind: 'commoner', tags: ['merchant'], level: 2 }, 'cmn')
    registerNpc(state, merchant)
    const p = state.position!
    merchant.at = { area: p.area, x: p.x, y: p.y, until: state.time.day }
    const pending = prepareAction(state, { kind: 'seek_master', target: merchant.id, text: '' })
    expect(pending.base_dc).toBe(seekMasterDc(state, merchant))
    state.pendingAction!.natural = 20
    resolveAction(state, null)
    return { state, master: state.party.find((m) => m.id === merchant.id)! }
  }

  it('a commoner master travels along as a noncombatant', () => {
    const { state, master } = commonerMaster()
    expect(isBound(state)).toBe(true)
    expect(leaderOf(state)?.id).toBe(master.id)
    expect(master.class).toBe('noncombatant')
    expect(isNoncombatant(master)).toBe(true)
    expect(maybeMasterEvent(state, 1)).toBeTruthy()
    startCombat(state)
    expect(state.combat!.combatants.some((c) => c.id === master.id)).toBe(false)
  })

  it('on defeat a noncombatant who cares fetches help: no money lost, back at half HP', () => {
    const { state, master } = commonerMaster()
    master.affinity = 100
    state.relationships![master.id]!.affinity = 100
    state.money_cc = 1000
    startCombat(state)
    state.combat!.status = 'defeat'
    const r = finishCombat(state)
    expect(validate(r), JSON.stringify(validate.errors)).toBe(true)
    expect(r.outcome.tags).toContain('搬救兵')
    expect(state.money_cc).toBe(1000)
    expect(master.hp).toBe(Math.ceil(master.maxHp / 2))
    expect(master.status).not.toContain('away')
  })

  it('on defeat a noncombatant who does not care runs off and waits in town', () => {
    const { state, master } = commonerMaster()
    master.affinity = -100
    state.relationships![master.id]!.affinity = -100
    state.money_cc = 1000
    standOn(state, 'gate')
    ;(state.masterPass ??= {})[state.location] = state.time.day
    goOutskirts(state)
    startCombat(state)
    state.combat!.status = 'defeat'
    finishCombat(state)
    expect(state.money_cc).toBe(900)
    expect(master.status).toContain('away')
    expect(master.hp).toBe(Math.ceil(master.maxHp / 2))
    expect(maybeMasterEvent(state, 1)).toBeUndefined()
    expect(rejoinAway(state)).toBeUndefined()
    enterLocation(state)
    const back = rejoinAway(state)!
    expect(validate(back)).toBe(true)
    expect(master.status).not.toContain('away')
  })

  it('a marked slave can sell themselves at the market to a new master, keeping the mark', () => {
    for (let seed = 1; seed < 60; seed++) {
      const state = game(seed)
      startAsSlave(state, { master: { type: 'none' }, mark: 'combat' })
      state.party[0]!.attrs.cha = 18
      const r = offerSelf(state, 'public')
      if (r.outcome.result !== 'success') continue
      expect(validate(r), JSON.stringify(validate.errors)).toBe(true)
      expect(state.pendingMark).toBeUndefined()
      expect(isBound(state)).toBe(true)
      expect(state.party[0]!.contract!.kind).toBe('combat')
      expect(r.changes.companions?.some((c) => c.change === 'transferred')).toBe(true)
      return
    }
    throw new Error('nobody bought')
  })
})
