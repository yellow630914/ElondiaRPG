import { describe, expect, it } from 'vitest'
import { perkDef, perkRules } from '@/engine/data'
import { enterLocation, standOn } from '@/engine/grid'
import { trainOptions } from '@/engine/perkActions'
import { perkPower, trainDays, trainSpec } from '@/engine/perks'
import { newGame } from '@/engine/state'
import { shopKey, shopState } from '@/engine/trade'

describe('受訓的價格與門檻（R20 C4）', () => {
  it('prices training by the strength of the perk', () => {
    const r = perkRules.training
    for (const p of perkRules.perks.filter((x) => x.train && !x.race)) {
      const t = trainSpec(p)
      const power = Math.abs(perkPower(p))
      const mult = p.flaw ? r.flaw_mult : 1
      expect(t.price_cc, p.id).toBe(Math.max(10, Math.round((power * r.price_per_power * mult) / 10) * 10))
      expect(t.dc, p.id).toBe(r.dc_base + Math.floor(power))
      if (p.flaw) expect(t.level, p.id).toBeUndefined()
      else if (power >= 4) expect(t, p.id).toMatchObject({ level: 5, affinity: 20 })
      else if (power >= 3) expect(t.level, p.id).toBe(3)
      else expect(t.level, p.id).toBeUndefined()
    }
    // 寫了的數字照寫的
    expect(trainSpec(perkDef('pathfinder')!, { attr: 'int', price_cc: 99, hours: 3, dc: 7 })).toMatchObject({ price_cc: 99, hours: 3, dc: 7 })
    expect(trainDays(8)).toEqual({ days: 1, elapsed: 8 })
    expect(trainDays(20)).toEqual({ days: 3, elapsed: 2 * 24 + 4 })
  })

  it('asks for level and the keeper\'s affinity at a shop', () => {
    const s = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 3 })
    enterLocation(s)
    standOn(s, 'tavern')
    const shop = shopState(s, 'tavern')
    const opt = () => trainOptions(s).find((o) => o.def.id === 'silver_tongue')!
    expect(opt().train.level).toBe(5)
    expect(opt().blocked).toContain('Lv.5')
    s.party[0]!.level = 5
    expect(opt().blocked).toContain('親密度要 20')
    s.relationships = { ...(s.relationships ?? {}), [shop.keeper]: { affinity: 20 } as never }
    expect(opt().blocked).toBeUndefined()
    expect(shopKey(s, 'tavern')).toContain('tavern')
  })
})
