// 回退（日誌上的「↶ 回退」）：撤銷最近幾輪，回到那一則日誌產生之前。
//
// - 每次動作前 game.ts 的 run() 本來就會留一份狀態（動作中途出錯時還原用），回退只是把其中幾份留下來，
//   不另外複製、也不寫進存檔：重新整理頁面、讀檔、回到首頁之後就不能回退了。
// - 「一輪」以日誌為單位：一次動作產生了新的日誌，就記下這一輪開始前的狀態，最多 UNDO_STEPS 份。
//   一輪從「平靜」的狀態開始：戰鬥中的每一回合、擲完骰等待判定的行動都算在開打、擲骰那一輪裡，
//   所以回退一場戰鬥會回到開打之前，回退主動行動會回到擲骰之前（可以用同樣的行動重擲）。
// - 允許刷判定：回退時換一個亂數種子，同樣的行動會擲出不同的骰子。

import type { ActionInput } from '@/engine/actions'
import type { GameState } from '@/engine/types'

/** 最多回退幾輪 */
export const UNDO_STEPS = 5

export interface UndoStep {
  /** 這一輪開始前的狀態 */
  state: GameState
  /** 這一輪的第一則日誌 */
  report: string
  /** 這一輪是主動行動：回退後可以用同樣的行動重擲 */
  redo?: ActionInput
}

/** 正在進行中的一輪（戰鬥、等待判定的行動）：這時的動作不算新的一輪的開始 */
export function midTurn(s: Pick<GameState, 'combat' | 'pendingAction'>): boolean {
  return !!s.combat || !!s.pendingAction
}

/** 等待判定的行動原本的輸入（重擲用） */
export function actionInputOf(p: NonNullable<GameState['pendingAction']>): ActionInput {
  const { kind, text, target, with: withIds, offer_cc, use, item } = p
  return {
    kind, text,
    ...(target !== undefined ? { target } : {}),
    ...(withIds?.length ? { with: [...withIds] } : {}),
    ...(offer_cc !== undefined ? { offer_cc } : {}),
    ...(use ? { use: { ...use } } : {}),
    ...(item !== undefined ? { item } : {}),
  }
}

/** 這次動作新增的第一則日誌（沒有新的日誌時 undefined）；lastBefore 是動作前最後一則日誌 */
export function firstNewReport(s: Pick<GameState, 'reports'>, lastBefore: string | undefined): string | undefined {
  const reports = s.reports
  if (!reports.length || reports.at(-1)!.report_id === lastBefore) return undefined
  let i = reports.length - 1
  while (i > 0 && reports[i - 1]!.report_id !== lastBefore) i--
  return reports[i]!.report_id
}

/**
 * 回退到 saved：在那之後才封存的舊日誌照樣封存（日誌的敘事封存時已經搬走了），
 * 並換一個亂數種子（同樣的行動會擲出不同的結果）。回傳還原後的狀態與被撤銷的日誌 id
 */
export function restoreTurn(current: GameState, saved: GameState, seed = randomSeed()): { state: GameState; removed: string[] } {
  const state = saved
  const archived = current.logArchive ?? []
  if (archived.length > (saved.logArchive?.length ?? 0)) {
    const ids = new Set(archived.map((e) => e.id))
    state.reports = saved.reports.filter((r) => !ids.has(r.report_id))
    state.logArchive = [...archived]
  }
  state.rngState = seed
  const kept = new Set(state.reports.map((r) => r.report_id))
  return { state, removed: current.reports.map((r) => r.report_id).filter((id) => !kept.has(id)) }
}

/** 回退前的確認文字 */
export function undoConfirmText(steps: number): string {
  return `回退 ${steps} 步：回到${steps > 1 ? '這幾輪' : '這一輪'}之前，之後的日誌與 AI 寫的經過會一起刪掉（已經用掉的 token 不會退回）。回退之後再做同樣的行動，骰子會重擲。確定嗎？`
}

function randomSeed(): number {
  return Math.floor(Math.random() * 0x100000000) | 0
}
