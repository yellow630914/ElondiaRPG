import { describe, expect, it } from 'vitest'
import { attrOf } from '@/engine/character'
import { itemDef, lewdRules } from '@/engine/data'
import { commissionHere, craftPlan, isAdultCraft, makeTarget, outfitLewdBonus, selfLewdBonus, setupMake } from '@/engine/craft'
import { bonusesOff, gearLewdOf, gearRules } from '@/engine/gear'
import { enterLocation, standOn } from '@/engine/grid'
import { gearLewd, lewdOf, lewdPower, lewdPowerOf } from '@/engine/lewd'
import { pcOf } from '@/engine/party'
import { newGame } from '@/engine/state'
import type { GameState, GearSpec } from '@/engine/types'

function game(): GameState {
  const state = newGame({ name: '莉雅', race: 'human', classId: 'bard', seed: 8, birthplace: 'albena' })
  enterLocation(state)
  state.money_cc = 100000
  return state
}
const spec = (name: string) => ({ ...itemDef(name)!.gear! }) as GearSpec

describe('拘束具放在額外飾品欄', () => {
  it('加成不生效，減值照算（屬性、慾望指標）', () => {
    const state = game()
    const pc = pcOf(state)
    const str = attrOf(pc, 'str'), cha = attrOf(pc, 'cha')
    // 刺釘項圈：力量 +1、魅力 −2
    pc.gear!.accessory = { name: '刺釘項圈', spec: spec('刺釘項圈') }
    expect(attrOf(pc, 'str')).toBe(str + 1)
    expect(attrOf(pc, 'cha')).toBe(cha - 2)
    expect(gearLewd(pc).submission).toBeGreaterThan(0)
    delete pc.gear!.accessory
    pc.gear!.extra_1 = { name: '刺釘項圈', spec: spec('刺釘項圈') }
    expect(bonusesOff('extra_1', pc.gear!.extra_1.spec)).toBe(true)
    expect(attrOf(pc, 'str')).toBe(str)
    expect(attrOf(pc, 'cha')).toBe(cha - 2)
    expect(gearLewd(pc).submission).toBe(0)
    // 負的慾望指標照算
    expect(gearLewdOf({ ...spec('刺釘項圈'), lewd: { endurance: -4, lewdness: 3 } }, true)).toEqual({ endurance: -4 })
  })

  it('一般的飾品放在額外飾品欄照常有加成', () => {
    expect(bonusesOff('extra_1', { base: 'amulet_ward', material: 'silver' })).toBe(false)
    expect(bonusesOff('accessory', spec('刺釘項圈'))).toBe(false)
  })
})

describe('打造拘束具', () => {
  it('成人用品店接拘束具的委託，可以加一項慾望指標；一般的店不接', () => {
    const state = game()
    expect(isAdultCraft('slave_collar')).toBe(true)
    expect(isAdultCraft('suppress_collar')).toBe(false)
    standOn(state, 'smithy')
    expect(commissionHere(state, 'slave_collar')).toBe(false)
    standOn(state, 'adult_shop')
    expect(commissionHere(state, 'slave_collar')).toBe(true)
    const plan = craftPlan(state, 'leather_cuffs', 'leather', [], undefined, { lewd: 'submission', buy: true })
    expect(plan.blockers).toEqual([])
    expect(outfitLewdBonus('leather_cuffs', 'leather')).toBe(lewdRules.outfit_commission!.bonus_by_tier[0])
  })

  it('自己打造的慾望指標加成照自己那一項的基本值打折', () => {
    const full = outfitLewdBonus('leather_cuffs', 'leather')!
    expect(selfLewdBonus({ lewd: { lewdness: 0, sensitivity: 0, endurance: 0, submission: 50 } }, 'submission', 'leather_cuffs', 'leather')).toBe(Math.round((full + 1) / 2))
    expect(selfLewdBonus({ lewd: { lewdness: 0, sensitivity: 0, endurance: 0, submission: 0 } }, 'submission', 'leather_cuffs', 'leather')).toBe(0)
    expect(selfLewdBonus({ lewd: { lewdness: 0, sensitivity: 0, endurance: 0, submission: 100 } }, 'submission', 'leather_cuffs', 'leather')).toBe(full + 1)
    // 指標 100 自己做比委託多 1～2：第 1、2 級 +1，第 3 級以上 +2
    const s100 = { lewd: { lewdness: 0, sensitivity: 0, endurance: 0, submission: 100 } }
    expect([1, 2, 3, 4].map((t) => { const m = Object.entries(gearRules.materials).find(([, x]) => x.kind === 'leather' && x.tier === t)![0]; return selfLewdBonus(s100, 'submission', 'leather_cuffs', m) })).toEqual([5, 7, 10, 12])
    // 一般裝備不能加
    const state = game()
    const pc = pcOf(state)
    expect(() => setupMake(state, makeTarget(pc.id, 'amulet_ward', 'silver', [], { lewd: 'submission' }))).toThrow('只有成人向服裝與拘束具')
  })
})

describe('慾望指標超過 100', () => {
  it('只有裝備推得過 100；機制用的效力超過 100 的部分遞減', () => {
    const state = game()
    const pc = pcOf(state)
    pc.lewd = { lewdness: 100, sensitivity: 100, endurance: 100, submission: 100 }
    expect(lewdOf(pc).submission).toBe(100)
    pc.gear!.wrists = { name: '腕鐐', spec: spec('腕鐐') }
    const v = lewdOf(pc)
    expect(v.submission).toBe(100 + gearLewd(pc).submission)
    expect(v.submission).toBeGreaterThan(100)
    expect(lewdPowerOf(pc).submission).toBe(lewdPower(v.submission))
    expect(lewdPower(80)).toBe(80)
    expect(lewdPower(100)).toBe(100)
    expect(lewdPower(150)).toBe(127)
    expect(lewdPower(200)).toBe(140)
    // 全身裝備合計最多 total_cap
    expect(lewdRules.gear.total_cap).toBe(100)
  })
})
