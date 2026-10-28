import { finishCombat } from '@/engine/combat'
import { afterCombat, move } from '@/engine/grid'
import { answerRoadEvent, finishJourney, leaveSide, startJourney } from '@/engine/road'
import type { GameState, Report } from '@/engine/types'

/** 直接抵達：出發（含城門盤查）後馬上結束旅途，不走路、不觸發沿途事件。被城門擋下時回傳盤查的紀錄。 */
export function arriveAt(state: GameState, destination: string): Report {
  return startJourney(state, destination) ?? finishJourney(state)
}

/** 一路走到目的地：戰鬥直接獲勝，事件選第一個選項，臨時地圖馬上離開 */
export function walkTo(state: GameState, destination: string): Report {
  const blocked = startJourney(state, destination)
  if (blocked) return blocked
  for (let i = 0; i < 200; i++) {
    if (state.roadEvent) {
      answerRoadEvent(state, 0)
      if (state.side) leaveSide(state)
      continue
    }
    if (state.pendingMasterEvent) delete state.pendingMasterEvent
    const r = move(state, 1, 0)
    if (r.combat) {
      for (const c of state.combat!.combatants) if (c.side === 'enemy') c.hp = 0
      state.combat!.status = 'victory'
      afterCombat(state, finishCombat(state))
      continue
    }
    if (r.report?.kind === 'travel') return r.report
  }
  throw new Error('never arrived')
}
