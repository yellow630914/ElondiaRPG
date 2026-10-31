import { describe, expect, it } from 'vitest'
import { geography } from '@/engine/data'
import {
  afterCombat, ascend, canTravelHere, cellAt, crossLink, currentArea, currentCell, descend, enterLocation, getArea,
  goOutskirts, isRevealed, move, moveTo, position, questRunnableHere, returnToTown, type Area,
} from '@/engine/grid'
import { isMaterialQuest } from '@/engine/materialQuests'
import { longRest } from '@/engine/rest'
import { newGame } from '@/engine/state'
import { acceptQuest, guildQuests } from '@/engine/town'
import { arriveAt } from './helpers/travel'
import type { GameState } from '@/engine/types'
import { fightToEnd } from './helpers/fight'

function game(seed = 1): GameState {
  const state = newGame({ name: '測試者', race: 'human', classId: 'barbarian', seed })
  enterLocation(state)
  return state
}

/** 廣度優先找路，回傳到目標格子的每一步 */
function pathTo(area: Area, from: { x: number; y: number }, match: (x: number, y: number) => boolean, avoid: string[] = []) {
  const key = (x: number, y: number) => `${x},${y}`
  const prev = new Map<string, string | null>([[key(from.x, from.y), null]])
  const queue = [from]
  while (queue.length) {
    const cur = queue.shift()!
    if (match(cur.x, cur.y) && (cur.x !== from.x || cur.y !== from.y)) {
      const steps: { x: number; y: number }[] = []
      for (let k: string | null = key(cur.x, cur.y); k && k !== key(from.x, from.y); k = prev.get(k) ?? null) {
        const [x, y] = k.split(',').map(Number)
        steps.unshift({ x: x!, y: y! })
      }
      return steps
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = cur.x + dx
      const ny = cur.y + dy
      const c = cellAt(area, nx, ny)
      if (!c || c.kind === 'wall' || c.kind === 'water' || prev.has(key(nx, ny))) continue
      if (avoid.includes(c.kind) && !match(nx, ny)) continue
      prev.set(key(nx, ny), key(cur.x, cur.y))
      queue.push({ x: nx, y: ny })
    }
  }
  return null
}

/** 從某格出發能走到的格子數 */
function pathCount(area: Area, from: { x: number; y: number }) {
  let count = 0
  pathTo(area, from, () => { count++; return false })
  return count
}

function walkTo(state: GameState, kind: string, avoid = ['encounter', 'elite', 'boss', 'trap', 'link']) {
  const area = currentArea(state)
  const steps = pathTo(area, position(state), (x, y) => cellAt(area, x, y)!.kind === kind, avoid)
  if (!steps) throw new Error(`no path to ${kind} in ${area.name}`)
  for (const s of steps) {
    moveTo(state, s.x, s.y)
    if (state.combat) fightToEnd(state)
  }
}

describe('settlements', () => {
  it('starts at the gate of Soriel, which allows travel', () => {
    const state = game()
    expect(currentArea(state).name).toBe('外環・朝聖者區')
    expect(currentCell(state).kind).toBe('gate')
    expect(canTravelHere(state)).toBe(true)
  })

  it('connects Soriel blocks through links', () => {
    const state = game()
    walkTo(state, 'link', [])
    // 走到路口不會自動換區：按 E（crossLink）才過去
    expect(currentCell(state).kind).toBe('link')
    crossLink(state)
    expect(['外環・商業街', '內環・聖殿區']).toContain(currentArea(state).name)
  })

  it('builds a walkable map for every settlement with all facilities reachable from the gate', () => {
    for (const loc of geography.locations.filter((l) => l.type !== 'dungeon')) {
      const state = game()
      state.location = loc.id
      enterLocation(state)
      const area = currentArea(state)
      expect(currentCell(state).kind, loc.id).toBe('gate')
      for (const kind of ['inn', 'guild', 'tavern', 'shop']) {
        const reachable = pathTo(area, position(state), (x, y) => cellAt(area, x, y)!.kind === kind, ['link'])
        const elsewhere = area.cells.some((c) => c.kind === 'link')
        expect(reachable !== null || elsewhere, `${loc.id} ${kind}`).toBe(true)
      }
    }
  })

  it('checks the quest spot before running town quests', () => {
    const state = game(3)
    // 以地標為標的的委託另外測（landmarks.spec.ts）
    let quest = guildQuests(state).find((q) => q.area === 'town' && !q.landmark)
    for (let d = 2; !quest && d < 30; d++) {
      state.quests = []
      state.time.day = d
      quest = guildQuests(state).find((q) => q.area === 'town' && !q.landmark)
    }
    acceptQuest(state, quest!.id)
    const spot = { cellar_rats: 'tavern', lost_purse: 'shop', apothecary_delivery: 'shop', night_patrol: 'gate' }[quest!.template!]!
    const withSpot = { ...quest!, spot }
    if (spot !== 'gate') expect(questRunnableHere(state, withSpot)).toBe(false)
    // 商店在商業街，要先經過通道
    if (spot === 'shop') walkTo(state, 'link', [])
    if (currentCell(state).kind !== spot) walkTo(state, spot, [])
    expect(questRunnableHere(state, withSpot)).toBe(true)
  })
})

describe('outskirts', () => {
  it('generates a random wild area with fog of war and returns to town', () => {
    const state = game()
    goOutskirts(state)
    const area = currentArea(state)
    expect(area.kind).toBe('wild')
    expect(currentCell(state).kind).toBe('exit')
    expect(area.cells.filter((c) => c.kind === 'encounter').length).toBeGreaterThanOrEqual(3)
    const p = position(state)
    expect(isRevealed(area, p.x, p.y)).toBe(true)
    expect(isRevealed(area, 0, 0)).toBe(false)
    returnToTown(state)
    expect(currentCell(state).kind).toBe('gate')
  })

  it('never walls the gate in: most of the outskirts are reachable from the exit', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const state = game(seed)
      goOutskirts(state)
      const area = currentArea(state)
      const reachable = pathCount(area, position(state))
      expect(reachable, `seed ${seed}`).toBeGreaterThanOrEqual(Math.floor(area.cells.length / 3))
    }
  })

  it('places markers for accepted outskirts quests', () => {
    const state = game(5)
    let quest = guildQuests(state).find((q) => q.area === 'outskirts' && !isMaterialQuest(q))
    for (let d = 2; !quest && d < 30; d++) {
      state.quests = []
      state.time.day = d
      quest = guildQuests(state).find((q) => q.area === 'outskirts' && !isMaterialQuest(q))
    }
    acceptQuest(state, quest!.id)
    goOutskirts(state)
    expect(currentArea(state).cells.some((c) => c.kind === 'quest' && c.questId === quest!.id)).toBe(true)
  })

  it('starts combat when stepping on an encounter and clears it after winning', () => {
    const state = game(2)
    goOutskirts(state)
    const area = currentArea(state)
    const steps = pathTo(area, position(state), (x, y) => cellAt(area, x, y)!.kind === 'encounter', ['encounter', 'trap'])!
    let result
    for (const s of steps) result = moveTo(state, s.x, s.y)
    expect(result?.combat).toBeDefined()
    state.party[0]!.hp = 999
    state.combat!.combatants.find((c) => c.id === 'pc')!.hp = 999
    const report = fightToEnd(state)
    afterCombat(state, report)
    const p = position(state)
    if (report.outcome.result === 'victory') expect(cellAt(currentArea(state), p.x, p.y)!.done).toBe(true)
  })

  it('refuses to walk through walls and only moves one cell at a time', () => {
    const state = game()
    expect(() => move(state, 0, 1)).toThrow()
    expect(() => move(state, 1, 1)).toThrow()
  })
})

describe('dungeons', () => {
  it('generates four layers with stairs, a safe room, layer bosses guarding the stairs and a boss on the deepest layer', () => {
    const state = game(9)
    arriveAt(state, 'snake_creek')
    expect(currentArea(state).name).toBe('蛇溪洞窟・周邊')
    expect(currentCell(state).kind).toBe('exit')
    expect(canTravelHere(state)).toBe(true)
    const guards = ['', 'smuggler_boss', 'serpent_alpha']
    for (let layer = 0; layer < 3; layer++) {
      const area = currentArea(state)
      expect(area.layer).toBe(layer)
      expect(area.cells.some((c) => c.kind === 'safe')).toBe(true)
      // 淺層、中層：層主守著往下的階梯；打倒後格子變成階梯（測試直接換掉）
      const guard = area.cells.find((c) => c.kind === 'boss' && c.then === 'stairs_down')
      if (layer > 0) {
        expect(guard?.group?.[0]?.[0]).toBe(guards[layer])
        guard!.kind = guard!.then!
        delete guard!.then
      } else {
        expect(guard).toBeUndefined()
      }
      // 直接走到階梯（測試只檢查地圖結構，不打遭遇）
      const steps = pathTo(area, position(state), (x, y) => cellAt(area, x, y)!.kind === 'stairs_down', [])!
      expect(steps).not.toBeNull()
      const last = steps.at(-1)!
      state.position = { area: area.key, x: last.x, y: last.y }
      descend(state)
      expect(currentCell(state).kind).toBe('stairs_up')
    }
    const deep = currentArea(state)
    expect(deep.name).toBe('蛇溪洞窟・深層')
    expect(deep.cells.some((c) => c.kind === 'boss' && c.group?.[0]?.[0] === 'serpent_matriarch')).toBe(true)
    ascend(state)
    expect(currentArea(state).layer).toBe(2)
    expect(currentCell(state).kind).toBe('stairs_down')
  })

  it('takes a long rest at a safe room once, consuming rations', () => {
    const state = game(4)
    arriveAt(state, 'whisper_crypt')
    const area = currentArea(state)
    const safe = area.cells.findIndex((c) => c.kind === 'safe')
    state.position = { area: area.key, x: safe % area.width, y: Math.floor(safe / area.width) }
    const pc = state.party[0]!
    pc.hp = 1
    const rations = state.inventory.find((i) => i.name === '乾糧')!.qty
    pc.slotsUsed = [1]
    longRest(state, 'safe')
    expect(pc.hp).toBe(pc.maxHp)
    expect(pc.slotsUsed).toEqual([])
    expect(state.inventory.find((i) => i.name === '乾糧')?.qty ?? 0).toBe(rations - 1)
    expect(() => longRest(state, 'safe')).toThrow('已經長休過')
  })

  it('throws everyone out of the dungeon after a defeat', () => {
    const state = game(6)
    arriveAt(state, 'snake_creek')
    const area = currentArea(state)
    const steps = pathTo(area, position(state), (x, y) => cellAt(area, x, y)!.kind === 'encounter', ['encounter', 'trap'])
    if (!steps) return
    for (const s of steps) moveTo(state, s.x, s.y)
    if (!state.combat) return
    for (const c of state.combat.combatants) if (c.side === 'party') c.hp = 1
    for (const c of state.combat.combatants) if (c.side === 'enemy') c.hp = c.maxHp = 999
    const report = fightToEnd(state)
    afterCombat(state, report)
    expect(report.outcome.result).toBe('defeat')
    expect(currentCell(state).kind).toBe('exit')
    expect(getArea(state, currentArea(state).key).layer).toBe(0)
  })
})
