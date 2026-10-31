import { afterEach, describe, expect, it } from 'vitest'
import { stories } from '@/engine/data'
import { enterLocation, standOn } from '@/engine/grid'
import { applyContent, emptyMods, normalizeMods, sanitizeCond } from '@/engine/mods'
import { newGame } from '@/engine/state'
import { activeNodes, canStart, nodesHere, nodesWaitingForDays, optionOpen, playNode, startStory } from '@/engine/story'
import { condMet } from '@/engine/storyFlags'
import { storyIssues, type StoryMod } from '@/engine/storyMods'
import type { GameState, Report } from '@/engine/types'

afterEach(() => applyContent(emptyMods()))

function game(): GameState {
  const state = newGame({ name: '測試者', race: 'human', classId: 'fighter', seed: 7, birthplace: 'soriel' })
  enterLocation(state)
  state.time = { day: 1, hour: 10, minute: 0 }
  return state
}

/** 在酒館訂做，三天後來取件；取件的選項只出現訂了的那一件 */
const order: StoryMod = {
  id: 'order', title: '訂做', summary: '', start: { kind: 'guild', location: 'soriel' }, start_flags: ['o_started'], custom: true,
  nodes: [
    {
      id: 'pick', title: '挑一件', text: '', at: { where: 'cell', location: 'soriel', cell: 'tavern' }, kind: 'choice', requires: { flags: ['o_started'] },
      options: [{ label: '劍', success: { set_flags: ['o_ordered', 'o_sword'] } }, { label: '盾', success: { set_flags: ['o_ordered', 'o_shield'] } }],
    },
    {
      id: 'collect', title: '取件', text: '', at: { where: 'cell', location: 'soriel', cell: 'tavern' }, kind: 'choice',
      requires: { flags: ['o_ordered'], after: { story: 'order', node: 'pick', days: 3 } },
      options: [
        { label: '取回劍', requires: { flags: ['o_sword'] }, success: { complete: true } },
        { label: '取回盾', requires: { flags: ['o_shield'] }, success: { complete: true } },
      ],
    },
  ],
}
/** 接在「訂做」之後的任務：前一個結束兩天後才開放 */
const sequel: StoryMod = {
  id: 'sequel', title: '續集', summary: '', start: { kind: 'guild', location: 'soriel', requires: { after: { story: 'order', days: 2 } } }, start_flags: ['s_started'], custom: true,
  nodes: [{ id: 'n1', title: '一', text: '', at: { where: 'cell', location: 'soriel', cell: 'guild' }, kind: 'story', requires: { flags: ['s_started'] }, success: { complete: true } }],
}

describe('「某個任務結束後幾天」的條件', () => {
  it('opens a node some days after another node ended, and the notebook says when', () => {
    applyContent(normalizeMods({ ...emptyMods(), stories: { order, sequel } }))
    const state = game()
    startStory(state, 'order')
    standOn(state, 'tavern')
    playNode(state, 'order:pick', 1)
    const picked = { ...state.time }
    expect(activeNodes(state).map((n) => n.ref)).toEqual([])
    const later = nodesWaitingForDays(state)
    expect(later.map((n) => n.ref)).toEqual(['order:collect'])
    expect(later[0]!.from).toEqual({ day: picked.day + 3, hour: picked.hour, minute: picked.minute })

    state.time = { ...later[0]!.from, minute: later[0]!.from.minute! - 1 }
    expect(nodesHere(state)).toEqual([])
    state.time = later[0]!.from
    const collect = nodesHere(state)
    expect(collect.map((n) => n.ref)).toEqual(['order:collect'])
    // 只出現訂了的那一件
    expect([0, 1].map((i) => optionOpen(state, collect[0]!.node, i))).toEqual([false, true])
    expect(nodesWaitingForDays(state)).toEqual([])

    // 續集：訂做結束兩天後才開放
    const sequelDef = stories.find((s) => s.id === 'sequel')!
    expect(canStart(state, sequelDef)).toBe(false)
    playNode(state, 'order:collect', 1) as Report
    expect(state.stories?.order?.status).toBe('completed')
    expect(canStart(state, sequelDef)).toBe(false)
    state.time = { ...state.time, day: state.time.day + 2 }
    expect(canStart(state, sequelDef)).toBe(true)
  })

  it('is never met before the story (or node) has ended', () => {
    const state = game()
    expect(condMet(state, { after: { story: 'order', days: 1 } })).toBe(false)
    expect(condMet(state, { after: { story: 'nope', node: 'x', days: 1 } })).toBe(false)
  })

  it('is kept when saving, clamped, and checked', () => {
    expect(sanitizeCond({ after: { story: 'order', node: 'pick', days: 99 } })).toEqual({ after: { story: 'order', node: 'pick', days: 60 } })
    expect(sanitizeCond({ after: { story: '', days: 3 } })).toBeUndefined()
    expect(storyIssues({ ...sequel, start: { ...sequel.start, requires: { after: { story: 'missing', days: 2 } } } } as never).some((i) => i.includes('missing'))).toBe(true)
    applyContent(normalizeMods({ ...emptyMods(), stories: { order } }))
    expect(storyIssues({ ...sequel, start: { ...sequel.start, requires: { after: { story: 'order', node: 'nope', days: 2 } } } } as never).some((i) => i.includes('任務點不存在'))).toBe(true)
  })
})

describe('內建：三天後取件、三天後再見', () => {
  it('forge picks hand over the item at a collect node days later', () => {
    for (const [id, days] of [['gear_new_design', 3], ['gear_forge_mech_armor', 7]] as const) {
      const def = stories.find((s) => s.id === id)!
      const pick = def.nodes.find((n) => n.id === 'pick')!
      const collect = def.nodes.find((n) => n.id === 'collect')!
      expect(collect.requires?.after).toEqual({ story: id, node: 'pick', days })
      expect(pick.options!.every((o) => !o.success?.complete && !o.success?.effects)).toBe(true)
      expect(collect.options!.length).toBe(pick.options!.length)
      expect(collect.options!.every((o) => o.success?.complete && o.success.effects?.some((e) => e.type === 'item'))).toBe(true)
      expect(storyIssues(def)).toEqual([])
    }
  })

  it('chained stories open three days after the previous one', () => {
    for (const [next, prev] of [['smg_skull_tide', 'smg_blacksail_cargo'], ['pyre_prelude', 'pyre_cleanse'], ['spirit_drowned', 'spirit_upstream'], ['morphe_dream_dragon', 'morphe_moth_dust']]) {
      expect(stories.find((s) => s.id === next)!.start.requires?.after).toEqual({ story: prev, days: 3 })
    }
  })
})
