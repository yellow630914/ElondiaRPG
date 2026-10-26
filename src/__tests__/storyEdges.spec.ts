import { afterEach, describe, expect, it } from 'vitest'
import { prepareAction, resolveAction } from '@/engine/actions'
import { resolveCaptive } from '@/engine/captives'
import { afterDefeat, currentArea, enterLocation, findKind, move, standOn } from '@/engine/grid'
import { applyContent, emptyMods, normalizeMods } from '@/engine/mods'
import { npcRecord, registerNpc } from '@/engine/npcs'
import { applyPendingMove, leaveSide } from '@/engine/road'
import { newGame } from '@/engine/state'
import { ensureRelationship, setAffinity } from '@/engine/social'
import { abandonStory, activeNodes, blockingNode, forgetStoryWaits, nodesHere, optionOpen, playNode, pruneStories, setupStoryCheck, startStory, storyCostGate, storyCosts, storyMaxCost, storyOffersHere, waitStory } from '@/engine/story'
import { stories } from '@/engine/data'
import { sanitizeStory, storyCheck, type StoryMod } from '@/engine/storyMods'
import { setFlag } from '@/engine/storyFlags'
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

  it('keeps you in the map at its entrance when you fall there, so the quest goes on', () => {
    const state = game({ c: cave })
    startStory(state, 'c')
    playNode(state, 'c:enter')
    const area = currentArea(state)
    state.position = { area: area.key, x: area.width - 1, y: area.height - 1 }
    afterDefeat(state)
    expect(state.stories?.c?.status).toBe('active')
    expect(state.side?.area).toBe(area.key)
    expect(state.position).toMatchObject({ area: area.key, ...findKind(area, 'exit') })
    expect(stars(state)).toEqual(['c:boss'])
  })

  it('still takes you out of a map whose quest points are all done', () => {
    const state = game({ c: cave })
    startStory(state, 'c')
    playNode(state, 'c:enter')
    const back = state.side!.back
    state.side!.story = undefined
    afterDefeat(state)
    expect(state.side).toBeUndefined()
    expect(state.position).toEqual(back)
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

describe('NPCs a quest still needs and NPCs it kills', () => {
  const lastWords: StoryMod = {
    id: 'wb_last_words', title: '臨終的託付', summary: '老人臨終託付', custom: true,
    start: { kind: 'npc', npc: SELENE },
    start_flags: ['wb_start'],
    nodes: [
      { id: 'dies', title: '老人斷氣', kind: 'story', text: '…', at: { where: 'settlement', location: 'soriel' }, requires: { flags: ['wb_start'] }, success: { set_flags: ['wb_dead'], deaths: [SELENE] } },
      { id: 'after', title: '替他完成心願', kind: 'story', text: '…', at: { where: 'settlement', location: 'soriel' }, requires: { flags: ['wb_dead'] }, success: { complete: true } },
    ],
  } as unknown as StoryMod

  it('keeps going after loading when the quest itself killed its giver', () => {
    const state = game({ wb_last_words: lastWords })
    startStory(state, 'wb_last_words')
    playNode(state, 'wb_last_words:dies')
    pruneStories(state)
    expect(state.stories!.wb_last_words!.status).toBe('active')
    playNode(state, 'wb_last_words:after')
    expect(state.stories!.wb_last_words!.status).toBe('completed')
  })

  it('does not offer a quest when someone a later point needs is already dead', async () => {
    const { canStart } = await import('@/engine/story')
    const { stories } = await import('@/engine/data')
    const state = game()
    state.party[0]!.level = 8
    state.guild = { rank: 'C', merit: 0 }
    setFlag(state, 'rwar_1_done')
    const def = stories.find((s) => s.id === 'rhine_iron_cross')!
    expect(canStart(state, def)).toBe(true)
    kill(state, 'npc_rock_the_rat')
    expect(canStart(state, def)).toBe(false)
  })
})

describe('content tags on every option', () => {
  it('warns when turning tags off would leave a choice with nothing to pick', async () => {
    const { stories } = await import('@/engine/data')
    game({
      wb_ntr: {
        id: 'wb_ntr', title: 'NTR 分支測試', summary: '…', custom: true, start: { kind: 'guild' },
        nodes: [{ id: 'pick', title: '抉擇', kind: 'choice', text: '…', at: { where: 'settlement', location: 'soriel' }, options: [{ label: '把她讓給他', tags: ['ntr'], success: { complete: true } }] }],
      } as unknown as StoryMod,
    })
    const def = stories.find((s) => s.id === 'wb_ntr')!
    expect(storyCheck(def).warnings.some((w) => w.includes('沒有選項可選'))).toBe(true)
    def.nodes[0]!.options!.push({ label: '拒絕', success: { complete: true } })
    expect(storyCheck(def).warnings.some((w) => w.includes('沒有選項可選'))).toBe(false)
  })
})

describe('hidden landmarks and town jobs', () => {
  it('does not post a job at a landmark that has not appeared yet', async () => {
    const { landmarks } = await import('@/engine/data')
    const { guildQuests } = await import('@/engine/town')
    const hidden: Record<string, unknown> = {}
    for (const l of Object.values(landmarks).filter((x) => x.location === 'rhineburg')) {
      hidden[l.id] = { ...JSON.parse(JSON.stringify(l)), open: { ...(l.open ?? {}), flags: ['wb_never'], hidden: true } }
    }
    for (let seed = 1; seed <= 8; seed++) {
      applyContent(normalizeMods({ ...emptyMods(), landmarks: hidden as never }))
      const state = newGame({ name: '測試者', race: 'human', classId: 'fighter', seed, birthplace: 'rhineburg' })
      enterLocation(state)
      expect(guildQuests(state).filter((q) => q.landmark)).toEqual([])
    }
  })
})

describe('ordinary quests that need an adult-only character', () => {
  const quest = (tags?: string[]) => sanitizeStory('o', {
    title: '屋頂', summary: '', start: { kind: 'manual' }, start_flags: ['o'], ...(tags ? { tags } : {}),
    nodes: [{ id: 'roof', title: '屋頂上的人', text: '', at: { where: 'npc', npc: 'npc_oboro' }, kind: 'story', success: { complete: true } }],
  }, false)

  it('warns that the quest gets stuck while adult content is off', () => {
    expect(storyCheck(quest()).warnings.some((w) => w.includes('屋頂上的人') && w.includes('成人向角色朧'))).toBe(true)
  })

  it('does not warn when the quest itself is adult', () => {
    expect(storyCheck(quest(['adult'])).warnings.some((w) => w.includes('成人向角色'))).toBe(false)
  })
})

describe('options that cost money', () => {
  const pay = sanitizeStory('p', {
    title: '贖身', summary: '', start: { kind: 'manual' }, start_flags: ['p'],
    nodes: [
      { id: 'ransom', title: '贖金', text: '', at: { where: 'settlement', location: 'soriel' }, kind: 'choice', options: [
        { label: '付清', success: { effects: [{ type: 'money', amount: -1500 }], complete: true } },
        { label: '離開', success: { complete: true } },
      ] },
      { id: 'tip', title: '打聽', text: '', at: { where: 'settlement', location: 'soriel' }, kind: 'check', check: { attr: 'cha', dc: 10 }, success: {}, fail: { effects: [{ type: 'money', amount: -150 }] } },
    ],
  }, false)

  it('cannot be picked without the money, and the others still can', () => {
    const state = game({ p: pay })
    startStory(state, 'p')
    state.money_cc = 1000
    const node = activeNodes(state).find((n) => n.ref === 'p:ransom')!.node
    expect(storyCosts(node, 0)).toEqual({ success: 1500, fail: 0 })
    expect(storyCostGate(state, node, 0)).toContain('1,500')
    expect(() => playNode(state, 'p:ransom', 0)).toThrow('錢不夠')
    expect(storyCostGate(state, node, 1)).toBeUndefined()
    state.money_cc = 1500
    playNode(state, 'p:ransom', 0)
    expect(state.money_cc).toBe(0)
  })

  it('blocks a check whose result costs more than you carry, and tells you before you take the quest', () => {
    const state = game({ p: pay })
    startStory(state, 'p')
    state.money_cc = 100
    expect(() => setupStoryCheck(state, 'p:tip')).toThrow('錢不夠')
    state.money_cc = 150
    expect(() => setupStoryCheck(state, 'p:tip')).not.toThrow()
    expect(storyMaxCost(pay)).toBe(1500)
  })
})

describe('characters a quest takes along', () => {
  it('warns when the same result both brings someone along and ends the quest', () => {
    const def = sanitizeStory('j', {
      title: '同行', summary: '', start: { kind: 'manual' }, start_flags: ['j'],
      nodes: [{ id: 'go', title: '走吧', text: '', at: { where: 'settlement', location: 'soriel' }, kind: 'story', success: { join: SELENE, complete: true } }],
    }, false)
    expect(storyCheck(def).warnings.some((w) => w.includes('走吧') && w.includes('正式入隊'))).toBe(true)
  })

  it('has no built-in quest that brings someone along only to drop them at the end', () => {
    expect(stories.filter((d) => storyCheck(d).warnings.some((w) => w.includes('正式入隊'))).map((d) => d.id)).toEqual([])
  })
})
