import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { dungeonDepth, dungeonEncounters, enemies, findLocation, geography, locationById } from '@/engine/data'
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

describe('custom dungeons: travel', () => {
  it('are never a shortcut between two settlements', () => {
    const before = shortestPath('rivervale', 'albena')!.days
    applyContent(normalizeMods({ ...emptyMods(), dungeons: { [ID]: cave({ routes: [{ to: 'rivervale', days: [0.5, 0.5], mode: 'trail' }, { to: 'albena', days: [0.5, 0.5], mode: 'trail' }] }) } }))
    expect(shortestPath('rivervale', 'albena')!.days).toEqual(before)
    expect(shortestPath('albena', ID)!.days).toEqual([0.5, 0.5])
    expect(shortestPath(ID, 'soriel')!.legs[0]!.to).toBe('rivervale')
  })
})

describe('custom dungeons: editor preview and quick start', () => {
  it('show levels, ranks, chest levels and warnings per layer', async () => {
    const { layerPreview } = await import('@/engine/dungeonPreview')
    const m = cave({ layers: { ...cave().layers, middle: [], deep: [[['slime', 1]]] } })
    const p = layerPreview(m)
    expect(p.map((l) => l.layer)).toEqual(['outskirts', 'shallow', 'middle', 'deep'])
    expect(p[0]!.rank).toBeUndefined()
    expect(p[1]!.levels).toEqual([1, 2])
    expect(p[1]!.rank).toBeTruthy()
    expect(p[2]!.warnings[0]).toContain('這一層沒有怪物')
    expect(p[3]!.warnings).toContain('比上一層弱')
    expect(p[3]!.boss?.name).toBe(enemies.reef_crab!.name)
  })

  it('list the guilds within a week that will post quests for it', async () => {
    const { routePreview } = await import('@/engine/dungeonPreview')
    const { guilds, neighbors } = routePreview(cave())
    expect(guilds[0]).toMatchObject({ id: 'rivervale', days: 2 })
    expect(guilds.every((g) => g.days <= 7)).toBe(true)
    expect(neighbors).toEqual([locationById('rivervale').name])
    expect(routePreview({ ...cave(), requires: { flags: ['x'] } }).neighbors).toEqual([])
  })

  it('copy a built-in dungeon and auto-fill by level', async () => {
    const { autoFillLayers, copyLayers, layerPreview } = await import('@/engine/dungeonPreview')
    const copied = copyLayers('snake_creek')
    expect(copied.layers.shallow).toEqual(dungeonEncounters.snake_creek!.shallow)
    expect(copied.bosses?.deep?.length).toBeGreaterThan(0)
    let seed = 1
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const filled = autoFillLayers('central', false, {}, random)
    const m = sanitizeDungeonMod(ID, { ...cave(), ...filled })
    const p = layerPreview(m)
    expect(p.every((l) => l.levels)).toBe(true)
    expect(p.every((l) => !l.warnings.some((w) => w.includes('強很多') || w.includes('弱很多')))).toBe(true)
    expect(Object.keys(m.bosses ?? {})).toEqual(['shallow', 'middle', 'deep'])
  })
})

describe('custom dungeons: the AI sees the description', () => {
  it('adds the description to the scene of reports inside the dungeon', async () => {
    const { commitReport } = await import('@/engine/state')
    applyContent(normalizeMods({ ...emptyMods(), dungeons: { [ID]: cave({ desc: '石灰岩洞，洞口垂著蝙蝠。' }) } }))
    const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 5, birthplace: 'rivervale' })
    state.location = ID
    enterLocation(state)
    const report = { kind: 'rest', time: { start: state.time, end: state.time }, location: { at: ID, region: 'central' }, party: [], outcome: { result: 'neutral', summary: '' }, changes: {}, narration: {} }
    const out = commitReport(state, report as never)
    expect(out.location.scene).toBe('測試洞窟（石灰岩洞，洞口垂著蝙蝠。）')
  })
})

describe('custom dungeons: other content can point at them', () => {
  it('keeps story spots, dungeon events and intel items that use the dungeon, and reports them as usage', async () => {
    const { storyCheck } = await import('@/engine/storyMods')
    const { stories, itemDef } = await import('@/engine/data')
    const { travelEvents } = await import('@/engine/road')
    const mods = normalizeMods({
      ...emptyMods(),
      dungeons: { [ID]: cave() },
      stories: {
        mod_story_cave: {
          title: '洞窟的委託', summary: '', rank: 'E', custom: true,
          start: { kind: 'guild', location: 'rivervale', text: '公會的人說洞窟裡有東西。' },
          nodes: [{ id: 'n1', title: '洞窟深處', at: { where: 'dungeon', location: ID, layer: 'shallow' }, kind: 'combat', enemies: [['slime', 1]], success: { text: '打倒了。', complete: true }, fail: { text: '退回去了。' } }],
        } as never,
      },
      travelEvents: {
        mod_event_cave: {
          scope: 'dungeon', tier: 'normal', kind: 'choice', triggers: ['chest'], dungeons: [ID], custom: true,
          title: '洞窟的寶箱', text: '寶箱上刻著字。', options: [{ label: '打開', success: { text: '裡面是空的。' } }],
        } as never,
      },
      items: { 洞窟的地圖: { name: '洞窟的地圖', category: 'info', price_cc: 30, tags: ['tavern'], custom: true, intel: { kind: 'point', event: 'chest', location: ID, layer: 'middle' } } as never },
    })
    expect(mods.stories.mod_story_cave!.nodes[0]!.at).toMatchObject({ where: 'dungeon', location: ID, layer: 'shallow' })
    expect(mods.travelEvents.mod_event_cave!.dungeons).toEqual([ID])
    expect(mods.items['洞窟的地圖']!.intel).toMatchObject({ location: ID, layer: 'middle' })

    applyContent(mods)
    expect(storyCheck(stories.find((s) => s.id === 'mod_story_cave')!).errors).toEqual([])
    expect(travelEvents.templates.find((t) => t.id === 'mod_event_cave')?.dungeons).toEqual([ID])
    expect(itemDef('洞窟的地圖')?.intel?.location).toBe(ID)
    expect(dungeonUsage(ID).sort()).toEqual([
      '地下城事件「洞窟的寶箱」',
      '情報物品「洞窟的地圖」',
      '特殊任務「洞窟的委託」的任務點「洞窟深處」',
    ].sort())
  })
})

describe('custom dungeons: replacing all content', () => {
  it('drops a dungeon that is in use without breaking the game, and lists what changed', async () => {
    const { editableWorld } = await import('./testWorld')
    const { useGame } = await import('@/stores/game')
    const { specialMaps } = await import('@/engine/data')
    const c = editableWorld()
    c.saveDungeon(ID, cave())
    const room = { name: '洞窟深處', location: ID, desc: '', lighting: 'dark', layer: 'deep', grid: ['#####', '#...#', '##E##'], custom: true }
    c.saveSpecialMap('sm_test_room', room as never)
    // 進行中的遊戲：人在地下城裡，接了以它為目標的委託
    const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 5, birthplace: 'rivervale' })
    state.location = ID
    enterLocation(state)
    state.quests.push({ id: 'q1', giver: 'rivervale', target: ID, title: '清剿測試洞窟', status: 'accepted' } as never)
    useGame().state = state

    // 匯入的內容沒有這座地下城，但特殊地圖還寫著它
    c.importMods(JSON.stringify({ type: 'elondia-content', specialMaps: { sm_test_room: room } }))
    expect(findLocation(ID)).toBeUndefined()
    expect(c.mods.dungeons).toEqual({})
    expect(specialMaps.sm_test_room!.location).toBe('soriel')
    expect(state.location).toBe('rivervale')
    expect(state.position).toBeTruthy()
    expect(state.expedition).toBeUndefined()
    expect(state.quests.some((q) => q.id === 'q1')).toBe(false)
    expect(c.problems.some((p) => p.includes('自建地下城「測試洞窟」不在匯入的內容裡'))).toBe(true)
    expect(c.problems.some((p) => p.includes('特殊地圖「洞窟深處」原本屬於「loc_test_cave」') && p.includes('索里耶爾'))).toBe(true)
  })
})

describe('custom dungeons: uploaded image', () => {
  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

  it('keeps only image data URLs that are not too big', async () => {
    const { DUNGEON_IMAGE_MAX_CHARS } = await import('@/engine/dungeonMods')
    expect(sanitizeDungeonMod(ID, cave({ image: PNG })).image).toBe(PNG)
    expect(sanitizeDungeonMod(ID, cave({ image: 'https://example.com/a.png' })).image).toBeUndefined()
    expect(sanitizeDungeonMod(ID, cave({ image: `data:image/png;base64,${'A'.repeat(DUNGEON_IMAGE_MAX_CHARS)}` })).image).toBeUndefined()
  })

  it('is the background inside the dungeon, and goes away when the dungeon does', async () => {
    const { backgroundFor } = await import('@/components/fx/backgrounds')
    applyContent(normalizeMods({ ...emptyMods(), dungeons: { [ID]: cave({ image: PNG }) } }))
    const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 5, birthplace: 'rivervale' })
    state.location = ID
    enterLocation(state)
    expect(backgroundFor(state, {})).toBe(PNG)
    // 內建的同名圖優先（例如之後放了 <id>-<層> 的圖）
    expect(backgroundFor(state, { [`${ID}-outskirts`]: 'built-in.webp' })).toBe('built-in.webp')
    applyContent(emptyMods())
    const { dungeonImages } = await import('@/engine/dungeonMods')
    expect(dungeonImages[ID]).toBeUndefined()
  })
})

describe('custom dungeons: empty layers and missing bosses', () => {
  const allCells = async (state: ReturnType<typeof newGame>, layer: number) => {
    const { generateLayer } = await import('@/engine/grid')
    const { Rng } = await import('@/engine/rng')
    return generateLayer(state, locationById(ID), layer, new Rng(layer * 7 + 1)).cells
  }

  it('spawn no monsters on an empty layer, and post no quests for it', async () => {
    const { guildQuests } = await import('@/engine/town')
    applyContent(normalizeMods({ ...emptyMods(), dungeons: { [ID]: cave({ layers: { outskirts: [], shallow: [], middle: [[['reef_crab', 2]]], deep: [] }, bosses: {} }) } }))
    const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 5, birthplace: 'rivervale' })
    state.location = ID
    enterLocation(state)
    for (const layer of [0, 1, 3]) {
      const cells = await allCells(state, layer)
      expect(cells.some((c) => ['encounter', 'elite', 'boss'].includes(c.kind))).toBe(false)
      expect(cells.some((c) => c.kind === 'stairs_down' || c.kind === 'exit' || c.kind === 'stairs_up')).toBe(true)
    }
    // 有怪物、沒設層主的中層：照強敵的規則守著樓梯
    const middle = await allCells(state, 2)
    expect(middle.find((c) => c.kind === 'boss')?.group).toEqual([['reef_crab', 3]])
    // 委託：只有中層
    const town = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 5, birthplace: 'rivervale' })
    const mine: string[] = []
    for (let d = 0; d < 20; d++) {
      town.time.day += 8
      for (const q of guildQuests(town)) if (q.target === ID) mine.push(`${q.kind}:${q.layer}`)
    }
    expect(mine.length).toBeGreaterThan(0)
    expect(mine.every((k) => k.endsWith(':middle'))).toBe(true)
  })

  it('give the deepest layer a boss by the elite rule when none is set', async () => {
    applyContent(normalizeMods({ ...emptyMods(), dungeons: { [ID]: cave({ bosses: {} }) } }))
    const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 5, birthplace: 'rivervale' })
    const deep = await allCells(state, 3)
    expect(deep.find((c) => c.kind === 'boss')?.group).toEqual([['reef_crab', 4]])
  })

  it('auto-fill copies built-in layer bosses and skips story-only enemies', async () => {
    const { autoFillLayers, storyOnlyMonsters } = await import('@/engine/dungeonPreview')
    const builtinBosses = new Set(Object.values(dungeonEncounters).flatMap((t) => Object.values(t.bosses ?? {}).map((g) => JSON.stringify(g))))
    const storyOnly = storyOnlyMonsters()
    expect(storyOnly.size).toBeGreaterThan(0)
    let seed = 1
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (const region of geography.regions) {
      const f = autoFillLayers(region.id, true, { outskirts: [2, 4], shallow: [6, 9], middle: [10, 13], deep: [14, 17], abyss: [17, 20] }, random)
      for (const g of Object.values(f.bosses ?? {})) expect(builtinBosses.has(JSON.stringify(g))).toBe(true)
      for (const g of Object.values(f.layers).flat()) for (const [e] of g ?? []) expect(storyOnly.has(e)).toBe(false)
    }
  })

  it('tell the player why they were moved when the dungeon is gone', async () => {
    const { migrate } = await import('@/engine/state')
    const { takeLocationNotice } = await import('@/engine/pruneLocations')
    applyContent(normalizeMods({ ...emptyMods(), dungeons: { [ID]: cave() } }))
    const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 5, birthplace: 'rivervale' })
    state.location = ID
    enterLocation(state)
    applyContent(emptyMods())
    migrate(state)
    expect(takeLocationNotice()).toBe(`「測試洞窟」已經不在這個世界，你回到了${locationById('rivervale').name}。`)
    expect(takeLocationNotice()).toBeNull()
  })
})
