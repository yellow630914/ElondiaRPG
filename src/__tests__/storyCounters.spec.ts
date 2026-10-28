import { afterEach, describe, expect, it } from 'vitest'
import { newGame } from '@/engine/state'
import { addCounters, clampCounters, condMet, counterValue, setFlag } from '@/engine/storyFlags'
import { applyContent, emptyMods, normalizeMods, sanitizeCond } from '@/engine/mods'
import { sanitizeOutcome, storyCheck } from '@/engine/storyMods'
import { stories, storyCounters } from '@/engine/data'

afterEach(() => applyContent(emptyMods()))

const game = () => newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 1 })

describe('story counters', () => {
  it('starts at the initial value, adds deltas inside one report and clamps to the limits', () => {
    const state = game()
    expect(counterValue(state, 'human_stance')).toBe(0)
    storyCounters.test_c = { name: '測試', initial: 2, min: 0, max: 5 }
    expect(counterValue(state, 'test_c')).toBe(2)
    const changes: { flags?: Record<string, unknown> } = {}
    addCounters(state, changes, { test_c: 2, human_stance: -1, missing: 3 })
    addCounters(state, changes, { test_c: 4 })
    Object.assign(state.flags, changes.flags)
    expect(counterValue(state, 'test_c')).toBe(5)
    expect(counterValue(state, 'human_stance')).toBe(-1)
    expect(state.flags['count:missing']).toBeUndefined()
    delete storyCounters.test_c
  })

  it('clamps saved values into new limits when the counter is changed', () => {
    const state = game()
    storyCounters.test_c = { name: '測試', initial: 0 }
    state.flags['count:test_c'] = 9
    state.flags['count:human_stance'] = -4
    storyCounters.test_c = { name: '測試', initial: 0, min: -2, max: 3 }
    clampCounters(state)
    expect(counterValue(state, 'test_c')).toBe(3)
    expect(counterValue(state, 'human_stance')).toBe(-4)
    state.flags['count:test_c'] = -7
    clampCounters(state)
    expect(counterValue(state, 'test_c')).toBe(-2)
    delete storyCounters.test_c
  })

  it('checks counter ranges and any-of flags', () => {
    const state = game()
    expect(condMet(state, { counters: { human_stance: { min: 1 } } })).toBe(false)
    expect(condMet(state, { counters: { human_stance: { max: 0 } } })).toBe(true)
    state.flags['count:human_stance'] = 2
    expect(condMet(state, { counters: { human_stance: { min: 1, max: 3 } } })).toBe(true)
    expect(condMet(state, { flags_any: ['a', 'b'] })).toBe(false)
    setFlag(state, 'b')
    expect(condMet(state, { flags_any: ['a', 'b'] })).toBe(true)
  })

  it('keeps counters and any-of flags through the content editor', () => {
    expect(sanitizeCond({ flags_any: ['x'], counters: { Human_Stance: { min: 1.4 }, bad: {} } })).toEqual({ flags_any: ['x'], counters: { human_stance: { min: 1 } } })
    expect(sanitizeOutcome({ counters: { human_stance: 3, demon_stance: 0 } })).toEqual({ counters: { human_stance: 3 } })
  })

  it('registers custom counters from the world and flags stories that use unknown ones', () => {
    const mods = normalizeMods({ counters: { dawn_succession: { name: '王位之爭', initial: 0, custom: true } } })
    expect(mods.counters.dawn_succession?.custom).toBe(true)
    applyContent(mods)
    expect(storyCounters.dawn_succession?.name).toBe('王位之爭')
    const def = JSON.parse(JSON.stringify(stories[0]))
    def.nodes[0].success = { ...(def.nodes[0].success ?? {}), counters: { nope: 1 } }
    expect(storyCheck(def).errors.some((e) => e.includes('nope'))).toBe(true)
  })
})

describe('npc stage identity', () => {
  it('renames and re-describes a fixed NPC while the stage holds, then restores it', async () => {
    const { npcRecord } = await import('@/engine/npcs')
    const { ensureRelationship } = await import('@/engine/social')
    const { builtinNpc, sanitizeNpc } = await import('@/engine/mods')
    const { clearFlag } = await import('@/engine/storyFlags')
    const mods = emptyMods()
    const base = builtinNpc('npc_alexei')!
    mods.npcs.npc_alexei = sanitizeNpc('npc_alexei', {
      ...base,
      stages: [{ requires: { flags: ['alexei_crowned'] }, location: 'dawnlight', haunts: [{ location: 'dawnlight', zone: 'palace', weight: 1 }], name: '國王阿列克謝', background: '晨曦王國的新國王。', tags: ['royal'] }],
    }, false)
    expect(mods.npcs.npc_alexei!.stages![0]!.name).toBe('國王阿列克謝')
    applyContent(mods)
    const state = game()
    ensureRelationship(state, npcRecord(state, 'npc_alexei')!)
    setFlag(state, 'alexei_crowned')
    const rec = npcRecord(state, 'npc_alexei')!
    expect(rec.name).toBe('國王阿列克謝')
    expect(rec.background).toBe('晨曦王國的新國王。')
    expect(state.relationships!.npc_alexei!.name).toBe('國王阿列克謝')
    clearFlag(state, 'alexei_crowned')
    const back = npcRecord(state, 'npc_alexei')!
    expect(back.name).toBe('阿列克謝')
    expect(back.background).toContain('嫡皇子')
    expect(back.stagedIdentity).toBeUndefined()
  })
})

describe('content tags', () => {
  it('hides tagged stories and options the settings turn off, and stories for other bodies', async () => {
    const { canStart, optionOpen } = await import('@/engine/story')
    const { setContentFilters, defeatAdultAllowed, setDefeatAdult } = await import('@/engine/content')
    const state = game()
    const def = { id: 'tag_test', title: '測試', summary: '', start: { kind: 'manual' as const }, nodes: [] }
    expect(canStart(state, def)).toBe(true)
    expect(canStart(state, { ...def, tags: ['adult'] })).toBe(true)
    expect(canStart(state, { ...def, tags: ['adult', 'ntr'] })).toBe(true)
    setContentFilters({ ntr: false })
    expect(canStart(state, { ...def, tags: ['adult', 'ntr'] })).toBe(false)
    const node = { id: 'n', title: 'n', text: '', at: { where: 'settlement' as const }, kind: 'choice' as const, options: [{ label: 'a' }, { label: 'b', tags: ['ntr'] }] }
    expect(optionOpen(state, node, 0)).toBe(true)
    expect(optionOpen(state, node, 1)).toBe(false)
    setContentFilters({ ntr: true })
    // 主角的體型
    state.party[0]!.body = 'masc'
    expect(canStart(state, { ...def, start: { kind: 'manual', pc_body: ['fem'] } })).toBe(false)
    expect(canStart(state, { ...def, start: { kind: 'manual', pc_body: ['masc', 'fem'] } })).toBe(true)
    // 戰敗色情事件
    expect(defeatAdultAllowed('masc')).toBe(true)
    setDefeatAdult('not_masc')
    expect(defeatAdultAllowed('masc')).toBe(false)
    expect(defeatAdultAllowed('fem')).toBe(true)
    setContentFilters({ pc_unwilling: false })
    expect(defeatAdultAllowed('fem')).toBe(false)
    setContentFilters({ pc_unwilling: true })
    setDefeatAdult('all')
  })
})

describe('hidden landmarks', () => {
  it('shows a plain road until the flags hold', async () => {
    const { getArea } = await import('@/engine/grid')
    const { builtinLandmark, sanitizeLandmarkMod } = await import('@/engine/landmarkMods')
    const base = builtinLandmark('lm_dawn_sanctum')!
    const mods = emptyMods()
    mods.landmarks.lm_dawn_sanctum = sanitizeLandmarkMod('lm_dawn_sanctum', { ...base, open: { flags: ['sanctum_open'], hidden: true } })
    expect(mods.landmarks.lm_dawn_sanctum.open?.hidden).toBe(true)
    applyContent(mods)
    const state = game()
    const at = base.at
    const cell = () => getArea(state, at.area).cells[at.y * getArea(state, at.area).width + at.x]!.kind
    expect(cell()).toBe('floor')
    setFlag(state, 'sanctum_open')
    expect(cell()).toBe('lm_dawn_sanctum')
  })
})

describe('story deaths', () => {
  it('marks a fixed NPC dead and fails other stories that need them, but not this one', async () => {
    const { startStory, playNode } = await import('@/engine/story')
    const { npcRecord } = await import('@/engine/npcs')
    const { sanitizeStory } = await import('@/engine/storyMods')
    const mods = emptyMods()
    mods.stories.death_a = sanitizeStory('death_a', {
      title: '國王之死', summary: '', start: { kind: 'manual' },
      nodes: [{ id: 'n1', title: '國王倒下', text: '國王倒下了。', at: { where: 'settlement' }, kind: 'story', success: { deaths: ['npc_alexander'], complete: true } }],
    }, true)
    mods.stories.death_b = sanitizeStory('death_b', {
      title: '覲見國王', summary: '', start: { kind: 'manual' },
      nodes: [{ id: 'm1', title: '見國王', text: '…', at: { where: 'npc', npc: 'npc_alexander' }, kind: 'story', success: { complete: true } }],
    }, true)
    applyContent(mods)
    const state = game()
    startStory(state, 'death_b')
    startStory(state, 'death_a')
    playNode(state, 'death_a:n1')
    expect(npcRecord(state, 'npc_alexander')!.dead).toBe(true)
    expect(state.stories!.death_a!.status).toBe('completed')
    expect(state.stories!.death_b!.status).toBe('failed')
  })
})
