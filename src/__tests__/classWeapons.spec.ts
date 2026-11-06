// 存檔規則「職業武器限制」（docs/ITEMS.md 第 2.2 節）：主手只能拿職業能用的武器類型
import { describe, expect, it } from 'vitest'
import { classWeaponBlock, creationCatalog, gearRules, registerGear } from '@/engine/gear'
import { startCombat, unusableReason } from '@/engine/combat'
import { enterLocation } from '@/engine/grid'
import { enforceClassWeapons, equipItem } from '@/engine/inventory'
import { npcRecord } from '@/engine/npcs'
import { joinParty, pcOf } from '@/engine/party'
import { addItem, newGame } from '@/engine/state'
import type { GameState } from '@/engine/types'

function game(classId: string, on: boolean): GameState {
  const s = newGame({ name: '北眺', race: 'human', classId, seed: 4, ...(on ? { options: { defeatLoot: 'half', classWeapons: true } } : {}) })
  enterLocation(s)
  return s
}
const give = (s: GameState, base: string) => {
  const name = registerGear(s, { base, material: 'iron' })
  addItem(s.inventory, name, 1)
  return name
}

describe('職業武器限制', () => {
  it('lists the weapon types of every class and blocks the rest', () => {
    expect(gearRules.classes.ranger!.weapons).toEqual(['弓弩'])
    expect(classWeaponBlock('ranger', { base: 'warhammer', material: 'iron' })).toBe('遊俠只能拿弓弩類的武器')
    expect(classWeaponBlock('ranger', { base: 'crossbow', material: 'oak' })).toBeNull()
    expect(classWeaponBlock('monk', { base: 'quarterstaff', material: 'oak' })).toContain('不拿武器')
    // 副手、防具不受限制
    expect(classWeaponBlock('wizard', { base: 'shield', material: 'iron' })).toBeNull()
    // 職業模板裡的武器都在自己的清單內
    for (const [id, t] of Object.entries(gearRules.classes)) {
      if (!t || typeof t !== 'object' || !('main' in t)) continue
      for (const b of t.main) expect(classWeaponBlock(id, { base: b, material: 'iron' }), `${id} ${b}`).toBeNull()
    }
  })

  it('refuses to equip when on, and allows it when off (old saves)', () => {
    const on = game('ranger', true)
    const name = give(on, 'warhammer')
    expect(() => equipItem(on, name, pcOf(on).id)).toThrow('遊俠只能拿弓弩類的武器')
    const off = game('ranger', false)
    expect(off.options?.classWeapons).toBeUndefined()
    const n2 = give(off, 'warhammer')
    equipItem(off, n2, pcOf(off).id)
    expect(pcOf(off).gear?.main_hand?.spec.base).toBe('warhammer')
  })

  it('puts a disallowed weapon back in the pack when the rule is turned on', () => {
    const s = game('ranger', false)
    const name = give(s, 'warhammer')
    equipItem(s, name, pcOf(s).id)
    expect(enforceClassWeapons(s)).toEqual([])
    s.options = { ...s.options!, classWeapons: true }
    const notes = enforceClassWeapons(s)
    expect(notes).toEqual([`北眺的${name}收進了行囊（遊俠只能拿弓弩類的武器）`])
    expect(pcOf(s).gear?.main_hand).toBeUndefined()
    expect(pcOf(s).weapon).toBe('unarmed')
    expect(s.inventory.find((i) => i.name === name)?.qty).toBe(1)
    // 被鎖住的（主人強迫的）不動
    const s2 = game('ranger', false)
    const n2 = give(s2, 'warhammer')
    equipItem(s2, n2, pcOf(s2).id)
    pcOf(s2).gear!.main_hand!.locked = 'master'
    s2.options = { ...s2.options!, classWeapons: true }
    expect(enforceClassWeapons(s2)).toEqual([])
  })

  it('takes the weapon of a member who joins with the wrong kind', () => {
    const s = game('fighter', true)
    const rec = npcRecord(s, 'npc_saka')!
    const m = joinParty(s, rec, 'voluntary')
    expect(m.gear?.main_hand).toBeUndefined()
    expect(s.inventory.some((i) => i.name.includes('長棍') || i.name.includes('棍'))).toBe(true)
  })

  it('leaves disallowed weapons out of the creation catalog only when on', () => {
    const main = (on: boolean) => creationCatalog('ranger', 'human', on).find((c) => c.slot === 'main_hand')!.options.map((o) => o.base)
    expect(new Set(main(true))).toEqual(new Set(['longbow']))
    expect(main(false)).toContain('longbow')
  })

  it('turns off weapon skills in combat while the class weapon is not in hand', () => {
    const fight = (on: boolean, strip: boolean) => {
      const s = game('ranger', on)
      const pc = pcOf(s)
      pc.level = 6
      pc.abilities.push('volley')
      pc.loadout = undefined
      if (strip) delete pc.gear!.main_hand
      const c = startCombat(s, [['goblin', 1]])
      const me = c.combatants.find((x) => x.id === pc.id)!
      return unusableReason(c, me, 'volley')
    }
    expect(fight(true, true)).toBe('要拿弓弩類的武器')
    expect(fight(true, false)).not.toBe('要拿弓弩類的武器')
    expect(fight(false, true)).not.toBe('要拿弓弩類的武器')
  })
})
