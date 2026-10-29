import { describe, expect, it } from 'vitest'
import { creationSlots, EXTRA_SLOT, gearName, generateLoadout, slotsFor } from '@/engine/gear'
import { forceEquip } from '@/engine/forcedGear'
import { enterLocation } from '@/engine/grid'
import { putOn } from '@/engine/inventory'
import { pcOf } from '@/engine/party'
import { Rng } from '@/engine/rng'
import { bindModifiers } from '@/engine/schools'
import { masterCandidates, startAsSlave } from '@/engine/slavery'
import { baseReport } from '@/engine/town'
import { newGame } from '@/engine/state'
import type { GameState } from '@/engine/types'

function game(): GameState {
  const state = newGame({ name: '莉雅', race: 'human', classId: 'fighter', seed: 3, birthplace: 'rhineburg' })
  enterLocation(state)
  return state
}
const spec = (base: string, material = 'leather') => ({ base, material })

describe('額外飾品欄', () => {
  it('飾品與拘束具可以放，護具與服裝不行；原本的部位滿了才放額外飾品欄', () => {
    expect(slotsFor(spec('ring_swift', 'copper'))).toEqual(['ring_1', 'ring_2', EXTRA_SLOT])
    expect(slotsFor(spec('blindfold'))).toContain(EXTRA_SLOT)
    expect(slotsFor(spec('maid_dress', 'linen'))).not.toContain(EXTRA_SLOT)
    expect(slotsFor(spec('panties', 'linen'))).not.toContain(EXTRA_SLOT)
    const pc = pcOf(game())
    const ring = spec('ring_swift', 'copper')
    expect(putOn(pc, gearName(ring), ring).target).toBe('ring_1')
    expect(putOn(pc, gearName(ring), ring).target).toBe('ring_2')
    expect(putOn(pc, gearName(ring), ring).target).toBe(EXTRA_SLOT)
  })

  it('拘束具放在額外飾品欄時原本的部位空著，雙面效應照算', () => {
    const pc = pcOf(game())
    const helm = spec('hood', 'linen')
    putOn(pc, gearName(helm), helm, 'head')
    const blind = spec('blindfold')
    putOn(pc, gearName(blind), blind, EXTRA_SLOT)
    expect(pc.gear?.head?.spec.base).toBe('hood')
    expect(pc.gear?.[EXTRA_SLOT]?.spec.base).toBe('blindfold')
    expect(bindModifiers(pc, { attr: 'int' }).length).toBeGreaterThan(0)
  })

  it('主人強制的拘束具戴在原本的部位', () => {
    const state = game()
    const [rec] = masterCandidates('rhineburg', 3)
    startAsSlave(state, { master: { type: 'candidate', rec: rec! }, mark: 'labor' })
    const pc = pcOf(state)
    const line = forceEquip(state, baseReport(state, 'event', 0), rec!.id, '腕鐐')
    expect(line).toContain('手腕')
    expect(pc.gear?.[EXTRA_SLOT]).toBeUndefined()
  })

  it('建角可以選，NPC 依等級有機會戴', () => {
    expect(creationSlots('fighter').find((s) => s.slot === EXTRA_SLOT)?.bases).toContain('ring_swift')
    const rng = new Rng(1)
    const worn = Array.from({ length: 30 }, () => generateLoadout('fighter', 15, rng)).filter((g) => g[EXTRA_SLOT])
    expect(worn.length).toBeGreaterThan(5)
  })
})
