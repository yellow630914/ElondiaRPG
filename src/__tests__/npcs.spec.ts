import { describe, expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020'
import schema from '../../schemas/report.schema.json'
import { prepareAction, resolveAction, sanitizeJudgment } from '@/engine/actions'
import { tavernCandidates } from '@/engine/companions'
import { affinityTable, giftBonus } from '@/engine/interactions'
import { generateNpc } from '@/engine/npcs'
import { withRng } from '@/engine/state'
import { locationById, npcTags } from '@/engine/data'
import { cellAt, currentArea, enterLocation, standOn, zonesOf } from '@/engine/grid'
import { npcKind, npcRecord, npcTitle } from '@/engine/npcs'
import { areaOf, ensureRoster, peopleHere, presentHere, whereToday } from '@/engine/population'
import { shopState } from '@/engine/trade'
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
  it('scatters residents over the cells of their district and keeps shopkeepers in their shop', () => {
    const state = game()
    ensureRoster(state, 'soriel')
    standOn(state, 'shop')
    const here = peopleHere(state)
    const area = currentArea(state)
    expect(here.length).toBeGreaterThan(0)
    for (const p of here) {
      expect(areaOf(state, p.rec)).toBe(area.key)
      const cell = cellAt(area, p.x, p.y)!
      expect(['wall', 'water', 'link', 'gate']).not.toContain(cell.kind)
    }
    // 不是每個人都擠在同一格
    expect(new Set(here.map((p) => `${p.x},${p.y}`)).size).toBeGreaterThan(1)
    // 店主在店裡，主角站在店裡時就在身邊
    const keeper = shopState(state, 'general').keeper
    expect(peopleHere(state).find((p) => p.rec.id === keeper)).toMatchObject({ staff: true, dist: 0 })
    expect(presentHere(state, keeper)).toBe(true)
    // 只有身邊（相鄰格）的人能互動
    for (const p of peopleHere(state)) expect(presentHere(state, p.rec.id)).toBe(p.dist <= 1)
  })

  it('moves people around during the day', () => {
    const state = game()
    ensureRoster(state, 'soriel')
    const at = (h: number) => {
      state.time = { ...state.time, hour: h }
      return peopleHere(state).map((p) => `${p.rec.id}:${p.x},${p.y}`).sort().join('|')
    }
    expect(at(8)).toBe(at(9))
    expect(at(8)).not.toBe(at(14))
  })
})

const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema)

function someone(state: GameState, spec: Parameters<typeof generateNpc>[2] = {}) {
  const rec = withRng(state, (rng) => generateNpc(state, rng, { kind: 'commoner', tags: ['commoner'], occupation: '麵包師', haunts: [{ location: state.location, zone: 'town', weight: 1 }], ...spec }))
  // 站在主角旁邊
  const p = state.position!
  rec.at = { area: p.area, x: p.x, y: p.y, until: state.time.day }
  return rec
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

describe('appearance and personality', () => {
  it('builds looks from body parts and personality from axes, with at least one racial trait each', async () => {
    const { rollLook, npcTraits } = await import('@/engine/traits')
    const { Rng } = await import('@/engine/rng')
    const rng = new Rng(5)
    // 所有選項的互斥標籤
    const allOptions = [
      ...Object.values(npcTraits.parts).flat(),
      ...npcTraits.personality.axes.flatMap((a) => a.options),
      ...Object.values(npcTraits.personality.quirks_by_kind).flat(),
      ...Object.values(npcTraits.races).flatMap((r) => [
        ...(r.features ?? []), ...Object.values(r.parts ?? {}).flat(), ...Object.values(r.force ?? {}).flat(), ...(r.personality ?? []),
        ...(r.lineages ?? []).flatMap((l) => [...(l.features ?? []), ...Object.values(l.parts ?? {}).flat(), ...Object.values(l.force ?? {}).flat(), ...(l.personality ?? [])]),
      ]),
    ].map((o) => (typeof o === 'string' ? { t: o } : o)) as { t: string; tags?: string[]; not?: string[] }[]
    const notOf = new Map(allOptions.map((o) => [o.t, o.not ?? []]))
    for (const race of Object.keys(npcTraits.races)) {
      for (const gender of ['male', 'female', 'femboy', 'ts', 'futa', 'unknown']) {
        for (let i = 0; i < 15; i++) {
          const look = rollLook(rng, { race, gender, kind: i % 2 ? 'commoner' : 'adventurer', location: 'soriel', used: new Set() })
          const d = look.detail
          expect(d.features.length, `${race} feature`).toBeGreaterThan(0)
          expect(d.raceTraits.length, `${race} trait`).toBeGreaterThan(0)
          expect(Object.keys(d.parts).length).toBeGreaterThanOrEqual(9)
          expect(Object.keys(d.traits).length).toBeGreaterThanOrEqual(4)
          // 沒有矛盾：選到的任何一項，它的互斥標籤都不在選到的標籤裡
          const chosen = [...Object.values(d.parts), ...d.features, ...Object.values(d.traits)]
          for (const t of chosen) for (const n of notOf.get(t) ?? []) expect(d.tags, `${look.appearance} ${look.personality}`).not.toContain(n)
          if (race === 'dwarf') expect(look.name).toMatch(/・/)
          if (race === 'elf' || race === 'yulin') expect(d.tags).not.toContain('beard')
        }
      }
    }
  })
})
