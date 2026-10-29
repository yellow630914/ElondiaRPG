import { describe, expect, it } from 'vitest'
import { startCombat } from '@/engine/combat'
import { lewdRules } from '@/engine/data'
import { applyEffects } from '@/engine/effects'
import { gearName } from '@/engine/gear'
import { addLewd, bandName, exposureAt, exposureLevel, gearLewd, lewdDaily, lewdOf, lewdSummary, npcLewd } from '@/engine/lewd'
import { pcOf } from '@/engine/party'
import { advanceTime, commitReport, newGame } from '@/engine/state'
import { condMet } from '@/engine/storyFlags'
import { baseReport } from '@/engine/town'
import type { Character, GearSlot, GearSpec } from '@/engine/types'

const wear = (c: Character, slot: GearSlot, base: string, extra: Partial<GearSpec> = {}) => {
  const spec: GearSpec = { base, material: 'cloth', ...extra }
  ;(c.gear ??= {})[slot] = { name: gearName(spec), spec }
}

function game() {
  const state = newGame({ name: '莉雅', race: 'human', classId: 'bard', seed: 5 })
  const pc = pcOf(state)
  pc.gear = {}
  return { state, pc }
}

describe('慾望指標：數值與分段', () => {
  it('沒有記錄時用預設；分段每 20 一段，順從在有契約時用被迫者的名稱', () => {
    const { pc } = game()
    expect(lewdOf(pc)).toEqual(lewdRules.defaults)
    expect(bandName('lewdness', 0)).toBe('純情')
    expect(bandName('lewdness', 65)).toBe('淫蕩')
    expect(bandName('submission', 50)).toBe('習慣')
    expect(bandName('submission', 50, true)).toBe('麻木與認命')
    expect(bandName('exposure', 100)).toBe('人盡皆知')
  })

  it('成人向服裝與束縛用的底材給加值；物品寫的加值每件 ±10、全身 ±20', () => {
    const { pc } = game()
    wear(pc, 'body', 'bunny_suit')
    expect(gearLewd(pc).lewdness).toBe(5)
    wear(pc, 'accessory', 'slave_collar')
    expect(gearLewd(pc)).toMatchObject({ submission: 5, endurance: 3 })
    wear(pc, 'head', 'bunny_ears', { lewd: { lewdness: 30 } })
    // 兔耳：成人向 +5 加上寫的 +30，單件最多 +10；全身最多 +20
    expect(gearLewd(pc).lewdness).toBe(15)
    wear(pc, 'feet', 'heels', { lewd: { lewdness: 10 } })
    expect(gearLewd(pc).lewdness).toBe(20)
    expect(lewdOf(pc).lewdness).toBe(lewdRules.defaults.lewdness + 20)
  })

  it('曝露度看最外層：上身遮住內衣，什麼都沒穿是 3', () => {
    const { pc } = game()
    expect(exposureLevel(pc)).toBe(3)
    wear(pc, 'underwear_top', 'pasties')
    wear(pc, 'underwear_bottom', 'thong')
    expect(exposureLevel(pc)).toBe(3)
    wear(pc, 'body', 'dress')
    expect(exposureLevel(pc)).toBe(0)
    wear(pc, 'body', 'bunny_suit')
    expect(exposureLevel(pc)).toBe(2)
    wear(pc, 'body', 'reverse_bunny')
    expect(exposureLevel(pc)).toBe(3)
  })
})

describe('慾望指標：增減與每天的變化', () => {
  it('加減夾在 0～100，記進報告；曝露名聲依地區記', () => {
    const { state, pc } = game()
    const report = baseReport(state, 'action', 0)
    expect(addLewd(state, pc, 'lewdness', 200, report)).toBe(90)
    expect(pc.lewd!.lewdness).toBe(100)
    addLewd(state, pc, 'exposure', 30, report, 'central')
    expect(exposureAt(state, pc.id, 'central')).toBe(30)
    expect(exposureAt(state, pc.id, 'south')).toBe(0)
    expect(report.changes.lewd).toEqual([
      { actor: pc.id, stat: 'lewdness', delta: 90, after: 100 },
      { actor: pc.id, stat: 'exposure', delta: 30, after: 30, region: 'central' },
    ])
  })

  it('在城裡穿曝露的服裝，曝露名聲每天累積；穿成人向服裝淫亂成長、穿束縛忍耐成長', () => {
    const { state, pc } = game()
    // 尋常的魅氣濃度（×1，charm.ts）
    state.location = 'rhineburg'
    wear(pc, 'body', 'bunny_suit')
    wear(pc, 'accessory', 'slave_collar')
    lewdDaily(state, 1, 4)
    // 每天 +曝露度 2 × 2，再淡掉 1（第一天還沒有可以淡掉的）
    expect(exposureAt(state, pc.id, 'central')).toBe(4 + 3 + 3)
    expect(pc.lewd!.lewdness).toBe(lewdRules.defaults.lewdness + 3)
    expect(pc.lewd!.endurance).toBe(lewdRules.defaults.endurance + 3)
  })

  it('跨日時結算（走格子、報告的時間）；沒穿曝露的服裝時曝露名聲慢慢淡掉', () => {
    const { state, pc } = game()
    state.location = 'soriel'
    wear(pc, 'body', 'dress')
    addLewd(state, pc, 'exposure', 10, undefined, 'central')
    const day = state.time.day
    advanceTime(state, 24 * 3)
    expect(state.time.day).toBe(day + 3)
    expect(exposureAt(state, pc.id, 'central')).toBe(7)
  })

  it('親密場景：主角的淫亂成長，記下日子', () => {
    const { state, pc } = game()
    const report = baseReport(state, 'action', 1)
    report.narration = { ...report.narration, adult_scene: '測試' }
    commitReport(state, report)
    expect(pc.lewd!.lewdness).toBe(lewdRules.defaults.lewdness + 1)
    expect(pc.lewd!.lastScene).toBe(report.time.end.day)
  })
})

describe('慾望指標：連動', () => {
  it('戰鬥：忍耐加慾望上限、敏感改變受到的慾望、淫亂帶著慾望上場', () => {
    const { state, pc } = game()
    pc.lewd = { lewdness: 60, sensitivity: 90, endurance: 40, submission: 40 }
    const combat = startCombat(state, [['goblin', 1]])
    const me = combat.combatants.find((c) => c.id === pc.id)!
    expect(me.lustMax).toBe(30 + 3 * me.level + 20)
    expect(me.lustMods).toMatchObject({ taken: 0.75 + 90 / 200, self: 1.25, convert: 0.1 })
    // 淫亂 60：開戰帶上限 15% 的慾望；主角先動的話，回合開始已經消退一次（淫亂高，消退 ×0.7）
    const start = Math.round(me.lustMax! * 3 * 0.05)
    expect([start, start - Math.max(1, Math.round(me.lustMax! * 0.05 * 0.7))]).toContain(me.lust)
  })

  it('效果與條件：lewd 效果、stats 條件', () => {
    const { state, pc } = game()
    const report = baseReport(state, 'action', 0)
    applyEffects(state, report, [{ type: 'lewd', stat: 'submission', delta: 15 }])
    expect(pc.lewd!.submission).toBe(lewdRules.defaults.submission + 15)
    expect(condMet(state, { stats: { submission: { min: 20 } } })).toBe(true)
    expect(condMet(state, { stats: { submission: { min: 30 } } })).toBe(false)
    expect(condMet(state, { stats: { exposure: { max: 0 } } })).toBe(true)
  })

  it('NPC：依標籤與 id 固定地擲，寫了的值優先', () => {
    const a = npcLewd({ id: 'npc_x', tags: ['prostitute'] })
    expect(npcLewd({ id: 'npc_x', tags: ['prostitute'] })).toEqual(a)
    expect(a.lewdness).toBeGreaterThanOrEqual(50)
    expect(a.lewdness).toBeLessThanOrEqual(80)
    expect(npcLewd({ id: 'npc_x', lewd: { submission: 77 } }).submission).toBe(77)
  })

  it('給 AI 的分段文字', () => {
    const { state, pc } = game()
    expect(lewdSummary(state, pc)).toContain('淫亂：純情')
    expect(lewdSummary(state, pc, true)).toContain('（10）')
  })
})
