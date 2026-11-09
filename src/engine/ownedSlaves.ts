// 主角擁有的奴隸（工具列「奴隸」，OwnedSlavesDialog.vue）：隊伍裡的，與留在自己的房子裡的。
import { awayCompanions, awayLabel } from './away'
import { pcOf } from './party'
import { contractOf } from './tattoos'
import type { Character, GameState } from './types'

export interface OwnedSlave {
  member: Character
  /** 在隊伍裡（可以調教、派去工作、送回家） */
  inParty: boolean
  /** 不在隊伍裡時在哪裡（例如「索里耶爾的房子」） */
  where?: string
}

/** 這個人是主角的奴隸 */
export function isOwnSlave(state: GameState, m: Character | undefined): boolean {
  return !!m && m.bond === 'slave' && !m.isPlayer && contractOf(m)?.master === pcOf(state).id
}

/** 主角擁有的奴隸：隊伍裡的在前，留在房子裡的在後 */
export function ownedSlaves(state: GameState): OwnedSlave[] {
  const out: OwnedSlave[] = state.party.filter((m) => isOwnSlave(state, m)).map((m) => ({ member: m, inParty: true }))
  for (const a of awayCompanions(state)) {
    if (isOwnSlave(state, a.character)) out.push({ member: a.character, inParty: false, where: awayLabel(a.place) })
  }
  return out
}
