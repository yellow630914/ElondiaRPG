import { describe, expect, it } from 'vitest'
import { prepareAction, resolveAction } from '@/engine/actions'
import { proposeDc, underworldProposalBlocked } from '@/engine/companions'
import { currentArea, enterLocation, standOn } from '@/engine/grid'
import { isBound } from '@/engine/party'
import { masterCandidates, startAsSlave } from '@/engine/slavery'
import { newGame } from '@/engine/state'
import type { GameState } from '@/engine/types'
import { enterUnderworld, underworldEntryBlocked, underworldEscorted, underworldKnown } from '@/engine/underworld'

// 被主人帶著時向主人提議去地下街（docs/COMPANIONS.md、SPECIAL_MAPS.md 第 9 節）
function slaveAt(location: string): GameState {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 3, birthplace: location })
  enterLocation(state)
  const [rec] = masterCandidates(location, 3)
  startAsSlave(state, { master: { type: 'candidate', rec: rec! }, mark: 'labor' })
  standOn(state, 'tavern')
  return state
}

function propose(state: GameState, natural: number) {
  prepareAction(state, { kind: 'propose', target: 'underworld', text: '' })
  state.pendingAction!.natural = natural
  return resolveAction(state, null)
}

describe('proposing the underworld to the master', () => {
  it('cannot enter the underworld before the master agrees', () => {
    const state = slaveAt('albena')
    expect(isBound(state)).toBe(true)
    expect(underworldEntryBlocked(state)).toContain('向主人提議')
    expect(underworldProposalBlocked(state)).toBeUndefined()
    expect(proposeDc(state, { kind: 'underworld' })).toBeGreaterThan(0)
  })

  it('on success the master takes you in today and you learn the entrance', () => {
    const state = slaveAt('albena')
    propose(state, 20)
    expect(underworldEscorted(state)).toBe(true)
    expect(underworldKnown(state)).toBe(true)
    expect(underworldEntryBlocked(state)).toBeUndefined()
    enterUnderworld(state)
    expect(currentArea(state).key).toContain('sm/')
    // 第二天要再提一次
    const back = slaveAt('albena')
    propose(back, 20)
    back.time.day += 1
    expect(underworldEscorted(back)).toBe(false)
    expect(underworldEntryBlocked(back)).toContain('向主人提議')
  })

  it('on a failure the master refuses for the rest of the day', () => {
    const state = slaveAt('albena')
    propose(state, 1)
    expect(underworldEscorted(state)).toBe(false)
    expect(underworldProposalBlocked(state)).toContain('今天不想再聽')
    expect(() => prepareAction(state, { kind: 'propose', target: 'underworld', text: '' })).toThrow()
  })

  it('needs a town with an underworld and the tavern', () => {
    const state = slaveAt('rivervale')
    expect(underworldProposalBlocked(state)).toBe('這座城沒有地下街')
    const away = slaveAt('albena')
    standOn(away, 'guild')
    expect(underworldProposalBlocked(away)).toContain('酒館')
  })
})
