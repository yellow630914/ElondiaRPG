// 說服主人重簽契約（engine/resign.ts）：親密度 40 以上提出新的條款，成功照改、部分成功改一半
import { describe, expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020'
import schema from '../../schemas/report.schema.json'
import { prepareAction, resolveAction } from '@/engine/actions'
import { slaveryRules } from '@/engine/data'
import { enterLocation } from '@/engine/grid'
import { pcOf } from '@/engine/party'
import { halfwayTerms, resignBlocked, resignDc, resignTerms } from '@/engine/resign'
import { masterCandidates, startAsSlave } from '@/engine/slavery'
import { newGame } from '@/engine/state'
import { contractOf, slaveMarkOf } from '@/engine/tattoos'
import type { GameState, MarkTerms } from '@/engine/types'

const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema)
const r = slaveryRules.resign

function slave(affinity: number = r.min_affinity): { state: GameState; master: string } {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 3, birthplace: 'rhineburg' })
  enterLocation(state)
  const [rec] = masterCandidates('rhineburg', 3)
  startAsSlave(state, { master: { type: 'candidate', rec: rec! }, mark: 'combat' })
  const master = contractOf(pcOf(state))!.master
  state.relationships![master]!.affinity = affinity
  return { state, master }
}

function act(state: GameState, terms: Partial<MarkTerms>, natural: number) {
  prepareAction(state, { kind: 'resign', text: '主人，我想替你多賺點錢，但也想留一點給自己', terms })
  state.pendingAction!.natural = natural
  const rep = resolveAction(state, null)
  expect(validate(rep), JSON.stringify(validate.errors)).toBe(true)
  return rep
}

describe('說服主人重簽契約', () => {
  it('親密度 40 以上、被主人帶著才能提；DC 比談判解除契約低', () => {
    const low = slave(r.min_affinity - 1)
    expect(resignBlocked(low.state)).toContain(`親密度 ${r.min_affinity} 以上`)
    expect(() => prepareAction(low.state, { kind: 'resign', text: '', terms: { income_share: 0.5 } })).toThrow('還不夠信任你')
    const { state } = slave()
    expect(resignBlocked(state)).toBeUndefined()
    expect(resignDc(state)).toBeGreaterThanOrEqual(5)
    const free = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 3 })
    enterLocation(free)
    expect(resignBlocked(free)).toContain('沒有被主人帶著')
  })

  it('成功：照提出的條款改成自訂印記，主人、部位、服從懲罰不變', () => {
    const { state, master } = slave()
    const c = contractOf(pcOf(state))!
    const place = c.terms.place
    const obedience = c.obedience
    const before = c.terms.obedience_penalty
    const rep = act(state, { name: '雙人契約', income_share: 0.4, exit_dc: 8, place: 'back', obedience_penalty: 0 }, 20)
    const now = contractOf(pcOf(state))!
    expect(now.kind).toBe('custom')
    expect(now.master).toBe(master)
    expect(now.terms.name).toBe('雙人契約')
    expect(now.terms.income_share).toBe(0.4)
    expect(now.terms.exit_dc).toBe(8)
    expect(now.terms.place).toBe(place)
    expect(now.terms.obedience_penalty).toBe(before)
    expect(now.obedience).toBe(obedience)
    expect(slaveMarkOf(pcOf(state))!.place).toBe(place)
    expect(rep.outcome.summary).toContain('收益歸主人 100% → 40%')
    expect(rep.outcome.summary).toContain('自己留 60%')
  })

  it('數值夾在自訂印記的範圍內', () => {
    const { state } = slave()
    const t = resignTerms(state, { income_share: -1, exit_dc: 999 })
    expect(t.income_share).toBe(slaveryRules.custom_mark.income_share[0])
    expect(t.exit_dc).toBe(slaveryRules.custom_mark.exit_dc[1])
  })

  it('部分成功各改一半、名稱不變；失敗或大失敗今天不能再提，大失敗扣親密度', () => {
    const { state, master } = slave(60)
    const now = contractOf(pcOf(state))!.terms
    const half = halfwayTerms(now, resignTerms(state, { name: '新名字', income_share: 0.4 }))
    expect(half.income_share).toBe(Math.round(((now.income_share + 0.4) / 2) * 100) / 100)
    expect(half.name).toBe(now.name)

    const rep = act(state, { income_share: 0.2 }, 1)
    expect(['fail', 'fumble']).toContain(rep.check?.degree)
    expect(contractOf(pcOf(state))!.terms.income_share).toBe(now.income_share)
    expect(resignBlocked(state)).toContain('今天不想再聽')
    expect(state.relationships![master]!.affinity).toBe(60 + (rep.check?.degree === 'fumble' ? r.fumble_affinity : 0))
    state.time.day += 1
    expect(resignBlocked(state)).toBeUndefined()
  })

  it('部分成功時照一半改', () => {
    const { state } = slave(60)
    const now = contractOf(pcOf(state))!.terms
    prepareAction(state, { kind: 'resign', text: '', terms: { name: '新名字', income_share: 0.4 } })
    const p = state.pendingAction!
    const mod = p.modifiers.cha + p.situational.reduce((n, x) => n + x.value, 0)
    p.natural = Math.max(2, Math.min(19, p.base_dc - 2 - mod))
    const rep = resolveAction(state, null)
    expect(rep.check?.degree).toBe('partial')
    const after = contractOf(pcOf(state))!.terms
    expect(after.income_share).toBe(Math.round(((now.income_share + 0.4) / 2) * 100) / 100)
    expect(after.name).toBe(now.name)
  })

  it('沒有改任何東西時不能提', () => {
    const { state } = slave()
    expect(() => prepareAction(state, { kind: 'resign', text: '', terms: {} })).toThrow('和現在的一樣')
  })

  it('部分成功至少往目標移一格', () => {
    const { state } = slave(60)
    const now = contractOf(pcOf(state))!.terms
    const half = halfwayTerms(now, resignTerms(state, { negotiate_dc: now.negotiate_dc - 1, income_share: now.income_share - 0.01, exit_dc: now.exit_dc }))
    expect(half.negotiate_dc).toBe(now.negotiate_dc - 1)
    expect(half.income_share).toBe(Math.round((now.income_share - 0.01) * 100) / 100)
    expect(half.exit_dc).toBe(now.exit_dc)
  })

  it('和「找主人做點什麼」一樣：主人不在身邊、眼前有事要處理時不能提', () => {
    const { state, master } = slave()
    const m = state.party.find((x) => x.id === master)!
    m.status.push('away')
    expect(resignBlocked(state)).toBe('主人不在身邊')
    m.status = m.status.filter((x) => x !== 'away')
    state.standoff = {} as never
    expect(resignBlocked(state)).toBe('現在不能這麼做')
    delete state.standoff
    expect(resignBlocked(state)).toBeUndefined()
  })
})
