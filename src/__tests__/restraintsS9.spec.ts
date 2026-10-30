import { describe, expect, it } from 'vitest'
import { arenaRules, startArena } from '@/engine/arena'
import { finishCombat } from '@/engine/combat'
import { BIND_KINDS, enemies, itemDef, lewdRules } from '@/engine/data'
import { forcedGearPool } from '@/engine/forcedGear'
import { gearRules, gearSummary } from '@/engine/gear'
import { enterLocation, standOn } from '@/engine/grid'
import { equipItem, lockable, lockGear, unlockGear } from '@/engine/inventory'
import { lewdOf } from '@/engine/lewd'
import { pcOf } from '@/engine/party'
import { bindModifiers, bindsOf, twoFaceCombat } from '@/engine/schools'
import { addItem, newGame } from '@/engine/state'
import { shopState } from '@/engine/trade'
import type { GameState, GearSlot } from '@/engine/types'

function game(birthplace = 'rhineburg'): GameState {
  const state = newGame({ name: '莉雅', race: 'human', classId: 'bard', seed: 8, birthplace })
  enterLocation(state)
  state.money_cc = 100000
  return state
}
const slotOf = (state: GameState, name: string) => (Object.keys(pcOf(state).gear!) as GearSlot[]).find((s) => pcOf(state).gear![s]?.name === name)!
const sells = (state: GameState, shop: Parameters<typeof shopState>[1], name: string) =>
  shopState(state, shop).deals.some((d) => d.gets.some((g) => g.type === 'item' && g.name === name))

/** 每種拘束、每個程度：商店賣的拘束具 */
function shopMatrix(): Record<string, number[]> {
  const out: Record<string, number[]> = {}
  for (const i of [...new Set(['皮眼罩', '單手套', '步鍊', '芭蕾高跟靴', '麻繩繩衣', '絲繩龜甲縛', '跳蛋內褲', '鈴鐺乳夾', '蕾絲眼紗', '全罩皮頭套', '絲帶手銬', '皮手銬', '腳踝鈴鍊', '魔導震動栓', '鐵骨束腰', '絲巾口塞', '口球', '皮革面罩口枷'])]) {
    const def = itemDef(i)!
    expect(def.tags.some((t) => ['tailor', 'smith', 'magic', 'jeweler'].includes(t))).toBe(true)
    const base = gearRules.bases[def.gear!.base]!
    ;(out[base.bind_kind!] ??= []).push(def.gear!.bind ?? base.bind!)
  }
  return out
}

describe('S9-2 拘束具', () => {
  it('每種拘束在商店都買得到程度 1～3', () => {
    const m = shopMatrix()
    for (const k of BIND_KINDS) expect([...new Set(m[k])].sort()).toEqual([1, 2, 3])
  })

  it('封住嘴巴：平常魅力與談判減值，戰鬥中豁免、減傷，免疫嘲諷', () => {
    const state = game()
    const pc = pcOf(state)
    addItem(state.inventory, '口球', 1)
    equipItem(state, '口球', pc.id)
    pc.lewd = { ...lewdOf(pc), endurance: 0 }
    expect(bindModifiers(pc, { context: 'action', attr: 'cha' })[0]!.value).toBe(-2)
    expect(bindModifiers(pc, { context: 'negotiation', attr: 'int' })[0]!.value).toBe(-2)
    expect(bindModifiers(pc, { context: 'action', attr: 'str' })).toEqual([])
    pc.perks = ['school_bondage']
    pc.gear![slotOf(state, '口球')]!.lock = 'white'
    // 束縛派和口枷契合 ×1.2；免疫嘲諷只在程度 3（口球是程度 2）
    expect(twoFaceCombat(pc)).toMatchObject({ mods: { save: 1, dr: 1 }, immune: [] })
    expect(lewdRules.schools.bondage!.fit).toContain('mouth')
    addItem(state.inventory, '皮革面罩口枷', 1)
    equipItem(state, '皮革面罩口枷', pc.id)
    pc.gear![slotOf(state, '皮革面罩口枷')]!.lock = 'white'
    expect(twoFaceCombat(pc).immune).toEqual(['taunted'])
  })

  it('口枷戴在頭部；要和眼罩一起戴，其中一件放進額外飾品欄', () => {
    const state = game()
    const pc = pcOf(state)
    addItem(state.inventory, '皮眼罩', 1)
    addItem(state.inventory, '絲巾口塞', 1)
    equipItem(state, '皮眼罩', pc.id)
    equipItem(state, '絲巾口塞', pc.id, 'extra_1')
    expect(bindsOf(pc).map((b) => b.kind).sort()).toEqual(['eyes', 'mouth'])
  })

  it('自帶鎖的拘束具：戴上就算鎖上，不能另外上鎖也打不開，卸下不會多一把鎖', () => {
    const state = game()
    const pc = pcOf(state)
    pc.perks = ['school_bondage']
    addItem(state.inventory, '囚徒的符文枷', 1)
    addItem(state.inventory, '白鐵鎖', 1)
    equipItem(state, '囚徒的符文枷', pc.id)
    const slot = slotOf(state, '囚徒的符文枷')
    expect(bindsOf(pc)[0]).toMatchObject({ kind: 'hands', bind: 3, lock: 'rune' })
    expect(twoFaceCombat(pc).mods.dr).toBe(Math.round(3 * 1.2 * 1.2))
    expect(lockable(pc.gear![slot])).toBe(false)
    expect(() => lockGear(state, pc.id, slot, '白鐵鎖')).toThrow('已經上鎖')
    expect(() => unlockGear(state, pc.id, slot)).toThrow('沒有上鎖')
    expect(gearSummary(itemDef('囚徒的符文枷')!.gear!)).toContain('自帶符文鎖')
  })

  it('魅氣濃的城市，裁縫店多了全罩皮頭套；普通城鎮沒有。主人會強制戴上、又有商店標籤的（口球）照樣在店裡賣', () => {
    /** 換幾個種子（每天上架的貨是隨機的），有沒有哪一次賣這件 */
    const anySells = (birthplace: string, name: string) => {
      for (let seed = 1; seed <= 20; seed++) {
        const s = newGame({ name: '莉雅', race: 'human', classId: 'bard', seed, birthplace })
        enterLocation(s)
        if (sells(s, 'tailor', name)) return true
      }
      return false
    }
    expect(anySells('albena', '全罩皮頭套')).toBe(true)
    expect(anySells('rhineburg', '全罩皮頭套')).toBe(false)
    expect(anySells('albena', '口球')).toBe(true)
  })

  it('主人的池子多了口球、皮手銬、全罩皮頭套、鐵骨束腰（依身分）', () => {
    const state = game()
    expect(forcedGearPool(state, [])).toContain('口球')
    expect(forcedGearPool(state, [])).not.toContain('皮手銬')
    expect(forcedGearPool(state, ['villain'])).toEqual(expect.arrayContaining(['皮手銬', '全罩皮頭套']))
    expect(forcedGearPool(state, ['noble'])).toContain('鐵骨束腰')
  })

  it('其他來源：寶箱、園區、拍賣會、捕奴隊隊長、拘束戰鬥場', () => {
    const chest = (layer: string) => gearRules.chests[layer]!.items.map(([n]) => n)
    expect(chest('shallow')).toEqual(expect.arrayContaining(['絲帶手銬', '蕾絲眼紗', '絲巾口塞', '腳踝鈴鍊']))
    expect(chest('deep')).toContain('囚徒的符文枷')
    expect(lewdRules.park.chest_items.map(([n]) => n)).toEqual(expect.arrayContaining(['夢魔的眼紗', '觸手束衣']))
    expect(lewdRules.auction.pool.map(([n]) => n)).toEqual(expect.arrayContaining(['夢魔的眼紗', '聖女的貞潔鎖']))
    expect(enemies.slaver_captain!.loot).toContainEqual({ item: '獵奴人的鎖鏈', chance: 0.25 })
    expect(arenaRules().rings.bound!.rare!.items).toEqual(['女王的芭蕾靴'])
  })

  it('拘束戰鬥場：對手夠強時有機會拿到專屬獎品', () => {
    const state = game('albena')
    standOn(state, 'tavern')
    addItem(state.inventory, '皮眼罩', 1)
    const rare = arenaRules().rings.bound!.rare!
    const chance = rare.chance
    rare.chance = 1
    try {
      ;(state.arena ??= {}).albena = { bound: { streak: rare.tier * arenaRules().streak_per_tier, best: 0 } }
      startArena(state, 'bound', { restraint: '皮眼罩' })
      expect(state.combat!.arena!.tier).toBe(rare.tier)
      for (const c of state.combat!.combatants) if (c.side === 'enemy') c.hp = 0
      state.combat!.status = 'victory'
      finishCombat(state)
      expect(state.inventory.some((i) => i.name === '女王的芭蕾靴')).toBe(true)
    } finally {
      rare.chance = chance
    }
  })
})
