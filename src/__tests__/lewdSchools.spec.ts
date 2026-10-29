import { describe, expect, it } from 'vitest'
import { startCombat } from '@/engine/combat'
import { escapeDc, submissionDc } from '@/engine/companions'
import { lewdRules } from '@/engine/data'
import { gearName } from '@/engine/gear'
import { enterLocation } from '@/engine/grid'
import { lockGear, unequipItem, unlockGear } from '@/engine/inventory'
import { addLewd } from '@/engine/lewd'
import { masterRelease, masterToolReady } from '@/engine/masterTool'
import { isBound, pcOf } from '@/engine/party'
import { checkModifiers, learnablePerks, levelUpPerkOffer } from '@/engine/perks'
import { Rng } from '@/engine/rng'
import { bindModifiers, lustTotals, schoolsOf, twoFaceCombat } from '@/engine/schools'
import { masterCandidates, startAsSlave } from '@/engine/slavery'
import { addItem, newGame } from '@/engine/state'
import { contractOf } from '@/engine/tattoos'
import type { Character, GameState, GearSlot } from '@/engine/types'

function game(): GameState {
  const state = newGame({ name: '莉雅', race: 'human', classId: 'fighter', seed: 3, birthplace: 'rhineburg' })
  enterLocation(state)
  return state
}
const wear = (c: Character, slot: GearSlot, base: string, material = 'leather') => {
  const spec = { base, material }
  ;(c.gear ??= {})[slot] = { name: gearName(spec), spec }
}
function enslaved(): GameState {
  const state = game()
  const [rec] = masterCandidates('rhineburg', 3)
  startAsSlave(state, { master: { type: 'candidate', rec: rec! }, mark: 'labor' })
  return state
}

describe('慾望流派', () => {
  it('進階要先入門；縱欲與禁慾互斥；流派不進升級的選項', () => {
    const pc = pcOf(game())
    const ids = () => learnablePerks(pc).map((p) => p.id)
    expect(ids()).toContain('school_indulgence')
    expect(ids()).not.toContain('wanton_blaze')
    pc.perks = ['school_indulgence']
    expect(ids()).toContain('wanton_blaze')
    expect(ids()).not.toContain('school_abstinence')
    expect(schoolsOf(pc)).toEqual(['indulgence'])
    for (let i = 0; i < 20; i++) {
      const offer = levelUpPerkOffer(pc, 3, new Rng(i))
      expect(offer?.options.some((id) => id.startsWith('school_'))).toBeFalsy()
      pc.perkOffers = []
    }
  })

  it('流派特質換算進戰鬥：上限、自己增加的慾望、引爆', () => {
    const state = game()
    const pc = pcOf(state)
    pc.perks = ['school_indulgence', 'wanton_blaze', 'school_bondage']
    const before = startCombat(game(), [['goblin', 1]]).combatants.find((c) => c.side === 'party')!
    const me = startCombat(state, [['goblin', 1]]).combatants.find((c) => c.id === pc.id)!
    expect(me.lustMax).toBe(before.lustMax! + 5)
    expect(me.lustMods!.self).toBeCloseTo(before.lustMods!.self + 0.25)
    expect(me.lustMods!.burst).toBeCloseTo(0.2)
  })

  it('隸從派沒有主人時一半效果；有主人時全效，主人在隊伍裡再加奴之誓', () => {
    const free = pcOf(game())
    free.perks = ['school_servitude']
    expect(lustTotals(free).convert).toBeCloseTo(0.05)
    const state = enslaved()
    const pc = pcOf(state)
    pc.perks = ['school_servitude']
    expect(lustTotals(pc).convert).toBeCloseTo(0.1)
    const plain = pcOf(enslaved())
    const base = startCombat(enslaved(), [['goblin', 1]]).combatants.find((c) => c.id === plain.id)!
    const me = startCombat(state, [['goblin', 1]]).combatants.find((c) => c.id === pc.id)!
    expect((me.baseMods.dr ?? 0) - (base.baseMods.dr ?? 0)).toBe(2)
    expect((me.baseMods.save ?? 0) - (base.baseMods.save ?? 0)).toBe(2)
  })

  it('清心寡慾：淫亂的增加減半，零頭記著', () => {
    const state = game()
    const pc = pcOf(state)
    pc.perks = ['school_abstinence', 'pure_heart']
    const start = lewdRules.defaults.lewdness
    expect(addLewd(state, pc, 'lewdness', 1)).toBe(0)
    expect(addLewd(state, pc, 'lewdness', 1)).toBe(1)
    expect(pc.lewd!.lewdness).toBe(start + 1)
    expect(addLewd(state, pc, 'lewdness', -3)).toBe(-3)
  })
})

describe('雙面效應與鎖', () => {
  it('平常：拘束具讓相關的檢定變差，忍耐高的人減輕', () => {
    const pc = pcOf(game())
    wear(pc, 'wrists', 'armbinder')
    expect(bindModifiers(pc, { context: 'action', attr: 'str' })).toEqual([{ label: `拘束【${pc.gear!.wrists!.name}】`, value: -3 }])
    expect(bindModifiers(pc, { context: 'action', attr: 'cha' })).toEqual([])
    expect(checkModifiers(pc, { context: 'lock' }).some((m) => m.value === -3)).toBe(true)
    pc.lewd = { ...lewdRules.defaults, endurance: 80 }
    expect(bindModifiers(pc, { context: 'action', attr: 'dex' })[0]!.value).toBe(-1)
  })

  it('戰鬥：修了流派、鎖上才有增益；流派契合 ×1.2，鎖越好越強', () => {
    const pc = pcOf(game())
    wear(pc, 'wrists', 'armbinder')
    expect(twoFaceCombat(pc).active).toEqual([])
    pc.perks = ['school_indulgence']
    expect(twoFaceCombat(pc).active).toEqual([])
    pc.gear!.wrists!.lock = 'white'
    expect(twoFaceCombat(pc)).toMatchObject({ mods: { dr: 3 }, immune: ['disarmed'] })
    pc.perks = ['school_bondage']
    expect(twoFaceCombat(pc).mods.dr).toBe(4)
    pc.gear!.wrists!.lock = 'gold'
    expect(twoFaceCombat(pc).mods.dr).toBe(Math.round(3 * 1.3 * 1.2))
  })

  it('上鎖用掉行囊裡的鎖，打開或卸下時放回來；戰鬥中免疫繳械', () => {
    const state = game()
    const pc = pcOf(state)
    pc.perks = ['school_bondage']
    wear(pc, 'head', 'blindfold')
    addItem(state.inventory, '白鐵鎖', 2)
    lockGear(state, pc.id, 'head', '白鐵鎖')
    expect(pc.gear!.head!.lock).toBe('white')
    expect(state.inventory.find((i) => i.name === '白鐵鎖')?.qty).toBe(1)
    const me = startCombat(state, [['goblin', 1]]).combatants.find((c) => c.id === pc.id)!
    expect(me.immune).toContain('blinded')
    state.combat = undefined
    unlockGear(state, pc.id, 'head')
    expect(pc.gear!.head!.lock).toBeUndefined()
    expect(state.inventory.find((i) => i.name === '白鐵鎖')?.qty).toBe(2)
    lockGear(state, pc.id, 'head', '白鐵鎖')
    unequipItem(state, pc.id, 'head')
    expect(state.inventory.find((i) => i.name === '白鐵鎖')?.qty).toBe(2)
    expect(() => lockGear(state, pc.id, 'body', '白鐵鎖')).toThrow()
  })
})

describe('主人是工具人', () => {
  it('親密度夠高時直接解約；順從讓逃離更難', () => {
    const state = enslaved()
    const pc = pcOf(state)
    expect(isBound(state)).toBe(true)
    const master = contractOf(pc)!.master
    state.relationships![master]!.affinity = 30
    expect(masterToolReady(state)).toBe(false)
    expect(() => masterRelease(state)).toThrow()
    pc.lewd = { ...lewdRules.defaults, submission: 60 }
    expect(submissionDc(pc)).toBe(2)
    const dc = escapeDc(state)
    pc.lewd.submission = 0
    expect(escapeDc(state)).toBe(dc - 2)
    state.relationships![master]!.affinity = lewdRules.master_tool.release_affinity
    expect(masterToolReady(state)).toBe(true)
    masterRelease(state)
    expect(contractOf(pc)).toBeUndefined()
  })
})
