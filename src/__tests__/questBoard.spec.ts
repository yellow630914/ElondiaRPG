import { describe, expect, it } from 'vitest'
import { playerRank } from '@/engine/guild'
import { arrangeBoard, DEFAULT_BOARD_VIEW, parseBoardView, questGroup, type BoardView } from '@/engine/questBoard'
import { newGame } from '@/engine/state'
import { standOn } from '@/engine/grid'
import { canNegotiate } from '@/engine/negotiation'
import type { GameState, Quest } from '@/engine/types'

function game(): GameState {
  return newGame({ name: '測試者', race: 'human', classId: 'fighter', seed: 4, birthplace: 'soriel' })
}

let n = 0
function quest(over: Partial<Quest>): Quest {
  n += 1
  return {
    id: `q${n}`, title: `委託 ${n}`, rank: 'F', kind: 'pest', area: 'town', giver: 'soriel', target: 'soriel',
    goal: 1, progress: 0, reward_cc: 40, status: 'available', ...over,
  }
}

const view = (over: Partial<BoardView> = {}): BoardView => ({ ...DEFAULT_BOARD_VIEW, ...over })
const ids = (list: Quest[]) => list.map((q) => q.id)

describe('委託板的篩選與排序', () => {
  it('hides quests above the player rank by default, keeping them to show on demand', () => {
    const state = game()
    expect(playerRank(state)).toBe('F')
    const f = quest({ rank: 'F' })
    const e = quest({ rank: 'E' })
    const c = quest({ rank: 'C' })
    const r = arrangeBoard(state, [c, f, e], view())
    // 一個人時只能接同級或更低
    expect(ids(r.shown)).toEqual([f.id])
    expect(ids(r.hidden)).toEqual([c.id, e.id])
    // 「全部」：都列出來，沒有收起來的
    const all = arrangeBoard(state, [c, f, e], view({ onlyOpen: false }))
    expect(ids(all.shown)).toEqual([c.id, f.id, e.id])
    expect(all.hidden).toEqual([])
  })

  it('pins taken quests (exam first) on top, whatever the sort', () => {
    const state = game()
    const open = quest({ reward_cc: 900 })
    const taken = quest({ status: 'accepted', reward_cc: 10 })
    const ready = quest({ status: 'ready', reward_cc: 20 })
    // 晉升考核的階級比主角高，照樣算可以接
    const exam = quest({ rank: 'E', status: 'accepted', flags: { exam: true } })
    const r = arrangeBoard(state, [open, taken, ready, exam], view({ sort: 'reward' }))
    expect(ids(r.shown)).toEqual([exam.id, taken.id, ready.id, open.id])
    const offered = quest({ rank: 'E', flags: { exam: true } })
    expect(ids(arrangeBoard(state, [open, offered], view()).shown)).toEqual([offered.id, open.id])
  })

  it('sorts open quests by rank, reward or deadline', () => {
    const state = game()
    state.party.push({ ...state.party[0]!, id: 'buddy', isPlayer: false })
    // 組隊時可以接高一級的 E
    const low = quest({ rank: 'F', reward_cc: 50, area: 'town' })
    const high = quest({ rank: 'E', reward_cc: 30, area: 'outskirts' })
    const mid = quest({ rank: 'F', reward_cc: 70, area: 'outskirts' })
    expect(ids(arrangeBoard(state, [low, high, mid], view({ sort: 'rank' })).shown)).toEqual([high.id, low.id, mid.id])
    expect(ids(arrangeBoard(state, [low, high, mid], view({ sort: 'reward' })).shown)).toEqual([mid.id, low.id, high.id])
    // 城內的期限比近郊短
    expect(arrangeBoard(state, [high, mid, low], view({ sort: 'deadline' })).shown[0]!.id).toBe(low.id)
  })

  it('filters by area and quest type', () => {
    const state = game()
    const pest = quest({ kind: 'pest', area: 'town' })
    const gather = quest({ kind: 'gather_wild', area: 'outskirts' })
    const errand = quest({ kind: 'delivery', area: 'town' })
    expect(questGroup('drop_boss')).toBe('material')
    expect(questGroup('boss_hunt')).toBe('fight')
    expect(ids(arrangeBoard(state, [pest, gather, errand], view({ area: 'town' })).shown)).toEqual([pest.id, errand.id])
    expect(ids(arrangeBoard(state, [pest, gather, errand], view({ group: 'material' })).shown)).toEqual([gather.id])
    expect(arrangeBoard(state, [pest, gather, errand], view({ area: 'outskirts', group: 'errand' })).shown).toEqual([])
  })

  it('reads the saved choice defensively', () => {
    expect(parseBoardView(null)).toEqual(DEFAULT_BOARD_VIEW)
    expect(parseBoardView({ onlyOpen: false, area: 'dungeon', group: 'fight', sort: 'deadline' }))
      .toEqual({ onlyOpen: false, area: 'dungeon', group: 'fight', sort: 'deadline' })
    expect(parseBoardView({ onlyOpen: 'yes', area: 'moon', group: 'x', sort: 'price' })).toEqual(DEFAULT_BOARD_VIEW)
    // 物件原型上的名字不算合法的選項
    expect(parseBoardView({ group: 'toString', sort: '__proto__' })).toEqual(DEFAULT_BOARD_VIEW)
    expect(parseBoardView({ group: 'constructor', sort: 'hasOwnProperty' })).toEqual(DEFAULT_BOARD_VIEW)
  })

  it('does not let the player negotiate a quest above their rank', () => {
    const state = game()
    standOn(state, 'guild')
    const high = quest({ rank: 'A' })
    const low = quest({ rank: 'F' })
    state.quests.push(high, low)
    expect(canNegotiate(state, 'quest_reward', { quest: high.id })).toMatch(/階級不足/)
    expect(canNegotiate(state, 'quest_reward', { quest: low.id })).toBeNull()
  })
})
