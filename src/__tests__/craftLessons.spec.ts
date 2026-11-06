import { describe, expect, it } from 'vitest'
import { craftLessons, learnCraft } from '@/engine/craftLessons'
import { skillOf } from '@/engine/crafting'
import { enterLocation, standOn } from '@/engine/grid'
import { generateNpc } from '@/engine/npcs'
import { joinParty } from '@/engine/party'
import { newGame, withRng } from '@/engine/state'

function game() {
  const s = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 6, birthplace: 'soriel' })
  enterLocation(s)
  s.money_cc = 5000
  return s
}

describe('學工藝（R21 K5）', () => {
  it('teaches the crafts of the shop up to Lv.2, for a fee and time', () => {
    const s = game()
    standOn(s, 'smithy')
    expect(craftLessons(s).map((l) => [l.craft, l.from, l.to, l.price_cc, l.hours])).toEqual([['smithing', 0, 1, 200, 8], ['woodworking', 0, 1, 200, 8]])
    const t0 = s.time.day * 24 + s.time.hour
    learnCraft(s, 'smithing')
    expect(skillOf(s.party[0]!, 'smithing')).toEqual({ level: 1, xp: 0 })
    expect(s.money_cc).toBe(4800)
    expect(s.time.day * 24 + s.time.hour - t0).toBe(8)
    const next = craftLessons(s).find((l) => l.craft === 'smithing')!
    expect([next.from, next.to, next.price_cc, next.hours, next.days]).toEqual([1, 2, 800, 24, 3])
    const t1 = s.time.day * 24 + s.time.hour
    learnCraft(s, 'smithing')
    expect(skillOf(s.party[0]!, 'smithing').level).toBe(2)
    // 分 3 天：經過 2 天又 8 小時
    expect(s.time.day * 24 + s.time.hour - t1).toBe(2 * 24 + 8)
    // 店裡最多教到 Lv.2
    expect(craftLessons(s).some((l) => l.craft === 'smithing')).toBe(false)
    expect(() => learnCraft(s, 'smithing')).toThrow('Lv.2')
    // 別的店教別的工藝
    standOn(s, 'tailor')
    expect(craftLessons(s).map((l) => l.craft)).toEqual(['leatherwork', 'tailoring'])
  })

  it('needs the money', () => {
    const s = game()
    standOn(s, 'smithy')
    s.money_cc = 100
    expect(craftLessons(s)[0]!.blocked).toContain('錢不夠')
    expect(() => learnCraft(s, 'smithing')).toThrow('錢不夠')
  })

  it('starts a new companion at level 0', () => {
    const s = game()
    const rec = withRng(s, (rng) => generateNpc(s, rng, { level: 3, kind: 'adventurer', location: s.location }))
    const m = joinParty(s, rec, 'voluntary')
    expect(skillOf(m, 'smithing').level).toBe(0)
    const crafter = withRng(s, (rng) => generateNpc(s, rng, { level: 3, kind: 'adventurer', location: s.location }))
    crafter.tags = [...(crafter.tags ?? []), 'cook']
    const c = joinParty(s, crafter, 'voluntary')
    expect(skillOf(c, 'cooking').level).toBe(2)
  })
})
