import { describe, expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020'
import schema from '../../schemas/report.schema.json'
import { act, combatant, finishCombat, itemTargets, startCombat, type Combatant } from '@/engine/combat'
import { ATTR_IDS, combatRules, enemies, itemDef, itemRules, statuses } from '@/engine/data'
import { forgeItemFor, gearRules, gearSpecOf, MATERIAL_KINDS, randomGear } from '@/engine/gear'
import { currentArea, moveTo } from '@/engine/grid'
import { useItem } from '@/engine/inventory'
import { Rng } from '@/engine/rng'
import { newGame } from '@/engine/state'
import { travel } from '@/engine/travel'
import type { GameState } from '@/engine/types'

const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema)

function fight(seed = 1, group: [string, number][] = [['goblin', 2]]): GameState {
  const state = newGame({ name: '測試者', race: 'human', classId: 'fighter', seed })
  startCombat(state, group)
  return state
}

function makeCurrent(state: GameState, id: string): Combatant {
  const combat = state.combat!
  combat.turn = combat.order.indexOf(id)
  return combatant(combat, id)
}

function give(state: GameState, name: string, qty = 1) {
  state.inventory.push({ name, qty })
}

describe('item data', () => {
  it('references existing statuses, damage types, attributes and materials', () => {
    for (const i of itemRules.items) {
      const u = i.use
      if (u?.status) expect(statuses[u.status.id], i.name).toBeDefined()
      if (u?.apply) expect(statuses[u.apply.status], i.name).toBeDefined()
      if (u?.apply?.save) expect(ATTR_IDS).toContain(u.apply.save)
      for (const c of u?.cleanse ?? []) expect(statuses[c], `${i.name} → ${c}`).toBeDefined()
      for (const m of i.forge?.materials ?? []) expect(gearRules.materials[m], `${i.name} → ${m}`).toBeDefined()
    }
    for (const [k, t] of Object.entries(gearRules.chests)) if (!k.startsWith('$')) for (const [name] of t.items) expect(itemDef(name), name).toBeDefined()
    for (const kind of MATERIAL_KINDS) for (let tier = 2; tier <= 5; tier++) expect(forgeItemFor(kind, tier), `${kind} ${tier}`).toBeDefined()
  })

  it('gives monster-type bosses only materials and tags armed humanoids', () => {
    const bosses = new Set<string>()
    for (const t of Object.values(enemies)) if (t.armed) expect(['humanoid', 'undead', 'demon', 'spirit']).toContain(t.kind)
    for (const id of ['serpent_alpha', 'serpent_matriarch']) bosses.add(id)
    for (const id of bosses) {
      const e = enemies[id]!
      expect(e.armed).toBeFalsy()
      expect(e.loot?.some((l) => itemDef(l.item)?.forge)).toBe(true)
      for (const l of e.loot ?? []) expect(itemDef(l.item)?.category).toBe('material')
    }
    expect(enemies.bandit!.armed).toBe(true)
  })
})

describe('consumables in combat', () => {
  it('throws a fire bottle at one enemy and a lightning bomb at all of them', () => {
    const state = fight(2, [['goblin', 3]])
    give(state, '火焰瓶')
    give(state, '雷光彈')
    const foes = state.combat!.combatants.filter((c) => c.side === 'enemy')
    for (const f of foes) f.hp = f.maxHp = 200
    makeCurrent(state, 'pc').ap = 9
    act(state, { type: 'item', item: '火焰瓶', target: foes[0]!.id })
    const fire = state.combat!.timeline.find((t) => t.action === '使用火焰瓶')!
    expect(fire.effects!.filter((e) => e.type === 'damage').map((e) => e.target)).toEqual([foes[0]!.id])
    makeCurrent(state, 'pc').ap = 9
    act(state, { type: 'item', item: '雷光彈', target: foes[1]!.id })
    const bomb = state.combat!.timeline.find((t) => t.action === '使用雷光彈')!
    expect(new Set(bomb.effects!.filter((e) => e.type === 'damage').map((e) => e.target)).size).toBe(3)
  })

  it('cleanses, shields, energizes, buffs and revives allies', () => {
    const state = fight(3)
    for (const n of ['解毒劑', '護盾藥劑', '活力藥劑', '巨力藥劑', '復甦藥劑']) give(state, n)
    const pc = makeCurrent(state, 'pc')
    pc.statuses.push({ id: 'poisoned', turns: 3, source: 'e0' })
    pc.ap = 9
    act(state, { type: 'item', item: '解毒劑', target: 'pc' })
    expect(pc.statuses.some((s) => s.id === 'poisoned')).toBe(false)
    makeCurrent(state, 'pc').ap = 9
    act(state, { type: 'item', item: '護盾藥劑', target: 'pc' })
    expect(pc.tempHp).toBe(12)
    makeCurrent(state, 'pc').ap = 2
    act(state, { type: 'item', item: '活力藥劑', target: 'pc' })
    expect(pc.ap).toBe(Math.min(pc.apMax, 2 - combatRules.action_costs.item + 2))
    makeCurrent(state, 'pc').ap = 9
    act(state, { type: 'item', item: '巨力藥劑', target: 'pc' })
    expect(pc.statuses.find((s) => s.id === 'potion_might')?.turns).toBe(3)
    // 復甦藥劑只能給倒下的隊友
    expect(itemTargets(state.combat!, '復甦藥劑')).toHaveLength(0)
    pc.hp = 0
    expect(itemTargets(state.combat!, '復甦藥劑').map((c) => c.id)).toEqual(['pc'])
  })

  it('keeps combat-only items out of the pack menu', () => {
    const state = newGame({ name: '測試者', race: 'human', classId: 'fighter', seed: 1 })
    give(state, '火焰瓶')
    expect(() => useItem(state, '火焰瓶', 'pc')).toThrow('戰鬥中')
  })
})

describe('gear sources', () => {
  it('generates level-capped random gear', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const spec = randomGear(new Rng(seed), 4)
      expect(gearRules.materials[spec.material]!.level).toBeLessThanOrEqual(4)
    }
  })

  it('places chests in dungeons and opens them for money and loot', () => {
    let opened = false
    for (let seed = 1; seed <= 12 && !opened; seed++) {
      const state = newGame({ name: '測試者', race: 'human', classId: 'fighter', seed })
      travel(state, 'snake_creek')
      const area = currentArea(state)
      const i = area.cells.findIndex((c) => c.kind === 'chest')
      if (i < 0) continue
      const x = i % area.width
      const y = Math.floor(i / area.width)
      const from = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [x + dx!, y + dy!] as const)
        .find(([nx, ny]) => !['wall', 'water'].includes(area.cells[ny * area.width + nx]?.kind ?? 'wall'))!
      state.position = { area: area.key, x: from[0], y: from[1] }
      const before = state.money_cc
      const r = moveTo(state, x, y).report!
      expect(validate(r), JSON.stringify(validate.errors)).toBe(true)
      expect(r.outcome.tags).toContain('寶箱')
      expect(state.money_cc).toBeGreaterThan(before)
      expect(area.cells[i]!.done).toBe(true)
      for (const g of r.changes.items_gained ?? []) expect(itemDef(g.name) ?? state.customItems?.[g.name]).toBeTruthy()
      opened = true
    }
    expect(opened).toBe(true)
  })

  it('drops gear from armed humanoids sometimes', () => {
    let drops = 0
    for (let seed = 1; seed <= 40; seed++) {
      const state = fight(seed, [['bandit', 3]])
      for (const c of state.combat!.combatants) if (c.side === 'enemy') c.hp = 0
      state.combat!.status = 'victory'
      const r = finishCombat(state)
      drops += (r.changes.items_gained ?? []).filter((g) => gearSpecOf(state, g.name)).length
    }
    expect(drops).toBeGreaterThan(0)
  })
})
