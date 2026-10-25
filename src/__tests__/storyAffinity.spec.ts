import { afterEach, describe, expect, it } from 'vitest'
import { prepareAction, resolveAction } from '@/engine/actions'
import { enterLocation } from '@/engine/grid'
import { applyContent, emptyMods, normalizeMods } from '@/engine/mods'
import { npcRecord } from '@/engine/npcs'
import { newGame } from '@/engine/state'
import { ensureRelationship, setAffinity } from '@/engine/social'
import { failStoryCheck, optionOpen, playNode, startStory, storyAffinity, storyCheckGate } from '@/engine/story'
import { sanitizeStory, storyIssues } from '@/engine/storyMods'
import type { GameState } from '@/engine/types'

afterEach(() => applyContent(emptyMods()))

// 瑟琳的任務最後：邀請她入隊（好感 10 以上才出現；好感換成加值，不到 20 直接失敗），沒過就給一筆錢
const INVITE = sanitizeStory('invite', {
  title: '邀請瑟琳', summary: '一起冒險吧', start: { kind: 'manual' },
  nodes: [{
    id: 'ask', title: '邀請瑟琳入隊', text: '任務告一段落，你想邀請瑟琳同行。', at: { where: 'settlement', location: 'soriel' }, kind: 'choice',
    options: [
      {
        label: '邀請她入隊', requires: { affinity: { npc_selene: 10 } },
        check: { attr: 'cha', dc: 12, affinity: { npc: 'npc_selene', per: 10, max: 5, min: 20 } },
        success: { text: '瑟琳答應了。', effects: [{ type: 'companion', npc: 'npc_selene', mode: 'voluntary' }], complete: true },
        fail: { text: '瑟琳婉拒，塞給你一袋錢當謝禮。', effects: [{ type: 'money', amount: 200 }], complete: true },
      },
      { label: '道別', success: { complete: true } },
    ],
  }],
}, false)

function game(affinity: number): GameState {
  applyContent(normalizeMods({ ...emptyMods(), stories: { invite: INVITE } }))
  const state = newGame({ name: '測試者', race: 'human', classId: 'fighter', seed: 5, birthplace: 'soriel' })
  enterLocation(state)
  ensureRelationship(state, npcRecord(state, 'npc_selene')!)
  setAffinity(state, 'npc_selene', affinity)
  startStory(state, 'invite')
  return state
}
const OPT = 'invite:ask:0'

describe('special quest checks that use affinity', () => {
  it('keeps the fields through sanitizing and checks the referenced NPC exists', () => {
    const o = INVITE.nodes[0]!.options![0]!
    expect(o.requires).toEqual({ affinity: { npc_selene: 10 } })
    expect(o.check?.affinity).toEqual({ npc: 'npc_selene', per: 10, max: 5, min: 20 })
    expect(storyIssues(INVITE).filter((i) => i.includes('不存在'))).toEqual([])
    const bad = sanitizeStory('bad', { ...INVITE, nodes: [{ ...INVITE.nodes[0]!, options: [{ ...o, check: { ...o.check!, affinity: { npc: 'npc_nobody' } } }] }] }, false)
    expect(storyIssues(bad).some((i) => i.includes('npc_nobody'))).toBe(true)
  })

  it('hides the option until the NPC likes you enough', () => {
    const state = game(5)
    expect(optionOpen(state, INVITE.nodes[0]!, 0)).toBe(false)
    expect(optionOpen(state, INVITE.nodes[0]!, 1)).toBe(true)
    expect(() => prepareAction(state, { kind: 'story', target: OPT, text: '' })).toThrow('不能選')
  })

  it('fails without a roll below the threshold and pays the consolation money', () => {
    const state = game(15)
    expect(optionOpen(state, INVITE.nodes[0]!, 0)).toBe(true)
    expect(storyCheckGate(state, OPT)).toContain('不到 20')
    expect(() => prepareAction(state, { kind: 'story', target: OPT, text: '' })).toThrow('沒辦法檢定')
    const money = state.money_cc
    const r = failStoryCheck(state, OPT)
    expect(r.outcome.summary).toContain('沒有擲骰')
    expect(state.money_cc).toBe(money + 200)
    expect(state.stories?.invite?.status).toBe('completed')
    expect(state.party.some((m) => m.id === 'npc_selene')).toBe(false)
  })

  it('adds the affinity bonus to the charisma check and joins on success', () => {
    const state = game(45)
    expect(storyAffinity(state, INVITE.nodes[0]!.options![0]!.check!.affinity!)).toMatchObject({ bonus: 4, blocked: false })
    const p = prepareAction(state, { kind: 'story', target: OPT, text: '請她一起走' })
    expect(p.attr).toBe('cha')
    expect(p.situational).toContainEqual({ label: '瑟琳的好感（45）', value: 4 })
    expect(p.scene).toContain('瑟琳對主角的好感 45')
    state.pendingAction!.natural = 15
    const r = resolveAction(state, null)
    expect(r.check?.degree).toMatch(/success|critical/)
    expect(state.party.find((m) => m.id === 'npc_selene')?.bond).toBe('voluntary')
    expect(r.others?.some((o) => o.id === 'npc_selene') || r.party.some((m) => m.id === 'npc_selene')).toBe(true)
  })

  it('caps the bonus and lets dislike count against you', () => {
    const state = game(15)
    expect(storyAffinity(state, { npc: 'npc_selene', per: 2, max: 3 }).bonus).toBe(3)
    setAffinity(state, 'npc_selene', -25)
    expect(storyAffinity(state, { npc: 'npc_selene' }).bonus).toBe(-2)
    // 選項不檢定時也照條件：好感不夠選不了
    expect(() => playNode(state, 'invite:ask', 0)).toThrow('不能選')
  })
})
