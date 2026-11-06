// 委託板的篩選與排序（畫面在 PlacePanel.vue 的委託板對話框，見 docs/GUILD.md 第 0 節）。
// 只決定顯示哪些、照什麼順序，不改委託本身。

import { questDeadlineDays } from './deadlines'
import { isExam } from './guild'
import { RANK_ORDER } from './materialQuests'
import { canAcceptRank } from './town'
import type { GameState, Quest, QuestKind } from './types'

export type QuestGroup = 'fight' | 'material' | 'errand'

/** 委託類型分成三組（篩選用） */
export const QUEST_GROUP_NAME: Record<QuestGroup, string> = { fight: '討伐', material: '採集與材料', errand: '差事' }

const GROUP_OF: Record<QuestKind, QuestGroup> = {
  clear_dungeon: 'fight', pest: 'fight', hunt: 'fight', boss_hunt: 'fight',
  gather: 'material', gather_wild: 'material', gather_dungeon: 'material', drop_wild: 'material', drop_dungeon: 'material', drop_boss: 'material',
  search: 'errand', patrol: 'errand', delivery: 'errand',
}

export function questGroup(kind: QuestKind): QuestGroup {
  return GROUP_OF[kind] ?? 'errand'
}

export type BoardSort = 'board' | 'rank' | 'reward' | 'deadline'
export const BOARD_SORT_NAME: Record<BoardSort, string> = { board: '公會的順序', rank: '階級高的先', reward: '報酬高的先', deadline: '期限短的先' }

export interface BoardView {
  /** 只看可以接的（可接、已接、可交付、晉升考核）；false＝全部 */
  onlyOpen: boolean
  area: Quest['area'] | ''
  group: QuestGroup | ''
  sort: BoardSort
}

export const DEFAULT_BOARD_VIEW: BoardView = { onlyOpen: true, area: '', group: '', sort: 'board' }

/** 這個主角接不了的委託（階級不足）：還沒接、不是晉升考核、階級太高 */
export function rankTooLow(state: GameState, q: Quest): boolean {
  return q.status === 'available' && !canAcceptRank(state, q.rank, q)
}

/**
 * 依篩選與排序整理委託板：
 * - shown：要列出來的。已接、可交付的固定在最上面（晉升考核再排在最前），其餘照選的排序。
 * - hidden：「只看可以接的」時收起來的階級不足委託（同樣照篩選與排序），玩家點了才展開。
 */
export function arrangeBoard(state: GameState, quests: Quest[], view: BoardView): { shown: Quest[]; hidden: Quest[] } {
  const matched = quests.filter((q) => (!view.area || q.area === view.area) && (!view.group || questGroup(q.kind) === view.group))
  const taken = matched.filter((q) => q.status !== 'available')
  const open = sortQuests(state, matched.filter((q) => q.status === 'available'), view.sort)
  const pinned = [...taken.filter(isExam), ...taken.filter((q) => !isExam(q))]
  if (!view.onlyOpen) return { shown: [...pinned, ...open], hidden: [] }
  return { shown: [...pinned, ...open.filter((q) => !rankTooLow(state, q))], hidden: open.filter((q) => rankTooLow(state, q)) }
}

function sortQuests(state: GameState, list: Quest[], sort: BoardSort): Quest[] {
  // 晉升考核在「公會的順序」裡維持最前面（和 examsFirst 一樣）；其他排序照數值排
  if (sort === 'board') return [...list.filter(isExam), ...list.filter((q) => !isExam(q))]
  const key = (q: Quest): number => {
    if (sort === 'rank') return -RANK_ORDER.indexOf(q.rank)
    if (sort === 'reward') return -q.reward_cc
    return questDeadlineDays(q, state) ?? Number.POSITIVE_INFINITY
  }
  // 同分照原本的順序（Array.prototype.sort 是穩定排序）
  return [...list].sort((a, b) => key(a) - key(b))
}

/** 篩選與排序存在瀏覽器裡；讀到壞掉或舊的值時照預設 */
export function parseBoardView(raw: unknown): BoardView {
  const v = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof BoardView, unknown>>
  return {
    onlyOpen: typeof v.onlyOpen === 'boolean' ? v.onlyOpen : DEFAULT_BOARD_VIEW.onlyOpen,
    area: v.area === 'town' || v.area === 'outskirts' || v.area === 'dungeon' ? v.area : '',
    group: typeof v.group === 'string' && v.group in QUEST_GROUP_NAME ? v.group as QuestGroup : '',
    sort: typeof v.sort === 'string' && v.sort in BOARD_SORT_NAME ? v.sort as BoardSort : DEFAULT_BOARD_VIEW.sort,
  }
}
