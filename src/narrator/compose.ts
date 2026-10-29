// 依玩家的提示詞設定組出實際送出的提示詞（遊戲與「提示詞」頁籤的預覽共用）。

import type { ActionPending } from '@/engine/actions'
import { lewdSummary } from '@/engine/lewd'
import { charmNote } from '@/engine/charm'
import { protagonistText } from '@/engine/character'
import { locationById } from '@/engine/data'
import * as social from '@/engine/social'
import type { GameState, Report } from '@/engine/types'
import { actionLoreText, buildActionPrompt, partyLewd } from './judge'
import { loreForReport, pickLore, type LoreItem, type LoreSelection } from './lore'
import { adultSceneOf, buildPrompt, type Prompt } from './prompt'
import { activeEntries, type PromptConfig, type PromptTarget } from './promptConfig'
import { toOutputScript } from './script'

export interface ComposeOptions {
  config: PromptConfig
  /** 套用覆寫後的世界書條目（loreItems） */
  lore: LoreItem[]
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

/** 判定請求的人際關係與記憶：隊伍全員，加上行動的對象（多個對象時每一位） */
export function judgeContext(state: GameState, p: ActionPending): string {
  const participants = ['pc', ...state.party.filter((m) => !m.isPlayer).map((m) => m.id)]
  const target = p.target?.includes(':') ? p.target.split(':')[1] : p.target
  for (const id of [target, ...(p.with ?? [])]) if (id && state.relationships?.[id] && !participants.includes(id)) participants.push(id)
  return social.formatContext(state, social.selectContext(state, { participants, location: state.location }))
}

/** 這則日誌的敘事屬於哪一種：帶親密場景是「成人場景」 */
export function narrationTarget(report: Report): Extract<PromptTarget, 'narration' | 'adult'> {
  return adultSceneOf(report) ? 'adult' : 'narration'
}

export function composeNarration(state: GameState | null, report: Report, o: ComposeOptions): Composed {
  const name = playerName(state)
  // 分流：帶親密場景的日誌才送成人向的條目（世界書、文風、其他提示詞）
  const adult = !!adultSceneOf(report)
  const lore = loreForReport(o.lore, report, { adult, budgetChars: o.budgetChars, playerName: name })
  // 成人場景：主角與隊友的慾望指標（分段的文字）
  const protagonist = protagonistOf(state) + (adult && state ? `\n慾望指標：${lewdSummary(state, state.party.find((m) => m.isPlayer)!)}${partyLewd(state, false)}\n${charmNote(state)}` : '')
  const context = narrationContext(state, report)
  // 成人場景的敘事用套用到「成人場景」的條目
  const target = narrationTarget(report)
  const prompt = buildPrompt(report, lore, {
    playerName: name,
    language: o.language,
    ...(protagonist ? { protagonist } : {}),
    ...(context ? { context } : {}),
    styles: activeEntries(o.config.styles, target, name, { adult }),
    instructions: activeEntries(o.config.custom, target, name, { position: 'system', adult }),
    endNotes: activeEntries(o.config.custom, target, name, { position: 'end', adult }),
    ...(o.config.narrationRules ? { rules: o.config.narrationRules } : {}),
    ...(o.config.defeatRules ? { defeatRules: o.config.defeatRules } : {}),
    ...(o.config.sceneRules ? { sceneRules: o.config.sceneRules } : {}),
  })
  return { prompt: toOutputScript(prompt, o.language), lore }
}

export function composeJudge(state: GameState, p: ActionPending, o: ComposeOptions): Composed {
  const name = playerName(state)
  // 分流：行動可能進入親密場景（娼館、主人的要求、戰敗事件……）時才送成人向的條目
  const adult = !!p.adultScene
  const lore = o.config.loreInJudge
    ? pickLore(o.lore, { text: actionLoreText(state, p), travel: false }, { adult, budgetChars: o.budgetChars, playerName: name })
    : undefined
  const prompt = buildActionPrompt(state, p, judgeContext(state, p), {
    language: o.language,
    narrative: !o.splitNarrative,
    styles: activeEntries(o.config.styles, 'judge', name, { adult }),
    instructions: activeEntries(o.config.custom, 'judge', name, { position: 'system', adult }),
    endNotes: activeEntries(o.config.custom, 'judge', name, { position: 'end', adult }),
    ...(o.config.defeatRules ? { defeatRules: o.config.defeatRules } : {}),
    ...(o.config.sceneRules ? { sceneRules: o.config.sceneRules } : {}),
    ...(lore ? { lore } : {}),
  })
  return { prompt: toOutputScript(prompt, o.language), ...(lore ? { lore } : {}) }
}
