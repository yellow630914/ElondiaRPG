import { describe, expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020'
import schema from '../../schemas/report.schema.json'
import { prepareAction, resolveAction, sanitizeJudgment } from '@/engine/actions'
import { tavernCandidates } from '@/engine/companions'
import { affinityTable, giftBonus } from '@/engine/interactions'
import { generateNpc } from '@/engine/npcs'
import { withRng } from '@/engine/state'
import { locationById, npcTags } from '@/engine/data'
import { enterLocation, standOn, zonesOf } from '@/engine/grid'
import { npcKind, npcRecord, npcTitle } from '@/engine/npcs'
import { ensureRoster, peopleHere, whereToday } from '@/engine/population'
import { newGame } from '@/engine/state'
import type { GameState } from '@/engine/types'

function game(seed = 3, location = 'soriel'): GameState {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed })
  state.location = location
  enterLocation(state)
  return state
}

describe('rosters', () => {
  it('builds a fixed roster of adventurers and commoners without touching the game rng', () => {
    const state = game()
    const rng = state.rngState
    const roster = ensureRoster(state, 'albena')!
    expect(state.rngState).toBe(rng)
    expect(roster.members.length).toBe(16)
    const recs = roster.members.map((id) => npcRecord(state, id)!)
    const adventurers = recs.filter((r) => npcKind(r) === 'adventurer')
    const commoners = recs.filter((r) => npcKind(r) === 'commoner')
    expect(adventurers.length).toBe(8)
    expect(commoners.length).toBe(8)
    // 具名 NPC 算在冒險者名額裡
    expect(roster.members).toContain('npc_kai')
    for (const c of commoners) {
      expect(c.class).toBe('')
      expect(c.hire_cc).toBe(0)
      expect(npcTitle(c)).toBeTruthy()
      expect(c.tags?.length).toBeGreaterThan(0)
    }
    for (const a of adventurers.filter((r) => r.generated)) expect(a.class).toBeTruthy()
    // 同一個種子、同一個地點：同一份名單
    const again = game()
    expect(ensureRoster(again, 'albena')!.members.map((id) => npcRecord(again, id)!.name)).toEqual(recs.map((r) => r.name))
    expect(ensureRoster(state, 'albena')).toBe(roster)
    expect(ensureRoster(state, 'snake_creek')).toBeUndefined()
  })

  it('gives every resident active locations that start at home and respect the tags', () => {
    for (const loc of ['soriel', 'rhineburg', 'rivervale']) {
      const state = game(5, loc)
      const roster = ensureRoster(state, loc)!
      const zones = zonesOf(locationById(loc))
      for (const id of roster.members) {
        const rec = npcRecord(state, id)!
        expect(rec.haunts!.some((h) => h.location === loc)).toBe(true)
        for (const h of rec.haunts!) {
          if (h.location === loc) expect(zones).toContain(h.zone)
          if (h.zone === 'dungeon') expect(locationById(h.location).type).toBe('dungeon')
        }
        for (const t of rec.tags ?? []) {
          const def = npcTags.tags[t]!
          expect(def.kinds).toContain(npcKind(rec))
          if (def.location_types) expect(def.location_types).toContain(locationById(loc).type)
        }
      }
    }
  })

  it('moves people between their active locations day by day, deterministically', () => {
    const state = game()
    const lina = npcRecord(state, 'npc_lina')!
    const days = Array.from({ length: 40 }, (_, d) => whereToday(lina, d + 1)!)
    expect(days.map((h) => `${h.location}/${h.zone}`)).toEqual(Array.from({ length: 40 }, (_, d) => whereToday(lina, d + 1)!).map((h) => `${h.location}/${h.zone}`))
    expect(new Set(days.map((h) => `${h.location}/${h.zone}`)).size).toBeGreaterThan(1)
    expect(days.filter((h) => h.location === 'soriel' && h.zone === 'town').length).toBeGreaterThan(days.length / 3)
  })
})

describe('people here', () => {
  it('lists residents of the current district and staff at their facility', () => {
    const state = game()
    ensureRoster(state, 'soriel')
    standOn(state, 'shop')
    const here = peopleHere(state)
    expect(here.length).toBeGreaterThan(0)
    for (const p of here.filter((x) => !x.staff)) {
      const today = whereToday(p.rec, state.time.day)!
      expect(today.location).toBe('soriel')
      expect(['town', 'temple']).toContain(today.zone)
    }
    // 名單上今天在城裡一般區域的人都列得出來
    const expected = state.rosters!.soriel!.members.filter((id) => {
      const t = whereToday(npcRecord(state, id)!, state.time.day)!
      return t.location === 'soriel' && t.zone === 'town'
    })
    for (const id of expected) expect(here.map((p) => p.rec.id)).toContain(id)
  })
})

const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema)

function someone(state: GameState, spec: Parameters<typeof generateNpc>[2] = {}) {
  return withRng(state, (rng) => generateNpc(state, rng, { kind: 'commoner', tags: ['commoner'], occupation: '麵包師', haunts: [{ location: state.location, zone: 'town', weight: 1 }], ...spec }))
}

function act(state: GameState, input: Parameters<typeof prepareAction>[1], natural: number) {
  prepareAction(state, input)
  state.pendingAction!.natural = natural
  const r = resolveAction(state, null)
  expect(validate(r), JSON.stringify(validate.errors)).toBe(true)
  return r
}

describe('interactions', () => {
  it('chats with people here and gets acquainted', () => {
    const state = game()
    const baker = someone(state)
    const r = act(state, { kind: 'chat', target: baker.id, text: '問問最近城裡有什麼新鮮事' }, 20)
    expect(r.check?.degree).toBe('critical')
    expect(state.relationships![baker.id]!.affinity).toBe(3)
    expect(() => prepareAction(state, { kind: 'chat', target: 'npc_ael', text: '' })).toThrow('不在這裡')
  })

  it('gives a gift: pricier gifts count for more, and a fumble returns it', () => {
    const state = game()
    const baker = someone(state)
    const lord = someone(state, { tags: ['noble'], occupation: '子爵' })
    state.inventory.push({ name: '乾糧', qty: 2 }, { name: '治療藥劑', qty: 1 })
    expect(giftBonus(state, baker, '治療藥劑')).toBeGreaterThan(giftBonus(state, baker, '乾糧'))
    expect(giftBonus(state, lord, '治療藥劑')).toBeLessThan(giftBonus(state, baker, '治療藥劑'))
    const table = affinityTable(state, 'gift', baker, '治療藥劑')
    act(state, { kind: 'gift', target: baker.id, item: '治療藥劑', text: '' }, 20)
    expect(state.relationships![baker.id]!.affinity).toBe(table.critical)
    expect(state.inventory.find((i) => i.name === '治療藥劑')).toBeUndefined()

    const rations = state.inventory.find((i) => i.name === '乾糧')!.qty
    const r = act(state, { kind: 'gift', target: lord.id, item: '乾糧', text: '' }, 1)
    expect(r.check?.degree).toBe('fumble')
    expect(state.inventory.find((i) => i.name === '乾糧')?.qty).toBe(rations)
    expect(state.relationships![lord.id]!.affinity).toBe(-3)
    expect(() => prepareAction(state, { kind: 'gift', target: baker.id, item: '龍蛋', text: '' })).toThrow('沒有龍蛋')
  })

  it('flattery is harder on nobles and backfires on a failure', () => {
    const state = game()
    const baker = someone(state)
    const lord = someone(state, { tags: ['noble'], occupation: '子爵' })
    const p1 = prepareAction(state, { kind: 'flatter', target: baker.id, text: '誇她的麵包是全城最好的' })
    expect(p1.situational).toEqual([])
    state.pendingAction!.natural = 1
    resolveAction(state, null)
    expect(state.relationships![baker.id]!.affinity).toBe(-6)
    const p2 = prepareAction(state, { kind: 'flatter', target: lord.id, text: '稱讚子爵的家徽' })
    expect(p2.situational).toEqual([{ label: '對方身分高貴', value: -2 }])
  })

  it('lets the AI decide the degree but keeps affinity under the rules', () => {
    const state = game()
    const baker = someone(state)
    const p = prepareAction(state, { kind: 'chat', target: baker.id, text: '聊聊天' })
    const j = sanitizeJudgment(state, p, { degree: 'success', effects: [{ type: 'affinity', npc: baker.id, delta: 8 }, { type: 'flag', key: '知道麵包店的祕方', value: true }] })
    resolveAction(state, j)
    expect(state.relationships![baker.id]!.affinity).toBe(2)
    expect(state.flags['ai:知道麵包店的祕方']).toBe(true)
  })

  it('never offers commoners for hire', () => {
    const state = game()
    ensureRoster(state, 'soriel')
    someone(state)
    for (const c of tavernCandidates(state)) expect(npcKind(npcRecord(state, c.npc)!)).toBe('adventurer')
  })
})

describe('capital districts', () => {
  it('links every block both ways and gives capitals a noble district and a palace', async () => {
    const maps = (await import('../../data/world/maps.json')).default as unknown as {
      maps: Record<string, { blocks: { id: string; grid: string[]; links?: Record<string, string>; zone?: string }[] }>
      templates: Record<string, { blocks: { id: string; grid: string[]; links?: Record<string, string>; zone?: string }[] }>
    }
    for (const set of [...Object.values(maps.maps), ...Object.values(maps.templates)]) {
      for (const b of set.blocks) {
        for (const [digit, target] of Object.entries(b.links ?? {})) {
          const t = set.blocks.find((x) => x.id === target)
          expect(t, `${b.id} → ${target}`).toBeTruthy()
          expect(b.grid.some((row) => row.includes(digit))).toBe(true)
          expect(t!.grid.some((row) => row.includes(digit))).toBe(true)
          expect(t!.links?.[digit]).toBe(b.id)
        }
      }
    }
    for (const id of ['soriel', 'rhineburg', 'silvermoon']) {
      const zones = zonesOf(locationById(id))
      expect(zones).toContain('noble')
      expect(zones).toContain('palace')
    }
    expect(zonesOf(locationById('rivervale'))).not.toContain('noble')
  })
})
