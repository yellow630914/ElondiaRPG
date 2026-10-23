// docs/KNOWN_ISSUES.md 第 5 節修掉的問題（W1～W23）：每條至少一個測試
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { applyContent, emptyMods, normalizeMods, sanitizeAbility, sanitizeBase, sanitizeNpc, type ContentMods } from '@/engine/mods'
import { applyEffects } from '@/engine/effects'
import { addHours, migrate, newGame } from '@/engine/state'
import { enterLocation } from '@/engine/grid'
import { enterSpecial } from '@/engine/specialMaps'
import { applyPendingMove } from '@/engine/road'
import { newStory, sanitizeStory, storyCheck } from '@/engine/storyMods'
import type { GameState, Report } from '@/engine/types'
import { useContent } from '@/stores/content'
import { newShop } from '@/engine/shopMods'
import { locationById, perkDef, shopRules, specialMaps } from '@/engine/data'
import { townTemplates } from '@/engine/townEvents'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  applyContent(emptyMods())
})
afterEach(() => applyContent(emptyMods()))

/** 匯入一次、再像重新開遊戲一樣從存檔讀出（只載入原版時整理） */
function importAndReload(pkg: Partial<ContentMods>): ContentMods {
  const first = normalizeMods({ ...emptyMods(), ...pkg })
  applyContent(emptyMods())
  localStorage.setItem('elondia.worlds', JSON.stringify({ active: 'w1', worlds: [{ id: 'w1', name: '測試', mods: first, updated: 1 }] }))
  setActivePinia(createPinia())
  return useContent().worlds.find((w) => w.id === 'w1')!.mods
}

describe('W1-W4: references to new content in the same package', () => {
  it('W1 keeps exclusive between two new perks', () => {
    const perk = (ex: string[]) => ({ custom: true, name: '特質', desc: '', effects: [{ type: 'check', attr: 'str', value: 1 }], exclusive: ex })
    const m = importAndReload({ perks: { mod_perk_a: perk(['mod_perk_b', 'charming']), mod_perk_b: perk(['mod_perk_a']) } as never })
    expect(m.perks.mod_perk_a!.exclusive).toEqual(['mod_perk_b', 'charming'])
    expect(m.perks.mod_perk_b!.exclusive).toEqual(['mod_perk_a'])
    applyContent(m)
    expect(perkDef('mod_perk_b')!.exclusive).toEqual(['mod_perk_a'])
  })

  it('W2 keeps town event cells that point at a new shop', () => {
    const ev = { custom: true, scope: 'town', kind: 'choice', title: '店裡的事', text: '…', cells: ['shop_x'], options: [{ label: '好', outcome: { text: '好' } }] }
    const m = importAndReload({ shops: { shop_x: { ...newShop(), name: '新店' } }, travelEvents: { mod_event_x: ev } } as never)
    expect(m.travelEvents.mod_event_x!.cells).toEqual(['shop_x'])
    applyContent(m)
    expect(townTemplates().find((t) => t.id === 'mod_event_x')!.cells).toEqual(['shop_x'])
  })

  it('W3 keeps special map encounters and resources that use new monsters and items', () => {
    const map = { custom: true, name: '新地圖', location: 'rhineburg', size: [9, 7], table: [[['mod_enemy_x', 2]], [['goblin', 1]]], resource_items: ['新草'] }
    const m = importAndReload({
      enemies: { mod_enemy_x: { custom: true, name: '新怪', level: 1 } },
      items: { 新草: { custom: true, category: 'material', price_cc: 1 } },
      specialMaps: { sm_new: map },
    } as never)
    expect(m.specialMaps.sm_new!.table).toEqual([[['mod_enemy_x', 2]], [['goblin', 1]]])
    expect(m.specialMaps.sm_new!.resource_items).toEqual(['新草'])
    applyContent(m)
    expect(specialMaps.sm_new!.table).toEqual([[['mod_enemy_x', 2]], [['goblin', 1]]])
    expect(specialMaps.sm_new!.resource_items).toEqual(['新草'])
  })

  it('W4 keeps generated gear in a shop fixed list', () => {
    const m = importAndReload({
      materials: { mod_mat_star: { custom: true, kind: 'metal', name: '星鐵', tier: 2, bonus: 1, rarity: 'common', level: 3, price: 2 } },
      shops: { shop_y: { ...newShop(), name: '星鐵鋪', fixed: [{ item: '星鐵匕首' }] } },
    } as never)
    expect(m.shops.shop_y!.fixed).toEqual([{ item: '星鐵匕首', stock: 1 }])
    applyContent(m)
    expect(shopRules.types.shop_y!.fixed).toEqual([{ item: '星鐵匕首', stock: 1 }])
  })
})

const game = (birthplace = 'rhineburg') => {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 3, birthplace })
  enterLocation(state)
  return state
}
const blankReport = (state: GameState): Report => ({
  schema_version: '0.1', report_id: `r-test-${state.nextReportNo++}`, kind: 'event',
  time: { start: { ...state.time }, end: addHours(state.time, 1) },
  location: { at: state.location }, party: [], outcome: { result: 'success', summary: '測試' }, changes: {},
})

describe('W5-W11: runtime behaviour', () => {
  it('W5 turns local reputation into the faction of the current place, and drops the old local key', () => {
    const state = game('ironforge')
    const report = blankReport(state)
    applyEffects(state, report, [{ type: 'reputation', faction: 'local', delta: 1 }])
    expect(report.changes.reputation).toEqual([{ faction: locationById('ironforge').faction, delta: 1 }])
    state.reputation.local = 3
    expect(migrate(state).reputation.local).toBeUndefined()
  })

  it('W6 grants the named ability, or offers a choice with a reason, never a random one', () => {
    const state = game()
    const pc = state.party[0]!
    let notes = applyEffects(state, blankReport(state), [{ type: 'ability', ability: 'sweeping_strike' }])
    expect(pc.abilities).toContain('sweeping_strike')
    expect(notes.join()).toContain('領悟了')
    notes = applyEffects(state, blankReport(state), [{ type: 'ability', ability: 'sweeping_strike' }])
    expect(notes.join()).toContain('已經會')
    const before = [...pc.abilities]
    notes = applyEffects(state, blankReport(state), [{ type: 'ability', ability: 'fireball' }])
    expect(pc.abilities).toEqual(before)
    expect(notes.join()).toContain('不是這個職業的能力')
    expect(pc.pendingAbilityChoices).toHaveLength(1)
  })

  it('W7 drops heal, shield and cleanse from abilities that do not resolve automatically', () => {
    const raw = { name: '治療打擊', target: 'ally' as const, heal: { flat: 5 }, shield: { flat: 3 }, cleanse: true, recover_slot: true }
    const a = sanitizeAbility('mod_ability_x', { ...raw, resolve: 'attack' }, true)
    expect([a.heal, a.shield, a.cleanse, a.recover_slot]).toEqual([undefined, undefined, undefined, undefined])
    expect(sanitizeAbility('mod_ability_x', { ...raw, resolve: 'auto' }, true)).toMatchObject({ heal: { flat: 5 }, shield: { flat: 3 }, cleanse: true })
  })

  it('W8 treats an NPC without kind or combat class as a commoner', () => {
    expect(sanitizeNpc('mod_npc_baker', { name: '麵包師', occupation: '麵包師', location: 'rhineburg' }, true)).toMatchObject({ kind: 'commoner', class: '', hire_cc: 0 })
    expect(sanitizeNpc('mod_npc_mage', { name: '法師', class: 'wizard', location: 'rhineburg' }, true)).toMatchObject({ kind: 'adventurer', class: 'wizard' })
  })

  it('W9 keeps a misspelled special map so the story check reports it', () => {
    const s = newStory('mod_story_typo')
    s.nodes[0]!.at = { where: 'special', special_map: 'sm_typo' }
    const out = sanitizeStory('mod_story_typo', s, true)
    expect(out.nodes[0]!.at.special_map).toBe('sm_typo')
    expect(storyCheck(out).errors.join()).toContain('特殊地圖不存在')
  })

  it('W10 leaves the special map when a quest moves the party elsewhere', () => {
    const state = game()
    enterSpecial(state, 'sm_rhineburg_sewer')
    expect(state.special).toBeDefined()
    state.pendingMove = { travel_to: 'soriel' }
    applyPendingMove(state)
    expect(state.location).toBe('soriel')
    expect(state.special).toBeUndefined()
  })

  it('W11 keeps armor overrides of built-in bases and ignores pointing them at another weapon', () => {
    expect(sanitizeBase({ name: '板甲', kind: 'metal', price: 1500, armorDef: { name: '板甲', evade: 0, dr: 9 } }, false, 'plate').armorDef).toMatchObject({ dr: 9 })
    const sword = sanitizeBase({ name: '長劍', kind: 'metal', price: 240, slot: 'main_hand', weapon: 'dagger' }, false, 'longsword')
    expect(sword.weaponDef).toBeUndefined()
    // 自建的底材可以複製別的武器的數值，名稱用底材的
    expect(sanitizeBase({ name: '短刃', kind: 'metal', price: 50, slot: 'main_hand', weapon: 'dagger' }, true).weaponDef).toMatchObject({ name: '短刃', dice: '1d4' })
  })
})
