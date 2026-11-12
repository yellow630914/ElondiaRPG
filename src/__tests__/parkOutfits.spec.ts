import { describe, expect, it } from 'vitest'
import { enemies, itemDef, itemRules, landmarks, shopRules, specialMaps } from '@/engine/data'
import { gearRules } from '@/engine/gear'
import { currentCell, enterLocation, standOn } from '@/engine/grid'
import { equipItem } from '@/engine/inventory'
import { exposureLevel } from '@/engine/lewd'
import { pcOf } from '@/engine/party'
import { enterSpecial } from '@/engine/specialMaps'
import { addItem, migrate, newGame } from '@/engine/state'
import { shopState } from '@/engine/trade'
import type { GameState } from '@/engine/types'

// 緋夢樂園主題體驗區的五件套（worldgen/scripts/elondia/park_outfits49.py，docs/LUST_PARK.md 第 9 節）

const SETS: Record<string, string[]> = {
  lm_park_exp_ranch: ['cow_bikini', 'cow_bikini_bottom', 'cow_horns', 'cowbell_collar', 'cow_tail'],
  lm_park_exp_greenhouse: ['silk_veil_top', 'silk_veil_skirt', 'antenna_band', 'cocoon_gloves', 'egg_chain'],
  lm_park_exp_aquarium: ['shell_top', 'mermaid_skirt', 'pearl_tiara', 'pearl_necklace', 'fin_anklets'],
  lm_park_exp_garden: ['petal_bra', 'petal_skirt', 'flower_crown', 'vine_bracelets', 'leaf_sandals'],
  lm_park_exp_theater: ['succubus_bustier', 'succubus_shorts', 'succubus_horns', 'succubus_tail', 'succubus_boots'],
}
const BOSSES: Record<string, string[]> = {
  lm_park_exp_ranch: ['lp_boss_hound_alpha', 'lp_boss_white_fox', 'lp_boss_stallion'],
  lm_park_exp_greenhouse: ['lp_boss_slime_mother', 'lp_boss_slug_king', 'lp_boss_hive_queen'],
  lm_park_exp_aquarium: ['lp_boss_tank_octopus', 'lp_boss_sea_serpent', 'lp_boss_abyss_mother'],
  lm_park_exp_garden: ['lp_boss_giant_glue', 'lp_boss_lotus', 'lp_boss_flower_queen'],
  lm_park_exp_theater: ['lp_boss_manager', 'lp_boss_director', 'lp_boss_queen'],
}
const itemsOf = (base: string) => itemRules.items.filter((i) => i.gear?.base === base && !i.tags.includes('unique'))
const tierOf = (name: string) => gearRules.materials[itemDef(name)!.gear!.material]!.tier

function game(): GameState {
  const state = newGame({ name: '莉雅', race: 'human', classId: 'bard', gender: '女', seed: 7, birthplace: 'bloodplume' })
  enterLocation(state)
  state.money_cc = 100000
  return state
}

describe('五件套', () => {
  it('每館一套五件、各佔一個部位，三種材料等級；當身分要五件都穿上', () => {
    for (const [hall, set] of Object.entries(SETS)) {
      expect(new Set(set.map((b) => gearRules.bases[b]!.slot)).size, hall).toBe(5)
      for (const b of set) expect(itemsOf(b).map((i) => tierOf(i.name)).sort(), b).toEqual([1, 2, 3])
      // 這一館（和裡面那一層）每一個需要穿著的身分都是整套
      const inner = Object.values(landmarks).filter((l) => l.id === hall || l.at.area === `sm/${landmarks[hall]!.interior}`)
      const roles = inner.flatMap((l) => [...(l.scenes ?? []).map((s) => s.role), l.enter?.role]).filter((r) => r?.wear)
      expect(roles.length, hall).toBeGreaterThan(0)
      for (const r of roles) expect([...r!.wear!].sort(), hall).toEqual([...set].sort())
    }
    // 淫植花園：整館要穿花瓣裝，不再只看曝露度
    expect(landmarks.lm_park_exp_garden!.enter!.role!.exposure).toBeUndefined()
  })

  it('乳牛比基尼拆成上衣與下著：上衣只遮上身，兩件都穿是曝露度 3，只穿上衣下身是光著', () => {
    expect(gearRules.bases.cow_bikini).toMatchObject({ name: '乳牛比基尼上衣', slot: 'body', top_only: true })
    expect(gearRules.bases.cow_bikini_bottom).toMatchObject({ name: '乳牛比基尼下著', slot: 'legs' })
    const state = game()
    const pc = pcOf(state)
    pc.gear = {}
    addItem(state.inventory, '亞麻乳牛比基尼上衣', 1)
    addItem(state.inventory, '亞麻乳牛比基尼下著', 1)
    equipItem(state, '亞麻乳牛比基尼上衣', pc.id)
    expect(exposureLevel(pc)).toBe(3)
    equipItem(state, '亞麻乳牛比基尼下著', pc.id)
    expect(exposureLevel(pc)).toBe(3)
    expect(itemDef('亞麻乳牛比基尼')).toBeUndefined()
  })

  it('讀舊存檔時「乳牛比基尼」改名成「乳牛比基尼上衣」（行囊與身上）', () => {
    const state = game()
    const pc = pcOf(state)
    state.inventory.push({ name: '絲綢乳牛比基尼', qty: 2 }, { name: '絲綢乳牛比基尼上衣', qty: 1 })
    pc.gear!.body = { name: '亞麻乳牛比基尼', spec: { base: 'cow_bikini', material: 'linen' } }
    migrate(state)
    expect(state.inventory.find((i) => i.name === '絲綢乳牛比基尼上衣')?.qty).toBe(3)
    expect(state.inventory.some((i) => i.name === '絲綢乳牛比基尼')).toBe(false)
    expect(pc.gear!.body!.name).toBe('亞麻乳牛比基尼上衣')
  })
})

describe('樂園服裝店', () => {
  it('體驗區入口的換衣間：五套的第一、二級每天都有，第三級隨機幾件', () => {
    expect(specialMaps.sm_park_experience!.shops).toContainEqual({ shop: 'costume', x: 9, y: 5 })
    const state = game()
    enterSpecial(state, 'sm_park_experience')
    expect(standOn(state, 'costume')).toBe(true)
    expect(currentCell(state).kind).toBe('costume')
    const sold = new Set(shopState(state, 'costume').deals.map((d) => d.title))
    for (const set of Object.values(SETS)) for (const b of set) for (const i of itemsOf(b)) if (tierOf(i.name) <= 2) expect(sold.has(i.name), i.name).toBe(true)
    expect([...sold].filter((n) => itemDef(n) && tierOf(n) === 3).length).toBeGreaterThan(0)
    expect(shopRules.types.costume!.name).toBe('樂園服裝店')
  })
})

describe('層主掉落', () => {
  it('各園區的層主有機率掉自己園區套裝的一件，越深材料越好', () => {
    for (const [hall, ids] of Object.entries(BOSSES)) {
      const names = new Set(SETS[hall]!.flatMap((b) => itemsOf(b).map((i) => i.name)))
      const tiers = ids.map((id) => {
        const drops = enemies[id]!.loot!.filter((l) => names.has(l.item))
        expect(drops.length, id).toBe(5)
        for (const d of drops) expect(d.chance, id).toBeGreaterThan(0)
        return Math.min(...drops.map((d) => tierOf(d.item)))
      })
      expect(tiers, hall).toEqual([...tiers].sort((a, b) => a - b))
      expect(tiers[2], hall).toBe(3)
    }
  })
})
