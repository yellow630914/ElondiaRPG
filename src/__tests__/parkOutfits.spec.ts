import { describe, expect, it } from 'vitest'
import { COSTUME_SHOPS, enemies, itemDef, itemRules, landmarks, shopRules, specialMaps } from '@/engine/data'
import { gearRules, missingWear, wearName, wearUnfit } from '@/engine/gear'
import { currentCell, enterLocation, standOn } from '@/engine/grid'
import { equipItem } from '@/engine/inventory'
import { exposureLevel } from '@/engine/lewd'
import { pcOf } from '@/engine/party'
import { enterLandmark, interiorBlocked, roleMembers } from '@/engine/landmarks'
import { sanitizeShopMod } from '@/engine/shopMods'
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
    // 當天已經上架的商品與拍賣會的拍品（0.6.2 的存檔）
    state.shops = { 'albena/adult_shop': { day: state.time.day, keeper: 'k', source: 'rules', deals: [{ id: 'item:絲綢乳牛比基尼', title: '絲綢乳牛比基尼', gives: [{ type: 'money', amount: 120 }], gets: [{ type: 'item', name: '絲綢乳牛比基尼', qty: 1 }], stock: 1 }] } }
    state.auction = { day: state.time.day, location: state.location, lots: [{ name: '月影絲乳牛比基尼', start: 100, rival: 200, won: 150 }] }
    migrate(state)
    const deal = state.shops['albena/adult_shop']!.deals[0]!
    expect([deal.id, deal.title, (deal.gets[0] as { name: string }).name]).toEqual(['item:絲綢乳牛比基尼上衣', '絲綢乳牛比基尼上衣', '絲綢乳牛比基尼上衣'])
    expect(state.auction.lots[0]).toMatchObject({ name: '月影絲乳牛比基尼上衣', won: 150 })
    expect(state.inventory.find((i) => i.name === '絲綢乳牛比基尼上衣')?.qty).toBe(3)
    expect(state.inventory.some((i) => i.name === '絲綢乳牛比基尼')).toBe(false)
    expect(pc.gear!.body!.name).toBe('亞麻乳牛比基尼上衣')
  })
})

// 每館一間換衣間（服裝分館販賣）：四館在館裡，花園的在體驗區（進花粉溫室前就要穿好）
const SHOP_OF: Record<string, string> = {
  lm_park_exp_ranch: 'costume_ranch', lm_park_exp_greenhouse: 'costume_greenhouse', lm_park_exp_aquarium: 'costume_aquarium', lm_park_exp_garden: 'costume_garden', lm_park_exp_theater: 'costume_theater',
}
/** 這一館的服裝（五件加上人馬族版） */
const piecesOf = (hall: string) => [...SETS[hall]!, ...Object.entries(gearRules.bases).filter(([, b]) => b.wear_as && SETS[hall]!.includes(b.wear_as)).map(([id]) => id)]

describe('換衣間', () => {
  it('每館一間：只賣自己那一館的服裝，第一、二級每天都有，第三級隨機幾件；固定清單在編輯器存得下', () => {
    expect(Object.keys(shopRules.types).filter((t) => t.startsWith('costume')).sort()).toEqual([...COSTUME_SHOPS].sort())
    for (const [hall, sid] of Object.entries(SHOP_OF)) {
      const map = hall === 'lm_park_exp_garden' ? 'sm_park_experience' : landmarks[hall]!.interior!
      expect(specialMaps[map]!.shops!.map((x) => x.shop), hall).toContain(sid)
      const state = game()
      enterSpecial(state, map)
      expect(standOn(state, sid), sid).toBe(true)
      const sold = new Set(shopState(state, sid as never).deals.map((d) => d.title))
      const own = new Set(piecesOf(hall))
      for (const b of own) for (const i of itemsOf(b)) if (tierOf(i.name) <= 2) expect(sold.has(i.name), i.name).toBe(true)
      for (const n of sold) expect(own.has(itemDef(n)!.gear!.base), `${sid} ${n}`).toBe(true)
      expect([...sold].filter((n) => tierOf(n) === 3).length, sid).toBeGreaterThan(0)
      const d = shopRules.types[sid as never]!
      expect(sanitizeShopMod(sid, { fixed: JSON.parse(JSON.stringify(d.fixed)) }).fixed, sid).toEqual(d.fixed)
    }
    expect(specialMaps.sm_park_experience!.shops!.some((x) => x.shop === ('costume' as never))).toBe(false)
  })
})

describe('人馬族版', () => {
  it('人馬族穿不了的下身、鞋子、腿部飾品各有一件人馬族版，當作原本那件', () => {
    const centaurState = newGame({ name: '艾菈', race: 'centaur', classId: 'bard', gender: '女', seed: 7, birthplace: 'bloodplume' })
    for (const [hall, set] of Object.entries(SETS)) {
      // 每一館都穿得齊
      expect(wearUnfit('centaur', set), hall).toEqual([])
      const pc = pcOf(centaurState)
      pc.gear = {}
      for (const b of set) {
        const alt = Object.entries(gearRules.bases).find(([, x]) => x.wear_as === b)?.[0]
        const item = itemsOf(alt ?? b).find((i) => tierOf(i.name) === 1)!
        addItem(centaurState.inventory, item.name, 1)
        equipItem(centaurState, item.name, pc.id)
      }
      expect(missingWear(pc, set), hall).toEqual([])
    }
    expect(wearName('cow_bikini_bottom')).toBe('乳牛比基尼下著（人馬族穿乳牛花紋馬衣）')
    // 人類穿不了人馬族版
    expect(wearUnfit('human', ['cow_horse_cloth'])).toEqual(['cow_horse_cloth'])
  })

  it('人馬族穿好花瓣裝（花瓣馬衣、葉片蹄套）就能進花粉溫室、當體驗者', () => {
    const state = newGame({ name: '艾菈', race: 'centaur', classId: 'bard', gender: '女', seed: 7, birthplace: 'bloodplume' })
    const pc = pcOf(state)
    for (const n of ['亞麻花瓣胸衣', '亞麻花瓣馬衣', '亞麻花冠', '亞麻藤蔓手環', '亞麻葉片蹄套']) {
      addItem(state.inventory, n, 1)
      equipItem(state, n, pc.id)
    }
    enterSpecial(state, 'sm_lust_park')
    for (const id of ['lm_park_experience', 'lm_park_exp_garden']) {
      const l = landmarks[id]!
      state.position = { area: l.at.area, x: l.at.x, y: l.at.y }
      expect(interiorBlocked(state), id).toBeUndefined()
      enterLandmark(state)
    }
    expect(roleMembers(state, landmarks.lm_park_exp_garden!.enter!.role!).map((c) => c.id)).toEqual([pc.id])
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
