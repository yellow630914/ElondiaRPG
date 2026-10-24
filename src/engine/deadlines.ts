// 委託與特殊任務的期限（docs/GUILD.md、docs/STORY_QUESTS.md）。
// - 一般委託：接下時依地點決定期限（town_quests.json 的 deadline_days）；過了還沒完成目標就逾期失敗，公會聲望 -1。
//   目標達成（ready，只差回去交付）之後不會逾期；以前的存檔接下的委託沒有期限。
// - 特殊任務：time_limit 天內要完成，從開始算；過了就失敗（任務同行的夥伴離隊）。
// 每次動作之後檢查（store 的 run），戰鬥中不檢查。

import { locationById, questDeadlineRules } from './data'
import { dropExam } from './guild'
import { addHours, commitReport } from './state'
import { expireStory, storyDef } from './story'
import { baseReport } from './town'
import type { GameState, GameTime, Quest, Report } from './types'
import { shortestPath } from './world'
import { gameRule } from './gameRules'

const hoursOf = (t: GameTime) => t.day * 24 + (t.hour ?? 0) + (t.minute ?? 0) / 60

/** 這件委託有幾天可以完成（沒有設定、或存檔規則設成不限時 undefined） */
export function questDeadlineDays(quest: Pick<Quest, 'area' | 'giver' | 'target'>, state?: Pick<GameState, 'options'> | null): number | undefined {
  const r = questDeadlineRules
  const mult = gameRule(state, 'deadlineMult')
  if (!r || mult <= 0) return undefined
  const scaled = (d: number) => Math.max(1, Math.round(d * mult))
  if (quest.area === 'town') return scaled(r.town)
  if (quest.area === 'outskirts') return scaled(r.outskirts)
  const path = shortestPath(quest.giver, quest.target)
  const travel = path ? Math.ceil(path.days[1]) : 0
  return scaled(Math.min(r.max, r.dungeon + r.per_travel_day * travel))
}

/** 接下委託時記下期限 */
export function setQuestDeadline(state: GameState, quest: Quest) {
  const days = questDeadlineDays(quest, state)
  if (days !== undefined) quest.deadline = addHours(state.time, days * 24)
}

/** 特殊任務的期限（開始的時間＋time_limit 天） */
export function storyDeadline(state: GameState, id: string): GameTime | undefined {
  const p = state.stories?.[id]
  const days = storyDef(id)?.time_limit
  return p && days ? addHours(p.started, days * 24) : undefined
}

/** 離期限還有幾小時（負數是已經過了） */
export function hoursLeft(state: GameState, deadline: GameTime): number {
  return hoursOf(deadline) - hoursOf(state.time)
}

/** 給畫面：「剩 3 天」「剩 5 小時」「已逾期」 */
export function deadlineText(state: GameState, deadline: GameTime | undefined): string {
  if (!deadline) return ''
  const h = hoursLeft(state, deadline)
  if (h <= 0) return '已逾期'
  return h >= 24 ? `剩 ${Math.floor(h / 24)} 天` : `剩 ${Math.ceil(h)} 小時`
}

/** 檢查期限：逾期的委託拿掉（一份報告），逾期的特殊任務失敗（各一份報告）。回傳產生的報告 */
export function expireDeadlines(state: GameState): Report[] {
  if (state.combat) return []
  const out: Report[] = []
  const late = state.quests.filter((q) => q.status === 'accepted' && q.deadline && hoursLeft(state, q.deadline) <= 0)
  if (late.length) {
    state.quests = state.quests.filter((q) => !late.includes(q))
    for (const q of late) dropExam(state, q.id)
    const report = baseReport(state, 'quest', 0)
    report.location.scene = `${locationById(state.location).name}`
    report.quest = { id: late[0]!.id, title: late[0]!.title, rank: late[0]!.rank, status: 'expired' }
    report.outcome = {
      result: 'failure',
      summary: `委託${late.map((q) => `「${q.title}」`).join('、')}過了期限，算是失敗了，公會對你的評價下降。`,
      tags: ['委託逾期'],
    }
    report.changes.reputation = [{ faction: 'guild', delta: -late.length }]
    report.narration = { length: 'short' }
    report.lore_keys!.push('冒險者公會')
    out.push(commitReport(state, report))
  }
  for (const [id, p] of Object.entries(state.stories ?? {})) {
    if (p.status !== 'active') continue
    const d = storyDeadline(state, id)
    if (d && hoursLeft(state, d) <= 0) out.push(expireStory(state, id))
  }
  return out
}
