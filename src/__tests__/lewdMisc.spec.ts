import { describe, expect, it } from 'vitest'
import { lewdRules } from '@/engine/data'
import { slaveValueMult } from '@/engine/lewd'
import { slavePrice } from '@/engine/npcs'
import { npcPerksOf } from '@/engine/perks'
import { perkDef } from '@/engine/data'
import { portraitAllure, portraitPrompt, DEFAULT_PORTRAIT_TEMPLATE, LEGACY_PORTRAIT_TEMPLATES } from '@/narrator/imageInfo'
import { RULE_DEFS } from '@/engine/gameRules'

const base = { lewdness: 10, sensitivity: 50, endurance: 10, submission: 10 }

describe('S8 其他', () => {
  it('奴隸的身價：指標超過 50 的部分與色情技能讓身價變高（有上限）', () => {
    expect(slaveValueMult(base, 0)).toBe(1)
    expect(slaveValueMult({ ...base, submission: 80 }, 2)).toBeCloseTo(1 + 30 * 0.006 + 2 * 0.04)
    expect(slaveValueMult({ lewdness: 100, sensitivity: 100, endurance: 100, submission: 100 }, 20)).toBe(1 + lewdRules.slave_price.max)
    const c = { race: 'human', class: 'fighter', level: 5 }
    expect(slavePrice(c, 1, undefined, 1.5)).toBe(Math.round(slavePrice(c) * 1.5 / 10) * 10)
  })

  it('娼妓、奴隸 NPC 有機會帶流派的入門特質（每人固定）', () => {
    const ids = Array.from({ length: 40 }, (_, i) => `npc_test_${i}`)
    const withSchool = ids.filter((id) => npcPerksOf({ id, tags: ['prostitute'] }).some((p) => perkDef(p)?.school))
    expect(withSchool.length).toBeGreaterThan(5)
    expect(withSchool.length).toBeLessThan(35)
    expect(npcPerksOf({ id: ids[0]!, tags: ['prostitute'] })).toEqual(npcPerksOf({ id: ids[0]!, tags: ['prostitute'] }))
    expect(ids.every((id) => !npcPerksOf({ id, tags: ['commoner'] }).some((p) => perkDef(p)?.school))).toBe(true)
  })

  it('形象圖帶上慾望的氣質；舊的預設模板換成新的', () => {
    expect(portraitAllure(10, 0)).toBe('')
    expect(portraitAllure(85, 65)).toContain('sultry')
    const subject = { id: 'x', name: 'A', gender: '', race: '人類', role: '戰士', appearance: '', personality: '', background: '', gear: [], tattoos: [], allure: 'seductive gaze' }
    expect(portraitPrompt(subject, DEFAULT_PORTRAIT_TEMPLATE, 'anime')).toContain('Allure: seductive gaze')
    expect(portraitPrompt({ ...subject, allure: '' }, DEFAULT_PORTRAIT_TEMPLATE, 'anime')).not.toContain('Allure')
    expect(LEGACY_PORTRAIT_TEMPLATES.length).toBe(2)
  })

  it('存檔規則：娼館事件的機率', () => {
    expect(RULE_DEFS.brothelEventMult.default).toBe(1)
  })
})
