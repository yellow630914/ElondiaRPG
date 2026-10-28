import { describe, expect, it } from 'vitest'
import { prepareAction, resolveAction, sanitizeJudgment } from '@/engine/actions'
import { inviteDc, invitable } from '@/engine/companions'
import { companionRules, tagDcMod } from '@/engine/data'
import { enterLocation } from '@/engine/grid'
import { generateNpc, npcRecord, registerNpc } from '@/engine/npcs'
import { partyMax } from '@/engine/party'
import { ensureRelationship, setAffinity } from '@/engine/social'
import { newGame, withRng } from '@/engine/state'
import type { GameState, NpcRecord } from '@/engine/types'
import { buildActionPrompt } from '@/narrator/judge'

function game(): GameState {
  const state = newGame({ name: '艾倫', race: 'human', classId: 'fighter', seed: 3, birthplace: 'rhineburg' })
  enterLocation(state)
  return state
}

/** 讓這個人站在主角身邊、互相認識 */
function beside(state: GameState, rec: NpcRecord, affinity = 60): NpcRecord {
  registerNpc(state, rec)
  const p = state.position!
  state.npcs![rec.id] = { ...state.npcs![rec.id]!, at: { area: p.area, x: p.x, y: p.y, until: state.time.day } }
  ensureRelationship(state, npcRecord(state, rec.id)!)
  setAffinity(state, rec.id, affinity)
  return npcRecord(state, rec.id)!
}

function stranger(state: GameState, affinity = 60): NpcRecord {
  return beside(state, withRng(state, (rng) => generateNpc(state, rng, { level: 1, kind: 'adventurer', location: state.location })), affinity)
}

function judge(state: GameState, target: string, natural: number, degree = 'success') {
  const p = prepareAction(state, { kind: 'free', target, text: '請她和我一起去冒險' })
  p.natural = natural
  return { p, j: sanitizeJudgment(state, p, { degree, effects: [{ type: 'join', npc: target }] }) }
}

describe('AI judged free actions bringing the target into the party', () => {
  it('lets the target join on a success that also beats the invite DC', () => {
    const state = game()
    const rec = stranger(state)
    const { j } = judge(state, rec.id, 20)
    expect(j.effects).toEqual([{ type: 'companion', npc: rec.id, mode: 'voluntary' }])
    const report = resolveAction(state, j)
    expect(state.party.some((m) => m.id === rec.id)).toBe(true)
    expect(report.outcome.summary).toContain('加入了隊伍')
  })

  it('drops the join and says why when an invite condition fails', () => {
    const state = game()
    const rec = stranger(state)
    // 失敗、部分成功：不入隊
    expect(judge(state, rec.id, 20, 'partial').j.notes?.join()).toContain('成功以上')
    state.pendingAction = undefined
    // 骰值沒有達到邀請的 DC
    const low = judge(state, rec.id, 2)
    expect(low.j.effects).toEqual([{ type: 'flag', key: `invite_wait:${rec.id}`, value: true }])
    expect(low.j.adjusted?.join()).toContain(`邀請的 DC ${inviteDc(state, rec.id)}`)
    const report = resolveAction(state, low.j)
    expect(state.party.some((m) => m.id === rec.id)).toBe(false)
    expect(report.outcome.summary).toContain('沒有入隊')
    delete state.flags[`invite_wait:${rec.id}`]
    // 隊伍滿了
    while (state.party.length < partyMax(state)) state.party.push({ ...state.party[0]!, id: `x${state.party.length}`, isPlayer: false })
    expect(judge(state, rec.id, 20).j.notes?.join()).toContain(`隊伍最多 ${partyMax(state)} 人`)
    state.pendingAction = undefined
    // 婉拒後的冷卻
    state.party.splice(1)
    state.flags[`invite_wait:${rec.id}`] = true
    expect(judge(state, rec.id, 20).j.notes?.join()).toContain('下次長休後再邀請')
  })

  it('puts the target off until the next long rest when they turn it down', () => {
    const state = game()
    const rec = stranger(state)
    const { j } = judge(state, rec.id, 20, 'partial')
    resolveAction(state, j)
    expect(state.flags[`invite_wait:${rec.id}`]).toBe(true)
    expect(invitable(state).some((r) => r.id === rec.id)).toBe(false)
    // 骰值沒有達到邀請的 DC 也一樣
    const other = stranger(state, 0)
    const low = judge(state, other.id, 2)
    resolveAction(state, low.j)
    expect(state.flags[`invite_wait:${other.id}`]).toBe(true)
    // 隊伍放不下不是對方拒絕：不用等
    const third = stranger(state)
    while (state.party.length < partyMax(state)) state.party.push({ ...state.party[0]!, id: `x${state.party.length}`, isPlayer: false })
    resolveAction(state, judge(state, third.id, 20).j)
    expect(state.flags[`invite_wait:${third.id}`]).toBeUndefined()
  })

  it('says why someone cannot be invited', () => {
    const state = game()
    const cold = stranger(state, -5)
    expect(judge(state, cold.id, 20).j.notes?.join()).toContain('親密度不夠')
    state.pendingAction = undefined
    const held = stranger(state, 30)
    state.captives = { npcs: [held.id], aggressor: 'npc', location: state.location, area: state.position!.area, day: state.time.day }
    expect(invitable(state).some((r) => r.id === held.id)).toBe(false)
    const p = prepareAction(state, { kind: 'free', target: held.id, text: '跟我走吧' })
    const q = buildActionPrompt(state, p, '')
    expect(q.system + q.user).toContain('被制伏了')
    expect(sanitizeJudgment(state, p, { degree: 'success', effects: [{ type: 'join', npc: held.id }] }).effects).toEqual([])
  })

  it('counts the affinity change of the same judgment', () => {
    const state = game()
    const rec = stranger(state, 5)
    const { j } = judge(state, rec.id, 20, 'success')
    expect(j.effects).toContainEqual({ type: 'companion', npc: rec.id, mode: 'voluntary' })
    state.pendingAction = undefined
    const p = prepareAction(state, { kind: 'free', target: rec.id, text: '一起走吧' })
    p.natural = 20
    const k = sanitizeJudgment(state, p, { degree: 'success', effects: [{ type: 'join', npc: rec.id }, { type: 'affinity', npc: rec.id, delta: -10 }] })
    expect(k.effects.some((e) => e.type === 'companion')).toBe(false)
    expect(k.notes?.join()).toContain('親密度不夠')
    expect(state.relationships![rec.id]!.affinity).toBe(5)
  })

  it('uses the rolled degree when the AI leaves it out', () => {
    const state = game()
    const rec = stranger(state)
    const p = prepareAction(state, { kind: 'free', target: rec.id, text: '一起走吧' })
    p.natural = 20
    const j = sanitizeJudgment(state, p, { effects: [{ type: 'join', npc: rec.id }] })
    expect(j.degree).toBe('critical')
    expect(j.effects).toEqual([{ type: 'companion', npc: rec.id, mode: 'voluntary' }])
  })

  it('stops a beaten rival being hostile once they join', () => {
    const state = game()
    const rec = stranger(state)
    state.npcs![rec.id]!.hostile = true
    resolveAction(state, judge(state, rec.id, 20).j)
    expect(state.party.some((m) => m.id === rec.id)).toBe(true)
    expect(state.npcs![rec.id]?.hostile).toBeUndefined()
  })

  it('tells the AI judge about joining and the invite DC only for a known target outside the party', () => {
    const state = game()
    const rec = stranger(state)
    const text = (p: ReturnType<typeof prepareAction>) => { const q = buildActionPrompt(state, p, ''); return q.system + '\n' + q.user }
    const p = prepareAction(state, { kind: 'free', target: rec.id, text: '一起走吧' })
    expect(text(p)).toContain(`{"type":"join","npc":"${rec.id}"}`)
    expect(text(p)).toContain(`邀請的 DC ${inviteDc(state, rec.id)}`)
    state.pendingAction = undefined
    const alone = prepareAction(state, { kind: 'free', text: '在街上閒晃' })
    expect(text(alone)).not.toContain('"type":"join"')
  })

  it('only takes the action target', () => {
    const state = game()
    const a = stranger(state)
    const b = stranger(state)
    const p = prepareAction(state, { kind: 'free', target: a.id, text: '一起走吧' })
    p.natural = 20
    const j = sanitizeJudgment(state, p, { degree: 'critical', effects: [{ type: 'join', npc: b.id }] })
    expect(j.effects).toEqual([])
    expect(j.notes?.join()).toContain('只有這次行動的對象')
  })
})

describe('inviting people who never take hire', () => {
  it('raises the invite DC for rulers and heads of institutions', () => {
    const state = game()
    const extra = companionRules.invite.unhireable ?? 0
    expect(extra).toBeGreaterThan(0)
    const queen = beside(state, { ...npcRecord(state, 'npc_ithrandil')! })
    const plain = stranger(state)
    setAffinity(state, plain.id, 60)
    setAffinity(state, queen.id, 60)
    const lv = state.party[0]!.level
    const i = companionRules.invite
    const base = (r: NpcRecord) => i.base - Math.floor(60 / i.affinity_step) + i.level_gap * Math.max(0, r.level - lv) + tagDcMod(r, 'invite')
    expect(inviteDc(state, plain.id)).toBe(base(plain))
    expect(inviteDc(state, queen.id)).toBe(base(queen) + extra)
  })
})
