import { describe, expect, it } from 'vitest'
import { arenaRules } from '@/engine/arena'
import { enemies, itemDef, itemRules, lewdRules } from '@/engine/data'
import { gearName, gearRules } from '@/engine/gear'
import { enterLocation } from '@/engine/grid'
import { equipItem } from '@/engine/inventory'
import { outfitChoices } from '@/engine/outfitTailor'
import { pcOf } from '@/engine/party'
import { adultOutfitPieces } from '@/engine/schools'
import { addItem, newGame } from '@/engine/state'
import { consignable } from '@/engine/auction'
import { isUniqueItem, notForSale, sellPrice, shopKey } from '@/engine/trade'

const NEW = ['micro_bikini', 'sling_swimsuit', 'dancer_veils', 'open_gown', 'micro_skirt', 'assless_chaps', 'platform_heels', 'latex_gloves', 'garter_belt', 'cupless_bra', 'succubus_horns', 'body_chain']

describe('S9-6 淫服補充', () => {
  it('12 種新的成人向服裝底材，每種都有前三級材料的制式品；最露骨的只在魅氣濃的城鎮賣', () => {
    for (const id of NEW) {
      const b = gearRules.bases[id]!
      expect(b.outfit, id).toBe('adult')
      const std = itemRules.items.filter((i) => i.gear?.base === id && !i.tags.includes('unique') && !notForSale(i))
      expect(std.map((i) => i.name).sort(), id).toEqual(std.map((i) => gearName(i.gear!)).sort())
      expect(std).toHaveLength(3)
      for (const i of std) expect(!!i.charm_min, i.name).toBe(['micro_bikini', 'sling_swimsuit', 'assless_chaps', 'cupless_bra'].includes(id))
    }
    // 下身、鞋子、手腕、腰帶、首飾也有淫服了
    const slots = new Set(Object.values(gearRules.bases).filter((b) => b.outfit === 'adult').map((b) => b.slot))
    for (const s of ['legs', 'feet', 'wrists', 'belt', 'accessory']) expect(slots.has(s as never), s).toBe(true)
  })

  it('裁縫店訂做淫服可以選新的底材；穿上算進淫服的件數', () => {
    expect(outfitChoices().map((c) => c.base)).toEqual(expect.arrayContaining(['open_gown', 'garter_belt']))
    const state = newGame({ name: '莉雅', race: 'human', classId: 'bard', seed: 2, birthplace: 'albena' })
    enterLocation(state)
    const pc = pcOf(state)
    for (const n of ['亞麻超短裙', '亞麻吊襪腰帶']) {
      addItem(state.inventory, n, 1)
      equipItem(state, n, pc.id)
    }
    expect(adultOutfitPieces(pc)).toBe(2)
  })

  it('6 件獨特品：寶箱、園區寶箱、拍賣會、性戰場、夢魔氏族的執行者', () => {
    for (const n of ['緋夢夫人的晚禮服', '流沙聖殿的舞孃紗衣', '潮汐港的微比基尼', '黑薔薇的乳膠手套', '夜蝶的吊襪腰帶', '夢魔氏族的角冠']) {
      expect(itemDef(n)?.gear, n).toBeTruthy()
    }
    expect(gearRules.chests.deep!.items.map(([n]) => n)).toContain('流沙聖殿的舞孃紗衣')
    expect(gearRules.chests.abyss!.items.map(([n]) => n)).toContain('夜蝶的吊襪腰帶')
    expect(lewdRules.park.chest_items.map(([n]) => n)).toContain('潮汐港的微比基尼')
    expect(lewdRules.auction.pool.map(([n]) => n)).toContain('緋夢夫人的晚禮服')
    expect(arenaRules().rings.lust!.rare!.items).toEqual(['黑薔薇的乳膠手套'])
    expect(enemies.incubus_enforcer!.loot).toContainEqual({ item: '夢魔氏族的角冠', chance: 0.65 })
  })

  it('標了 unique 的獨特品（沒有獨特效果的也算）：商店不收、拍賣會不收', () => {
    const state = newGame({ name: '莉雅', race: 'human', classId: 'bard', seed: 2, birthplace: 'albena' })
    enterLocation(state)
    const uniques = itemRules.items.filter((i) => i.tags.includes('unique') && i.gear && !i.gear.unique).map((i) => i.name)
    expect(uniques).toEqual(expect.arrayContaining(['緋夢夫人的晚禮服', '夜蝶的吊襪腰帶', '囚徒的符文枷', '獵奴人的鎖鏈']))
    for (const n of uniques) {
      addItem(state.inventory, n, 1)
      expect(isUniqueItem(state, n), n).toBe(true)
      expect(sellPrice(state, shopKey(state, 'tailor'), n), n).toBeNull()
    }
    expect(consignable(state).filter((n) => uniques.includes(n))).toEqual([])
    expect(notForSale(itemDef('夜蝶的吊襪腰帶')!)).toBe(true)
  })
})
