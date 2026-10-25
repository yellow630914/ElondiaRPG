import { afterEach, describe, expect, it } from 'vitest'
import { prepareAction, resolveAction } from '@/engine/actions'
import { resolveCaptive } from '@/engine/captives'
import { currentArea, enterLocation, move, standOn } from '@/engine/grid'
import { applyContent, emptyMods, normalizeMods } from '@/engine/mods'
import { npcRecord, registerNpc } from '@/engine/npcs'
import { applyPendingMove, leaveSide } from '@/engine/road'
import { newGame } from '@/engine/state'
import { ensureRelationship, setAffinity } from '@/engine/social'
import { abandonStory, activeNodes, blockingNode, forgetStoryWaits, nodesHere, optionOpen, playNode, pruneStories, startStory, storyOffersHere, waitStory } from '@/engine/story'
import { sanitizeStory, type StoryMod } from '@/engine/storyMods'
import type { GameState, Report } from '@/engine/types'

afterEach(() => applyContent(emptyMods()))

const SELENE = 'npc_selene'

function game(stories: Record<string, StoryMod> = {}): GameState {
  applyContent(normalizeMods({ ...emptyMods(), stories }))
  const state = newGame({ name: '測試者', race: 'human', classId: 'fighter', seed: 5, birthplace: 'soriel' })
  enterLocation(state)
  return state
}

function kill(state: GameState, id: string) {
  const rec = state.npcs?.[id] ?? registerNpc(state, { ...npcRecord(state, id)! })
  rec.dead = true
}

function capture(state: GameState, id: string) {
  state.captives = { npcs: [id], aggressor: 'party', location: state.location, area: currentArea(state).key, day: state.time.day }
}

// 開頭的固定 NPC 在身邊（瑟琳的任務）
function besideSelene(state: GameState) {
  state.npcs ??= {}
  const rec = state.npcs[SELENE] ?? registerNpc(state, { ...npcRecord(state, SELENE)! })
  rec.at = { area: currentArea(state).key, x: state.position!.x, y: state.position!.y, until: 999 }
}

describe('special quest NPCs who are captured, dead or hostile', () => {
  it('does not offer the quest when the giver is captured, dead or hostile', () => {
    const state = game()
    besideSelene(state)
    const offered = () => storyOffersHere(state).some((d) => d.id === 'lost_relic')
    expect(offered()).toBe(true)
    capture(state, SELENE)
    expect(offered()).toBe(false)
    delete state.captives
    state.npcs![SELENE]!.hostile = true
    expect(offered()).toBe(false)
    delete state.npcs![SELENE]!.hostile
    kill(state, SELENE)
    expect(offered()).toBe(false)
  })

  it('fails the quest when an NPC it still needs is executed, and the guest leaves', () => {
    const state = game()
    startStory(state, 'lost_relic')
    capture(state, SELENE)
    const r = resolveCaptive(state, SELENE, 'execute')
    expect(state.stories?.lost_relic?.status).toBe('failed')
    expect(r.outcome.summary).toContain('瑟琳死了')
    expect(activeNodes(state)).toEqual([])
  })

  it('fails quests whose NPC died before this version when loading', () => {
    const state = game()
    startStory(state, 'lost_relic')
    kill(state, SELENE)
    pruneStories(state)
    expect(state.stories?.lost_relic?.status).toBe('failed')
  })

  it('wins a duel without fighting when the only foe is already dead', () => {
    const duel = sanitizeStory('duel', {
      title: '決鬥', summary: '', start: { kind: 'manual' }, start_flags: ['d'],
      nodes: [{ id: 'fight', title: '和瑟琳決鬥', text: '', at: { where: 'settlement', location: 'soriel' }, kind: 'combat', foes: [SELENE], requires: { flags: ['d'] }, success: { text: '你贏了。', complete: true } }],
    }, false)
    const state = game({ duel })
    startStory(state, 'duel')
    kill(state, SELENE)
    const r = playNode(state, 'duel:fight') as Report
    expect(state.combat).toBeUndefined()
    expect(r.outcome.summary).toContain('已經不在了')
    expect(state.stories?.duel?.status).toBe('completed')
  })

  it('hides affinity options and blocks joining while the NPC is captured', () => {
    const invite = sanitizeStory('invite', {
      title: '邀請', summary: '', start: { kind: 'manual' },
      nodes: [{
        id: 'ask', title: '邀請瑟琳', text: '', at: { where: 'settlement', location: 'soriel' }, kind: 'choice',
        options: [
          { label: '邀請', check: { attr: 'cha', dc: 12, affinity: { npc: SELENE } }, success: { effects: [{ type: 'companion', npc: SELENE, mode: 'voluntary' }], complete: true } },
          { label: '直接拉她入隊', success: { effects: [{ type: 'companion', npc: SELENE, mode: 'voluntary' }] } },
        ],
      }],
    }, false)
    const state = game({ invite })
    ensureRelationship(state, npcRecord(state, SELENE)!)
    setAffinity(state, SELENE, 45)
    startStory(state, 'invite')
    capture(state, SELENE)
    const node = activeNodes(state)[0]!.node
    expect(optionOpen(state, node, 0)).toBe(false)
    expect(() => prepareAction(state, { kind: 'story', target: 'invite:ask:0', text: '' })).toThrow()
    const r = playNode(state, 'invite:ask', 1) as Report
    expect(state.party.some((m) => m.id === SELENE)).toBe(false)
    expect(r.outcome.summary).toContain('被制伏')
  })
})

describe('arriving at a special quest point', () => {
  const town = (urgent: boolean): StoryMod => sanitizeStory('t', {
    title: '城裡的事', summary: '', start: { kind: 'manual' }, start_flags: ['t'],
    nodes: [{ id: 'here', title: '在城裡', text: '', at: { where: 'cell', location: 'soriel', cell: 'tavern' }, kind: 'check', check: { attr: 'cha', dc: 30 }, requires: { flags: ['t'] }, ...(urgent ? { urgent: true } : {}), success: { complete: true } }],
  }, false)

  it('blocks moving until you deal with it; points that are not urgent can wait until you come back', () => {
    const state = game({ t: town(false) })
    startStory(state, 't')
    standOn(state, 'tavern')
    expect(blockingNode(state)?.ref).toBe('t:here')
    expect(() => move(state, 0, 1)).toThrow('先處理特殊任務')
    waitStory(state, 't:here')
    expect(blockingNode(state)).toBeUndefined()
    expect(nodesHere(state).map((n) => n.ref)).toEqual(['t:here'])
    // 走開再回來：又觸發
    const reports = state.reports.length
    standOn(state, 'gate')
    forgetStoryWaits(state)
    standOn(state, 'tavern')
    expect(blockingNode(state)?.ref).toBe('t:here')
    expect(state.reports.length).toBe(reports)
  })

  it('offers only abandoning on urgent points', () => {
    const state = game({ t: town(true) })
    startStory(state, 't')
    standOn(state, 'tavern')
    expect(() => waitStory(state, 't:here')).toThrow('不能稍候')
    abandonStory(state, 't')
    expect(blockingNode(state)).toBeUndefined()
  })

  it('stops blocking after an attempt that made no progress', () => {
    const state = game({ t: town(false) })
    startStory(state, 't')
    standOn(state, 'tavern')
    prepareAction(state, { kind: 'story', target: 't:here', text: '' })
    state.pendingAction!.natural = 2
    const r = resolveAction(state, null)
    expect(r.kind).toBe('event')
    expect(state.stories?.t?.status).toBe('active')
    expect(blockingNode(state)).toBeUndefined()
  })

  it('lists situational modifiers on the check', () => {
    const state = game({ t: sanitizeStory('t', { ...town(false), nodes: [{ ...town(false).nodes[0]!, check: { attr: 'cha', dc: 12, affinity: { npc: SELENE } } }] }, false) })
    ensureRelationship(state, npcRecord(state, SELENE)!)
    setAffinity(state, SELENE, 45)
    startStory(state, 't')
    standOn(state, 'tavern')
    prepareAction(state, { kind: 'story', target: 't:here', text: '' })
    state.pendingAction!.natural = 10
    const r = resolveAction(state, null)
    expect(r.check?.situational).toContainEqual({ label: '瑟琳的好感（45）', value: 4 })
  })
})

describe('side maps a quest takes you into', () => {
  const cave = sanitizeStory('c', {
    title: '洞窟', summary: '', start: { kind: 'manual' }, start_flags: ['c'],
    nodes: [
      { id: 'enter', title: '進洞', text: '', at: { where: 'settlement', location: 'soriel' }, kind: 'story', requires: { flags: ['c'], flags_none: ['c_in'] }, success: { set_flags: ['c_in'], side_map: 'cave' } },
      { id: 'boss', title: '洞裡的人', text: '', at: { where: 'side', side_map: 'cave' }, kind: 'story', requires: { flags: ['c_in'] }, success: { complete: true } },
    ],
  }, false)
  const stars = (state: GameState) => currentArea(state).cells.filter((c) => c.storyNode).map((c) => c.storyNode)

  it('puts the point only in its own map and abandons the quest when you leave', () => {
    const state = game({ c: cave })
    startStory(state, 'c')
    playNode(state, 'c:enter')
    expect(state.side?.story).toBe('c')
    expect(stars(state)).toEqual(['c:boss'])
    leaveSide(state)
    expect(state.stories?.c?.status).toBe('failed')
  })

  it('does not put the point in an unrelated cave', () => {
    const state = game({ c: cave })
    startStory(state, 'c')
    playNode(state, 'c:enter')
    state.side!.story = undefined
    leaveSide(state)
    state.pendingMove = { side_map: 'cave' }
    applyPendingMove(state)
    expect(stars(state)).toEqual([])
  })
})
