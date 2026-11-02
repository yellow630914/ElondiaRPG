// 特殊任務生成器的整理（docs/plan/roadmap/WORLD_EDITOR_PLAN.md E4b）：用固定的 AI 回覆，不呼叫 AI
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { abilities, enemies, stories } from '@/engine/data'
import { applyContent, emptyMods } from '@/engine/mods'
import { buildGenerated, defaultGenInput, diceAvg, enemyBand, knownFlags, rewardFor, shrinkDice, type GenInput } from '@/engine/questGen'
import { useContent } from '@/stores/content'
import { reply } from './questGenFixture'

const input = (over: Partial<GenInput> = {}): GenInput => ({ ...defaultGenInput(), prompt: '燈塔守夜人', ...over })

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})
afterEach(() => applyContent(emptyMods()))

describe('dice helpers', () => {
  it('averages and shrinks dice', () => {
    expect(diceAvg('2d6+3')).toBe(10)
    expect(diceAvg('d8')).toBe(4.5)
    expect(diceAvg('abc')).toBe(0)
    expect(diceAvg(shrinkDice('10d12', 9))).toBeLessThanOrEqual(9)
    expect(shrinkDice('1d6', 10)).toBe('1d6')
  })
})

describe('buildGenerated', () => {
  it('replaces refs with ids, names in text, and prefixes own flags', () => {
    const g = buildGenerated(reply(), input(), 'test')
    expect(g.storyId).toBe('mod_story_gtest')
    const s = g.mods.stories![g.storyId]!
    const npcId = Object.keys(g.mods.npcs!)[0]!
    expect(npcId).toBe('mod_npc_gtest_1')
    expect(s.nodes[0]!.text).toContain('老守夜人格倫')
    expect(s.nodes[1]!.at.cell).toBe('lm_gtest_1')
    expect(s.nodes[2]!.at.special_map).toBe('sm_gtest_1')
    expect(s.nodes[2]!.enemies).toEqual([['mod_enemy_gtest_1', 1]])
    expect(s.nodes[1]!.options![0]!.success!.effects![0]).toMatchObject({ type: 'affinity', npc: npcId })
    expect(s.start_flags).toEqual(['gtest_started'])
    expect(s.nodes[1]!.requires!.flags).toEqual(['gtest_heard'])
  })

  it('keeps existing flags it deliberately reads', () => {
    const existing = [...knownFlags()][0]!
    const r = reply()
    ;(r.story.nodes[0] as { requires: { flags: string[] } }).requires.flags = ['started', existing]
    const s = buildGenerated(r, input(), 'test').mods.stories!.mod_story_gtest!
    expect(s.nodes[0]!.requires!.flags).toEqual(['gtest_started', existing])
  })

  it('decides rewards, rank and level by the suggested level', () => {
    const g = buildGenerated(reply(), input({ level: 8 }), 'test')
    const s = g.mods.stories!.mod_story_gtest!
    const want = rewardFor(8)
    expect(s.start.min_level).toBe(8)
    expect(s.rank).toBe(want.rank)
    expect(s.rewards).toEqual([{ type: 'money', amount: want.money }, { type: 'xp', amount: want.xp }])
    // 中途的錢不超過完成報酬
    expect((s.nodes[0]!.success!.effects![0] as { amount: number }).amount).toBeLessThanOrEqual(want.money)
    expect(g.adjusted.some((a) => a.includes('完成報酬'))).toBe(true)
  })

  it('drops disallowed kinds, tags, scenes and unchecked kinds', () => {
    const g = buildGenerated(reply(), input({ allow: { ...defaultGenInput().allow, statuses: false } }), 'test')
    expect(g.dropped.some((d) => d.includes('特質'))).toBe(true)
    expect(g.dropped.some((d) => d.includes('狀態'))).toBe(true)
    expect(g.mods.statuses).toBeUndefined()
    const s = g.mods.stories!.mod_story_gtest!
    expect(s.nodes[1]!.options!.map((o) => o.label)).toEqual(['揭發他', '收下封口費'])
    expect(s.nodes[2]!.success!.scene).toBeUndefined()
  })

  it('fixes the numbers of new monsters, abilities and statuses', () => {
    const g = buildGenerated(reply(), input({ level: 5 }), 'test')
    const foe = g.mods.enemies!.mod_enemy_gtest_1!
    const band = enemyBand(5)
    expect(foe.hp).toBe(band.hp[1])
    expect(foe.xp).toBe(band.xp[0])
    expect(diceAvg(foe.weapon.dice)).toBeLessThanOrEqual(band.weapon[1])
    expect(foe.abilities).toEqual(['mod_ability_gtest_1'])
    const ab = g.mods.abilities!.mod_ability_gtest_1!
    expect(ab.classes).toEqual(['monster'])
    expect(ab.apply).toEqual([{ status: 'mod_status_gtest_1', turns: 2, on: 'hit' }])
    expect(diceAvg(ab.damage![0]!.dice)).toBeLessThan(165)
    expect(diceAvg(g.mods.statuses!.mod_status_gtest_1!.dot!.dice)).toBeLessThan(130)
    expect(g.adjusted.filter((a) => a.includes('已調')).length).toBeGreaterThanOrEqual(2)
  })

  it('fills the program-decided fields of new npcs, items, landmarks and maps', () => {
    const g = buildGenerated(reply(), input(), 'test')
    const npc = g.mods.npcs!.mod_npc_gtest_1!
    expect(npc.location).toBe('soriel')
    expect(npc.hire_cc).toBeGreaterThan(1)
    expect(g.mods.items!['沉甸甸的錢袋']!.category).toBe('material')
    const lm = g.mods.landmarks!.lm_gtest_1!
    expect(lm.at.area.startsWith('soriel')).toBe(true)
    expect(lm.types).toEqual(['harbor'])
    const map = g.mods.specialMaps!.sm_gtest_1!
    expect(map.size).toEqual([16, 6])
    expect(map.table).toEqual([[['mod_enemy_gtest_1', 1]]])
  })

  it('renames a new item that collides with an existing one', () => {
    const r = reply()
    r.new.items[0]!.name = '乾糧'
    const g = buildGenerated(r, input(), 'test')
    expect(Object.keys(g.mods.items!)).toEqual(['乾糧（2）'])
    expect(g.mods.stories!.mod_story_gtest!.nodes[1]!.options![1]!.success!.effects![0]).toMatchObject({ name: '乾糧（2）' })
  })

  it('reports undefined refs', () => {
    const r = reply()
    ;(r.story.nodes[0] as { allies?: string[] }).allies = ['$npc9']
    expect(buildGenerated(r, input(), 'test').dropped.some((d) => d.includes('$npc9'))).toBe(true)
  })

  it('caps mid-story xp like money', () => {
    const r = reply()
    r.story.nodes[0]!.success!.effects = [{ type: 'xp', amount: 1000 }, { type: 'xp', amount: 3000 }] as never
    const g = buildGenerated(r, input({ level: 4 }), 'test')
    const want = rewardFor(4)
    const xp = (g.mods.stories!.mod_story_gtest!.nodes[0]!.success!.effects as { amount: number }[]).reduce((s, e) => s + e.amount, 0)
    expect(xp).toBeLessThanOrEqual(want.xp)
    expect(g.adjusted.some((a) => a.includes('中途給的經驗'))).toBe(true)
  })

  it('caps new monster levels near the suggested level and warns about hard places', () => {
    const r = reply()
    r.new.enemies[0]!.level = 20
    r.story.nodes[0]!.at = { where: 'dungeon', location: 'ember_rift', layer: 'deep' } as never
    const g = buildGenerated(r, input({ level: 4 }), 'test')
    // 只出現一隻：算頭目，+5
    expect(g.mods.enemies!.mod_enemy_gtest_1!.level).toBe(9)
    expect(g.adjusted.some((a) => a.includes('比建議等級 4 高太多'))).toBe(true)
    expect(g.warnings.some((w) => w.includes('深層'))).toBe(true)
  })

  it('treats cleared number fields as not pinned', () => {
    const r = reply()
    r.story.start.min_level = 7
    const g = buildGenerated(r, input({ level: '' as never, maxNodes: '' as never }), 'test')
    expect(g.mods.stories!.mod_story_gtest!.start.min_level).toBe(7)
    expect(g.adjusted.some((a) => a.includes('任務點有'))).toBe(false)
  })

  it('drops new things the quest does not use', () => {
    const r = reply()
    r.new.landmarks.push({ ref: '$lm2', location: 'soriel', name: '沒用到的倉庫', emoji: '📦', desc: '', types: [] })
    const g = buildGenerated(r, input(), 'test')
    expect(Object.keys(g.mods.landmarks!)).toEqual(['lm_gtest_1'])
    expect(g.dropped.some((d) => d.includes('沒用到的倉庫'))).toBe(true)
  })

  it('throws without a story', () => {
    expect(() => buildGenerated({ notes: 'x' }, input())).toThrow()
  })
})

describe('checkGenerated (sandbox)', () => {
  it('passes a well-formed reply and leaves the world untouched', () => {
    const c = useContent()
    c.switchWorld(c.createWorld('生成'))
    const g = buildGenerated(reply(), input(), 'test')
    const r = c.checkGenerated(g.mods, g.storyId)
    expect(r.errors).toEqual([])
    expect(Object.keys(r.mods.stories ?? {})).toEqual([g.storyId])
    expect(Object.keys(r.mods.landmarks ?? {})).toEqual(['lm_gtest_1'])
    // 沙盒：目前的世界沒有被改到
    expect(stories.some((s) => s.id === g.storyId)).toBe(false)
    expect(enemies.mod_enemy_gtest_1).toBeUndefined()
    expect(abilities.mod_ability_gtest_1).toBeUndefined()
    // 寫進去之後就是普通的自建內容
    c.importPackage({ mods: r.mods, renamed: [], skipped: [], fingerprints: {} })
    expect(stories.find((s) => s.id === g.storyId)?.title).toBe('燈塔的守夜人')
  })

  it('reports unreachable nodes and missing references as errors', () => {
    const c = useContent()
    c.switchWorld(c.createWorld('生成'))
    const r = reply()
    ;(r.story.nodes[2] as { requires: { flags: string[] } }).requires.flags = ['never_set']
    r.story.nodes[0]!.at = { where: 'npc', npc: 'no_such_npc' } as never
    const g = buildGenerated(r, input(), 'test')
    const res = c.checkGenerated(g.mods, g.storyId)
    expect(res.errors.some((e) => e.includes('gtest_never_set'))).toBe(true)
    expect(res.errors.some((e) => e.includes('固定 NPC 不存在'))).toBe(true)
  })
})
