// 依玩家的提示詞設定組出實際送出的提示詞（遊戲與「提示詞」頁籤的預覽共用）。

import type { ActionPending } from '@/engine/actions'
import { protagonistText } from '@/engine/character'
import { locationById } from '@/engine/data'
import * as social from '@/engine/social'
import type { GameState, Report } from '@/engine/types'
import { actionLoreText, buildActionPrompt } from './judge'
import { loreForReport, pickLore, type LoreItem, type LoreSelection } from './lore'
import { buildPrompt, type Prompt } from './prompt'
import { activeEntries, type PromptConfig } from './promptConfig'

export interface ComposeOptions {
  config: PromptConfig
  /** 套用覆寫後的世界書條目（loreItems） */
  lore: LoreItem[]
  adult: boolean
  budgetChars: number
  language: 'zh-Hant' | 'zh-Hans'
  /** 判定與正文用不同的模型：判定不寫經過 */
  splitNarrative?: boolean
}

export interface Composed {
  prompt: Prompt
  /** 沒帶世界書時為 undefined */
  lore?: LoreSelection
}

function playerName(state: GameState | null): string {
  return state?.party.find((m) => m.isPlayer)?.name ?? '你'
}

export function protagonistOf(state: GameState | null): string {
  const me = state?.party.find((m) => m.isPlayer)
  return me ? protagonistText(me, me.birthplace ? locationById(me.birthplace).name : undefined) : ''
}

/** 敘事請求的人際關係與記憶 */
export function narrationContext(state: GameState | null, report: Report): string {
  return state ? social.formatContext(state, social.selectContext(state, social.queryForReport(state, report))) : ''
}

/** 判定請求的人際關係與記憶：隊伍全員，加上行動對象 */
export function judgeContext(state: GameState, p: ActionPending): string {
  const participants = ['pc', ...state.party.filter((m) => !m.isPlayer).map((m) => m.id)]
  const target = p.target?.includes(':') ? p.target.split(':')[1] : p.target
  if (target && state.relationships?.[target] && !participants.includes(target)) participants.push(target)
  return social.formatContext(state, social.selectContext(state, { participants, location: state.location }))
}

export function composeNarration(state: GameState | null, report: Report, o: ComposeOptions): Composed {
  const name = playerName(state)
  const lore = loreForReport(o.lore, report, { adult: o.adult, budgetChars: o.budgetChars, playerName: name })
  const protagonist = protagonistOf(state)
  const context = narrationContext(state, report)
  const prompt = buildPrompt(report, lore, {
    playerName: name,
    language: o.language,
    ...(protagonist ? { protagonist } : {}),
    ...(context ? { context } : {}),
    styles: activeEntries(o.config.styles, 'narration', name),
    instructions: activeEntries(o.config.custom, 'narration', name, 'system'),
    endNotes: activeEntries(o.config.custom, 'narration', name, 'end'),
  })
  return { prompt, lore }
}

export function composeJudge(state: GameState, p: ActionPending, o: ComposeOptions): Composed {
  const name = playerName(state)
  const lore = o.config.loreInJudge
    ? pickLore(o.lore, { text: actionLoreText(state, p), travel: false }, { adult: o.adult, budgetChars: o.budgetChars, playerName: name })
    : undefined
  const prompt = buildActionPrompt(state, p, judgeContext(state, p), {
    language: o.language,
    narrative: !o.splitNarrative,
    styles: activeEntries(o.config.styles, 'judge', name),
    instructions: activeEntries(o.config.custom, 'judge', name, 'system'),
    endNotes: activeEntries(o.config.custom, 'judge', name, 'end'),
    ...(lore ? { lore } : {}),
  })
  return { prompt, ...(lore ? { lore } : {}) }
}
