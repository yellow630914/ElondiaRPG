import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { perkDef, shopRules, workRules } from '@/engine/data'
import { CELL_ICON, enterLocation } from '@/engine/grid'
import { applyContent, builtinPerk, emptyMods, normalizeMods } from '@/engine/mods'
import { npcRecord } from '@/engine/npcs'
import { sanitizeShopMod } from '@/engine/shopMods'
import { newGame } from '@/engine/state'
import { itemUsage } from '@/engine/usage'
import { keeperFor, sellPrice, shopKey, shopState } from '@/engine/trade'
import { useContent } from '@/stores/content'
import { editableWorld } from './testWorld'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})
afterEach(() => applyContent(emptyMods()))

const game = () => {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 3, birthplace: 'rhineburg' })
  enterLocation(state)
  return state
}

describe('built-in shop edits', () => {
  it('keep only the fields a built-in shop may change, and only when they differ', () => {
    const m = sanitizeShopMod('smithy', {
      emoji: '🔨', desc: '新的說明', ai: false, keeper: { title: '老師傅', tags: ['merchant', 'villain', 'nope'] },
      name: '改名', catalog_tag: 'magic',
    } as never)
    expect(m).toEqual({ emoji: '🔨', desc: '新的說明', ai: false, keeper: { title: '老師傅', tags: ['merchant', 'villain'] } })
    const same = shopRules.types.smithy
    expect(sanitizeShopMod('smithy', { emoji: same.emoji, desc: same.desc, ai: same.ai })).toEqual({})
    expect(() => sanitizeShopMod('nope', {})).toThrow()
  })

  it('apply to the shop rules and the map icon, and restore cleanly', () => {
    applyContent(normalizeMods({ ...emptyMods(), shops: { smithy: { emoji: '🔨', ai: false, keeper: { title: '老師傅', tags: ['villain'] } }, ghost: { emoji: '👻' } } }))
    expect(shopRules.types.smithy).toMatchObject({ emoji: '🔨', ai: false, name: '鐵匠鋪', catalog_tag: 'smith' })
    expect(CELL_ICON.smithy).toBe('🔨')
    const state = game()
    const keeper = npcRecord(state, keeperFor(state, 'smithy'))!
    expect(keeper).toMatchObject({ occupation: '老師傅', tags: ['villain'] })
    applyContent(emptyMods())
    expect(shopRules.types.smithy).toMatchObject({ emoji: '⚒️', ai: true })
    expect(CELL_ICON.smithy).toBe('⚒️')
  })

  it('add a fixed list, change what the shop buys and the work there', () => {
    const m = sanitizeShopMod('smithy', {
      fixed: [{ item: '黑麵包', stock: 5 }, { item: '藥草', stock: 200, price_cc: 30 }, { item: '黑麵包', stock: 1 }, { item: '盜賊公會的舊手套', stock: 1 }, { item: '沒有這個', stock: 1 }],
      buys: ['food', 'equipment', 'bogus'] as never,
      work: { dc: 40, rate_cc: 9, desc: workRules.jobs.smithy!.desc },
    })
    // 重複的、不能賣的（獨特物品）與不存在的物品都不收；數量與 DC 夾在範圍內；和內建一樣的描述不存
    expect(m).toEqual({ fixed: [{ item: '黑麵包', stock: 5 }, { item: '藥草', stock: 99, price_cc: 30 }], buys: ['food', 'equipment'], work: { dc: 30, rate_cc: 9 } })
    applyContent(normalizeMods({ ...emptyMods(), shops: { smithy: m } }))
    expect(workRules.jobs.smithy).toMatchObject({ dc: 30, rate_cc: 9 })
    expect(itemUsage('黑麵包')).toContain('商店「鐵匠鋪」的固定清單')
    const state = game()
    const shop = shopState(state, 'smithy')
    const bread = shop.deals.find((d) => d.id === 'item:黑麵包')!
    expect(bread.stock).toBe(5)
    const herb = shop.deals.find((d) => d.id === 'item:藥草')!
    expect(herb.gives[0]).toMatchObject({ type: 'money' })
    expect(shop.deals.filter((d) => d.id === 'item:藥草')).toHaveLength(1)
    // 收購：食物可以賣，材料不收了
    expect(sellPrice(state, shopKey(state, 'smithy'), '黑麵包')).not.toBeNull()
    expect(sellPrice(state, shopKey(state, 'smithy'), '藥草')).toBeNull()
    applyContent(emptyMods())
    expect(shopRules.types.smithy.fixed).toBeUndefined()
    expect(workRules.jobs.smithy!.dc).toBe(12)
  })

  it('set which perks the shop trains, stored on the perks', () => {
    const c = editableWorld()
    c.setShopTraining('temple', ['iron_will', 'devout', 'artisan'])
    expect(perkDef('artisan')!.train!.cells).toEqual([...builtinPerk('artisan')!.train!.cells, 'temple'])
    expect(Object.keys(useContent().mods.perks).sort()).toEqual(['artisan', 'flaw_drunkard', 'flaw_old_wound', 'pure_heart', 'school_abstinence', 'temple_friend'])
    // 拿掉最後一個地點就不能受訓；加回去沿用內建的設定，和內建一樣的不再另外存
    expect(perkDef('temple_friend')!.train).toBeUndefined()
    c.setShopTraining('temple', ['iron_will', 'devout', 'temple_friend', 'flaw_drunkard', 'flaw_old_wound', 'school_abstinence', 'pure_heart'])
    expect(perkDef('temple_friend')!.train!.cells).toEqual(['temple'])
    expect(Object.keys(useContent().mods.perks)).toEqual([])
  })
})
