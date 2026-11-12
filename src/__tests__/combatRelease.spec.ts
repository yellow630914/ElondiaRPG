import { describe, expect, it } from 'vitest'
import { combatRelease } from '@/engine/combatRelease'
import { bindDetail, bindTip } from '@/engine/bindRulesMods'
import { gearName, gearSummary, gearSummaryParts } from '@/engine/gear'
import { enterLocation } from '@/engine/grid'
import { pcOf } from '@/engine/party'
import { newGame } from '@/engine/state'
import type { Character, GameState, GearSlot } from '@/engine/types'

// 拘束具的說明（物品說明的「限制行走 2」）與紙娃娃下方的「戰鬥中解放」（docs/LEWD_STATS.md 第 7 節）

function game(): GameState {
  const state = newGame({ name: '莉雅', race: 'human', classId: 'fighter', seed: 3, birthplace: 'rhineburg' })
  enterLocation(state)
  return state
}
const wear = (c: Character, slot: GearSlot, base: string, material = 'leather') => {
  const spec = { base, material }
  ;(c.gear ??= {})[slot] = { name: gearName(spec), spec }
}

describe('拘束具的說明', () => {
  it('「束縛雙手 3」帶著平常的檢定減值、戰鬥中的增益與免疫', () => {
    expect(bindDetail('hands', 3)).toMatchObject({ title: '束縛雙手 3', checks: '力量檢定、靈巧檢定、開鎖、陷阱', penalty: 3, combat: '減傷 +3', immune: ['繳械'] })
    expect(bindDetail('legs', 2)).toMatchObject({ checks: '靈巧檢定、旅途的危險、旅途的事件、撤退、潛行', penalty: 2, combat: '先攻 +4', immune: [] })
    expect(bindDetail('body', 1)!.checks).toBe('所有檢定')
    expect(bindTip('legs', 3)).toContain('戰鬥中：先攻 +5、行動點回復 +1')
  })

  it('物品摘要的拘束那一段可以看細節，文字和原本的摘要一樣', () => {
    const spec = { base: 'armbinder', material: 'leather' }
    const parts = gearSummaryParts(spec)
    expect(parts.map((p) => p.text).join('・')).toBe(gearSummary(spec))
    const bind = parts.find((p) => p.bind)!
    expect(bind.text).toBe('束縛雙手 3')
    expect(bind.tip).toContain('平常：力量檢定、靈巧檢定、開鎖、陷阱 −3')
    // 一般裝備沒有
    expect(gearSummaryParts({ base: 'longsword', material: 'iron' }).some((p) => p.bind || p.tip)).toBe(false)
  })
})

describe('戰鬥中解放', () => {
  it('沒修流派、慾望戰鬥關閉時寫原因', () => {
    const state = game()
    const pc = pcOf(state)
    wear(pc, 'wrists', 'armbinder')
    pc.gear!.wrists!.lock = 'white'
    expect(combatRelease(state, pc).off).toContain('流派')
    pc.perks = ['school_bondage']
    ;(state.options as { lustMult?: number }).lustMult = 0
    expect(combatRelease(state, pc).off).toContain('慾望戰鬥關閉')
  })

  it('拘束具的部分套上全身上限，括號是實際加總', () => {
    const state = game()
    const pc = pcOf(state)
    pc.perks = ['school_bondage', 'school_flesh']
    for (const [slot, base] of [['wrists', 'armbinder'], ['accessory', 'collar_chain'], ['legs', 'leg_binder'], ['feet', 'ballet_boots'], ['piercing_1', 'shock_pads'], ['underwear_bottom', 'thrust_dildo']] as const) {
      wear(pc, slot, base)
      pc.gear![slot]!.lock = 'gold'
    }
    const r = combatRelease(state, pc)
    const dr = r.rows.find((x) => x.key === 'dr')!
    expect(dr.value).toBe(3)
    expect(dr.raw).toBeGreaterThan(3)
    expect(r.rows.find((x) => x.key === 'initiative')).toMatchObject({ name: '先攻', value: 5 })
    expect(r.rows.find((x) => x.key === 'ap_regen')).toMatchObject({ value: 1, raw: 4 })
    expect(r.sources).toContain('拘束具 6 件')
    expect(r.immune).toContain('繳械')
    // 先攻在最前面
    expect(r.rows[0]!.key).toBe('initiative')
  })
})
