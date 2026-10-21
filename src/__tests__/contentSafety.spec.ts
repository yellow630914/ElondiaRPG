import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { applyEffects } from '@/engine/effects'
import { enemies, itemDef, stories } from '@/engine/data'
import { gearBonuses, gearRules, gearSummary, randomGear, startingGear, syncGear } from '@/engine/gear'
import { currentArea, enterLocation, moveTo, standOn, substituteGroup } from '@/engine/grid'
import { applyContent, emptyMods, newBase, newEnemy, newMaterial, newNpc, normalizeMods, sanitizeBase, sanitizeMaterial } from '@/engine/mods'
import { Rng } from '@/engine/rng'
import { newGame } from '@/engine/state'
import { playNode, pruneStories, startStory } from '@/engine/story'
import { newStory, sanitizeStory, storyIssues } from '@/engine/storyMods'
import { abandonQuest, buyRations } from '@/engine/town'
import { gearUsage, npcUsage, storyUsage } from '@/engine/usage'
import type { GameState, Report } from '@/engine/types'
import { useContent } from '@/stores/content'
import { useGame } from '@/stores/game'

function game(): GameState {
  const state = newGame({ name: '測試者', race: 'human', classId: 'fighter', seed: 11, birthplace: 'soriel' })
  enterLocation(state)
  state.money_cc = 1000
  return state
}

const emptyReport = (state: GameState): Report => ({
  schema_version: '0.1', report_id: 'r', kind: 'event', time: { start: state.time, end: state.time },
  location: { at: 'soriel', region: 'central' }, party: [], outcome: { result: 'neutral' }, changes: {},
})

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})
afterEach(() => applyContent(emptyMods()))

describe('deleting content that is still used', () => {
  it('blocks deleting a custom base, material, enemy, NPC or story while something uses it', () => {
    const c = useContent()
    const g = useGame()
    g.state = game()
    c.saveMaterial('mod_mat_a', { ...newMaterial(), name: '星鋼' }, true)
    c.saveBase('mod_base_a', { ...newBase(), name: '星劍' }, true)
    // 存檔裡的角色拿著它做的裝備
    g.state.party[0]!.gear!.main_hand = { name: '星鋼星劍', spec: { base: 'mod_base_a', material: 'mod_mat_a' } }
    expect(c.usageOf('base', 'mod_base_a')).toEqual(['目前存檔「測試者」身上的裝備'])
    expect(() => c.deleteBase('mod_base_a')).toThrow('還有地方用到')
    expect(() => c.deleteMaterial('mod_mat_a')).toThrow('還有地方用到')
    delete g.state.party[0]!.gear!.main_hand
    c.deleteBase('mod_base_a')
    expect(gearRules.bases.mod_base_a).toBeUndefined()

    c.saveEnemy('mod_enemy_a', newEnemy('mod_enemy_a'))
    c.saveNpc('mod_npc_a', newNpc('mod_npc_a'))
    const s = newStory('mod_story_a')
    s.nodes[0] = { ...s.nodes[0]!, kind: 'combat', enemies: [['mod_enemy_a', 1]], foes: ['mod_npc_a'] }
    c.saveStory('mod_story_a', s)
    expect(() => c.deleteEnemy('mod_enemy_a')).toThrow('特殊任務')
    expect(npcUsage('mod_npc_a')[0]).toContain('任務點「第一個任務點」的敵人')
    expect(() => c.deleteNpc('mod_npc_a')).toThrow('還有地方用到')
    // 存檔正在進行的任務不能刪
    startStory(g.state, 'mod_story_a')
    expect(storyUsage('mod_story_a', g.state)).toHaveLength(1)
    expect(() => c.deleteStory('mod_story_a')).toThrow('正在進行')
    delete g.state.stories!.mod_story_a
    c.deleteStory('mod_story_a')
    c.deleteEnemy('mod_enemy_a')
    c.deleteNpc('mod_npc_a')
    expect(enemies.mod_enemy_a).toBeUndefined()
  })

  it('renames a custom item everywhere it can, and blocks deleting one the save still holds', () => {
    const c = useContent()
    const g = useGame()
    g.state = game()
    c.saveItem('月光草', { category: 'material', price_cc: 5, tags: [], custom: true })
    const s = newStory('mod_story_b')
    s.rewards = [{ type: 'item', name: '月光草', qty: 2 }]
    c.saveStory('mod_story_b', s)
    g.state.inventory.push({ name: '月光草', qty: 3 })
    c.saveItem('月光草', { ...itemDef('月光草')! }, '月光|草*')
    expect(itemDef('月光草')).toBeDefined()
    expect(c.mods.stories.mod_story_b!.rewards).toEqual([{ type: 'item', name: '月光草', qty: 2 }])
    c.saveItem('月光草', { ...itemDef('月光草')! }, '銀月草')
    expect(c.mods.stories.mod_story_b!.rewards).toEqual([{ type: 'item', name: '銀月草', qty: 2 }])
    expect(g.state.inventory.find((i) => i.name === '銀月草')?.qty).toBe(3)
    expect(() => c.deleteItem('銀月草')).toThrow('還有地方用到')
    // AI 登錄在存檔的物品名稱也不能拿來用
    g.state.customItems = { 秘製護符: { category: 'gear', price_cc: 30 } }
    expect(() => c.saveItem('秘製護符', { category: 'gear', price_cc: 1, tags: [], custom: true })).toThrow('存檔已經有')
  })
})

describe('missing content does not crash the game', () => {
  it('treats gear made from a deleted base or material as having no effect', () => {
    const state = game()
    const pc = state.party[0]!
    pc.gear = {}
    pc.gear.main_hand = { name: '消失的劍', spec: { base: 'gone_base', material: 'iron' } }
    pc.gear!.ring_1 = { name: '消失的戒指', spec: { base: 'ring', material: 'gone_mat' } }
    expect(() => syncGear(pc)).not.toThrow()
    expect(pc.weapon).toBe('unarmed')
    expect(gearBonuses(pc).mods).toEqual({})
    expect(gearSummary(pc.gear!.main_hand.spec)).toContain('已失效')
    const r = emptyReport(state)
    expect(applyEffects(state, r, [{ type: 'gear', spec: { base: 'gone_base', material: 'iron' } }])).toEqual(['（有一件裝備獎勵已經不存在）'])
  })

  it('skips a companion effect for a deleted NPC or one already in the party', () => {
    const state = game()
    const r = emptyReport(state)
    expect(applyEffects(state, r, [{ type: 'companion', npc: 'mod_npc_gone', mode: 'voluntary' }])).toEqual(['（要加入的角色已經不存在）'])
    applyEffects(state, r, [{ type: 'companion', npc: 'npc_lina', mode: 'voluntary' }])
    expect(applyEffects(state, r, [{ type: 'companion', npc: 'npc_lina', mode: 'voluntary' }])).toEqual(['莉娜已經在隊伍裡了'])
  })

  it('keeps built-in gear structure fixed and still finds a material when a tier is missing', () => {
    expect(sanitizeMaterial({ ...gearRules.materials.iron!, kind: 'leather', tier: 3 }, false, 'iron')).toMatchObject({ kind: 'metal', tier: 1 })
    expect(sanitizeBase({ ...gearRules.bases.longsword!, slot: 'body', kind: 'cloth' }, false, 'longsword')).toMatchObject({ slot: 'main_hand', kind: 'metal' })
    // 自建的可以改
    expect(sanitizeMaterial({ ...newMaterial(), tier: 4 }, true, 'mod_mat_x').tier).toBe(4)
    // 就算某一級的材料不見了（例如舊的匯入檔），隨機裝備與起始裝備也不會壞
    const iron = gearRules.materials.iron!
    delete gearRules.materials.iron
    try {
      expect(() => startingGear('fighter')).not.toThrow()
      expect(() => randomGear(new Rng(3), 1)).not.toThrow()
    } finally {
      gearRules.materials.iron = iron
    }
  })

  it('reads saved content that uses custom bases and materials without dropping them', () => {
    const raw = JSON.parse(JSON.stringify({
      materials: { mod_mat_b: { ...newMaterial(), name: '霜鐵' } },
      bases: { mod_base_b: { ...newBase(), name: '霜刃' } },
      items: { 霜鐵霜刃改: { category: 'equipment', price_cc: 500, tags: [], gear: { base: 'mod_base_b', material: 'mod_mat_b' }, custom: true } },
    }))
    applyContent(emptyMods())
    const m = normalizeMods(raw)
    expect(m.items.霜鐵霜刃改!.gear).toEqual({ base: 'mod_base_b', material: 'mod_mat_b' })
  })

  it('ends a quest whose story was deleted and lets its guests go', () => {
    const state = game()
    const s = sanitizeStory('mod_story_c', { ...newStory('mod_story_c'), nodes: [{ ...newStory('x').nodes[0]!, requires: { flags: ['mod_story_c_started'] }, success: { join: 'npc_lina' } }] }, true)
    applyContent(normalizeMods({ ...emptyMods(), stories: { mod_story_c: s } }))
    startStory(state, 'mod_story_c')
    state.stories!.mod_story_c!.guests = ['npc_lina']
    applyEffects(state, emptyReport(state), [{ type: 'companion', npc: 'npc_lina', mode: 'voluntary' }])
    state.party.find((m) => m.id === 'npc_lina')!.bond = 'guest'
    applyContent(emptyMods())
    pruneStories(state)
    expect(state.stories!.mod_story_c!.status).toBe('failed')
    expect(state.party.some((m) => m.id === 'npc_lina')).toBe(false)
  })
})

describe('other restrictions', () => {
  it('charges rations at the catalog price', () => {
    const c = useContent()
    c.saveItem('乾糧', { ...itemDef('乾糧')!, price_cc: 12 })
    const state = game()
    buyRations(state, 2)
    expect(state.money_cc).toBe(1000 - 24)
  })

  it('points out missing facilities, items, NPCs and shared start flags in a quest chain', () => {
    const s = newStory('mod_story_d')
    s.start_flags = ['relic_started']
    s.nodes[0] = { ...s.nodes[0]!, at: { where: 'cell', location: 'rivervale', cell: 'jeweler' }, success: { complete: true, effects: [{ type: 'item', name: '不存在的東西', qty: 1 }, { type: 'affinity', npc: 'nobody', delta: 3 }] } }
    const issues = storyIssues(s)
    expect(issues.some((i) => i.startsWith('任務點「第一個任務點」：河谷鎮沒有'))).toBe(true)
    expect(issues.some((i) => i.includes('不存在的東西'))).toBe(true)
    expect(issues.some((i) => i.includes('nobody'))).toBe(true)
    expect(issues.some((i) => i.includes('失竊的聖環徽記'))).toBe(true)
    expect(storyIssues(stories.find((d) => d.id === 'lost_relic')!)).toEqual([])
  })

  it('lists the save and other content in gear usage', () => {
    const state = game()
    expect(gearUsage('material', 'iron', state).some((u) => u.includes('目前存檔'))).toBe(true)
  })
})

/** 進地下城，把主角旁邊的一格改成指定的內容，再走上去 */
function stepOntoDungeonCell(state: GameState, cell: Record<string, unknown>) {
  state.location = 'whisper_crypt'
  enterLocation(state)
  const area = currentArea(state)
  const p = state.position!
  const [dx, dy] = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).find(([dx, dy]) => {
    const c = area.cells[(p.y + dy) * area.width + p.x + dx]
    return p.x + dx >= 0 && p.y + dy >= 0 && p.x + dx < area.width && p.y + dy < area.height && c && c.kind !== 'wall' && c.kind !== 'water'
  })!
  const i = (p.y + dy) * area.width + p.x + dx
  area.cells[i] = cell as never
  return { area, i, result: moveTo(state, p.x + dx, p.y + dy) }
}

describe('getting unstuck from deleted content', () => {
  it('lets you abandon a general quest whose target no longer exists', () => {
    const state = game()
    state.quests.push({
      id: 'q_gone', title: '討伐消失的怪物', rank: 'F', kind: 'boss_hunt', area: 'dungeon', giver: 'soriel', target: 'whisper_crypt',
      goal: 1, progress: 0, reward_cc: 100, monster: 'mod_enemy_gone', status: 'accepted',
    } as never)
    const r = abandonQuest(state, 'q_gone')
    expect(r.quest?.status).toBe('abandoned')
    expect(state.quests.some((q) => q.id === 'q_gone')).toBe(false)
    expect(r.changes.reputation).toEqual([{ faction: 'guild', delta: -1 }])
    expect(() => abandonQuest(state, 'q_gone')).toThrow('沒有進行中')
  })

  it('replaces a deleted elite or boss on an already generated map instead of skipping it', () => {
    const state = game()
    const { area, i, result } = stepOntoDungeonCell(state, { kind: 'elite', group: [['mod_enemy_gone', 2]] })
    expect(result.combat).toBeDefined()
    expect(area.cells[i]!.group!.every(([id]) => !!enemies[id])).toBe(true)
    expect(state.combat!.combatants.filter((c) => c.side === 'enemy').length).toBeGreaterThanOrEqual(2)
    delete state.combat
    expect(substituteGroup(state, area, 'boss').every(([id]) => !!enemies[id])).toBe(true)
  })

  it('starts another special quest from an outcome, once', () => {
    const b = sanitizeStory('mod_story_next', { ...newStory('mod_story_next'), start: { kind: 'manual' } }, true)
    const a = newStory('mod_story_first')
    a.nodes[0] = { ...a.nodes[0]!, success: { complete: true, effects: [{ type: 'start_story', story: 'mod_story_next' }] } }
    const sa = sanitizeStory('mod_story_first', a, true)
    expect(sa.nodes[0]!.success!.effects).toEqual([{ type: 'start_story', story: 'mod_story_next' }])
    expect(storyIssues(b, [b]).some((x) => x.includes('只由其他事件開啟'))).toBe(true)
    applyContent(normalizeMods({ ...emptyMods(), stories: { mod_story_first: sa, mod_story_next: b } }))
    expect(storyIssues(b).some((x) => x.includes('只由其他事件開啟'))).toBe(false)
    const state = game()
    startStory(state, 'mod_story_first')
    standOn(state, 'tavern')
    const r = playNode(state, 'mod_story_first:n1') as Report
    expect(r.story?.id).toBe('mod_story_first')
    expect(state.stories?.mod_story_next?.status).toBe('active')
    expect(applyEffects(state, emptyReport(state), [{ type: 'start_story', story: 'mod_story_next' }])).toEqual(['特殊任務「新的特殊任務」已經開始過了'])
  })
})
