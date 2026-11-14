// 還沒接的特殊任務：冒險筆記的「可以接」與人物的角色線（engine/storyBoard.ts）
import { describe, expect, it } from 'vitest'
import { stories } from '@/engine/data'
import { enterLocation } from '@/engine/grid'
import { guildOf } from '@/engine/guild'
import { npcRecord } from '@/engine/npcs'
import { pcOf } from '@/engine/party'
import { ensureRelationship, setAffinity } from '@/engine/social'
import { newGame } from '@/engine/state'
import { npcLine, storyBoard } from '@/engine/storyBoard'
import { setFlag } from '@/engine/storyFlags'
import type { GameState } from '@/engine/types'

const byTitle = (t: string) => stories.find((d) => d.title === t)!

function game(): GameState {
  const state = newGame({ name: '莉雅', race: 'human', classId: 'bard', seed: 5, birthplace: 'soriel' })
  enterLocation(state)
  pcOf(state).level = 5
  guildOf(state).rank = 'C'
  return state
}

describe('可以接的特殊任務', () => {
  it('沒見過的人的角色線不列；見過之後第一段現在就能接，寫出去哪裡找', () => {
    const state = game()
    const first = byTitle('練習對象')
    expect(storyBoard(state, 'soon').some((e) => e.def.id === first.id)).toBe(false)
    ensureRelationship(state, npcRecord(state, 'npc_lucia')!)
    const e = storyBoard(state, 'soon').find((x) => x.def.id === first.id)!
    expect(e).toMatchObject({ state: 'now', where: '找露西菈（血羽城堡）', line: { npc: 'npc_lucia', index: 1 } })
    // 第二段要先完成第一段（旗標）：還不列
    expect(storyBoard(state, 'soon').some((x) => x.def.id === byTitle('魅魔百態').id)).toBe(false)
  })

  it('前一段完成之後，只差親密度：快要能接，寫出差多少；只顯示現在能接的時不列', () => {
    const state = game()
    ensureRelationship(state, npcRecord(state, 'npc_lucia')!)
    const first = byTitle('練習對象')
    ;(state.stories ??= {})[first.id] = { id: first.id, status: 'completed', done: [], log: [] } as never
    setFlag(state, 'luc_1_done')
    pcOf(state).level = 9
    setAffinity(state, 'npc_lucia', 12)
    const next = byTitle('魅魔百態')
    const e = storyBoard(state, 'soon').find((x) => x.def.id === next.id)!
    expect(e.state).toBe('soon')
    expect(e.needs).toEqual([
      { label: '等級 8', have: '現在 9', ok: true },
      { label: '和露西菈的親密度 20', have: '現在 12', ok: false, ratio: 0.6 },
    ])
    expect(storyBoard(state, 'now').some((x) => x.def.id === next.id)).toBe(false)
    expect(storyBoard(state, 'off')).toEqual([])
    // 親密度到了：現在就能接
    setAffinity(state, 'npc_lucia', 20)
    expect(storyBoard(state, 'soon').find((x) => x.def.id === next.id)?.state).toBe('now')
  })

  it('角色線：完成、可以接、快要能接、之後', () => {
    const state = game()
    ensureRelationship(state, npcRecord(state, 'npc_lucia')!)
    const first = byTitle('練習對象')
    ;(state.stories ??= {})[first.id] = { id: first.id, status: 'completed', done: [], log: [] } as never
    setFlag(state, 'luc_1_done')
    pcOf(state).level = 9
    const line = npcLine(state, 'npc_lucia', 'soon')!
    expect(line.find((x) => x.def.id === first.id)?.status).toBe('done')
    expect(line.find((x) => x.def.id === byTitle('魅魔百態').id)?.status).toBe('soon')
    expect(line.some((x) => x.status === 'locked')).toBe(true)
    // 只顯示現在能接的：快要能接的算在「之後」
    expect(npcLine(state, 'npc_lucia', 'now')!.find((x) => x.def.id === byTitle('魅魔百態').id)?.status).toBe('locked')
    expect(npcLine(state, 'npc_lucia', 'off')).toBeUndefined()
    expect(npcLine(state, 'npc_nobody', 'soon')).toBeUndefined()
  })

  it('公會的任務只列去過的城', () => {
    const state = game()
    const guild = storyBoard(state, 'soon').filter((e) => e.def.start.kind === 'guild')
    expect(guild.length).toBeGreaterThan(0)
    for (const e of guild) expect(!e.def.start.location || e.def.start.location === 'soriel').toBe(true)
    expect(guild.every((e) => e.where.endsWith('冒險者公會'))).toBe(true)
  })
})
