import { afterEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useContent } from '@/stores/content'
import { applyContent, emptyMods, normalizeMods } from '@/engine/mods'
import { builtinFamilyRules, currentFamilyRules, FAMILY_FIELDS, sanitizeFamilyRules } from '@/engine/familyMods'
import { lactationRules } from '@/engine/lactation'
import { familyRules } from '@/engine/pregMarks'

afterEach(() => applyContent(emptyMods()))

describe('懷孕與泌乳設定', () => {
  it('內建的設定經過整理不變；每個欄位都讀得到', () => {
    expect(sanitizeFamilyRules(builtinFamilyRules())).toEqual(builtinFamilyRules())
    const cur = currentFamilyRules()
    for (const f of FAMILY_FIELDS) {
      const v = f.path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], cur)
      expect(typeof v, f.path).toBe('number')
      expect(v as number, f.path).toBeGreaterThanOrEqual(f.min)
      expect(v as number, f.path).toBeLessThanOrEqual(f.max)
    }
  })

  it('整理：夾在範圍內、階段的比例由小到大、治療職業只收存在的', () => {
    const raw = builtinFamilyRules()
    const r = sanitizeFamilyRules({ ...raw, conception: { ...(raw.conception as object), base: 5 }, stages: [{ id: 'hidden', at: 0 }, { id: 'early', at: 0.5 }, { id: 'mid', at: 0.3 }, { id: 'late', at: 0.2 }], birth: { ...(raw.birth as object), healer_classes: ['cleric', 'nope'] } })
    expect((r.conception as { base: number }).base).toBe(1)
    expect((r.stages as { at: number }[]).map((s) => s.at)).toEqual([0, 0.5, 0.55, 0.6])
    expect((r.birth as { healer_classes: string[] }).healer_classes).toEqual(['cleric'])
  })

  it('套用之後各模組讀到新的值（泌乳的參照也跟著變），恢復預設回到內建', () => {
    const mods = emptyMods()
    const raw = builtinFamilyRules()
    mods.family = { rules: { ...raw, nursery: { fee_cc: 25, escort_cc_per_day: 30 }, lactation: { ...(raw.lactation as object), sensitivity: 9 } } }
    applyContent(normalizeMods(mods))
    expect((familyRules.nursery as { fee_cc: number }).fee_cc).toBe(25)
    expect(lactationRules.sensitivity).toBe(9)
    applyContent(emptyMods())
    expect((familyRules.nursery as { fee_cc: number }).fee_cc).toBe(10)
    expect(lactationRules.sensitivity).toBe(5)
  })
})

describe('懷孕與泌乳設定：世界的存與合併', () => {
  it('存進世界、和匯入的內容比較與合併（舊的世界沒有這一區也不會出錯）', () => {
    setActivePinia(createPinia())
    const content = useContent()
    content.switchWorld(content.createWorld('懷孕設定'))
    const raw = builtinFamilyRules()
    content.saveFamilyRules({ ...raw, nursery: { fee_cc: 12, escort_cc_per_day: 30 } })
    expect((familyRules.nursery as { fee_cc: number }).fee_cc).toBe(12)
    const incoming = { ...emptyMods(), family: { rules: { ...raw, nursery: { fee_cc: 40, escort_cc_per_day: 30 } } } }
    const diff = content.diffMods(incoming)
    expect(diff.changed.map((e) => e.key)).toEqual(['family:rules'])
    content.mergeMods(diff, ['family:rules'])
    expect((familyRules.nursery as { fee_cc: number }).fee_cc).toBe(40)
    content.restoreFamilyRules()
    expect((familyRules.nursery as { fee_cc: number }).fee_cc).toBe(10)
    // 比較一個沒有這一區的內容：不出錯
    content.saveFamilyRules(raw)
    expect(() => content.diffMods(emptyMods())).not.toThrow()
    content.resetAll()
  })
})
