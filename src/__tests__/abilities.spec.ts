import { afterEach, describe, expect, it } from 'vitest'
import { learnable } from '@/engine/character'
import { startCombat } from '@/engine/combat'
import { abilities, classAbilities } from '@/engine/data'
import { abilityUsage, applyContent, emptyMods, newAbility, newEnemy, normalizeMods, sanitizeAbility, type ContentMods } from '@/engine/mods'
import { newGame, pruneAbilities } from '@/engine/state'

afterEach(() => applyContent(emptyMods()))

const mods = (patch: Partial<ContentMods>) => normalizeMods({ ...emptyMods(), ...patch })

describe('custom abilities', () => {
  it('cleans up an authored ability', () => {
    const a = sanitizeAbility('mod_ability_x', {
      ...newAbility('mod_ability_x'),
      name: '烈焰斬',
      classes: ['fighter', 'nobody', 'monster'],
      damage: [{ weapon: true, type: 'fire' }, { dice: 'oops' }, { dice: '2d6', type: 'nope' }],
      apply: [{ status: 'burning_x', turns: 2 }, { status: 'stunned', turns: 99, on: 'hit', save: 'str' }],
      mult: '' as unknown as number,
      uses: { per_combat: 1 },
      heal: {},
    }, true)
    expect(a.classes).toEqual(['fighter', 'monster'])
    expect(a.damage).toEqual([{ weapon: true, type: 'fire' }, { dice: '2d6' }])
    expect(a.apply).toEqual([{ status: 'stunned', turns: 20, on: 'hit', save: 'str' }])
    expect(a.mult).toBeUndefined()
    expect(a.heal).toBeUndefined()
    expect(a).toMatchObject({ unlock: 1, uses: { per_combat: 1 }, custom: true })
  })

  it('adds a custom skill that classes can learn and monsters can use, and edits a built-in one', () => {
    const a = { ...newAbility('mod_ability_y'), name: '旋風斬', classes: ['fighter', 'monster'] }
    const e = { ...newEnemy('mod_enemy_y'), abilities: ['mod_ability_y'] }
    const power = { ...abilities.power_strike!, desc: '改過的說明' }
    // 從儲存的資料讀回來（還沒套用時）也要認得自建的能力
    const m = normalizeMods(JSON.parse(JSON.stringify({ abilities: { mod_ability_y: a, power_strike: power }, enemies: { mod_enemy_y: e } })))
    expect(m.enemies.mod_enemy_y!.abilities).toEqual(['mod_ability_y'])
    expect(m.abilities.power_strike!.custom).toBeUndefined()
    applyContent(m)
    expect(abilities.power_strike!.desc).toBe('改過的說明')
    expect(classAbilities('fighter').some((x) => x.id === 'mod_ability_y')).toBe(true)
    const state = newGame({ name: '測試者', race: 'human', classId: 'fighter', seed: 3 })
    expect(learnable(state.party[0]!).some((x) => x.id === 'mod_ability_y')).toBe(true)
    startCombat(state, [['mod_enemy_y', 1]])
    expect(state.combat!.combatants.find((c) => c.side === 'enemy')!.abilities).toContain('mod_ability_y')
    expect(abilityUsage('mod_ability_y')).toEqual(['怪物「新的怪物」'])
  })

  it('也列出寄生物、技能書、事件、事件庫、怪物特徵這些拿得到能力的地方；色情技能與怪物技能都有來源', () => {
    expect(abilityUsage('para_lingerie_bind')).toEqual(['寄生物「渴求的魔導衣」（馴服之後、有獸蟲派時可以用，不分先後）'])
    expect(abilityUsage('para_mark_surge')).toEqual(['寄生物「魅魔的契紋」（馴服之後、有獸蟲派時可以用，不分先後）'])
    expect(abilityUsage('lust_kiss').some((u) => u.startsWith('寄生物「魅魔的契紋」（還沒馴服'))).toBe(true)
    expect(abilityUsage('lust_bind_stance').some((u) => u.startsWith('地下城事件「會自己穿上的繩衣」'))).toBe(true)
    expect(abilityUsage('lust_glance').some((u) => u.startsWith('技能書'))).toBe(true)
    expect(abilityUsage('rut_mount').some((u) => u.startsWith('怪物特徵'))).toBe(true)
    const orphans = Object.values(abilities).filter((x) => !x.classes.some((c) => c !== 'lewd' && c !== 'monster') && abilityUsage(x.id).length === 0)
    expect(orphans.map((x) => x.id)).toEqual([])
  })

  it('reports where an ability is used, including the current save, and prunes deleted ones', () => {
    applyContent(mods({ abilities: { mod_ability_z: newAbility('mod_ability_z') } }))
    const state = newGame({ name: '測試者', race: 'human', classId: 'fighter', seed: 3 })
    expect(abilityUsage('mod_ability_z', state)).toEqual([])
    state.party[0]!.abilities.push('mod_ability_z')
    expect(abilityUsage('mod_ability_z', state)).toEqual(['目前存檔的「測試者」'])
    expect(abilityUsage('power_strike').some((u) => u.includes('職業'))).toBe(true)
    applyContent(emptyMods())
    pruneAbilities(state)
    expect(state.party[0]!.abilities).not.toContain('mod_ability_z')
  })
})
