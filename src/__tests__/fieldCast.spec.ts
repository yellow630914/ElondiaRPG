// 戰鬥外施放治療、護盾類的能力（docs/COMBAT_SYSTEM.md 第 9 節「戰鬥外施放」）
import { describe, expect, it } from 'vitest'
import { prepareAction, resolveAction } from '@/engine/actions'
import { finishCombat, startCombat } from '@/engine/combat'
import { castOutsideCombat, fieldAbilities, fieldCastBlock } from '@/engine/fieldCast'
import { abilityDef } from '@/engine/data'
import { currentArea, enterLocation } from '@/engine/grid'
import { generateNpc } from '@/engine/npcs'
import { joinParty, pcOf } from '@/engine/party'
import { newGame, withRng } from '@/engine/state'
import { buildActionPrompt } from '@/narrator/judge'

function game(classId = 'cleric') {
  const s = newGame({ name: '瑟蕾娜', race: 'human', classId, seed: 5 })
  enterLocation(s)
  const pc = pcOf(s)
  pc.level = 5
  pc.abilities.push('cure_wounds', 'false_life', 'field_dressing')
  const rec = withRng(s, (rng) => generateNpc(s, rng, { level: 3, kind: 'adventurer', location: s.location }))
  const mate = joinParty(s, rec, 'voluntary')
  mate.hp = 1
  return { s, pc, mate }
}

describe('戰鬥外施放', () => {
  it('lists only healing and shielding abilities that resolve automatically on allies', () => {
    const { pc } = game()
    const ids = fieldAbilities(pc).map((a) => a.id)
    expect(ids).toEqual(expect.arrayContaining(['cure_wounds', 'false_life', 'field_dressing']))
    expect(ids.every((id) => abilityDef(id).heal || abilityDef(id).shield)).toBe(true)
  })

  it('heals a companion with a spell and spends a spell slot', () => {
    const { s, pc, mate } = game()
    const used = pc.slotsUsed.reduce((a, b) => a + (b ?? 0), 0)
    const r = castOutsideCombat(s, pc.id, 'cure_wounds', mate.id)
    expect(mate.hp).toBeGreaterThan(1)
    expect(pc.slotsUsed.reduce((a, b) => a + (b ?? 0), 0)).toBe(used + 1)
    expect(r.outcome.summary).toContain(`對${mate.name}施放了【治療術】`)
    expect(r.outcome.summary).toContain('回復')
  })

  it('limits per-combat skills out of combat until a long rest', () => {
    const { s, pc, mate } = game()
    castOutsideCombat(s, pc.id, 'field_dressing', mate.id)
    expect(fieldCastBlock(pc, abilityDef('field_dressing'))).toContain('長休')
    expect(() => castOutsideCombat(s, pc.id, 'field_dressing', mate.id)).toThrow('長休')
  })

  it('keeps an out-of-combat shield for the next fight only', () => {
    const { s, pc } = game()
    castOutsideCombat(s, pc.id, 'false_life')
    expect(pc.tempHp).toBeGreaterThan(0)
    const c = startCombat(s, [['goblin', 1]])
    expect(c.combatants.find((x) => x.id === pc.id)!.tempHp).toBe(pc.tempHp)
    c.status = 'victory'
    finishCombat(s)
    expect(pc.tempHp).toBeUndefined()
  })

  it('takes the same path when an active action uses it on a companion, and still judges the description', () => {
    const { s, pc, mate } = game()
    const p = prepareAction(s, { kind: 'free', text: '一邊替她療傷，一邊問她為什麼一個人追進森林', target: mate.id, use: { member: pc.id, ability: 'cure_wounds' } })
    expect(p.fieldEffects?.[0]?.target).toBe(mate.id)
    expect(p.usedAbility?.effect).toContain(mate.name)
    expect(mate.hp).toBe(1)
    const prompt = JSON.stringify(buildActionPrompt(s, p, ''))
    expect(prompt).toContain('能力的效果程式已經算好')
    resolveAction(s, null)
    expect(mate.hp).toBeGreaterThan(1)
  })

  it('falls back to a check bonus when the action target is not in the party', () => {
    const { s, pc, mate } = game()
    // 隊伍外的人（用被制伏的人當作就在身邊）
    const stranger = withRng(s, (rng) => generateNpc(s, rng, { level: 2, kind: 'adventurer', location: s.location }))
    s.captives = { ...(s.captives ?? {}), npcs: [stranger.id], area: currentArea(s).key } as typeof s.captives
    const hp = pc.hp
    const p = prepareAction(s, { kind: 'free', text: '替路人治療', target: stranger.id, use: { member: pc.id, ability: 'cure_wounds' } })
    expect(p.fieldEffects).toBeUndefined()
    resolveAction(s, null)
    expect(mate.hp).toBe(1)
    expect(pc.hp).toBe(hp)
  })

  it('heals the caster when an active action has no target at all', () => {
    const { s, pc } = game()
    pc.hp = 5
    const p = prepareAction(s, { kind: 'free', text: '找個角落坐下，替自己處理傷口', use: { member: pc.id, ability: 'cure_wounds' } })
    expect(p.fieldEffects?.[0]?.target).toBe(pc.id)
    resolveAction(s, null)
    expect(pc.hp).toBeGreaterThan(5)
  })
})
