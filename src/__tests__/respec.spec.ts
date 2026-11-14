// 神殿的洗點（玩家回報：這遊戲能轉職洗點嗎）
import { describe, expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020'
import schema from '../../schemas/report.schema.json'
import { baseAttrs, spendAttrPoint } from '@/engine/character'
import { attributeRules } from '@/engine/data'
import { enterLocation } from '@/engine/grid'
import { pcOf } from '@/engine/party'
import { respecBlocked, respecCost, respecPoints, templeRespec } from '@/engine/respec'
import { newGame, withRng } from '@/engine/state'
import { generateNpc, registerNpc } from '@/engine/npcs'
import { joinParty } from '@/engine/party'
import { respecMembers } from '@/engine/respec'

const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema)

function game() {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 3, bonus: { str: 1, dex: 1 } })
  enterLocation(state)
  return state
}

describe('洗點', () => {
  it('屬性退回職業與種族的基本值，建角加的、升級分配的點都變回未分配', () => {
    const state = game()
    const pc = pcOf(state)
    const base = baseAttrs(pc.class, pc.race)
    pc.level = 5
    pc.attrPoints = 3
    spendAttrPoint(pc, 'str')
    spendAttrPoint(pc, 'cha')
    const extra = Object.keys(base).reduce((n, a) => n + pc.attrs[a as keyof typeof base] - base[a as keyof typeof base], 0)
    expect(respecPoints(state)).toBe(extra)
    expect(extra).toBeGreaterThanOrEqual(2)
    state.money_cc = 10_000
    expect(respecBlocked(state)).toBeUndefined()
    const r = templeRespec(state)
    expect(validate(r), JSON.stringify(validate.errors)).toBe(true)
    expect(pc.attrs).toEqual(base)
    expect(pc.attrPoints).toBe(1 + extra)
    expect(state.money_cc).toBe(10_000 - attributeRules.respec.cost_per_level * 5)
    expect(respecPoints(state)).toBe(0)
    expect(respecBlocked(state)).toContain('沒有可以重新分配')
  })

  it('錢不夠、戰鬥中不行；費用照等級', () => {
    const state = game()
    const pc = pcOf(state)
    pc.attrPoints = 1
    spendAttrPoint(pc, 'int')
    pc.level = 7
    expect(respecCost(state)).toBe(attributeRules.respec.cost_per_level * 7)
    state.money_cc = respecCost(state) - 1
    expect(respecBlocked(state)).toContain('金錢不足')
  })

  it('夥伴也能洗點：只退回高於基本值的部分，費用照夥伴的等級；暫時離隊的不行', () => {
    const state = game()
    state.money_cc = 100_000
    const rec = withRng(state, (rng) => generateNpc(state, rng, { kind: 'adventurer', class: 'wizard', level: 5, location: state.location }, 'rs'))
    registerNpc(state, rec)
    const m = joinParty(state, rec, 'voluntary')
    expect(respecMembers(state).map((x) => x.id)).toContain(m.id)
    const base = baseAttrs(m.class, m.race)
    const extra = Object.keys(base).reduce((n, a) => n + Math.max(0, m.attrs[a as keyof typeof base] - base[a as keyof typeof base]), 0)
    expect(extra).toBeGreaterThan(0)
    expect(respecPoints(state, m.id)).toBe(extra)
    expect(respecCost(state, m.id)).toBe(attributeRules.respec.cost_per_level * m.level)
    const before = m.attrPoints
    templeRespec(state, m.id)
    expect(m.attrPoints).toBe(before + extra)
    expect(m.respecPoints).toBe(extra)
    for (const a of Object.keys(base) as (keyof typeof base)[]) expect(m.attrs[a]).toBeLessThanOrEqual(base[a])
    // 分配一點：洗點退回來的點先用掉
    spendAttrPoint(m, 'int')
    expect(m.respecPoints).toBe(extra - 1)
    m.status.push('away')
    expect(() => respecPoints(state, m.id)).toThrow('不能在這裡洗點')
  })

  it('主人的要求、戰敗後的處境這類等著處理的事要先處理', () => {
    const state = game()
    const pc = pcOf(state)
    pc.attrPoints = 1
    spendAttrPoint(pc, 'str')
    state.money_cc = 10_000
    expect(respecBlocked(state)).toBeUndefined()
    state.pendingMasterEvent = { id: 'x' } as unknown as typeof state.pendingMasterEvent
    expect(respecBlocked(state)).toContain('主人')
    delete state.pendingMasterEvent
    state.pendingDefeat = { x: 1 } as unknown as typeof state.pendingDefeat
    expect(respecBlocked(state)).toContain('處境')
  })
})
