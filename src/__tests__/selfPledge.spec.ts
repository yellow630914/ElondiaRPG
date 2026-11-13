// 主動認主（docs/COMPANIONS.md 2.3.2 節；engine/selfPledge.ts）
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PledgeSelfPanel from '@/components/PledgeSelfPanel.vue'
import TattooShop from '@/components/place/TattooShop.vue'
import { nextTick } from 'vue'
import { useGame } from '@/stores/game'
import Ajv2020 from 'ajv/dist/2020'
import schema from '../../schemas/report.schema.json'
import { slaveryRules } from '@/engine/data'
import { enterLocation, standOn } from '@/engine/grid'
import { generateNpc, registerNpc } from '@/engine/npcs'
import { isBound, joinParty, leaderOf, pcOf } from '@/engine/party'
import { pledgeBlocked, pledgeCandidates, pledgeSelf } from '@/engine/selfPledge'
import { newGame, withRng } from '@/engine/state'
import { contractOf } from '@/engine/tattoos'
import type { Bond } from '@/engine/data'
import type { GameState, NpcRecord } from '@/engine/types'
import { takeVoluntarySlave } from '@/engine/voluntarySlave'

const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema)
const r = slaveryRules.voluntary

function game(): GameState {
  const state = newGame({ name: '莉雅', race: 'human', classId: 'bard', seed: 9, birthplace: 'albena' })
  enterLocation(state)
  state.money_cc = 10_000
  expect(standOn(state, 'carver')).toBe(true)
  return state
}

function companion(state: GameState, bond: Bond, affinity: number = r.min_affinity): NpcRecord {
  const rec = withRng(state, (rng) => generateNpc(state, rng, { kind: 'adventurer', level: 3, location: 'albena' }, 'sp'))
  registerNpc(state, rec)
  joinParty(state, rec, bond)
  state.relationships![rec.id]!.affinity = affinity
  return rec
}

/** 站在主角身邊、認識的人 */
function beside(state: GameState, affinity: number): NpcRecord {
  const rec = withRng(state, (rng) => generateNpc(state, rng, { kind: 'adventurer', level: 4, location: 'albena' }, 'sb'))
  registerNpc(state, rec)
  const p = state.position!
  state.npcs![rec.id]!.at = { area: p.area, x: p.x, y: p.y, until: state.time.day }
  state.relationships ??= {}
  state.relationships[rec.id] = { id: rec.id, name: rec.name, affinity, toPlayer: '認識的人', toOthers: '', memories: [] } as never
  return rec
}

describe('主動認主', () => {
  it('請信任你的同伴收下自己：刻上選的印記，他成為主人帶著你，其他同伴照舊同行', () => {
    const state = game()
    const master = companion(state, 'voluntary')
    const friend = companion(state, 'hired', 20)
    expect(pledgeCandidates(state).map((x) => x.id)).toEqual([master.id, friend.id])
    expect(pledgeBlocked(state, master.id)).toBeUndefined()
    expect(pledgeBlocked(state, friend.id)).toContain(`親密度 ${r.min_affinity} 以上`)
    const money = state.money_cc
    const report = pledgeSelf(state, master.id, 'combat', 'lovers')
    expect(validate(report), JSON.stringify(validate.errors)).toBe(true)
    const c = contractOf(pcOf(state))!
    expect(c.master).toBe(master.id)
    expect(c.kind).toBe('combat')
    expect(c.style).toBe('lovers')
    expect(isBound(state)).toBe(true)
    expect(leaderOf(state)?.id).toBe(master.id)
    expect(state.party.find((m) => m.id === friend.id)?.bond).toBe('hired')
    expect(state.money_cc).toBe(money - r.fee_cc)
    expect(pcOf(state).status).toContain('slave_mark')
    expect(report.changes.companions?.filter((x) => x.npc === 'pc').map((x) => x.change)).toEqual(['enslaved'])
    expect(state.relationships![master.id]!.affinity).toBe(r.min_affinity)
    expect(state.relationships![master.id]!.toPlayer).toContain('自願成為他的奴隸')
    // 已經有印記：不能再認一次
    expect(pledgeBlocked(state, friend.id)).toContain('已經有奴隸印記')
  })

  it('也可以請身邊認識的人收下自己；不認識、親密度不夠的不行', () => {
    const state = game()
    const stranger = beside(state, 10)
    const patron = beside(state, 70)
    const ids = pledgeCandidates(state).map((x) => x.id)
    expect(ids).toEqual(expect.arrayContaining([stranger.id, patron.id]))
    expect(pledgeBlocked(state, stranger.id)).toContain('還不夠信任你')
    pledgeSelf(state, patron.id, slaveryRules.roles.default)
    expect(contractOf(pcOf(state))!.master).toBe(patron.id)
    expect(leaderOf(state)?.id).toBe(patron.id)
    expect(contractOf(pcOf(state))!.style).toBeUndefined()
  })

  it('跟著別人的隊伍時只能請隊長；擁有奴隸、不在刻印師那裡、錢不夠都不行', () => {
    const state = game()
    const leader = companion(state, 'leader')
    const other = beside(state, 80)
    expect(pledgeBlocked(state, other.id)).toContain(`只能請${leader.name}收下你`)
    expect(pledgeBlocked(state, leader.id)).toBeUndefined()
    standOn(state, 'gate')
    expect(pledgeBlocked(state, leader.id)).toContain('刻印師')
    standOn(state, 'carver')
    state.money_cc = r.fee_cc - 1
    expect(pledgeBlocked(state, leader.id)).toContain('金錢不足')
    state.money_cc = 10_000
    pledgeSelf(state, leader.id, slaveryRules.roles.default)
    expect(contractOf(pcOf(state))!.master).toBe(leader.id)
    expect(leaderOf(state)?.id).toBe(leader.id)

    // 自己擁有奴隸：奴隸不能擁有奴隸
    const owner = game()
    const slave = companion(owner, 'voluntary')
    takeVoluntarySlave(owner, slave.id, slaveryRules.roles.default)
    const friend = companion(owner, 'voluntary')
    expect(pledgeBlocked(owner, friend.id)).toContain(`你還擁有奴隸（${slave.name}）`)
  })
})

describe('主動認主的畫面', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('列出可以問的人與原因；按下去確認後成為對方的奴隸', async () => {
    const state = game()
    const master = companion(state, 'voluntary')
    const low = companion(state, 'hired', 5)
    const store = useGame()
    store.state = state
    const w = mount(PledgeSelfPanel)
    const rows = w.findAll('label.cand')
    expect(rows.map((x) => x.text())).toEqual([expect.stringContaining(master.name), expect.stringContaining(low.name)])
    expect(rows[1]!.classes()).toContain('off')
    vi.stubGlobal('confirm', () => true)
    const go = w.findAll('button.primary').find((b) => b.text().includes(`請${master.name}收下你`))!
    await go.trigger('click')
    await flushPromises()
    vi.unstubAllGlobals()
    expect(contractOf(pcOf(store.state!))?.master).toBe(master.id)
    expect(w.emitted('done')).toHaveLength(1)
  })
})

describe('刻印師的選單', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('自由身時有「請人收下自己」一列（寫出現在會答應的人數），刻了印記之後就沒有', async () => {
    const state = game()
    const master = companion(state, 'voluntary')
    companion(state, 'hired', 5)
    const store = useGame()
    store.state = state
    const w = mount(TattooShop, { props: { shop: 'carver' } })
    const row = () => w.findAll('button').find((b) => b.text().includes('請人收下自己'))
    expect(row()?.text()).toContain('1')
    pledgeSelf(state, master.id, slaveryRules.roles.default)
    store.state = { ...state }
    await nextTick()
    expect(row()).toBeUndefined()
    expect(w.findAll('button').some((b) => b.text().includes('自願為奴'))).toBe(true)
  })
})
