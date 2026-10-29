import { describe, expect, it } from 'vitest'
import { prepareAction, resolveAction } from '@/engine/actions'
import { act, bondShare, currentActor, startCombat } from '@/engine/combat'
import { enterLocation } from '@/engine/grid'
import { npcLewdGain, seduceDcMod } from '@/engine/interactions'
import { lewdOf } from '@/engine/lewd'
import { characterFor, generateNpc, npcRecord } from '@/engine/npcs'
import { pcOf } from '@/engine/party'
import { recordMemory } from '@/engine/social'
import { baseReport } from '@/engine/town'
import { newGame, withRng } from '@/engine/state'
import type { Combatant } from '@/engine/combat'
import type { GameState } from '@/engine/types'

function game(): GameState {
  const state = newGame({ name: '莉雅', race: 'human', classId: 'bard', seed: 3 })
  state.location = 'soriel'
  enterLocation(state)
  return state
}

function someone(state: GameState, lewdness: number, tags = ['commoner']) {
  const rec = withRng(state, (rng) => generateNpc(state, rng, { kind: 'commoner', tags, occupation: '麵包師', haunts: [{ location: state.location, zone: 'town', weight: 1 }] }))
  rec.lewd = { ...rec.lewd, lewdness }
  const p = state.position!
  rec.at = { area: p.area, x: p.x, y: p.y, until: state.time.day }
  return rec
}

describe('誘惑', () => {
  it('對方越淫亂越容易；成功時親密度上升、對方淫亂 +1，之後生成的角色照這個值', () => {
    const state = game()
    const prude = someone(state, 0)
    const wanton = someone(state, 80)
    const d1 = prepareAction(state, { kind: 'seduce', target: prude.id, text: '' }).base_dc
    delete state.pendingAction
    const p = prepareAction(state, { kind: 'seduce', target: wanton.id, text: '' })
    const d2 = p.base_dc
    expect(d1 - d2).toBe(seduceDcMod(characterFor(state, prude)) - seduceDcMod(characterFor(state, wanton)))
    const c = characterFor(state, wanton)
    const mod80 = seduceDcMod(c)
    c.lewd = { ...lewdOf(c), lewdness: 0 }
    expect(seduceDcMod(c) - mod80).toBe(8)
    expect(p.adultScene?.on).toEqual([])
    p.natural = 20
    const r = resolveAction(state, null)
    expect(r.check?.degree).toBe('critical')
    expect(state.relationships![wanton.id]!.affinity).toBe(8)
    expect(lewdOf(characterFor(state, npcRecord(state, wanton.id)!)).lewdness).toBe(81)
    expect(r.changes.lewd?.[0]).toMatchObject({ stat: 'lewdness', delta: 1, after: 81 })
  })

  it('信仰虔誠的人比較難誘惑；固定 NPC 第一次被改時複製進存檔', () => {
    const state = game()
    const rec = someone(state, 0)
    const c = characterFor(state, rec)
    const base = seduceDcMod(c)
    c.attrs.fai = 20
    expect(seduceDcMod(c)).toBe(base + 1)
    const fixed = npcRecord(state, 'npc_park_greeter')!
    expect(state.npcs?.[fixed.id]).toBeUndefined()
    const before = lewdOf(characterFor(state, fixed)).lewdness
    expect(npcLewdGain(state, fixed, 1)).toBe(before < 100 ? 1 : 0)
    expect(state.npcs?.[fixed.id]?.lewd?.lewdness).toBe(Math.min(100, before + 1))
  })

  it('吃獻媚的加值：淫亂高的主角比較容易', () => {
    const state = game()
    const rec = someone(state, 30)
    pcOf(state).lewd = { ...lewdOf(pcOf(state)), lewdness: 85 }
    const p = prepareAction(state, { kind: 'seduce', target: rec.id, text: '' })
    expect(p.situational.some((s) => s.label.startsWith('淫亂') && s.value === 2)).toBe(true)
  })
})

describe('親密度與慾望分擔', () => {
  it('親密度每 25 點，分給對方的慾望少 10%（最多 40%）', () => {
    const pcSide = { lustMods: { pc: true } } as unknown as Combatant
    const ally = (affinity: number) => ({ lustMods: { affinity } }) as unknown as Combatant
    expect(bondShare(pcSide, ally(0))).toBe(0)
    expect(bondShare(pcSide, ally(50))).toBeCloseTo(0.2)
    expect(bondShare(ally(100), pcSide)).toBeCloseTo(0.4)
    expect(bondShare(ally(75), ally(30))).toBeCloseTo(0.1)
    expect(bondShare(pcSide, {} as Combatant)).toBe(0)
  })

  it('隊友開戰時記下對主角的親密度，分擔時傳過去的少一些', () => {
    const state = newGame({ name: '莉雅', race: 'human', classId: 'bard', seed: 11 })
    const pc = pcOf(state)
    pc.abilities.push('lust_spread')
    pc.level = 5
    pc.hp = pc.maxHp = 200
    const mate = characterFor(state, npcRecord(state, 'npc_park_greeter')!)
    mate.id = 'mate'
    mate.affinity = 50
    mate.hp = mate.maxHp = 200
    state.party.push(mate)
    const combat = startCombat(state, [['goblin', 1]])
    const me = combat.combatants.find((c) => c.id === pc.id)!
    const other = combat.combatants.find((c) => c.id === 'mate')!
    expect(me.lustMods?.pc).toBe(true)
    expect(other.lustMods?.affinity).toBe(50)
    for (let i = 0; i < 20 && combat.status === 'ongoing' && currentActor(combat)?.id !== me.id; i++) act(state, { type: 'end_turn' })
    me.lust = 40
    other.lust = 0
    act(state, { type: 'ability', ability: 'lust_spread' })
    // 分出 12，對方只承受 80%
    expect(me.lust).toBe(28)
    expect(other.lust).toBe(10)
  })

  it('一起經歷的慾望勝利記成比較難忘的記憶', () => {
    const state = game()
    const r = baseReport(state, 'combat', 0)
    r.outcome.summary = '擊敗了魅魔。魅魔在高潮中屈服（慾望勝利）。'
    r.outcome.tags = ['慾望勝利']
    expect(recordMemory(state, r)?.importance).toBe(2)
  })
})
