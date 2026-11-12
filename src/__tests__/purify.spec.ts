import { describe, expect, it } from 'vitest'
import { itemDef, lewdRules } from '@/engine/data'
import { enterLocation } from '@/engine/grid'
import { canUse, useItem, useSummary } from '@/engine/inventory'
import { addLewd, currentRegion, growLewd, lewdDaily } from '@/engine/lewd'
import { sanitizeItem } from '@/engine/mods'
import { pcOf } from '@/engine/party'
import { purifyBlocked, purifyCost, purifyMax, templePurify } from '@/engine/purify'
import { addItem, newGame } from '@/engine/state'
import type { GameState } from '@/engine/types'

// 降低慾望指標的途徑（docs/LEWD_STATS.md 第 4、4.1 節；worldgen/scripts/elondia/purify50.py）

function game(): GameState {
  const state = newGame({ name: '莉雅', race: 'human', classId: 'cleric', seed: 5, birthplace: 'albena' })
  enterLocation(state)
  state.money_cc = 10000
  return state
}

describe('敏感每天自然回落', () => {
  it('太久沒有親密場景、也沒在戰鬥中高潮，每天降 1，降到預設為止', () => {
    const state = game()
    const pc = pcOf(state)
    const day = state.time.day
    pc.lewd = { ...lewdRules.defaults, sensitivity: 60, lastScene: day }
    const idle = lewdRules.daily.sensitivity_idle_days
    lewdDaily(state, day, day + idle)
    expect(pc.lewd.sensitivity).toBe(60)
    lewdDaily(state, day + idle, day + idle + 3)
    expect(pc.lewd.sensitivity).toBe(57)
    lewdDaily(state, day + idle + 3, day + idle + 30)
    expect(pc.lewd.sensitivity).toBe(lewdRules.defaults.sensitivity)
  })

  it('戰鬥中高潮也算碰過：記下日子，回落重新等；存檔規則 0 不回落', () => {
    const state = game()
    const pc = pcOf(state)
    pc.lewd = { ...lewdRules.defaults, sensitivity: 70, lastScene: 0 }
    state.time.day = 30
    growLewd(state, pc, 'climax')
    expect(pc.lewd.lastClimax).toBe(30)
    expect(pc.lewd.sensitivity).toBe(71)
    lewdDaily(state, 30, 35)
    expect(pc.lewd.sensitivity).toBe(71)
    ;(state.options as { sensitivityDecay?: number }).sensitivityDecay = 0
    lewdDaily(state, 35, 60)
    expect(pc.lewd.sensitivity).toBe(71)
  })
})

describe('清心寡慾', () => {
  it('敏感的增加也減半', () => {
    const state = game()
    const pc = pcOf(state)
    pc.lewd = { ...lewdRules.defaults }
    pc.perks = ['school_abstinence', 'pure_heart']
    addLewd(state, pc, 'sensitivity', 4)
    expect(pc.lewd.sensitivity).toBe(52)
    addLewd(state, pc, 'lewdness', 4)
    expect(pc.lewd.lewdness).toBe(lewdRules.defaults.lewdness + 2)
  })
})

describe('神殿的淨身', () => {
  it('降一項指標：預設以上每點 40，降到預設以下加倍；每人每天一次', () => {
    const state = game()
    const pc = pcOf(state)
    pc.lewd = { ...lewdRules.defaults, sensitivity: 52 }
    const per = lewdRules.purify.per_point_cc
    expect(purifyMax(state, pc, 'sensitivity')).toBe(lewdRules.purify.max_points)
    // 52 → 47：兩點在預設以上，三點在預設以下
    expect(purifyCost(state, pc, 'sensitivity', 5)).toBe(per * 2 + per * lewdRules.purify.below_default_mult * 3)
    const money = state.money_cc
    const cost = purifyCost(state, pc, 'sensitivity', 5)
    const r = templePurify(state, pc.id, 'sensitivity', 5)
    expect(pc.lewd.sensitivity).toBe(47)
    expect(state.money_cc).toBe(money - cost)
    expect(r.changes.lewd?.[0]).toMatchObject({ stat: 'sensitivity', delta: -5 })
    expect(purifyBlocked(state, pc, 'lewdness', 1)).toContain('今天已經淨身過了')
    state.time.day += 1
    expect(purifyBlocked(state, pc, 'lewdness', 1)).toBe('')
  })

  it('也能降順從、這一帶的曝露名聲；降不下去、錢不夠時不行', () => {
    const state = game()
    const pc = pcOf(state)
    pc.lewd = { ...lewdRules.defaults, submission: 0 }
    expect(purifyBlocked(state, pc, 'submission', 1)).toContain('降不下去')
    ;(state.exposure ??= {})[pc.id] = { [currentRegion(state)]: 30 }
    templePurify(state, pc.id, 'exposure', 3)
    expect(state.exposure[pc.id]![currentRegion(state)]).toBe(27)
    state.time.day += 1
    state.money_cc = 0
    expect(purifyBlocked(state, pc, 'exposure', 1)).toBe('金錢不足')
  })
})

describe('冥想道具', () => {
  it('神殿賣的清心香：用了花一個小時，敏感 −2；降不下去時不會用掉', () => {
    const state = game()
    const pc = pcOf(state)
    pc.lewd = { ...lewdRules.defaults, sensitivity: 60 }
    expect(itemDef('清心香')!.tags).toContain('temple')
    expect(canUse('清心香')).toBe(true)
    expect(useSummary(itemDef('清心香')!.use)).toBe('冥想一小時：敏感 −2')
    expect(useSummary(itemDef('隱名符')!.use)).toBe('冥想一小時：這一帶的曝露名聲 −5')
    addItem(state.inventory, '清心香', 2)
    const r = useItem(state, '清心香', pc.id)
    expect(pc.lewd.sensitivity).toBe(58)
    expect(r.time.end.hour! - r.time.start.hour! + (r.time.end.day - r.time.start.day) * 24).toBeCloseTo(1)
    pc.lewd.sensitivity = 0
    expect(() => useItem(state, '清心香', pc.id)).toThrow('降不下去')
    expect(state.inventory.find((i) => i.name === '清心香')?.qty).toBe(1)
  })

  it('內容編輯器的物品可以寫冥想的增減，每項 ±20', () => {
    const m = sanitizeItem('測試香', { category: 'consumable', price_cc: 10, tags: [], use: { lewd: { sensitivity: -50, lewdness: 3, bogus: 2 } } } as never, true)
    expect(m.use?.lewd).toEqual({ sensitivity: -20, lewdness: 3 })
  })
})
