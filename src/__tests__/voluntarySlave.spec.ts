// 自願為奴（docs/COMPANIONS.md 2.3.1 節；engine/voluntarySlave.ts）
import { describe, expect, it } from 'vitest'
import { bondOf } from '@/engine/bondStyle'
import { slaveryRules } from '@/engine/data'
import { enterLocation, standOn } from '@/engine/grid'
import { generateNpc, registerNpc } from '@/engine/npcs'
import { joinParty, pcOf } from '@/engine/party'
import { masterCandidates, startAsSlave } from '@/engine/slavery'
import { newGame, withRng } from '@/engine/state'
import { contractOf } from '@/engine/tattoos'
import type { GameState } from '@/engine/types'
import { takeVoluntarySlave, volunteerBlocked, volunteerCandidates } from '@/engine/voluntarySlave'

const r = slaveryRules.voluntary

function game(bond: 'voluntary' | 'hired' = 'voluntary'): { state: GameState; id: string } {
  const state = newGame({ name: '莉雅', race: 'human', classId: 'bard', seed: 9, birthplace: 'albena' })
  enterLocation(state)
  state.money_cc = 10_000
  const rec = withRng(state, (rng) => generateNpc(state, rng, { kind: 'adventurer', level: 3, location: 'albena' }, 'vs'))
  registerNpc(state, rec)
  joinParty(state, rec, bond)
  state.relationships![rec.id]!.affinity = r.min_affinity
  expect(standOn(state, 'carver')).toBe(true)
  return { state, id: rec.id }
}

describe('自願為奴', () => {
  it('要在刻印師那裡、親密度 60 以上、錢夠才行；奴隸與主角不在名單上', () => {
    const { state, id } = game()
    expect(volunteerCandidates(state).map((m) => m.id)).toEqual([id])
    expect(volunteerBlocked(state, id)).toBeUndefined()
    state.relationships![id]!.affinity = r.min_affinity - 1
    expect(volunteerBlocked(state, id)).toContain(`親密度 ${r.min_affinity} 以上`)
    state.relationships![id]!.affinity = r.min_affinity
    state.money_cc = r.fee_cc - 1
    expect(volunteerBlocked(state, id)).toContain('金錢不足')
    state.money_cc = 10_000
    standOn(state, 'gate')
    expect(volunteerBlocked(state, id)).toContain('刻印師')
  })

  it('答應之後刻上選的印記、成為奴隸，預先說好的主僕關係照算；親密度照舊', () => {
    const { state, id } = game('hired')
    const money = state.money_cc
    const rep = takeVoluntarySlave(state, id, 'labor', 'lovers')
    const m = state.party.find((x) => x.id === id)!
    expect(m.bond).toBe('slave')
    expect(m.status).toContain('slave_mark')
    const c = contractOf(m)!
    expect(c).toMatchObject({ master: 'pc', masterName: pcOf(state).name, style: 'lovers' })
    expect(c.terms.name).toBe(slaveryRules.contracts.labor!.name)
    expect(bondOf(state, id)).toBe('lovers')
    expect(state.relationships![id]!.affinity).toBe(r.min_affinity)
    expect(state.money_cc).toBe(money - r.fee_cc)
    expect(rep.changes.companions?.[0]).toMatchObject({ npc: id, change: 'enslaved', reason: '自願為奴' })
    // 已經是奴隸：不能再問
    expect(volunteerCandidates(state)).toEqual([])
  })

  it('自訂印記；名實相符時不記關係', () => {
    const { state, id } = game()
    takeVoluntarySlave(state, id, { name: '誓約之環', mark: '鎖骨間一圈細細的銀紋。', income_share: 0, obedience_penalty: 0 }, 'strict')
    const c = contractOf(state.party.find((x) => x.id === id))!
    expect(c.terms.name).toBe('誓約之環')
    expect(c.style).toBeUndefined()
  })

  it('主角自己身上有奴隸印記時不行', () => {
    const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 3, birthplace: 'rhineburg' })
    enterLocation(state)
    const [rec] = masterCandidates('rhineburg', 3)
    startAsSlave(state, { master: { type: 'candidate', rec: rec! }, mark: 'labor' })
    const master = state.party.find((m) => !m.isPlayer)!
    expect(volunteerBlocked(state, master.id)).toContain('奴隸印記')
  })
})
