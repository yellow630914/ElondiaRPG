import { describe, expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020'
import schema from '../../schemas/report.schema.json'
import { prepareAction, resolveAction, sanitizeJudgment } from '@/engine/actions'
import { createNpc, gainXp, gearAffinities } from '@/engine/character'
import { actionRules, ATTR_IDS, itemRules, perkDef, perkRules, type CheckContext } from '@/engine/data'
import { applyEffects } from '@/engine/effects'
import { enterLocation, standOn } from '@/engine/grid'
import { useItem } from '@/engine/inventory'
import { applyPitch, learnFromOffer } from '@/engine/perkActions'
import {
  checkBonus, checkModifiers, grantPerk, npcPerksOf, offerPerks, perkPower, perksOf, pitchCap, pitchTarget, rollNpcPerks, sanitizePerk,
} from '@/engine/perks'
import { pcOf } from '@/engine/party'
import { Rng } from '@/engine/rng'
import { addItem, newGame, withRng } from '@/engine/state'
import { sanitizeEffects } from '@/engine/storyMods'
import type { GameState, Report } from '@/engine/types'

const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema)

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

describe('perk data', () => {
  it('uses only known contexts, actions, attributes and items', () => {
    const contexts = Object.keys(perkRules.contexts)
    const ids = new Set<string>()
    for (const p of perkRules.perks) {
      expect(ids.has(p.id), p.id).toBe(false)
      ids.add(p.id)
      for (const e of p.effects) {
        if (!('check' in e)) continue
        for (const c of e.check.contexts ?? []) expect(contexts, `${p.id} ${c}`).toContain(c)
        for (const k of e.check.kinds ?? []) expect(actionRules.kinds[k], `${p.id} ${k}`).toBeTruthy()
        for (const a of e.check.attrs ?? []) expect(ATTR_IDS).toContain(a)
      }
      // 種族特質（人類的適應力）可以沒有額外效果
      if (!p.race) expect(perkPower(p), p.id).toBeGreaterThan(0)
    }
    const books = itemRules.items.filter((i) => i.use?.perks)
    expect(books.length).toBeGreaterThanOrEqual(5)
    for (const b of books) for (const id of b.use!.perks!) expect(perkDef(id), `${b.name} ${id}`).toBeTruthy()
  })
})

describe('perks in checks', () => {
  it('add to the checks they cover, and only those', () => {
    const state = game({ perks: ['pathfinder', 'silver_tongue', 'respectable'] })
    const pc = pcOf(state)
    expect(checkBonus(pc, { context: 'travel' })).toBe(2)
    expect(checkBonus(pc, { context: 'retreat', attr: 'dex' })).toBe(2)
    expect(checkBonus(pc, { context: 'gate', attr: 'cha' })).toBe(3)
    expect(checkBonus(pc, { context: 'action', kind: 'haggle', attr: 'cha' })).toBe(2)
    expect(checkBonus(pc, { context: 'action', kind: 'chat', attr: 'cha', vsTags: ['noble'] })).toBe(2)
    expect(checkBonus(pc, { context: 'trap', attr: 'dex' })).toBe(0)
    expect(checkModifiers(pc, { context: 'travel' })).toEqual([{ label: '特質【識途老馬】', value: 2 }])
  })

  it('a lucky perk touches every kind of check, along with conditions', () => {
    const state = game({ perks: ['lucky'] })
    const pc = pcOf(state)
    for (const c of Object.keys(perkRules.contexts) as CheckContext[]) expect(checkBonus(pc, { context: c, attr: 'str' }), c).toBe(1)
    pc.status.push('punished')
    expect(checkBonus(pc, { context: 'gate', attr: 'cha' })).toBe(-1)
  })

  it('show up in an active action as situational modifiers', () => {
    const state = game({ perks: ['merchant_eye'] })
    standOn(state, 'tavern')
    const p = prepareAction(state, { kind: 'free', text: '和酒保聊聊' })
    expect(p.situational).toEqual([])
    delete state.pendingAction
    const w = prepareAction(state, { kind: 'work', target: '2', text: '' })
    expect(w.situational).toContainEqual({ label: '特質【生意頭腦】', value: 1 })
  })

  it('go into combat modifiers and resistances', () => {
    const state = game({ perks: ['brawler', 'fire_born'] })
    const g = gearAffinities(pcOf(state))
    expect(g.mods.hit).toBe(1)
    expect(g.resist.fire).toBe(-0.25)
  })
})

describe('getting perks', () => {
  it('lets a new character take any perks and make their own', () => {
    const state = game({
      perks: ['lucky', 'brawler', 'not_a_perk'],
      customPerks: [{ name: '酒館之子', effects: [{ check: { kinds: ['chat'] }, bonus: 9 }, { combat: { hit: 9 } }] }, { name: '' }],
    })
    const pc = pcOf(state)
    expect(pc.perks).toEqual(['lucky', 'brawler'])
    expect(pc.customPerks).toHaveLength(1)
    expect(pc.customPerks![0]).toMatchObject({ id: 'c-start-1', name: '酒館之子', custom: true })
    // 數值夾在範圍內
    expect(pc.customPerks![0]!.effects).toEqual([{ check: { kinds: ['chat'] }, bonus: 3 }, { combat: { hit: 2 } }])
    expect(perksOf(pc).map((p) => p.name)).toEqual(['適應力', '幸運兒', '打架好手', '酒館之子'])
  })

  it('offers three perks at the right levels', () => {
    const state = game()
    const pc = pcOf(state)
    withRng(state, (rng) => gainXp(pc, 100000, rng))
    expect(pc.perkOffers?.length).toBe(perkRules.levelup.levels.filter((l) => l <= pc.level).length)
    const o = pc.perkOffers![0]!
    expect(o).toMatchObject({ source: '升到 3 級', pitch: true })
    expect(o.options).toHaveLength(perkRules.levelup.choices)
    const r = learnFromOffer(state, 'pc', o.id, o.options[0]!)
    expect(validate(r), JSON.stringify(validate.errors)).toBe(true)
    expect(pc.perks).toContain(o.options[0])
    expect(r.changes.perks).toEqual([{ actor: 'pc', perk: o.options[0], name: perkDef(o.options[0]!)!.name, added: true }])
  })

  it('comes from effects (events, special quests) and can be lost', () => {
    const state = game()
    const pc = pcOf(state)
    applyEffects(state, blank(state), [{ type: 'perk', perk: 'veteran', options: ['diplomat'], source: '特殊任務「測試」' }])
    expect(pc.perkOffers).toEqual([{ id: 'po-1', source: '特殊任務「測試」', options: ['veteran', 'diplomat'], pitch: true }])
    applyEffects(state, blank(state), [{ type: 'perk', perk: 'thick_skin', direct: true }])
    expect(pc.perks).toContain('thick_skin')
    const report = blank(state)
    applyEffects(state, report, [{ type: 'lose_perk', perk: 'thick_skin' }])
    expect(pc.perks).not.toContain('thick_skin')
    expect(report.changes.perks).toEqual([{ actor: 'pc', perk: 'thick_skin', name: '皮糙肉厚', added: false }])
  })

  it('can be set up in the special quest editor', () => {
    expect(sanitizeEffects([{ type: 'perk', perk: 'veteran', options: ['nope', 'diplomat', 'veteran'] }, { type: 'perk', perk: 'nope' }, { type: 'lose_perk', perk: 'lucky' }]))
      .toEqual([{ type: 'perk', perk: 'veteran', options: ['diplomat'] }, { type: 'lose_perk', perk: 'lucky' }])
  })

  it('comes from reading a book', () => {
    const state = game()
    addItem(state.inventory, '《行旅手札》', 1)
    const r = useItem(state, '《行旅手札》', 'pc')
    expect(validate(r), JSON.stringify(validate.errors)).toBe(true)
    expect(pcOf(state).perkOffers?.[0]).toMatchObject({ source: '讀了「《行旅手札》」', options: ['pathfinder', 'survivor', 'watchful'] })
  })

  it('comes from training, for a fee', () => {
    const state = game()
    standOn(state, 'guild')
    state.money_cc = 1000
    prepareAction(state, { kind: 'train', target: 'pathfinder', text: '' })
    state.pendingAction!.natural = 18
    const r = resolveAction(state, null)
    expect(validate(r), JSON.stringify(validate.errors)).toBe(true)
    expect(state.money_cc).toBe(1000 - perkDef('pathfinder')!.train!.price_cc)
    expect(pcOf(state).perkOffers?.[0]).toMatchObject({ options: ['pathfinder'] })
    expect(() => prepareAction(state, { kind: 'train', target: 'lucky', text: '' })).toThrow('學不到')
  })
})

describe('pitching a different perk to the AI', () => {
  function offered() {
    const state = game()
    const offer = offerPerks(pcOf(state), '特殊任務「測試」', ['pathfinder'])!
    return { state, offer, target: pitchTarget('pc', offer.id) }
  }
  const strong = { name: '萬事通', desc: '什麼都會', effects: [{ check: {}, bonus: 3 }, { combat: { hit: 2 } }] }

  it('lets the AI design a perk, held to the strength of what was offered', () => {
    const { state, offer, target } = offered()
    const p = prepareAction(state, { kind: 'perk_pitch', target, text: '跑商多年，懂得看人臉色' })
    const judgment = sanitizeJudgment(state, p, { degree: 'success', attr: 'cha', dc: 12, perk: strong })
    expect(judgment.perk).toEqual(strong)
    state.pendingAction!.natural = 15
    const r = resolveAction(state, judgment)
    expect(validate(r), JSON.stringify(validate.errors)).toBe(true)
    const got = pcOf(state).customPerks![0]!
    expect(got.name).toBe('萬事通')
    expect(perkPower(got)).toBeLessThanOrEqual(pitchCap(offer, 0))
    expect(pcOf(state).perkOffers ?? []).toEqual([])
  })

  it('on a failure, keeps the offer but only the listed perks', () => {
    const { state, target } = offered()
    const report = blank(state)
    const text = applyPitch(state, report, target, 'fail', strong)
    expect(text).toContain('沒有被採用')
    const o = pcOf(state).perkOffers![0]!
    expect(o.pitched).toBe(true)
    expect(() => prepareAction(state, { kind: 'perk_pitch', target, text: '再試一次' })).toThrow('試過')
  })

  it('caps a critical one step above, a partial one step below', () => {
    const { offer } = offered()
    expect(pitchCap(offer, 1)).toBe(pitchCap(offer, 0) + 1)
    const fit = { name: '老江湖', effects: [{ check: { contexts: ['travel', 'road'] }, bonus: 3 }, { combat: { hit: 2 } }] }
    const weak = sanitizePerk(fit, 'c-x', pitchCap(offer, -1))!
    expect(perkPower(weak)).toBeLessThanOrEqual(pitchCap(offer, -1))
    expect(weak.effects.length).toBeGreaterThan(0)
    // 太廣的（所有檢定 +3）怎麼減都超過上限時，就不給
    expect(sanitizePerk({ name: '全能', effects: [{ check: {}, bonus: 3 }] }, 'c-y', 1)).toBeUndefined()
  })
})

describe('NPC perks', () => {
  it('are fixed per NPC, favour their tags, and come along when they join', () => {
    const rec = { id: 'gen_42', name: '路人', race: 'human', class: 'rogue', level: 3, location: 'rhineburg', hire_cc: 0, personality: '', tags: ['villain'] }
    expect(npcPerksOf(rec)).toEqual(npcPerksOf(rec))
    const c = createNpc(rec, new Rng(1))
    expect(c.perks ?? []).toEqual(npcPerksOf(rec))
    expect(npcPerksOf({ ...rec, perks: ['lucky', 'nope'] })).toEqual(['lucky'])
    // 抽很多次：惡人比較容易抽到惡人相關的特質
    const share = (tags: string[]) => {
      const rng = new Rng(9)
      let hit = 0
      let total = 0
      for (let i = 0; i < 500; i++) {
        for (const id of rollNpcPerks(rng, { tags, class: 'fighter' })) {
          total++
          if (perkDef(id)?.npc?.tags?.includes('villain')) hit++
        }
      }
      return hit / total
    }
    expect(share(['villain'])).toBeGreaterThan(share([]) * 2)
  })

  it('a slave sent to work rolls with their own perks', () => {
    const state = game()
    const pc = pcOf(state)
    grantPerk(pc, 'hard_worker')
    expect(checkBonus(pc, { context: 'action', kind: 'work', attr: 'cha' })).toBe(2)
  })
})
