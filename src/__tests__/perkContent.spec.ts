import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { itemDef, perkDef } from '@/engine/data'
import { enterLocation } from '@/engine/grid'
import { applyContent, emptyMods, newNpc, newPerk, normalizeMods, sanitizePerkMod } from '@/engine/mods'
import { hasPerk, perkCombat, perksOf } from '@/engine/perks'
import { migrate, newGame, prunePerks } from '@/engine/state'
import { newStory, storyCheck } from '@/engine/storyMods'
import type { GameState } from '@/engine/types'
import { perkUsage } from '@/engine/usage'
import { useGame } from '@/stores/game'
import { editableWorld } from './testWorld'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})
afterEach(() => applyContent(emptyMods()))

function game(race = 'human'): GameState {
  const state = newGame({ name: '測試者', race, classId: 'fighter', seed: 3, birthplace: 'soriel' })
  enterLocation(state)
  return state
}

describe('perk content', () => {
  it('adds, edits and restores perks; custom perks work like built-in ones', () => {
    const c = editableWorld()
    c.savePerk('mod_perk_a', { ...newPerk('mod_perk_a'), name: '夜行者', effects: [{ check: { contexts: ['stealth'] }, bonus: 2 }], train: { cells: ['tavern'], price_cc: 100, hours: 4, attr: 'dex', dc: 11 } })
    expect(perkDef('mod_perk_a')).toMatchObject({ name: '夜行者', train: { cells: ['tavern'] } })
    const state = game()
    state.party[0]!.perks = ['mod_perk_a']
    expect(hasPerk(state.party[0]!, 'mod_perk_a')).toBe(true)
    // 自建的特質在任務鏈檢查裡也認得
    const s = newStory('mod_story_p')
    s.nodes[0]!.success = { complete: true, effects: [{ type: 'perk', perk: 'mod_perk_a' }] }
    expect(storyCheck(s).errors).toEqual([])

    // 修改內建的：打架好手命中 +1 → +2；恢復預設
    c.savePerk('brawler', { ...perkDef('brawler')!, effects: [{ combat: { hit: 2 } }] })
    expect(perkCombat({ perks: ['brawler'] }).mods.hit).toBe(2)
    expect(c.mods.perks.brawler?.custom).toBeUndefined()
    c.restorePerk('brawler')
    expect(perkCombat({ perks: ['brawler'] }).mods.hit).toBe(1)
    expect(() => c.deletePerk('brawler')).toThrow('內建')
  })

  it('edits a race perk but keeps it a race perk', () => {
    const c = editableWorld()
    c.savePerk('race_elf', { ...perkDef('race_elf')!, race: undefined, requires: { classes: ['fighter'] }, effects: [{ resist: { psychic: -0.5 } }] })
    expect(perkDef('race_elf')).toMatchObject({ race: 'elf', effects: [{ resist: { psychic: -0.5 } }] })
    expect(perkDef('race_elf')!.requires).toBeUndefined()
    expect(perkCombat({ race: 'elf' }).resist.psychic).toBe(-0.5)
    // 抗性可以是弱點（種族特質原本就有，自建的特質也可以用來平衡強項），最多 +0.5
    expect(sanitizePerkMod('race_demon', perkDef('race_demon')!, false)!.effects).toEqual(perkDef('race_demon')!.effects)
    expect(sanitizePerkMod('mod_perk_w', { name: '弱點', effects: [{ resist: { radiant: 0.25, fire: -0.25, cold: 2 } }] }, true)!.effects).toEqual([{ resist: { radiant: 0.25, fire: -0.25, cold: 0.5 } }])
  })

  it('allows negative bonuses only on flaws, and race perks cannot be flaws', () => {
    const raw = { name: '負的', effects: [{ check: {}, bonus: -3 }, { combat: { hit: -2, evade: 9 } }] }
    const flaw = sanitizePerkMod('mod_perk_n', { ...raw, flaw: true }, true)!
    expect(flaw.flaw).toBe(true)
    expect(flaw.effects).toEqual([{ check: {}, bonus: -3 }, { combat: { hit: -2, evade: 3 } }])
    const plain = sanitizePerkMod('mod_perk_n', raw, true)!
    expect(plain.flaw).toBeUndefined()
    expect(plain.effects).toEqual([{ check: {}, bonus: 1 }, { combat: { evade: 3 } }])
    expect(sanitizePerkMod('race_elf', { ...perkDef('race_elf')!, flaw: true }, false)!.flaw).toBeUndefined()
    // 存成自建的缺陷之後照樣生效
    const c = editableWorld()
    c.savePerk('mod_perk_n', { ...newPerk('mod_perk_n'), ...raw, flaw: true })
    expect(perkDef('mod_perk_n')!.flaw).toBe(true)
    expect(perkCombat({ perks: ['mod_perk_n'] }).mods.hit).toBe(-2)
  })

  it('blocks deleting a custom perk while something uses it, and lists the places', () => {
    const c = editableWorld()
    const g = useGame()
    c.savePerk('mod_perk_u', newPerk('mod_perk_u'))
    c.saveNpc('mod_npc_p', { ...newNpc('mod_npc_p'), perks: ['mod_perk_u'] })
    const s = newStory('mod_story_u')
    s.nodes[0]!.success = { complete: true, effects: [{ type: 'lose_perk', perk: 'mod_perk_u' }] }
    c.saveStory('mod_story_u', s)
    c.saveItem('夜行手冊', { category: 'consumable', price_cc: 50, tags: [], custom: true, use: { perks: ['mod_perk_u'] } })
    expect(itemDef('夜行手冊')!.use!.perks).toEqual(['mod_perk_u'])
    c.savePerk('mod_perk_x', { ...newPerk('mod_perk_x'), exclusive: ['mod_perk_u'] })
    g.state = game()
    g.state.party[0]!.perks = ['mod_perk_u']
    const used = c.usageOf('perk', 'mod_perk_u')
    for (const where of ['固定 NPC「新的角色」的特質', '特殊任務「新的特殊任務」的效果', '書籍「夜行手冊」', '特質「新的特質」的互斥', '目前存檔的「測試者」']) {
      expect(used, where).toContain(where)
    }
    expect(() => c.deletePerk('mod_perk_u')).toThrow('還有地方用到')
    // 一個一個拿掉之後可以刪
    g.state.party[0]!.perks = []
    c.deletePerk('mod_perk_x')
    c.saveItem('夜行手冊', { category: 'consumable', price_cc: 50, tags: [], custom: true })
    c.deleteStory('mod_story_u')
    c.deleteNpc('mod_npc_p')
    expect(perkUsage('mod_perk_u', g.state)).toEqual([])
    c.deletePerk('mod_perk_u')
    expect(perkDef('mod_perk_u')).toBeUndefined()
  })

  it('drops perks that no longer exist from saves, offers and NPCs', () => {
    const state = game('dwarf')
    const pc = state.party[0]!
    pc.perks = ['brawler', 'mod_perk_gone']
    pc.perkOffers = [{ id: 'po-1', source: '測試', options: ['mod_perk_gone'] }, { id: 'po-2', source: '測試', options: ['mod_perk_gone', 'brawler'], pitch: true }]
    const loaded = migrate(JSON.parse(JSON.stringify(state)))
    const me = loaded.party[0]!
    expect(me.perks).toEqual(['brawler'])
    expect(me.perkOffers).toEqual([{ id: 'po-2', source: '測試', options: ['brawler'], pitch: true }])
    // 種族特質照算
    expect(perksOf(me).map((p) => p.id)).toEqual(['race_dwarf', 'brawler'])
    // 自訂內容改變之後也會清
    applyContent(normalizeMods({ ...emptyMods(), perks: { mod_perk_t: newPerk('mod_perk_t') } }))
    me.perks = ['mod_perk_t']
    applyContent(emptyMods())
    prunePerks(loaded)
    expect(me.perks).toEqual([])
  })
})
