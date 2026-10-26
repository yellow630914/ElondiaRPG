import { afterEach, describe, expect, it } from 'vitest'
import { newGame } from '@/engine/state'
import { applyContent, emptyMods } from '@/engine/mods'
import { sanitizeStory, storyCheck } from '@/engine/storyMods'
import { canStart } from '@/engine/story'
import { counterValue, setFlag } from '@/engine/storyFlags'
import { enemies, npcs as namedNpcs, stories } from '@/engine/data'
import { adultContent, setAdultContent, setContentFilters } from '@/engine/content'
import type { StoryDef } from '@/engine/data'

const adultDefault = adultContent()

afterEach(() => {
  setAdultContent(adultDefault)
  applyContent(emptyMods())
  setContentFilters({})
})

const game = () => newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 1 })
const story = (id: string) => stories.find((s) => s.id === id)!

// 內建的特殊任務不經過整理就直接用：要通過任務鏈的檢查，而且整理後不變（沒有超過長度、範圍的寫法）
describe('built-in stories', () => {
  it('pass the story check without errors or warnings', () => {
    const bad = stories.map((s) => ({ id: s.id, ...storyCheck(s) })).filter((r) => r.errors.length || r.warnings.length)
    expect(bad).toEqual([])
  })

  it('stay the same after sanitizing', () => {
    for (const s of stories) {
      const clean = sanitizeStory(s.id, s, false) as unknown as StoryDef
      expect(JSON.parse(JSON.stringify(clean)), s.id).toMatchObject(JSON.parse(JSON.stringify(s)))
    }
  })

  it('chains each storyline through its done flags and level bands', () => {
    const chains = [
      ['dawn_throne_ambush', 'dawn_throne_poison', 'dawn_throne_crown'],
      ['whisper_seal', 'whisper_oath', 'whisper_emperor'],
      ['lilian_successor', 'lilian_abbey', 'lilian_graduation'],
      ['rhine_raid', 'rhine_iron_cross', 'rhine_council'],
      ['mist_bell', 'mist_inquisition', 'mist_saint'],
      ['isadora_interview', 'isadora_ball', 'isadora_elope'],
    ]
    for (const ids of chains) {
      const levels = ids.map((id) => story(id).start.min_level)
      expect(levels).toEqual([5, 8, 11])
      for (let i = 1; i < ids.length; i++) expect(story(ids[i]!).start.requires?.flags?.length, ids[i]).toBeGreaterThan(0)
    }
    const adult = ['lilian_successor', 'lilian_abbey', 'lilian_graduation', 'isadora_interview', 'isadora_ball', 'isadora_elope']
    expect(adult.every((id) => story(id).tags?.includes('adult'))).toBe(true)
  })

  it('only fights stand-in monsters, never fixed NPCs, and kills the king on the story node', () => {
    expect(stories.flatMap((s) => s.nodes.flatMap((n) => n.foes ?? []))).toEqual([])
    const deaths = stories.flatMap((s) => s.nodes.flatMap((n) => [n.success, n.fail, ...(n.options ?? []).flatMap((o) => [o.success, o.fail])].flatMap((o) => o?.deaths ?? [])))
    expect(deaths).toEqual(['npc_alexander'])
  })

  it('opens the next quest only after the previous one, at its level and rank', () => {
    const state = game()
    const poison = story('dawn_throne_poison')
    state.party[0]!.level = 8
    state.guild = { rank: 'C', merit: 0 }
    expect(canStart(state, poison)).toBe(false)
    setFlag(state, 'dthr_1_done', true)
    expect(canStart(state, poison)).toBe(true)
    state.party[0]!.level = 7
    expect(canStart(state, poison)).toBe(false)
    // 選擇的結果推動人類世界的走向：公主 +1、皇子 -1
    const [princess, prince] = poison.nodes.find((n) => n.id === 'choose')!.options!.map((o) => o.success!)
    expect([princess!.counters, prince!.counters]).toEqual([{ human_stance: 1 }, { human_stance: -1 }])
    expect(counterValue(state, 'human_stance')).toBe(0)
  })

  it('hides the adult storyline when its tag is filtered out', () => {
    const state = game()
    state.party[0]!.level = 5
    state.guild = { rank: 'D', merit: 0 }
    state.relationships = { ...state.relationships, npc_lilian: { affinity: 10 } as never }
    const lil = story('lilian_successor')
    setAdultContent(true)
    const on = canStart(state, lil)
    setAdultContent(false)
    expect([on, canStart(state, lil)]).toEqual([true, false])
  })

  it('gives the new monarch a staged identity', () => {
    const ana = namedNpcs.find((n) => n.id === 'npc_anastasia')!
    const queen = ana.stages!.find((s) => s.requires.flags?.includes('dthr_queen'))!
    expect(queen.background).toContain('女王')
    expect(queen.tags).toEqual(['royal'])
    const alexei = namedNpcs.find((n) => n.id === 'npc_alexei')!
    expect(alexei.stages!.some((s) => s.requires.flags?.includes('dthr_king') && s.background?.includes('國王'))).toBe(true)
  })

  it('plays the coronation: the king dies on the story node and the queen takes her staged identity', async () => {
    const { startStory, playNode } = await import('@/engine/story')
    const { npcRecord } = await import('@/engine/npcs')
    const { joinParty } = await import('@/engine/party')
    const state = game()
    setFlag(state, 'dthr_back_princess')
    startStory(state, 'dawn_throne_crown')
    // 洛倫佐在身邊（任務點是「這位角色在身邊時」）
    joinParty(state, npcRecord(state, 'npc_lorenzo_valois')!, 'guest')
    playNode(state, 'dawn_throne_crown:deathbed')
    expect(npcRecord(state, 'npc_alexander')!.dead).toBe(true)
    expect(state.stories!.dawn_throne_crown!.status).toBe('active')
    setFlag(state, 'dthr_coup_done')
    playNode(state, 'dawn_throne_crown:crown_queen', 0)
    expect(state.stories!.dawn_throne_crown!.status).toBe('completed')
    expect(counterValue(state, 'human_stance')).toBe(1)
    expect(npcRecord(state, 'npc_anastasia')!.background).toContain('登基為晨曦王國的女王')
    expect(npcRecord(state, 'npc_alexei')!.background).toContain('守邊公爵')
  })

  it('never talks with the emperor of whispers: he is fought, then sealed, and keeps coming back', () => {
    const emperor = story('whisper_emperor')
    const throne = emperor.nodes.find((n) => n.id === 'throne')!
    expect(throne.kind).toBe('combat')
    expect(throne.enemies?.[0]?.[0]).toBe('emperor_of_whispers')
    expect(emperor.nodes.every((n) => (n.options ?? []).every((o) => !o.label.includes('勸')))).toBe(true)
    expect(enemies.emperor_of_whispers!.desc).toContain('重新聚起形體')
  })

  it('keeps the kingmaker and the rulers out of reach of a sneak attack', () => {
    for (const id of ['npc_lorenzo_valois', 'npc_anastasia', 'npc_alexei', 'npc_alexander']) expect(namedNpcs.find((n) => n.id === id)!.no_attack, id).toBe(true)
  })
})
