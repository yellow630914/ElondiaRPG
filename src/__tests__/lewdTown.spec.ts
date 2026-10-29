import { describe, expect, it } from 'vitest'
import { charmLevel } from '@/engine/charm'
import { setContentFilters } from '@/engine/content'
import { enterLocation, getArea, standOn, currentArea } from '@/engine/grid'
import { addLewd, lewdOf } from '@/engine/lewd'
import { pcOf } from '@/engine/party'
import { longRest, slaveRoomCost, slaveRoomOpen, innCost } from '@/engine/rest'
import { newGame } from '@/engine/state'
import { guildQuests } from '@/engine/town'
import { townCandidates } from '@/engine/townEvents'
import { shopState } from '@/engine/trade'
import type { GameState } from '@/engine/types'

function game(location: string): GameState {
  const state = newGame({ name: '莉雅', race: 'human', classId: 'bard', seed: 5, birthplace: location })
  enterLocation(state)
  state.money_cc = 100000
  return state
}

const sells = (state: GameState, name: string) => shopState(state, 'general').deals.some((d) => d.gets.some((g) => g.type === 'item' && g.name === name))

describe('魅氣濃的城鎮', () => {
  it('淫市的貨只在魅氣濃度 3 以上的城鎮賣', () => {
    expect(charmLevel('albena')).toBeGreaterThanOrEqual(3)
    expect(sells(game('albena'), '媚香蠟燭')).toBe(true)
    expect(charmLevel('rhineburg')).toBeLessThan(3)
    expect(sells(game('rhineburg'), '媚香蠟燭')).toBe(false)
  })

  it('旅店的奴房：便宜，全隊長休，主角順從上升、醒來虛脫', () => {
    const state = game('albena')
    expect(slaveRoomOpen(state)).toBe(true)
    expect(slaveRoomCost(state)).toBeLessThan(innCost(state))
    expect(standOn(state, 'inn')).toBe(true)
    const pc = pcOf(state)
    pc.hp = 1
    const before = lewdOf(pc).submission
    const r = longRest(state, 'slave_room')
    expect(pc.hp).toBe(pc.maxHp)
    expect(lewdOf(pc).submission).toBe(before + 1)
    expect(pc.status).toContain('drained')
    expect(r.outcome.tags).toContain('奴房')
    expect(r.narration?.adult_scene).toBeTruthy()
    expect(slaveRoomOpen(game('rhineburg'))).toBe(false)
    setContentFilters({ pc_unwilling: false })
    try {
      expect(slaveRoomOpen(state)).toBe(false)
    } finally {
      setContentFilters({ pc_unwilling: true })
    }
  })

  it('曝露名聲高時，城鎮多了認出你的人', () => {
    const state = game('albena')
    const area = currentArea(state)
    const ids = () => townCandidates(state, getArea(state, area.key), 'tavern').map((t) => t.id)
    expect(ids()).not.toContain('town_fan')
    addLewd(state, pcOf(state), 'exposure', 50)
    expect(ids()).toContain('town_fan')
  })

  it('淫亂夠高才接得到酒館舞孃的代班', () => {
    const low = game('albena')
    expect(guildQuests(low).some((q) => q.template === 'dancer_standin')).toBe(false)
    let found = false
    for (let seed = 1; seed <= 12 && !found; seed++) {
      const state = newGame({ name: '莉雅', race: 'human', classId: 'bard', seed, birthplace: 'albena' })
      enterLocation(state)
      pcOf(state).lewd = { ...lewdOf(pcOf(state)), lewdness: 60 }
      found = guildQuests(state).some((q) => q.template === 'dancer_standin')
    }
    expect(found).toBe(true)
  })
})
