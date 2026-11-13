import { describe, expect, it } from 'vitest'
import { npcTags, NPC_TAG_GROUPS } from '@/engine/data'
import { pcTagChoices, pcTagEffectLines, pcTagModifiers, pcTagMult } from '@/engine/pcTags'
import { newGame } from '@/engine/state'

const NEW = ['hunter', 'farmer', 'fisher', 'sailor', 'mercenary', 'scholar', 'performer', 'blacksmith', 'carpenter', 'leatherworker', 'jeweler', 'alchemist', 'cook', 'thief', 'smuggler']

describe('新的身分標籤（R20 C3）', () => {
  it('adds professions, crafters and the underworld, all choosable and grouped', () => {
    const choices = pcTagChoices().map(([id]) => id)
    for (const id of NEW) {
      const t = npcTags.tags[id]
      expect(t, id).toBeDefined()
      expect(choices, id).toContain(id)
      expect(Object.keys(NPC_TAG_GROUPS)).toContain(t!.group)
      expect(t!.pc_effects?.checks?.length, id).toBeGreaterThan(0)
      // 這一版 NPC 還不會隨機抽到這些身分（R21 再讓 NPC 帶工藝）
      expect(t!.commoner_weight ?? 0, id).toBe(0)
      expect(t!.adventurer_chance, id).toBeUndefined()
    }
    for (const id of ['blacksmith', 'carpenter', 'leatherworker', 'jeweler', 'alchemist', 'cook']) {
      expect(npcTags.tags[id]!.group).toBe('craft')
      expect(npcTags.tags[id]!.craft).toBeTruthy()
    }
    expect(npcTags.tags.good!.group).toBe('moral')
  })

  it('gives check bonuses on categories', () => {
    const pc = { isPlayer: true, tags: ['hunter', 'thief'] }
    expect(pcTagModifiers(pc, { context: 'travel' })).toEqual([{ label: '身分【獵人】', value: 1 }])
    expect(pcTagModifiers(pc, { context: 'trap' })).toEqual([{ label: '身分【獵人】', value: 1 }])
    expect(pcTagModifiers(pc, { context: 'action', kind: 'steal' })).toEqual([{ label: '身分【盜賊】', value: 1 }])
    expect(pcTagModifiers({ isPlayer: true, tags: ['blacksmith'] }, { context: 'action', kind: 'make' })).toEqual([{ label: '身分【鐵匠】', value: 1 }])
    // 隊友的標籤是 NPC 的身分，不算
    expect(pcTagModifiers({ isPlayer: false, tags: ['hunter'] }, { context: 'travel' })).toEqual([])
  })

  it('每個身分的效果說明都寫得出檢定的對象（學者的智力檢定不會只剩「+1」）', () => {
    expect(pcTagEffectLines('scholar')).toContain('智力檢定 +1')
    for (const [id] of pcTagChoices()) for (const line of pcTagEffectLines(id)) expect(line, id).not.toMatch(/^[\s（]/)
  })

  it('makes the sea cheaper for a sailor', () => {
    expect(pcTagMult({ isPlayer: true, tags: ['sailor'] }, 'fare_mult')).toBe(0.8)
    expect(pcTagMult({ isPlayer: true, tags: ['hunter'] }, 'fare_mult')).toBe(1)
    expect(pcTagEffectLines('sailor')).toContain('海路船資 −20%')
  })

  it('starts the game with the tools of the trade', () => {
    const s = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 3, tags: ['hunter', 'farmer', 'leatherworker'] })
    const qty = (n: string) => s.inventory.find((i) => i.name === n)?.qty ?? 0
    expect(qty('乾糧')).toBe(8)
    expect(qty('風乾肉')).toBe(3)
    expect(qty('製革工具組')).toBe(1)
    expect(qty('裁縫工具組')).toBe(1)
    expect(pcTagEffectLines('hunter')).toContain('開局帶著 風乾肉×3')
    const plain = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 3 })
    expect(plain.inventory).toEqual([{ name: '乾糧', qty: 5 }])
  })
})

describe('建角說明：工匠身分的開局工藝', () => {
  it('says which crafts start at Lv.2', () => {
    expect(pcTagEffectLines('leatherworker').join('；')).toContain('製革、裁縫從 Lv.2 開始')
    expect(pcTagEffectLines('hunter').join('；')).not.toContain('Lv.2')
  })
})
