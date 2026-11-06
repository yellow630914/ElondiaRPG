import { afterEach, describe, expect, it } from 'vitest'
import { applyClassRebalance, checkClassRebalance, declineClassRebalance, EAST_REGIONS, planClassRebalance } from '@/engine/classRebalance'
import { classModOf, sanitizeClassMod } from '@/engine/classMods'
import { findLocation } from '@/engine/data'
import { applyContent, emptyMods } from '@/engine/mods'
import { ensureRoster } from '@/engine/population'
import { newGame } from '@/engine/state'
import type { GameState, NpcRecord } from '@/engine/types'
import { pendingEvents } from '@/components/events/eventQueue'

afterEach(() => applyContent(emptyMods()))

/** 模擬新職業之前的存檔：炎華之地的名單已經生成，裡面沒有武夫、仙術師 */
function oldSave(seed = 5): GameState {
  const s = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed })
  delete s.classRebalance
  for (const id of ['longan', 'pingjiang', 'quanzhou', 'qingqiu', 'jinzhang', 'yinghe']) ensureRoster(s, id)
  for (const r of Object.values(s.npcs ?? {})) {
    if (r.class === 'wufu') r.class = 'fighter'
    if (r.class === 'xianshi') r.class = 'wizard'
  }
  return s
}
const east = (s: GameState): NpcRecord[] => Object.values(s.npcs ?? {}).filter((r) => r.generated && r.class && EAST_REGIONS.includes(findLocation(r.location)?.region ?? ''))
const count = (s: GameState, cls: string) => east(s).filter((r) => r.class === cls).length

describe('新職業的一次性調整（炎華之地）', () => {
  it('新遊戲不問', () => {
    const s = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 5 })
    expect(s.classRebalance?.done).toBe('skipped')
    checkClassRebalance(s)
    expect(s.classRebalance?.offer).toBeUndefined()
  })

  it('舊存檔：比例不對時先記下提議，不會自己改', () => {
    const s = oldSave()
    expect(east(s).length).toBeGreaterThanOrEqual(12)
    checkClassRebalance(s)
    expect(s.classRebalance?.offer?.plan.wufu).toBeGreaterThan(0)
    expect(s.classRebalance?.offer?.plan.xianshi).toBeGreaterThan(0)
    expect(count(s, 'wufu') + count(s, 'xianshi')).toBe(0)
    // 事件視窗：不擋行動、可以稍後
    expect(pendingEvents(s).find((e) => e.kind === 'classes')).toMatchObject({ blocking: false, title: '炎華之地的新職業' })
    declineClassRebalance(s)
    expect(pendingEvents(s).some((e) => e.kind === 'classes')).toBe(false)
  })

  it('答應：武夫從近戰職業、仙術師從施法職業挑，認識的人不動，之後不再問', () => {
    const s = oldSave()
    checkClassRebalance(s)
    const caster = east(s).find((r) => r.class === 'wizard')!
    s.relationships = { [caster.id]: { id: caster.id, name: caster.name } as never }
    const before = Object.fromEntries(east(s).map((r) => [r.id, r.class]))
    const plan = s.classRebalance!.offer!.plan
    const msg = applyClassRebalance(s)
    expect(msg).toContain('武夫')
    expect(count(s, 'wufu')).toBe(plan.wufu)
    expect(count(s, 'xianshi')).toBe(plan.xianshi)
    for (const r of east(s)) {
      if (r.class === 'wufu') expect(['fighter', 'barbarian', 'monk', 'paladin', 'ranger', 'rogue']).toContain(before[r.id])
      if (r.class === 'xianshi') expect(['wizard', 'bard', 'cleric', 'druid']).toContain(before[r.id])
    }
    expect(s.npcs![caster.id]!.class).toBe('wizard')
    expect(s.classRebalance).toEqual({ done: 'converted', converted: plan.wufu! + plan.xianshi! })
    checkClassRebalance(s)
    expect(s.classRebalance?.offer).toBeUndefined()
  })

  it('拒絕：職業不變，之後不再問', () => {
    const s = oldSave()
    checkClassRebalance(s)
    declineClassRebalance(s)
    checkClassRebalance(s)
    expect(s.classRebalance).toEqual({ done: 'declined' })
    expect(count(s, 'wufu') + count(s, 'xianshi')).toBe(0)
  })

  it('比例正常時不問', () => {
    const s = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 5 })
    delete s.classRebalance
    for (const id of ['longan', 'pingjiang', 'quanzhou', 'qingqiu', 'jinzhang', 'yinghe']) ensureRoster(s, id)
    if (planClassRebalance(s)) return // 剛好抽得很少：不比
    checkClassRebalance(s)
    expect(s.classRebalance).toEqual({ done: 'skipped' })
  })

  it('世界管理把權重設成 0 的職業不改', () => {
    applyContent({ ...emptyMods(), classes: { xianshi: sanitizeClassMod({ ...classModOf('xianshi'), npc_weight: 0 }, false) } })
    const s = oldSave()
    checkClassRebalance(s)
    expect(s.classRebalance?.offer?.plan.xianshi).toBeUndefined()
    expect(s.classRebalance?.offer?.plan.wufu).toBeGreaterThan(0)
  })
})
