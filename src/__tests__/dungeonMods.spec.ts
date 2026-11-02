import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { dungeonDepth, dungeonEncounters, findLocation, geography, locationById } from '@/engine/data'
import { applyDungeonMod, dungeonUsage, enemyInDungeons, isCustomDungeon, newDungeon, sanitizeDungeonMod, withoutEnemy, type DungeonMod } from '@/engine/dungeonMods'
import { enterLocation, getArea } from '@/engine/grid'
import { layerRanks } from '@/engine/materialQuests'
import { applyContent, emptyMods, normalizeMods, tableOptions } from '@/engine/mods'
import { newGame } from '@/engine/state'
import { reachable, shortestPath } from '@/engine/world'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})
afterEach(() => applyContent(emptyMods()))

const ID = 'loc_test_cave'
const cave = (extra: Partial<DungeonMod> = {}): DungeonMod => ({
  ...newDungeon(ID),
  name: '測試洞窟',
  routes: [{ to: 'rivervale', days: [1, 2], mode: 'trail' }],
  layers: {
    outskirts: [[['slime', 2]]],
    shallow: [[['slime', 1], ['reef_crab', 1]]],
    middle: [[['reef_crab', 2]]],
    deep: [[['reef_crab', 3]]],
  },
  bosses: { deep: [['reef_crab', 1], ['slime', 2]] },
  ...extra,
})

describe('custom dungeons: sanitize', () => {
  it('rejects bad ids and built-in ids', () => {
    expect(() => sanitizeDungeonMod('cave', cave())).toThrow()
    expect(() => sanitizeDungeonMod('loc_Bad-Id', cave())).toThrow()
    expect(() => sanitizeDungeonMod('soriel', cave())).toThrow()
  })

  it('keeps only routes to built-in settlements, one per settlement', () => {
    const m = sanitizeDungeonMod(ID, cave({
      routes: [
        { to: 'rivervale', days: [3, 1.26], mode: 'trail' },
        { to: 'rivervale', days: [1, 1], mode: 'road' },
        { to: 'snake_creek', days: [1, 1], mode: 'trail' },
        { to: 'nowhere', days: [1, 1], mode: 'trail' },
        { to: 'albena', days: [2, 2], mode: 'flying' as never, fare: 30 },
      ],
    }))
    expect(m.routes).toEqual([
      { to: 'rivervale', days: [1.5, 3], mode: 'trail' },
      { to: 'albena', days: [2, 2], mode: 'trail', fare: 30 },
    ])
  })

  it('drops unknown monsters and the abyss unless it is turned on', () => {
    const m = sanitizeDungeonMod(ID, cave({
      layers: { shallow: [[['ghost_of_nothing', 1]], [['slime', 9], ['slime', 1]]], abyss: [[['slime', 1]]] },
      bosses: { abyss: [['slime', 1]] },
    }))
    expect(m.layers.shallow).toEqual([[['slime', 6]]])
    expect(m.layers.abyss).toBeUndefined()
    expect(m.bosses).toBeUndefined()
    const deep = sanitizeDungeonMod(ID, cave({ abyss: true, layers: { abyss: [[['slime', 1]]] } }))
    expect(deep.layers.abyss).toEqual([[['slime', 1]]])
  })
})

describe('custom dungeons: apply and restore', () => {
  it('become a location with routes, an encounter table and layer ranks', () => {
    const before = { locations: geography.locations.length, routes: geography.routes.length }
    applyContent(normalizeMods({ ...emptyMods(), dungeons: { [ID]: cave() } }))
    expect(isCustomDungeon(ID)).toBe(true)
    expect(locationById(ID)).toMatchObject({ name: '測試洞窟', type: 'dungeon', region: 'central' })
    expect(shortestPath('soriel', ID)?.days).toEqual([3, 4])
    expect(reachable('rivervale').some((r) => r.id === ID)).toBe(true)
    expect(dungeonDepth(ID)).toBe(4)
    expect(dungeonEncounters[ID]!.bosses?.deep).toEqual([['reef_crab', 1], ['slime', 2]])
    expect(tableOptions().some((t) => t.key === `dungeon:${ID}:shallow`)).toBe(true)
    expect(layerRanks(ID)).toBeTruthy()

    applyContent(emptyMods())
    expect(findLocation(ID)).toBeUndefined()
    expect(dungeonEncounters[ID]).toBeUndefined()
    expect(shortestPath('soriel', ID)).toBeNull()
    expect(geography.locations.length).toBe(before.locations)
    expect(geography.routes.length).toBe(before.routes)
  })

  it('can be explored: the outskirts use the table on the dungeon', () => {
    applyContent(normalizeMods({ ...emptyMods(), dungeons: { [ID]: cave() } }))
    const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 5, birthplace: 'rivervale' })
    state.location = ID
    enterLocation(state)
    const area = getArea(state, state.position!.area)
    expect(area.kind).toBe('dungeon')
    const foes = area.cells.flatMap((c) => c.group ?? []).map(([e]) => e)
    expect(foes.length).toBeGreaterThan(0)
    expect(foes.every((e) => e === 'slime')).toBe(true)
  })

  it('register before the content that points at them when a world is read', () => {
    const mods = normalizeMods({
      ...emptyMods(),
      dungeons: { [ID]: cave() },
      specialMaps: { sm_test_room: { name: '洞窟深處', location: ID, desc: '', lighting: 'dark', layer: 'deep', grid: ['#####', '#...#', '##E##'] } },
    })
    expect(mods.specialMaps.sm_test_room?.location).toBe(ID)
  })

  it('keep their monsters on the dungeon, not as spawns on the monster', () => {
    const mods = normalizeMods({
      ...emptyMods(),
      dungeons: { [ID]: cave() },
      enemies: { slime: { spawns: [{ table: `dungeon:${ID}:shallow`, count: 1 }, { table: 'dungeon:snake_creek:shallow', count: 1 }] } as never },
    })
    expect(mods.enemies.slime?.spawns?.map((p) => p.table)).toEqual(['dungeon:snake_creek:shallow'])
  })

  it('drop monsters that no longer exist when applied', () => {
    applyContent({ ...emptyMods(), dungeons: { [ID]: cave({ layers: { ...cave().layers, middle: [[['mod_enemy_gone', 1]], [['reef_crab', 1]]] } }) } })
    expect(dungeonEncounters[ID]!.middle).toEqual([[['reef_crab', 1]]])
  })
})

describe('custom dungeons: references', () => {
  it('list the dungeons and layers a monster is used in, and can take it out', () => {
    const m = cave()
    expect(enemyInDungeons('slime', { [ID]: m })).toEqual(['自建地下城「測試洞窟」的周邊、淺層、深層層主'])
    const out = withoutEnemy(m, 'slime')!
    expect(out.layers.outskirts).toEqual([])
    expect(out.layers.shallow).toEqual([[['reef_crab', 1]]])
    expect(out.bosses?.deep).toEqual([['reef_crab', 1]])
    expect(withoutEnemy(m, 'nobody')).toBeUndefined()
  })

  it('report special maps and the current save that use the dungeon', () => {
    applyContent(normalizeMods({
      ...emptyMods(),
      dungeons: { [ID]: cave() },
      specialMaps: { sm_test_room: { name: '洞窟深處', location: ID, desc: '', lighting: 'dark', layer: 'deep', grid: ['#####', '#...#', '##E##'] } },
    }))
    const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 5, birthplace: 'rivervale' })
    expect(dungeonUsage(ID, state)).toEqual(['特殊地圖「洞窟深處」屬於這裡'])
    state.location = ID
    expect(dungeonUsage(ID, state)).toContain('目前的存檔正在這裡')
  })
})

describe('custom dungeons: the content store', () => {
  it('save, refuse duplicate names and dungeons without a route, and delete when unused', async () => {
    const { editableWorld } = await import('./testWorld')
    const c = editableWorld()
    expect(() => c.saveDungeon(ID, cave({ name: '索里耶爾' }))).toThrow('已經有叫')
    expect(() => c.saveDungeon(ID, cave({ routes: [] }))).toThrow('至少要有一條路線')
    c.saveDungeon(ID, cave())
    expect(locationById(ID).name).toBe('測試洞窟')
    c.deleteDungeon(ID)
    expect(findLocation(ID)).toBeUndefined()
  })

  it('block deleting a dungeon a special map belongs to, and a custom monster a dungeon uses', async () => {
    const { editableWorld } = await import('./testWorld')
    const c = editableWorld()
    c.saveEnemy('mod_enemy_bat', { name: '洞窟蝙蝠', level: 1 })
    c.saveDungeon(ID, cave({ layers: { ...cave().layers, shallow: [[['mod_enemy_bat', 2]], [['slime', 1]]] } }))
    expect(c.usageOf('enemy', 'mod_enemy_bat')).toEqual(['自建地下城「測試洞窟」的淺層'])
    expect(() => c.deleteEnemy('mod_enemy_bat')).toThrow('還有地方用到')
    c.removeEnemyFromDungeons('mod_enemy_bat')
    expect(c.mods.dungeons[ID]!.layers.shallow).toEqual([[['slime', 1]]])
    c.deleteEnemy('mod_enemy_bat')

    c.saveSpecialMap('sm_test_room', { name: '洞窟深處', location: ID, desc: '', lighting: 'dark', layer: 'deep', grid: ['#####', '#...#', '##E##'] })
    expect(() => c.deleteDungeon(ID)).toThrow('還有地方用到')
  })
})

describe('custom dungeons: saves that point at a dungeon that is gone', () => {
  it('send the party back to a settlement and drop the trip, quests, intel and haunts', async () => {
    const { migrate } = await import('@/engine/state')
    applyContent(normalizeMods({ ...emptyMods(), dungeons: { [ID]: cave() } }))
    const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 5, birthplace: 'rivervale' })
    state.location = ID
    enterLocation(state)
    expect(state.expedition?.location).toBe(ID)
    state.quests.push({ id: 'q1', giver: 'rivervale', target: ID, title: '清剿測試洞窟', status: 'accepted' } as never)
    state.intel = [{ id: 'i1', kind: 'point', title: '寶箱', text: '', from: 'rivervale', time: state.time, location: ID, status: 'active' }]
    state.npcs = { n1: { id: 'n1', name: '冒險者', haunts: [{ location: ID, zone: 'town', weight: 1 }, { location: 'rivervale', zone: 'town', weight: 1 }] } as never }

    applyContent(emptyMods())
    migrate(state)
    expect(state.location).toBe('rivervale')
    expect(state.position).toBeUndefined()
    expect(state.expedition).toBeUndefined()
    expect(state.quests.some((q) => q.id === 'q1')).toBe(false)
    expect(state.intel).toEqual([])
    expect(state.npcs.n1!.haunts).toEqual([{ location: 'rivervale', zone: 'town', weight: 1 }])
    expect(Object.keys(state.areas ?? {}).some((k) => k.startsWith(ID))).toBe(false)
    enterLocation(state)
    expect(state.position).toBeTruthy()
  })

  it('return to where the trip started when the destination is gone', async () => {
    const { pruneLocations } = await import('@/engine/pruneLocations')
    const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 5, birthplace: 'rivervale' })
    state.road = { from: 'albena', to: ID, start: state.time, modes: ['trail'], hours: 3, money: 0, timeline: [], hpBefore: {} }
    expect(pruneLocations(state)).toBe(true)
    expect(state.road).toBeUndefined()
    expect(state.location).toBe('albena')
  })
})

describe('custom dungeons: partial import and export', () => {
  it('carry the custom monsters a dungeon uses, and the dungeon a special map belongs to', async () => {
    const { buildRefs, closure } = await import('@/engine/contentRefs')
    const mods = normalizeMods({
      ...emptyMods(),
      enemies: { mod_enemy_bat: { name: '洞窟蝙蝠', level: 1, custom: true } as never },
      dungeons: { [ID]: cave({ layers: { ...cave().layers, shallow: [[['mod_enemy_bat', 2]]] } }) },
      specialMaps: { sm_test_room: { name: '洞窟深處', location: ID, desc: '', lighting: 'dark', layer: 'deep', grid: ['#####', '#...#', '##E##'] } },
    })
    const graph = buildRefs(mods)
    expect([...closure(graph, [`dungeons:${ID}`])].sort()).toEqual([`dungeons:${ID}`, 'enemies:mod_enemy_bat'])
    expect(closure(graph, ['specialMaps:sm_test_room']).has(`dungeons:${ID}`)).toBe(true)
  })

  it('give a copied dungeon a new id and a name that is not taken', async () => {
    const { buildPackage } = await import('@/engine/contentImport')
    const source = normalizeMods({ ...emptyMods(), dungeons: { [ID]: cave() } })
    const target = normalizeMods({ ...emptyMods(), dungeons: { [ID]: cave({ desc: '改過' }) } })
    const pkg = buildPackage(target, source, [{ key: `dungeons:${ID}`, status: 'conflict', custom: true }], { [`dungeons:${ID}`]: 'copy' })
    const copied = pkg.renamed[0]![1]
    const id = copied.slice('dungeons:'.length)
    expect(id).toMatch(/^loc_test_cave_[a-z0-9]+$/)
    expect(sanitizeDungeonMod(id, pkg.mods.dungeons![id]!).name).toBe('測試洞窟（2）')
  })
})
