import { describe, expect, it } from 'vitest'
import { prepareAction, resolveAction } from '@/engine/actions'
import { awayCompanions, lodgersHere, takeLodger } from '@/engine/away'
import { marketStock, tavernCandidates } from '@/engine/companions'
import { enterLocation } from '@/engine/grid'
import { residents } from '@/engine/homes'
import { currentMasterHome, syncMasterHome } from '@/engine/masterHome'
import { rosterBlocked, rosterDc, rosterWaiting } from '@/engine/masterRoster'
import { freePlayer, leaderOf, playerEscapes } from '@/engine/party'
import { masterCandidates, startAsSlave } from '@/engine/slavery'
import { newGame } from '@/engine/state'
import type { GameState } from '@/engine/types'

function slave(): GameState {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 3, birthplace: 'rhineburg' })
  enterLocation(state)
  const [rec] = masterCandidates('rhineburg', 3)
  startAsSlave(state, { master: { type: 'candidate', rec: rec! }, mark: 'labor' })
  return state
}

function act(state: GameState, target: string, natural: number) {
  prepareAction(state, { kind: 'propose', target, text: '' })
  state.pendingAction!.natural = natural
  return resolveAction(state, null)
}

/** 主人雇來一位冒險者、買下一名奴隸 */
function withMembers(): { state: GameState; hired: string; bought: string } {
  const state = slave()
  const hired = tavernCandidates(state)[0]!.npc
  act(state, `hire:${hired}`, 20)
  const bought = marketStock(state, 'public')[0]!.npc
  act(state, `buy:public:${bought}`, 20)
  expect(state.party.some((m) => m.id === hired)).toBe(true)
  expect(state.party.some((m) => m.id === bought)).toBe(true)
  return { state, hired, bought }
}

describe('asking the master to rearrange the party', () => {
  it('only offers what fits: hired members can leave or wait at the tavern, the master’s slaves only stay at home', () => {
    const { state, hired, bought } = withMembers()
    const master = leaderOf(state)!
    expect(rosterBlocked(state, 'dismiss', hired)).toBeUndefined()
    expect(rosterBlocked(state, 'lodge', hired)).toBeUndefined()
    expect(rosterBlocked(state, 'home', hired)).toMatch(/奴隸/)
    expect(rosterBlocked(state, 'dismiss', bought)).toMatch(/奴隸/)
    expect(rosterBlocked(state, 'lodge', bought)).toMatch(/奴隸/)
    expect(rosterBlocked(state, 'dismiss', master.id)).toBeTruthy()
    expect(rosterDc(state, 'dismiss')).toBeGreaterThan(0)
  })

  it('dismisses a hired member on a success and remembers a refusal for the day', () => {
    const { state, hired } = withMembers()
    act(state, `dismiss:${hired}`, 1)
    expect(state.party.some((m) => m.id === hired)).toBe(true)
    expect(rosterBlocked(state, 'dismiss', hired)).toMatch(/今天/)
    state.time.day++
    act(state, `dismiss:${hired}`, 20)
    expect(state.party.some((m) => m.id === hired)).toBe(false)
    expect(state.npcs![hired]!.character?.group).toBeUndefined()
  })

  it('leaves a hired member at the tavern and brings them back by asking again', () => {
    const { state, hired } = withMembers()
    act(state, `lodge:${hired}`, 20)
    expect(state.party.some((m) => m.id === hired)).toBe(false)
    expect(rosterWaiting(state).map((w) => [w.rec.id, w.place])).toEqual([[hired, 'tavern']])
    // 不是主角自己寄放的：不在「寄放夥伴」裡，也不能自己帶走
    expect(lodgersHere(state).some((m) => m.id === hired)).toBe(false)
    expect(() => takeLodger(state, hired)).toThrow(/主人/)
    act(state, `take:${hired}`, 20)
    const back = state.party.find((m) => m.id === hired)!
    expect(back.group).toBe(leaderOf(state)!.id)
    expect(rosterWaiting(state)).toEqual([])
  })

  it('leaves the master’s slave at the master’s home in that city', () => {
    const { state, bought } = withMembers()
    const home = syncMasterHome(state) ?? currentMasterHome(state)
    expect(home).toBeTruthy()
    state.location = home!.location
    act(state, `home:${bought}`, 20)
    expect(state.party.some((m) => m.id === bought)).toBe(false)
    expect(residents(state, home!.id).map((m) => m.id)).toEqual([bought])
    expect(rosterWaiting(state).map((w) => w.place)).toEqual(['home'])
    act(state, `take:${bought}`, 20)
    expect(state.party.some((m) => m.id === bought)).toBe(true)
  })

  it('turns a partial dismissal into waiting at the tavern', () => {
    const { state, hired } = withMembers()
    const dc = rosterDc(state, 'dismiss')
    prepareAction(state, { kind: 'propose', target: `dismiss:${hired}`, text: '' })
    const p = state.pendingAction!
    const mod = p.modifiers.cha + p.situational.reduce((s, x) => s + x.value, 0)
    p.natural = Math.max(2, Math.min(19, dc - 2 - mod))
    const r = resolveAction(state, null)
    expect(r.check?.degree).toBe('partial')
    expect(rosterWaiting(state).map((w) => w.rec.id)).toEqual([hired])
  })

  it('stops waiting for the master once the slave escapes', () => {
    const { state, hired } = withMembers()
    act(state, `lodge:${hired}`, 20)
    playerEscapes(state)
    const rec = state.npcs![hired]!
    expect(rec.staying).toBeUndefined()
    expect(rec.character?.group).toBeUndefined()
  })
})

describe('waiting members after the slave is freed', () => {
  it('stops waiting once the slave is freed, even though the master still leads', () => {
    const { state, hired, bought } = withMembers()
    act(state, `lodge:${hired}`, 20)
    const home = currentMasterHome(state)!
    state.location = home.location
    act(state, `home:${bought}`, 20)
    freePlayer(state)
    expect(leaderOf(state)).toBeTruthy()
    for (const id of [hired, bought]) {
      expect(state.npcs![id]!.staying).toBeUndefined()
      expect(state.npcs![id]!.character?.group).toBeUndefined()
    }
    expect(awayCompanions(state)).toEqual([])
  })

  it('marks members the master left behind in the away list, at the tavern and at the master’s home', () => {
    const { state, hired, bought } = withMembers()
    act(state, `lodge:${hired}`, 20)
    state.location = currentMasterHome(state)!.location
    act(state, `home:${bought}`, 20)
    const master = leaderOf(state)!.id
    const away = awayCompanions(state)
    expect(away.map((a) => [a.id, a.place.kind, a.master]).sort()).toEqual([[bought, 'home', master], [hired, 'tavern', master]].sort())
  })
})
