import { afterEach, describe, expect, it } from 'vitest'
import { prepareAction, resolveAction } from '@/engine/actions'
import { applyPatron } from '@/engine/brothel'
import {
  addRank, afterBrothelWork, patronTeaches, proposeDc, proposeWork, rankOf, startBrothelTraining, trainingOptions, trainingPreview, workEventsFor,
} from '@/engine/brothelLife'
import { buySlave, marketStock } from '@/engine/companions'
import { abilities, lewdRules, workRules } from '@/engine/data'
import { enterLocation, standOn } from '@/engine/grid'
import { npcRecord } from '@/engine/npcs'
import { courseTeaches, startTraining, trainingDcMods } from '@/engine/ownerTraining'
import { pcOf } from '@/engine/party'
import { ensureRoster } from '@/engine/population'
import { answerMasterEvent, eventRoles, pendingEventDef } from '@/engine/slavery'
import { newGame } from '@/engine/state'
import { baseReport } from '@/engine/town'
import type { GameState } from '@/engine/types'
import { workers, workPay, workTarget } from '@/engine/work'

function game(location = 'albena', seed = 11): GameState {
  const state = newGame({ name: '莉雅', race: 'human', classId: 'bard', seed, birthplace: location })
  enterLocation(state)
  ensureRoster(state, location)
  return state
}

function withSlave(state: GameState) {
  const l = marketStock(state, 'public')[0]!
  state.money_cc = l.price_cc + 100000
  buySlave(state, 'public', l.npc)
  return state.party.find((m) => m.id === l.npc)!
}

describe('調教', () => {
  it('抽同課程的事件，由主角擲骰；奴隸的順從讓檢定變容易，親密度很低時變難', () => {
    const state = game()
    const slave = withSlave(state)
    slave.lewd = { ...lewdRules.defaults, submission: 45 }
    state.relationships![slave.id]!.affinity = -5
    expect(trainingDcMods(state, slave)).toEqual([{ label: `${slave.name}的順從`, value: 4 }, { label: '親密度很低', value: -2 }])
    startTraining(state, slave.id, 'serve')
    expect(state.pendingMasterEvent).toMatchObject({ pool: 'owner', actor: slave.id })
    expect(pendingEventDef(state).course).toBe('serve')
    expect(state.pendingMasterEvent!.text).toContain(slave.name)
    const roles = eventRoles(state)
    expect(roles.roller.isPlayer).toBe(true)
    expect(roles.subject).toBe(slave)
    const report = answerMasterEvent(state, 2)
    expect(report.outcome.tags).toContain('調教')
    expect(state.pendingMasterEvent).toBeUndefined()
  })

  it('成功時課程的指標成長，成功夠多次保證學會課程的技能', () => {
    const state = game()
    const slave = withSlave(state)
    const before = slave.lewd?.submission ?? lewdRules.defaults.submission
    for (let i = 0; i < 3; i++) {
      startTraining(state, slave.id, 'serve')
      answerMasterEvent(state, 2)
    }
    // 沒有檢定的做法一定算成功：侍奉課程每次順從 +2，第三次學會一個技能
    expect(slave.lewd!.submission).toBe(before + 6)
    expect(slave.abilities.some((id) => courseTeaches('serve').includes(id))).toBe(true)
    expect(slave.trainProgress?.serve).toBe(0)
  })
})

describe('娼館：打工事件、頭牌等級、受訓', () => {
  it('頭牌等級：每座城各自累積，時薪變高，解鎖更好的事件', () => {
    const state = game()
    const pc = pcOf(state)
    expect(rankOf(state, pc.id)).toMatchObject({ level: 0, name: '見習' })
    const low = workEventsFor(state, pc).length
    addRank(state, pc.id, 30)
    expect(rankOf(state, pc.id)).toMatchObject({ level: 3, name: '頭牌' })
    expect(rankOf(state, pc.id, 'soriel').level).toBe(0)
    expect(workEventsFor(state, pc).length).toBeGreaterThan(low)
    const job = { ...workRules.jobs.brothel!, cell: 'brothel' }
    expect(workPay(job, 4, 'success', 1.45)).toBe(Math.round(workPay(job, 4, 'success') * 1.45))
  })

  it('打工結束時可能遇到事件；事件由接客的人擲骰，學會掛的技能', () => {
    const state = game()
    const pc = pcOf(state)
    pc.lewd = { ...lewdRules.defaults, lewdness: 100 }
    let hit = false
    for (let i = 0; i < 40 && !hit; i++) {
      afterBrothelWork(state, pc)
      hit = !!state.pendingMasterEvent
    }
    expect(hit).toBe(true)
    expect(state.pendingMasterEvent!.pool).toBe('brothel_work')
    expect(rankOf(state, pc.id).points).toBeGreaterThan(2)
    const e = pendingEventDef(state)
    const i = e.options.findIndex((o) => o.learn && !o.check)
    const report = answerMasterEvent(state, Math.max(0, i))
    expect(report.outcome.tags).toContain('娼館')
  })

  it('受訓：付學費，一定學會一個頭牌等級夠的技能；全部學過時複習', () => {
    const state = game()
    const pc = pcOf(state)
    state.money_cc = 100000
    const opts = trainingOptions(state, pc)
    expect(opts.length).toBeGreaterThan(0)
    expect(opts.every((o) => (o.event.rank_min ?? 0) === 0)).toBe(true)
    const money = state.money_cc
    startBrothelTraining(state)
    const teach = state.pendingMasterEvent!.teach!
    expect(abilities[teach]).toBeDefined()
    expect(state.money_cc).toBeLessThan(money)
    answerMasterEvent(state, 2)
    expect(pc.abilities).toContain(teach)
    // 全部學過：複習
    pc.abilities.push(...trainingOptions(state, pc).map((o) => o.ability.id))
    expect(trainingPreview(state, pc).review).toBe(true)
    startBrothelTraining(state)
    expect(state.pendingMasterEvent!.teach).toBeUndefined()
    const lewd = pc.lewd?.lewdness ?? lewdRules.defaults.lewdness
    answerMasterEvent(state, 2)
    expect(pc.lewd!.lewdness).toBe(lewd + 2)
  })
})

describe('光顧娼婦時學技能、提議夥伴', () => {
  it('親密度夠高的娼婦光顧成功時教主角一手；淫亂決定能教到幾級', () => {
    const state = game()
    standOn(state, 'brothel')
    const pc = pcOf(state)
    const rec = Object.values(state.npcs ?? {}).find((r) => r.tags?.includes('prostitute') && !r.tags.includes('merchant'))!
    expect(patronTeaches(rec).every((id) => abilities[id]!.classes.includes('lewd'))).toBe(true)
    state.relationships = { ...(state.relationships ?? {}), [rec.id]: { ...(state.relationships?.[rec.id] ?? { affinity: 0 }), affinity: 80 } } as GameState['relationships']
    state.money_cc = 100000
    let learned = false
    for (let i = 0; i < 20 && !learned; i++) {
      const before = pc.abilities.length
      applyPatron(state, baseReport(state, 'action', 0), rec.id, 'success')
      learned = pc.abilities.length > before
    }
    expect(learned).toBe(true)
  })

  it('自由的夥伴要先答應才能去娼館接客，工錢分一半；奴隸直接派', () => {
    const state = game()
    const slave = withSlave(state)
    standOn(state, 'brothel')
    expect(workers(state).map((m) => m.id)).toEqual([slave.id])
    // 解除契約之後是自由的夥伴
    slave.bond = 'voluntary'
    expect(workers(state)).toEqual([])
    standOn(state, 'tavern')
    expect(workers(state).map((m) => m.id)).toEqual([slave.id])
    standOn(state, 'brothel')
    expect(proposeDc(state, slave)).toBeGreaterThan(0)
    let ok = false
    for (let i = 0; i < 30 && !ok; i++) ok = proposeWork(state, slave.id).outcome.result === 'success'
    expect(ok).toBe(true)
    expect(workers(state).map((m) => m.id)).toEqual([slave.id])
    prepareAction(state, { kind: 'work', target: workTarget(4, slave.id), text: '' })
    state.pendingAction!.natural = 15
    const money = state.money_cc
    resolveAction(state, null)
    const pay = Math.round(workPay(workRules.jobs.brothel!, 4, 'success', 1) * lewdRules.brothel.propose.share)
    expect(state.money_cc - money).toBe(pay)
    expect(npcRecord(state, slave.id)).toBeDefined()
  })
})
