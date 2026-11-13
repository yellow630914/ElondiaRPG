import { describe, expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020'
import schema from '../../schemas/report.schema.json'
import { applyPatron } from '@/engine/brothel'
import { finishCombat, startCombat } from '@/engine/combat'
import { workRules } from '@/engine/data'
import { enterLocation } from '@/engine/grid'
import { generateNpc } from '@/engine/npcs'
import { commitReport, newGame, withRng } from '@/engine/state'
import { baseReport } from '@/engine/town'
import type { GameState, NpcRecord, TimelineEntry } from '@/engine/types'
import { describeChanges } from '@/narrator/describe'

const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema)

function game(seed = 3): GameState {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed })
  enterLocation(state)
  return state
}

function beside(state: GameState): NpcRecord {
  const rec = withRng(state, (rng) => generateNpc(state, rng, { level: 1, tags: ['villain'] }, 'vis'))
  const p = state.position!
  rec.at = { area: p.area, x: p.x, y: p.y, until: state.time.day }
  return rec
}

/** 把敵人全部打倒（戰鬥紀錄照實際戰鬥寫「死亡」），打贏後結算 */
function knockOutAll(state: GameState) {
  const combat = state.combat!
  for (const c of combat.combatants) {
    if (c.side !== 'enemy') continue
    c.hp = 0
    combat.timeline.push({
      seq: combat.timeline.length + 1, round: 1, time: combat.startTime, actor: 'pc', action: '攻擊',
      effects: [{ type: 'status_add', target: c.id, status: '死亡' }], result: 'success',
    } as TimelineEntry)
  }
  combat.status = 'victory'
  const raw = combat.timeline
  const report = finishCombat(state)
  expect(validate(report), JSON.stringify(validate.errors)).toBe(true)
  return { report, raw }
}

const deaths = (timeline: TimelineEntry[] = []) => timeline.flatMap((t) => t.effects ?? []).filter((e) => e.type === 'status_add' && e.status === '死亡')

describe('倒下卻沒死的敵人', () => {
  it('打贏攔路的人：戰報寫被制伏、戰鬥紀錄不寫死亡，提醒寫手等主角處置', () => {
    const state = game()
    const a = beside(state)
    startCombat(state, undefined, { npcs: [a.id], aggressor: 'npc' })
    const { report, raw } = knockOutAll(state)
    expect(report.others?.find((o) => o.name === a.name)?.status).toEqual(['被制伏'])
    expect(deaths(report.timeline)).toHaveLength(0)
    expect(report.timeline!.flatMap((t) => t.effects ?? []).some((e) => e.status === '倒下')).toBe(true)
    // 戰鬥中的動畫用的紀錄不動
    expect(deaths(raw)).toHaveLength(1)
    expect(report.narration?.focus?.join('')).toContain('處決之後由主角另外決定')
    expect(state.captives?.npcs).toEqual([a.id])
  })

  it('要活捉的戰鬥（抓扒手）：倒下的盜賊是被制伏', () => {
    const state = game()
    startCombat(state, [['bandit', 1]], { capture: true })
    const { report } = knockOutAll(state)
    expect(report.others?.filter((o) => o.monster).every((o) => o.status?.[0] === '被制伏')).toBe(true)
    expect(deaths(report.timeline)).toHaveLength(0)
    expect(report.narration?.focus?.join('')).toContain('活捉')
  })

  it('一般的戰鬥照舊是死亡', () => {
    const state = game()
    startCombat(state, [['bandit', 1]], {})
    const { report } = knockOutAll(state)
    expect(report.others?.find((o) => o.monster)?.status).toEqual(['死亡'])
    expect(deaths(report.timeline)).toHaveLength(1)
    expect(report.narration?.focus).toBeUndefined()
  })
})

describe('日誌的金錢明細', () => {
  it('娼館大失敗：付的錢和被扒走的錢分開列', () => {
    const state = game()
    state.money_cc = 812
    const price = workRules.brothel.patron.price_cc
    const report = baseReport(state, 'action', 0)
    applyPatron(state, report, undefined, 'fumble')
    const done = commitReport(state, report)
    const lost = Math.floor((812 - price) * workRules.brothel.patron.pickpocket_ratio)
    expect(done.changes.money_cc).toBe(-price - lost)
    expect(validate(done), JSON.stringify(validate.errors)).toBe(true)
    const lines = describeChanges(done)
    expect(lines).toContain(`金錢 -${price} 白鸛（消費）`)
    expect(lines).toContain(`金錢 -${lost} 白鸛（被扒走）`)
    expect(lines.filter((l) => l.startsWith('金錢'))).toHaveLength(2)
  })

  it('只有一筆時照舊寫合計，也不留明細', () => {
    const state = game()
    state.money_cc = 812
    const report = baseReport(state, 'action', 0)
    applyPatron(state, report, undefined, 'success')
    const done = commitReport(state, report)
    expect(done.changes.money_parts).toBeUndefined()
    expect(describeChanges(done).filter((l) => l.startsWith('金錢'))).toEqual([`金錢 -${workRules.brothel.patron.price_cc} 白鸛`])
  })
})
