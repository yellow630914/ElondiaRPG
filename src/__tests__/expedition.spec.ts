import { afterEach, describe, expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020'
import schema from '../../schemas/report.schema.json'
import { finishCombat, startCombat } from '@/engine/combat'
import { defeatLoss, expeditionRules } from '@/engine/expedition'
import {
  afterCombat, currentArea, currentCell, descend, enterLocation, findKind, generateLayer, layerKey, moveTo, placeAt, retreat, storeArea,
} from '@/engine/grid'
import { examQuest, playerRank, promotionStatus } from '@/engine/guild'
import { areaLighting, burnStep, currentLight, inDarkness, isDark, layerLighting, sightIn } from '@/engine/light'
import { advanceBossHunts } from '@/engine/materialQuests'
import { startJourney } from '@/engine/road'
import { addItem, assertSchema, commitReport, migrate, newGame, newReportId, SAVE_SCHEMA, withRng } from '@/engine/state'
import { abandonQuest, acceptQuest, canAcceptRank, guildQuests, turnInQuest } from '@/engine/town'
import { locationById } from '@/engine/data'
import { mod, proficiency } from '@/engine/character'
import { checkBonus } from '@/engine/perks'
import { withBonus } from '@/engine/rng'
import { standOn } from '@/engine/grid'
import type { GameState, Report } from '@/engine/types'
import { parseSaveFile } from '@/stores/saves'

const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema)
const valid = (r: Report) => expect(validate(r), JSON.stringify(validate.errors)).toBe(true)

function game(seed = 4): GameState {
  const state = newGame({ name: '測試者', race: 'human', classId: 'fighter', seed, birthplace: 'soriel' })
  enterLocation(state)
  return state
}

/** 進入地下城，站在某一層（必要時生成）的入口 */
function inDungeon(state: GameState, layer = 0, location = 'snake_creek') {
  state.location = location
  enterLocation(state)
  const loc = locationById(location)
  for (let l = 1; l <= layer; l++) {
    const area = withRng(state, (rng) => generateLayer(state, loc, l, rng))
    storeArea(state, area)
  }
  const area = state.areas![layerKey(location, layer)]!
  const start = findKind(area, layer === 0 ? 'exit' : 'stairs_up')!
  placeAt(state, area, start.x, start.y)
  return area
}

/** 走到旁邊一格走得到的地方（換成空地） */
function stepAside(state: GameState) {
  const area = currentArea(state)
  const p = state.position!
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const x = p.x + dx
    const y = p.y + dy
    if (x < 0 || y < 0 || x >= area.width || y >= area.height) continue
    const c = area.cells[y * area.width + x]!
    if (c.kind === 'wall' || c.kind === 'water') continue
    area.cells[y * area.width + x] = { kind: 'floor' }
    return moveTo(state, x, y)
  }
  throw new Error('no free cell')
}

const loot = (state: GameState, items: { name: string; qty: number }[], money = 0): Report => commitReport(state, {
  schema_version: '0.1', report_id: newReportId(state), kind: 'event', time: { start: state.time, end: state.time },
  location: { at: state.location, region: 'central' }, party: [], outcome: { result: 'success', summary: '撿到東西' },
  changes: { items_gained: items.map((i) => ({ ...i, owner: 'pc' })), ...(money ? { money_cc: money } : {}) },
})

afterEach(() => {
  expeditionRules.retreat.dc_base = 10
})

describe('save schema', () => {
  it('upgrades an old save step by step and refuses saves from a newer game', () => {
    const state = game()
    state.party[0]!.level = 5
    const old = JSON.parse(JSON.stringify(state)) as GameState
    delete old.schema
    delete old.guild
    delete old.options
    const up = migrate(old)
    expect(up.schema).toBe(SAVE_SCHEMA)
    // 以前的階級依等級換算：沿用
    expect(up.guild).toEqual({ rank: 'D', merit: 0 })
    expect(up.options).toEqual({ defeatLoot: 'half' })

    const future = { ...state, schema: SAVE_SCHEMA + 1 }
    expect(() => assertSchema(future)).toThrow('比較新版本')
    expect(() => migrate(JSON.parse(JSON.stringify(future)))).toThrow('比較新版本')
    expect(() => parseSaveFile(JSON.stringify({ state: future }))).toThrow('比較新版本')
  })

  it('starts tracking the trip when an old save is already inside a dungeon', () => {
    const state = game()
    inDungeon(state)
    const old = JSON.parse(JSON.stringify(state)) as GameState
    delete old.schema
    delete old.expedition
    expect(migrate(old).expedition?.location).toBe('snake_creek')
  })
})

describe('guild rank', () => {
  it('earns merit from quests, posts an exam when ready and promotes on passing it', () => {
    const state = game()
    standOn(state, 'guild')
    expect(playerRank(state)).toBe('F')
    // 交付一個 F 級委託：功績 +1
    const q = guildQuests(state).find((x) => x.rank === 'F' && x.kind !== 'boss_hunt' && !x.item)!
    acceptQuest(state, q.id)
    q.status = 'ready'
    q.progress = q.goal
    const done = turnInQuest(state, q.id)
    valid(done)
    expect(done.changes.merit).toBe(1)
    expect(state.guild!.merit).toBe(1)

    // 功績與等級都夠了：公會發晉升考核，就算是高一階也能接
    state.guild!.merit = 6
    state.party[0]!.level = 3
    expect(promotionStatus(state)).toMatchObject({ next: 'E', eligible: true })
    const exam = guildQuests(state).find((x) => x.flags?.exam)!
    expect(exam.rank).toBe('E')
    expect(exam.title).toContain('晉升考核')
    expect(canAcceptRank(state, 'E')).toBe(false)
    acceptQuest(state, exam.id)
    // 委託板更新也不會撤下考核
    state.time.day += 10
    guildQuests(state)
    expect(examQuest(state)?.id).toBe(exam.id)

    if (exam.kind === 'boss_hunt') advanceBossHunts(state, exam.target, [exam.monster!])
    else {
      exam.progress = exam.goal
      exam.status = 'ready'
    }
    const passed = turnInQuest(state, exam.id)
    valid(passed)
    expect(passed.changes.rank_up).toEqual({ from: 'F', to: 'E' })
    expect(playerRank(state)).toBe('E')
    expect(passed.party.find((p) => p.id === 'pc')?.rank).toBe('E')
    expect(examQuest(state)).toBeUndefined()
  })

  it('can drop an exam and take it again later', () => {
    const state = game()
    standOn(state, 'guild')
    state.guild!.merit = 6
    state.party[0]!.level = 3
    const exam = guildQuests(state).find((x) => x.flags?.exam)!
    acceptQuest(state, exam.id)
    abandonQuest(state, exam.id)
    expect(state.guild!.exam).toBeUndefined()
    expect(guildQuests(state).some((x) => x.flags?.exam)).toBe(true)
  })
})

describe('lighting', () => {
  it('knows which places are lit, lit by day or always dark', () => {
    expect(layerLighting('snake_creek', 0)).toBe('daylight')
    expect(layerLighting('snake_creek', 1)).toBe('dark')
    expect(layerLighting('mist_abbey', 1)).toBe('daylight')
    expect(layerLighting('ember_rift', 3)).toBe('lit')
    const state = game()
    const wild = { kind: 'wild' as const, location: 'soriel' }
    expect(areaLighting(wild)).toBe('daylight')
    state.time.hour = 12
    expect(isDark(state, wild)).toBe(false)
    state.time.hour = 22
    expect(isDark(state, wild)).toBe(true)
  })

  it('burns torches step by step in the dark and lights the next one', () => {
    const state = game()
    state.inventory = []
    const area = inDungeon(state, 1)
    expect(area.lighting).toBe('dark')
    expect(inDarkness(state, area)).toBe(true)
    expect(sightIn(state, area)).toBe(0)
    addItem(state.inventory, '火把（10 根）', 2)
    expect(sightIn(state, area)).toBe(2)
    // 點起一捆：行囊少一捆
    expect(state.inventory.find((i) => i.name === '火把（10 根）')?.qty).toBe(1)
    state.light!.left = 2
    burnStep(state, area)
    burnStep(state, area)
    expect(state.light).toBeUndefined()
    // 下一步點起第二捆
    burnStep(state, area)
    expect(state.inventory.some((i) => i.name === '火把（10 根）')).toBe(false)
    expect(currentLight(state)).toMatchObject({ name: '火把（10 根）', left: 59 })
  })

  it('prefers a lamp with oil, and a magic stone never burns out', () => {
    const state = game()
    state.inventory = []
    const area = inDungeon(state, 1)
    addItem(state.inventory, '火把（10 根）', 1)
    addItem(state.inventory, '油燈', 1)
    addItem(state.inventory, '燈油', 3)
    burnStep(state, area)
    expect(state.light?.item).toBe('油燈')
    expect(state.inventory.find((i) => i.name === '燈油')?.qty).toBe(2)
    addItem(state.inventory, '魔法照明石', 1)
    const left = state.light!.left
    burnStep(state, area)
    expect(state.light!.left).toBe(left)
    expect(currentLight(state)).toMatchObject({ name: '魔法照明石', permanent: true })
    expect(sightIn(state, area)).toBe(3)
  })

  it('makes traps harder and fights clumsier in the dark without light', () => {
    const state = game()
    state.inventory = []
    const area = inDungeon(state, 1)
    const p = state.position!
    const [dx, dy] = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).find(([dx, dy]) => {
      const c = area.cells[(p.y + dy) * area.width + p.x + dx]
      return c && c.kind !== 'wall' && c.kind !== 'water'
    })!
    area.cells[(p.y + dy) * area.width + p.x + dx] = { kind: 'trap' }
    const r = moveTo(state, p.x + dx, p.y + dy)
    valid(r.report!)
    expect(r.report!.timeline![0]!.action).toContain('一片漆黑')
    expect(r.report!.outcome.tags).toContain('黑暗')

    const combat = startCombat(state, [['goblin', 1]], { dark: true })
    expect(combat.dark).toBe(true)
    expect(combat.combatants.find((c) => c.id === 'pc')!.baseMods.hit).toBe(-2)
  })
})

describe('expedition', () => {
  it('tracks what this trip picked up and carries it out when leaving', () => {
    const state = game()
    inDungeon(state)
    expect(state.expedition).toMatchObject({ location: 'snake_creek', deepest: 0 })
    loot(state, [{ name: '溪畔藥草', qty: 2 }], 30)
    expect(state.expedition!.loot).toEqual([{ name: '溪畔藥草', qty: 2 }])
    expect(state.expedition!.money_cc).toBe(30)
    startJourney(state, 'soriel')
    expect(state.expedition).toBeUndefined()
  })

  it('records the deepest layer reached', () => {
    const state = game()
    const area = inDungeon(state)
    const down = area.cells.findIndex((c) => c.kind === 'stairs_down' || c.kind === 'boss')
    area.cells[down] = { kind: 'stairs_down' }
    placeAt(state, area, down % area.width, Math.floor(down / area.width))
    descend(state)
    expect(state.expedition!.deepest).toBe(1)
  })

  it('loses this trip’s loot on defeat according to the save’s rule', () => {
    for (const [rule, kept] of [['keep', 4], ['all', 0]] as const) {
      const state = game()
      state.options = { defeatLoot: rule }
      inDungeon(state)
      state.money_cc = 100
      loot(state, [{ name: '溪畔藥草', qty: 4 }], 40)
      const loss = withRng(state, (rng) => defeatLoss(state, rng, 'snake_creek'))
      expect(4 - (loss.items[0]?.qty ?? 0)).toBe(kept)
      expect(loss.money).toBe(rule === 'all' ? -40 : 0)
    }
    // 一半：每一份各擲一次
    const state = game()
    inDungeon(state)
    loot(state, [{ name: '溪畔藥草', qty: 40 }])
    const half = withRng(state, (rng) => defeatLoss(state, rng, 'snake_creek'))
    expect(half.items[0]!.qty).toBeGreaterThan(10)
    expect(half.items[0]!.qty).toBeLessThan(30)
    expect(state.expedition!.loot).toEqual([])
  })

  it('writes the lost loot into the defeat report', () => {
    const state = game()
    state.options = { defeatLoot: 'all' }
    inDungeon(state)
    loot(state, [{ name: '溪畔藥草', qty: 3 }])
    startCombat(state, [['goblin', 1]])
    for (const c of state.combat!.combatants) if (c.side === 'party') c.hp = 0
    state.combat!.status = 'defeat'
    const report = finishCombat(state)
    valid(report)
    expect(report.changes.items_lost).toContainEqual({ name: '溪畔藥草', qty: 3 })
    expect(report.outcome.summary).toContain('溪畔藥草×3')
    expect(report.outcome.tags).toContain('失去戰利品')
    expect(state.inventory.some((i) => i.name === '溪畔藥草')).toBe(false)
  })

  it('retreats from a safe room without a check, or fights pursuers when the check fails', () => {
    const state = game()
    const area = inDungeon(state, 1)
    stepAside(state)
    const here = state.position!
    area.cells[here.y * area.width + here.x] = { kind: 'safe' }
    const safe = retreat(state)
    valid(safe.report!)
    expect(currentArea(state).layer).toBe(0)
    expect(currentCell(state).kind).toBe('exit')

    // 不在安全房、檢定一定失敗：被追上
    const s2 = game(9)
    inDungeon(s2, 1)
    stepAside(s2)
    expeditionRules.retreat.dc_base = 100
    s2.party[0]!.level = 7
    const r = retreat(s2)
    valid(r.report!)
    expect(r.report!.outcome.tags).toContain('被追上')
    // 帶路的人：屬性＋熟練加值＋特質
    const guide = s2.party[0]!
    const modifier = mod(guide.attrs[expeditionRules.retreat.attr]) + proficiency(7) + checkBonus(guide, { context: 'retreat', attr: expeditionRules.retreat.attr })
    expect(r.report!.check!.modifier).toBe(modifier)
    expect(r.report!.timeline![0]!.roll!.dice).toBe(withBonus('1d20', modifier))
    expect(r.combat).toBeDefined()
    expect(s2.retreating).toBe(true)
    // 打贏就撤出
    for (const c of s2.combat!.combatants) if (c.side === 'enemy') c.hp = 0
    s2.combat!.status = 'victory'
    const won = finishCombat(s2)
    // 打贏追兵就撤出：當作戰術性撤退（不補撤退的時間）
    expect(won.outcome.tags).toContain('戰術性撤退')
    expect(won.outcome.summary).toContain('戰術性撤退')
    afterCombat(s2, won)
    expect(s2.retreating).toBeUndefined()
    expect(currentArea(s2).layer).toBe(0)
    expect(currentCell(s2).kind).toBe('exit')
  })
})
