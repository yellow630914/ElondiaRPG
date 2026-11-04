// 角色詳情的戰鬥加值與來源（character.ts 的 combatBonuses）：和開戰時的算法一樣
import { describe, expect, it } from 'vitest'
import { combatBonuses, mod, proficiency, attrsOf, weaponFor } from '@/engine/character'
import { armorDef } from '@/engine/data'
import { gearBonuses } from '@/engine/gear'
import { newGame } from '@/engine/state'
import { startCombat } from '@/engine/combat'
import { enterLocation } from '@/engine/grid'

describe('combat bonuses in the character sheet', () => {
  it('adds up proficiency, attributes, armor, gear, perks and meals, and names each source', () => {
    const state = newGame({ name: '北眺', race: 'human', classId: 'ranger', seed: 4, birthplace: 'soriel' })
    enterLocation(state)
    const pc = state.party[0]!
    pc.status = [...(pc.status ?? []), 'honed']
    const b = combatBonuses(pc)
    const w = weaponFor(pc)
    expect(b.hit.parts[0]).toEqual({ src: '熟練', v: proficiency(pc.level) })
    expect(b.hit.total).toBe(proficiency(pc.level) + mod(attrsOf(pc)[w.attr]) + (gearBonuses(pc).mods.hit ?? 0))
    const evadeBase = Math.floor(mod(attrsOf(pc).dex) / 2) + armorDef(pc.armor).evade + (gearBonuses(pc).mods.evade ?? 0)
    expect(b.evade.total).toBe(evadeBase)
    // 磨利：戰鬥傷害 +1，來源寫「狀態」
    expect(b.damage.parts).toContainEqual({ src: '狀態', v: 1 })
    // 和開戰時的角色一樣（迴避：防具 + 修正）
    const combat = startCombat(state, [['goblin', 1]])
    const me = combat.combatants.find((c) => c.id === pc.id)!
    expect(me.armorEvade + (me.baseMods?.evade ?? 0) + Math.floor(mod(me.attrs.dex) / 2)).toBe(b.evade.total)
  })
})
