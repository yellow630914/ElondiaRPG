import { describe, expect, it } from 'vitest'
import { act, combatant, startCombat } from '@/engine/combat'
import { itemDef, itemRules, shopRules, statuses } from '@/engine/data'
import { blockKeys, CELL_ICON, enterLocation, getArea, standOn } from '@/engine/grid'
import { formatDice, parseDice, sanitizeEnemy } from '@/engine/mods'
import { migrate, newGame } from '@/engine/state'
import { buyDeal, shopState } from '@/engine/trade'
import { acceptQuest, guildQuests } from '@/engine/town'
import type { GameState } from '@/engine/types'

function game(location = 'soriel', seed = 4): GameState {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed, birthplace: location })
  enterLocation(state)
  return state
}

describe('shop types', () => {
  it('sizes settlements by tier, gives each its own layout and puts the shops on the map', () => {
    const tiers: Record<string, { ids: string[]; blocks: number[]; kinds: string[] }> = {
      capital: { ids: ['soriel', 'rhineburg', 'dawnlight', 'ironforge', 'bloodplume', 'silvermoon', 'tidehaven', 'canglue'], blocks: [4, 5], kinds: ['smithy', 'tailor', 'jeweler', 'magic', 'informant', 'brothel', 'temple'] },
      city: { ids: ['albena', 'shadow_vale', 'silent_tomb'], blocks: [3, 3], kinds: ['smithy', 'tailor', 'jeweler', 'magic', 'informant', 'brothel', 'temple'] },
      medium: { ids: ['rivervale', 'greyrock', 'moltenhold', 'coral_bay', 'coast_ferry', 'ashport', 'sandcastle'], blocks: [2, 2], kinds: ['smithy', 'tailor', 'informant', 'temple', 'brothel'] },
      small: { ids: ['snowridge', 'bone_hills', 'windspeak', 'mosswhisper', 'sunscorch', 'stilltide_oasis'], blocks: [1, 1], kinds: ['inn', 'guild', 'tavern', 'shop', 'brothel'] },
    }
    const layouts = new Map<string, string>()
    for (const t of Object.values(tiers)) {
      for (const id of t.ids) {
        const keys = blockKeys(id)
        expect(keys.length, id).toBeGreaterThanOrEqual(t.blocks[0]!)
        expect(keys.length, id).toBeLessThanOrEqual(t.blocks[1]!)
        const state = game(id)
        for (const k of [...t.kinds, 'inn', 'guild', 'tavern', 'shop', 'gate']) expect(standOn(state, k as never), `${id} ${k}`).toBe(true)
        // 每個地點的格局都不一樣
        const grid = keys.map((key) => getArea(state, key).cells.map((c) => c.kind[0]).join('')).join('|')
        expect(layouts.get(grid), `${id} 和 ${layouts.get(grid)} 一樣`).toBeUndefined()
        layouts.set(grid, id)
      }
    }
    for (const k of ['inn', 'guild', 'tavern', 'shop', 'temple', 'brothel', 'smithy', 'tailor', 'jeweler', 'magic', 'informant'] as const) {
      expect(CELL_ICON[k], k).toBeTruthy()
    }
  })

  it('sells gear by kind: smithy metal and wood, tailor leather and cloth, jeweler jewelry', () => {
    const state = game()
    const kinds = (type: 'smithy' | 'tailor' | 'jeweler') => new Set(shopState(state, type).deals.flatMap((d) => {
      const g = itemDef(d.title)?.gear
      return g ? [itemRules.items.find((i) => i.name === d.title)!.gear!.base] : []
    }))
    expect(kinds('smithy').size).toBeGreaterThan(0)
    expect(kinds('tailor').size).toBeGreaterThan(0)
    expect(kinds('jeweler').size).toBeGreaterThan(0)
    // 材料以收購價的兩倍賣出，不能買進賣出套利
    const ingot = shopState(state, 'smithy').deals.find((d) => d.title === '精鋼錠')!
    expect(ingot.gives[0]!.amount).toBeGreaterThanOrEqual(itemDef('精鋼錠')!.price_cc * 2)
  })

  it('stocks scrolls plus random potions and materials at the magic shop', () => {
    const state = game()
    const deals = shopState(state, 'magic').deals
    const cat = (c: string) => deals.filter((d) => itemDef(d.title)?.category === c)
    expect(cat('scroll').length).toBeGreaterThanOrEqual(10)
    expect(cat('consumable').length).toBe(shopRules.types.magic.random!.consumables)
    expect(cat('material').length).toBe(shopRules.types.magic.random!.materials)
  })

  it('sells dungeon intel and quest leads at the informant', () => {
    const state = game('rivervale')
    const quest = guildQuests(state)[0]!
    acceptQuest(state, quest.id)
    const shop = shopState(state, 'informant')
    const intel = shop.deals.find((d) => d.id.startsWith('info:dungeon:'))!
    expect(intel.gets.find((g) => g.type === 'memory')).toBeTruthy()
    const lead = shop.deals.find((d) => d.id === `info:quest:${quest.id}`)!
    state.money_cc = 10000
    buyDeal(state, 'informant', lead.id)
    expect(state.quests.find((q) => q.id === quest.id)!.flags?.lead).toBe(true)
  })
})

describe('scrolls', () => {
  it('references existing statuses and teleports the party out', () => {
    const scrolls = itemRules.items.filter((i) => i.category === 'scroll')
    expect(scrolls.length).toBeGreaterThanOrEqual(20)
    for (const s of scrolls) {
      expect(s.use, s.name).toBeDefined()
      if (s.use?.status) expect(statuses[s.use.status.id]).toBeDefined()
      if (s.use?.apply) expect(statuses[s.use.apply.status]).toBeDefined()
      for (const c of s.use?.cleanse ?? []) expect(statuses[c]).toBeDefined()
    }
    const state = newGame({ name: '測試者', race: 'human', classId: 'fighter', seed: 2 })
    startCombat(state, [['goblin', 2]])
    state.inventory.push({ name: '傳送卷軸', qty: 1 }, { name: '火球術卷軸', qty: 1 })
    const combat = state.combat!
    combat.turn = combat.order.indexOf('pc')
    combatant(combat, 'pc').ap = 9
    for (const c of combat.combatants) if (c.side === 'enemy') c.hp = c.maxHp = 500
    act(state, { type: 'item', item: '火球術卷軸', target: combat.combatants.find((c) => c.side === 'enemy')!.id })
    const fire = combat.timeline.find((t) => t.action === '使用火球術卷軸')!
    expect(fire.effects!.filter((e) => e.type === 'damage')).toHaveLength(2)
    combat.turn = combat.order.indexOf('pc')
    combatant(combat, 'pc').ap = 9
    act(state, { type: 'item', item: '傳送卷軸', target: 'pc' })
    expect(combat.status).toBe('fled')
  })
})

describe('jewelry slots', () => {
  it('moves old saves: the ring to the first ring slot, the first necklace to 首飾, the second back to the pack', () => {
    const state = newGame({ name: '測試者', race: 'human', classId: 'fighter', seed: 1 })
    const pc = state.party[0]!
    const gear = pc.gear as Record<string, { name: string; spec: { base: string; material: string } } | undefined>
    gear.accessory = { name: '銅製精準之戒', spec: { base: 'ring_precision', material: 'copper' } }
    gear.neck_1 = { name: '銅製抗火項鍊', spec: { base: 'pendant_fire', material: 'copper' } }
    gear.neck_2 = { name: '銅製守護護符', spec: { base: 'amulet_ward', material: 'copper' } }
    migrate(state)
    expect(pc.gear!.ring_1?.name).toBe('銅製精準之戒')
    expect(pc.gear!.accessory?.name).toBe('銅製抗火項鍊')
    expect(gear.neck_1).toBeUndefined()
    expect(state.inventory.find((i) => i.name === '銅製守護護符')?.qty).toBe(1)
  })
})

describe('monster dice', () => {
  it('only allows {x}d{y}+{z}', () => {
    expect(parseDice('2d8+3')).toEqual({ count: 2, sides: 8, bonus: 3 })
    expect(formatDice({ count: 2, sides: 8, bonus: 0 })).toBe('2d8')
    expect(formatDice({ count: 0, sides: 1, bonus: -2 })).toBe('1d2')
    for (const [raw, want] of [['3d6+2', '3d6+2'], ['d6', '1d6'], ['2d8-1', '1d6'], ['abc', '1d6']]) {
      expect(sanitizeEnemy('x', { weapon: { dice: raw!, type: 'slashing', attr: 'str' } }, true).weapon.dice).toBe(want)
    }
  })
})
